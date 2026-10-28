import http from 'node:http';
import path from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createProxy } from './proxy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(here, '../ui');
const FRAME = path.join(here, '../frame');
const ROUTES = path.join(here, 'routes');
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Accepts "5173", "localhost:3000" or a full URL.
export function normalizeTarget(input) {
  const value = String(input ?? '').trim();
  if (/^\d+$/.test(value)) return new URL(`http://localhost:${value}`).href;
  return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`).href;
}

// Every file in frame/, in name order, as one script.
const frameScript = () =>
  readdirSync(FRAME)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => readFileSync(path.join(FRAME, name), 'utf8'))
    .join('\n;\n');

const listJs = (dir) => {
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.js')).sort();
  } catch {
    return [];
  }
};

// Starts the studio UI and, on the next free port, the proxy its frames load.
//
// Each module in src/routes/ adds API routes. It default-exports
// `async (ctx) => handler`, where handler(req, res, url) returns true when it
// answered the request. ctx gives it the current target, the ports, the
// project directory (cwd) and readBody/json helpers.
export async function startStudio({ target = null, port = 4747, host = '127.0.0.1', cwd = process.cwd() } = {}) {
  let current = target ? new URL(target) : null;
  let proxyPort;
  let studioPort;

  const proxy = createProxy({ getTarget: () => current, frameScript });

  const ctx = {
    cwd,
    host,
    getTarget: () => current,
    proxyPort: () => proxyPort,
    studioPort: () => studioPort,
    readBody,
    json,
  };
  const routes = [];

  const studio = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://studio');
    const { pathname } = url;

    if (pathname === '/api/state') return json(res, { target: current?.href ?? null, proxyPort });
    if (pathname === '/api/features') return json(res, listJs(path.join(UI, 'features')).map((f) => `/features/${f}`));
    if (pathname === '/api/target' && req.method === 'POST') {
      try {
        const { url: next } = JSON.parse(await readBody(req));
        current = new URL(normalizeTarget(next));
        return json(res, { target: current.href, proxyPort });
      } catch {
        return json(res, { error: "That isn't a URL the studio can open. Try http://localhost:3000." }, 400);
      }
    }
    for (const route of routes) {
      if (await route(req, res, url)) return;
    }

    const file =
      pathname === '/'
        ? path.join(UI, 'index.html')
        : pathname === '/devices.js'
          ? path.join(here, 'devices.js')
          : path.join(UI, path.normalize(pathname));
    if (!file.startsWith(UI) && file !== path.join(here, 'devices.js')) return notFound(res);
    try {
      const body = await readFile(file);
      const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      notFound(res);
    }
  });

  studioPort = await listen(studio, port, host);
  proxyPort = await listen(proxy, studioPort + 1, host);
  for (const name of listJs(ROUTES)) {
    const { default: create } = await import(pathToFileURL(path.join(ROUTES, name)).href);
    routes.push(await create(ctx));
  }
  return { studioPort, proxyPort };
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const attempt = (candidate) => {
      server.once('error', (err) =>
        err.code === 'EADDRINUSE' && candidate < port + 20 ? attempt(candidate + 1) : reject(err),
      );
      server.listen(candidate, host, () => {
        server.removeAllListeners('error');
        resolve(candidate);
      });
    };
    attempt(port);
  });
}

function json(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
