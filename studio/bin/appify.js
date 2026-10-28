#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { normalizeTarget, startStudio } from '../src/server.js';
import { readComments, updateComment } from '../src/comments.js';
import { capture } from '../src/capture.js';
import {
  createCheckpoint,
  getCheckpoint,
  listCheckpoints,
  readConfig,
  restoreCheckpoint,
  studioState,
} from '../src/checkpoints.js';

const HELP = `Usage:
  appify studio [app-url] [--port 4747] [--no-open]
      Opens the studio: your web app on desktop and phones, side by side.
      With no app URL, it looks for a dev server on the usual local ports.
      The first time, it saves the app as checkpoint v1 · Original.

  appify snapshot [--pages / /submit.html] [--shots] [--url app-url]
      Prints structured facts for each device and page as JSON, one object
      per line: overflow, small tap targets and form fields, hover-only CSS,
      fixed elements, things under the notch or home indicator, and the
      page's head tags (viewport, theme color, manifest, share tags).
      --shots also saves framed screenshots under .appify/snapshots/.

  appify checkpoint "label" [--note "…"] [--pages / /submit.html]
      Saves the code, framed screenshots and facts as the next version.

  appify history
      Lists the checkpoints.

  appify restore vN
      Saves the current code as a checkpoint, then puts the files back the
      way they were at vN (files added since are removed).

  appify comments [--all]
      Prints the open comments left in the studio, as JSON (--all includes
      resolved ones). Reads .appify/comments.json in the current directory.

  appify comments resolve <id>...
      Marks comments as resolved, e.g. appify comments resolve c3 c4

Snapshot, checkpoint and restore use the devices last shown in the studio and
start their own studio in the background; the app's dev server must be
running (--url, or the app the studio last opened).`;

const COMMON_PORTS = [5173, 3000, 3001, 4321, 5174, 8080, 8000, 4200, 5000, 8888];
const VALUE_FLAGS = new Set(['--port', '--note', '--url']);
const LIST_FLAGS = new Set(['--pages']);

const { positional, flags } = parseArgs(process.argv.slice(2));
if (flags['-h'] || flags['--help']) {
  console.log(HELP);
  process.exit(0);
}

