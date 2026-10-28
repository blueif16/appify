// Checkpoints: numbered versions of the user's app. Each one stores the code
// (as a commit in a private shadow repo, .appify/history.git, which never
// touches the project's own .git, index or branches), framed device
// screenshots and structured page facts (.appify/checkpoints/vN/).
//
// .appify/config.json remembers the last target URL and the studio's window
// setup, so checkpoints made from the CLI show the same devices.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEVICES } from './devices.js';
import { capture } from './capture.js';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
// Never versioned, on top of the project's own .gitignore files.
const EXCLUDE = ['.appify/', 'node_modules/', '.next/', '.nuxt/', '.svelte-kit/', '.output/', '.turbo/', '.vercel/', '.cache/'];
const STUDIO_KEYS = ['windows', 'mode', 'path', 'orientation', 'appearance'];
const DEFAULT_STUDIO = {
  windows: [
    { key: 1, device: 'desktop', minimized: false },
    { key: 2, device: 'iphone-16', minimized: false },
  ],
  mode: 'browser',
  path: '/',
  orientation: 'portrait',
  appearance: 'system',
};

const appifyDir = (cwd) => path.join(cwd, '.appify');
const gitDir = (cwd) => path.join(appifyDir(cwd), 'history.git');
const checkpointsDir = (cwd) => path.join(appifyDir(cwd), 'checkpoints');
const configFile = (cwd) => path.join(appifyDir(cwd), 'config.json');
export const checkpointDir = (cwd, id) => path.join(checkpointsDir(cwd), id);

// ---- Config -------------------------------------------------------------

export async function readConfig(cwd) {
  try {
    return JSON.parse(await readFile(configFile(cwd), 'utf8'));
  } catch {
    return {};
  }
}

export async function writeConfig(cwd, patch) {
  const next = { ...(await readConfig(cwd)), ...patch, updatedAt: new Date().toISOString() };
  await writeJson(configFile(cwd), next);
  return next;
}

export const pickStudioState = (state = {}) =>
  Object.fromEntries(STUDIO_KEYS.filter((key) => state[key] !== undefined).map((key) => [key, state[key]]));

// The studio state a capture should use: the saved one (or the given
// override) with unknown devices dropped.
export async function studioState(cwd, override) {
  const saved = override ?? (await readConfig(cwd)).studio ?? {};
  const state = { ...DEFAULT_STUDIO, ...pickStudioState(saved) };
  state.windows = Array.isArray(state.windows) ? state.windows.filter((win) => DEVICES[win?.device]) : [];
  if (!state.windows.some((win) => !win.minimized)) state.windows = DEFAULT_STUDIO.windows;
  return state;
}

// ---- Listing ------------------------------------------------------------

export async function listCheckpoints(cwd) {
  let names;
  try {
    names = await readdir(checkpointsDir(cwd));
  } catch {
    return [];
  }
  const metas = await Promise.all(
    names.filter((name) => /^v\d+$/.test(name)).map((name) => getCheckpoint(cwd, name)),
  );
  return metas.filter(Boolean).sort((a, b) => a.n - b.n);
}

