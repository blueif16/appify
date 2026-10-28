// Checkpoints API for the studio UI.
//   GET  /api/checkpoints                     -> { checkpoints: [meta…] }, oldest first
//   POST /api/checkpoints  { label, note?, by?, pages?, state? } -> meta (waits for the capture)
//   GET  /api/checkpoints/vN                  -> meta
//   GET  /api/checkpoints/vN/files/<file>     -> a screenshot or facts.json
//   POST /api/checkpoints/vN/restore          -> { restored, backup }
//   POST /api/studio-state { windows, mode, path, orientation, appearance }
//
// When the studio starts in a project with no checkpoints, "v1 · Original" is
// saved as soon as the app is reachable.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { network } from '../proxy.js';
import {
  checkpointDir,
  createCheckpoint,
  getCheckpoint,
  listCheckpoints,
  pickStudioState,
  readConfig,
  restoreCheckpoint,
  studioState,
  writeConfig,
} from '../checkpoints.js';

export default async function checkpointRoutes(ctx) {
  const { cwd, json, readBody } = ctx;
  const studioUrl = () => `http://${ctx.host === '0.0.0.0' ? '127.0.0.1' : ctx.host}:${ctx.studioPort()}`;

  // Captures load this studio in a headless browser, which resets the network
  // setting to full speed; put the user's back afterwards.
  const withCapture = async (fn) => {
    const previous = network.profile;
    try {
      return await fn({ studioUrl: studioUrl() });
    } finally {
      network.profile = previous;
    }
  };

  const target = ctx.getTarget();
  if (target) await writeConfig(cwd, { target: target.href }).catch(() => {});
  if (!process.env.APPIFY_INTERNAL) saveOriginal();

  async function saveOriginal() {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // let the other routes load first
    if ((await listCheckpoints(cwd)).length) return;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const url = ctx.getTarget();
      if (url && (await reachable(url))) {
        if ((await listCheckpoints(cwd)).length) return;
        try {
          const state = await studioState(cwd);
          const meta = await withCapture(({ studioUrl }) =>
            createCheckpoint(cwd, { label: 'Original', by: 'user', studioUrl, state }),
          );
          console.log(`  appify: saved ${meta.id} · ${meta.label}${meta.captureError ? ` (code only: ${meta.captureError})` : ''}`);
        } catch (err) {
          console.error(`  appify: couldn't save the original version: ${err.message}`);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  return async (req, res, url) => {
    if (url.pathname === '/api/studio-state') {
      if (req.method === 'GET') return json(res, (await readConfig(cwd)).studio ?? {}), true;
      if (req.method !== 'POST') return json(res, { error: 'Not supported.' }, 405), true;
      // Captures open the studio with ?capture=1; their state isn't the user's.
      if ((req.headers.referer ?? '').includes('capture=1')) return json(res, { ignored: true }), true;
      try {
        const body = JSON.parse(await readBody(req));
        const config = await writeConfig(cwd, { target: ctx.getTarget()?.href ?? null, studio: pickStudioState(body) });
        json(res, config.studio);
      } catch (err) {
        json(res, { error: err.message }, 400);
      }
      return true;
    }

    const match = url.pathname.match(/^\/api\/checkpoints(?:\/(v\d+)(?:\/(restore|files\/([\w.-]+)))?)?$/);
    if (!match) return false;
    const [, id, action, file] = match;

    try {
      if (!id && req.method === 'GET') {
        json(res, { checkpoints: await listCheckpoints(cwd) });
      } else if (!id && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const state = await studioState(cwd, body.state ? pickStudioState(body.state) : undefined);
        const meta = await withCapture(({ studioUrl }) =>
          createCheckpoint(cwd, {
            label: body.label,
            note: body.note,
            by: body.by,
            pages: Array.isArray(body.pages) ? body.pages : undefined,
            studioUrl,
            state,
          }),
        );
        json(res, meta, 201);
      } else if (id && !action && req.method === 'GET') {
        const meta = await getCheckpoint(cwd, id);
        meta ? json(res, meta) : json(res, { error: `No checkpoint ${id}.` }, 404);
      } else if (id && file && req.method === 'GET') {
        await sendFile(res, path.join(checkpointDir(cwd, id), file));
      } else if (id && action === 'restore' && req.method === 'POST') {
        if (!(await getCheckpoint(cwd, id))) return json(res, { error: `No checkpoint ${id}.` }, 404), true;
        const state = await studioState(cwd);
        json(res, await withCapture(({ studioUrl }) => restoreCheckpoint(cwd, id, { by: 'user', studioUrl, state })));
      } else {
        json(res, { error: 'Not supported.' }, 405);
      }
    } catch (err) {
      json(res, { error: err.message }, 500);
    }
    return true;
  };
}

async function sendFile(res, file) {
  if (file.includes('..')) throw new Error('Bad file name.');
  try {
    const info = await stat(file);
    const type = file.endsWith('.png') ? 'image/png' : file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'content-length': info.size, 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
    return true;
  } catch {
    return false;
  }
}