const cwd = process.cwd();
const command = positional[0];
const COMMANDS = { comments, snapshot, checkpoint, history, restore };
if (COMMANDS[command]) {
  try {
    process.exitCode = await COMMANDS[command](positional.slice(1));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
  process.exit();
}
if (command === 'studio') positional.shift();

const port = Number(flags['--port'] ?? 4747);
const target = positional[0] ? normalizeTarget(positional[0]) : await findDevServer();
const { studioPort } = await startStudio({ target, port });
const url = `http://localhost:${studioPort}`;

console.log(`
  appify studio   ${url}
  previewing      ${target ?? 'nothing yet. Choose your app in the studio.'}
`);
if (!flags['--no-open']) openBrowser(url);

// One comment per line: valid JSON that stays cheap for an agent to read.
async function comments([action, ...ids]) {
  if (!action) {
    const all = await readComments(cwd);
    const shown = flags['--all'] ? all : all.filter((c) => c.status === 'open');
    console.log(jsonLines(shown));
    return 0;
  }
  if (action === 'resolve' && ids.length) {
    let failed = 0;
    for (const id of ids) {
      const comment = await updateComment(cwd, id, { status: 'resolved' });
      if (comment) console.log(`Resolved ${id}: ${comment.text}`);
      else {
        console.error(`No comment ${id} in .appify/comments.json.`);
        failed = 1;
      }
    }
    return failed;
  }
  console.error(HELP);
  return 1;
}

async function snapshot() {
  const { studioUrl, state } = await backgroundStudio();
  const shots = Boolean(flags['--shots']);
  const outDir = shots ? path.join(cwd, '.appify', 'snapshots', new Date().toISOString().replace(/[:.]/g, '-')) : null;
  const result = await capture({ studioUrl, state, pages: pagesFlag(state), outDir, shots });
  const rel = outDir ? path.relative(cwd, outDir) : null;
  console.log(jsonLines(result.facts.map((f) => (f.shot ? { ...f, shot: path.join(rel, f.shot) } : f))));
  return 0;
}

async function checkpoint([label]) {
  if (!label) {
    console.error('Give the checkpoint a label, e.g. appify checkpoint "Bottom tab bar"');
    return 1;
  }
  const { studioUrl, state } = await backgroundStudio({ requireApp: false });
  const meta = await createCheckpoint(cwd, {
    label,
    note: flags['--note'] ?? '',
    by: 'agent',
    pages: flags['--pages'],
    studioUrl,
    state,
  });
  console.log(describe(meta));
  if (meta.captureError) console.log(`  code saved, no screenshots: ${meta.captureError}`);
  return 0;
}

async function history() {
  const list = await listCheckpoints(cwd);
  if (!list.length) console.log('No checkpoints yet. Open the studio, or run appify checkpoint "label".');
  for (const meta of list) console.log(describe(meta));
  return 0;
}

async function restore([id]) {
  if (!id || !(await getCheckpoint(cwd, id))) {
    console.error(id ? `No checkpoint ${id}. See appify history.` : 'Which checkpoint? e.g. appify restore v2');
    return 1;
  }
  const { studioUrl, state } = await backgroundStudio({ requireApp: false });
  const { restored, backup } = await restoreCheckpoint(cwd, id, { by: 'agent', studioUrl, state });
  console.log(`Restored ${restored}. The code before it is saved as ${backup.id} · ${backup.label}.`);
  return 0;
}

// A studio of our own on a free port, showing the devices last used in the
// studio, for captures. It goes away when this command exits.
async function backgroundStudio({ requireApp = true } = {}) {
  process.env.APPIFY_INTERNAL = '1'; // no automatic v1 from this instance
  const config = await readConfig(cwd);
  const app = flags['--url'] ? normalizeTarget(flags['--url']) : (config.target ?? (await findDevServer()));
  const up = app && (await reachable(app));
  if (!up && requireApp) {
    throw new Error(
      app ? `Can't reach ${app}. Start the app's dev server first, or pass --url.` : 'No app found. Start its dev server, or pass --url http://localhost:3000.',
    );
  }
  if (!up) return { studioUrl: null, state: null };
  const { studioPort } = await startStudio({ target: app, port: 49200 + Math.floor(Math.random() * 600), cwd });
  return { studioUrl: `http://127.0.0.1:${studioPort}`, state: await studioState(cwd) };
}

function pagesFlag(state) {
  const pages = flags['--pages'];
  return Array.isArray(pages) && pages.length ? pages : [state.path ?? '/'];
}

function describe(meta) {
  const c = meta.changes ?? {};
  const shots = meta.shots?.length ? ` · ${meta.shots.length} screenshots` : '';
  return `${meta.id} · ${meta.label} · ${meta.by} · ${meta.createdAt.slice(0, 16).replace('T', ' ')} · ${c.files ?? 0} files +${c.insertions ?? 0} −${c.deletions ?? 0}${shots}`;
}

function jsonLines(items) {
  return items.length ? `[\n${items.map((item) => JSON.stringify(item)).join(',\n')}\n]` : '[]';
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) flags[arg] = argv[++i];
    else if (LIST_FLAGS.has(arg)) {
      flags[arg] = [];
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[arg].push(argv[++i]);
    } else if (arg.startsWith('-')) flags[arg] = true;
    else positional.push(arg);
  }
  return { positional, flags };
}

async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
    return true;
  } catch {
    return false;
  }
}

async function findDevServer() {
  const found = await Promise.all(
    COMMON_PORTS.map(async (candidate) => {
      try {
        await fetch(`http://localhost:${candidate}/`, { signal: AbortSignal.timeout(800), redirect: 'manual' });
        return candidate;
      } catch {
        return null;
      }
    }),
  );
  const first = found.find(Boolean);
  return first ? `http://localhost:${first}/` : null;
}

function openBrowser(url) {
  let wsl = false;
  try {
    wsl = process.platform === 'linux' && /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {}
  const [opener, openerArgs] = wsl
    ? ['explorer.exe', [url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['explorer', [url]]
        : ['xdg-open', [url]];
  spawn(opener, openerArgs, { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref();
}