export async function getCheckpoint(cwd, id) {
  if (!/^v\d+$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(checkpointDir(cwd, id), 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

// ---- Creating and restoring ----------------------------------------------

// One checkpoint or restore at a time per process.
let queue = Promise.resolve();
const serial = (fn) => {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
};

// Saves the code, then captures screenshots and facts through the studio at
// studioUrl. If the capture fails (app not running), the code is still saved
// and meta.captureError says why.
export function createCheckpoint(cwd, options) {
  return serial(() => create(cwd, options));
}

async function create(cwd, { label, note = '', by = 'user', pages, studioUrl, state, log = () => {} }) {
  const existing = await listCheckpoints(cwd);
  const n = Math.max(0, ...existing.map((meta) => meta.n)) + 1;
  const id = `v${n}`;
  const previous = existing.at(-1) ?? null;
  const title = String(label ?? '').trim().slice(0, 120) || `Checkpoint ${n}`;

  await ensureRepo(cwd);
  const commit = await snapshotCode(cwd, `${id} · ${title}`, previous?.commit);
  await git(cwd, ['update-ref', `refs/appify/${id}`, commit]);
  const changes = await diffStat(cwd, previous?.commit ?? EMPTY_TREE, commit);

  const dir = checkpointDir(cwd, id);
  await mkdir(dir, { recursive: true });
  const settings = { mode: state?.mode ?? 'browser', orientation: state?.orientation ?? 'portrait', appearance: state?.appearance ?? 'system' };
  let shots = [];
  let facts = null;
  let captureError;
  if (studioUrl && state) {
    try {
      const result = await capture({
        studioUrl,
        state,
        pages: pages?.length ? pages : [state.path ?? '/'],
        outDir: dir,
        log,
      });
      shots = result.shots;
      await writeJson(path.join(dir, 'facts.json'), result.facts);
      facts = 'facts.json';
    } catch (err) {
      captureError = err.message;
    }
  } else {
    captureError = 'No studio to capture from.';
  }

  const meta = {
    id,
    n,
    label: title,
    note: String(note ?? ''),
    by: by === 'agent' ? 'agent' : 'user',
    createdAt: new Date().toISOString(),
    commit,
    parent: previous?.id ?? null,
    changes,
    settings,
    shots,
    facts,
    ...(captureError ? { captureError } : {}),
  };
  await writeJson(path.join(dir, 'meta.json'), meta);
  return meta;
}

// Saves a "Before restoring vN" checkpoint, then makes the project's files
// match vN: changed files go back, files added since are deleted. Ignored
// files (.gitignore, node_modules, .appify) are never touched.
export function restoreCheckpoint(cwd, id, options) {
  return serial(async () => {
    const target = await getCheckpoint(cwd, id);
    if (!target) throw new Error(`No checkpoint ${id}.`);
    const backup = await create(cwd, { ...options, label: `Before restoring ${id}` });
    await git(cwd, ['read-tree', '--reset', '-u', target.commit]);
    return { restored: id, backup };
  });
}

// ---- Shadow repo ----------------------------------------------------------

async function ensureRepo(cwd) {
  const dir = gitDir(cwd);
  if (!existsSync(path.join(dir, 'HEAD'))) {
    await mkdir(dir, { recursive: true });
    await git(cwd, ['init', '--quiet']);
    await git(cwd, ['config', 'core.autocrlf', 'false']);
    await git(cwd, ['config', 'gc.auto', '0']);
  }
  await mkdir(path.join(dir, 'info'), { recursive: true });
  await writeFile(path.join(dir, 'info', 'exclude'), `${EXCLUDE.join('\n')}\n`);
}

async function snapshotCode(cwd, message, parent) {
  await git(cwd, ['add', '--all', '--', '.']);
  const tree = (await git(cwd, ['write-tree'])).trim();
  const args = ['commit-tree', '--no-gpg-sign', ...(parent ? ['-p', parent] : []), '-m', message, tree];
  return (await git(cwd, args)).trim();
}

async function diffStat(cwd, from, to) {
  const out = await git(cwd, ['diff-tree', '--numstat', '-r', '--no-renames', from, to]);
  const rows = out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
  return {
    files: rows.length,
    insertions: rows.reduce((sum, [ins]) => sum + (Number(ins) || 0), 0),
    deletions: rows.reduce((sum, [, del]) => sum + (Number(del) || 0), 0),
    list: rows.slice(0, 50).map(([, , file]) => file),
  };
}

// Runs git against the shadow repo only. Its own index lives inside
// history.git, so the project's .git and index are never read or written.
function git(cwd, args) {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR']) delete env[key];
  Object.assign(env, {
    GIT_INDEX_FILE: path.join(gitDir(cwd), 'index'),
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'appify',
    GIT_AUTHOR_EMAIL: 'appify@localhost',
    GIT_COMMITTER_NAME: 'appify',
    GIT_COMMITTER_EMAIL: 'appify@localhost',
  });
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['--git-dir', gitDir(cwd), '--work-tree', cwd, ...args],
      { cwd, env, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => (err ? reject(new Error(`git ${args[0]} failed: ${(stderr || err.message).trim()}`)) : resolve(stdout)),
    );
  });
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${file}.tmp`, file);
}
