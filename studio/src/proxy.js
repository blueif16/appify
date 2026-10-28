// Serves the user's app to the studio's frames. It removes headers that block
// framing, swaps env(safe-area-inset-*) for variables the studio sets per
// phone, and injects frame.js into every page.
//
// With passThrough it only relays: same host, origin and redirect handling and
// WebSockets, but no frame script, no safe-area rewrite and no slow network.
// That is what a real phone gets through the phone link.

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import zlib from 'node:zlib';
import { Transform } from 'node:stream';

export const FRAME_SCRIPT_URL = '/__appify/frame.js';

const TEXT =
  /^(text\/html|text\/css|text\/javascript|application\/javascript|application\/x-javascript|application\/ecmascript)\b/i;
const SAFE_AREA = /\b(?:env|constant)\(\s*safe-area-inset-(top|right|bottom|left)/g;
const SIDES = ['top', 'right', 'bottom', 'left'];
const INSET_DEFAULTS = `:root{${SIDES.map((side) => `--appify-safe-area-inset-${side}:0px`).join(';')}}`;
const INJECT = `<style id="appify-insets">${INSET_DEFAULTS}</style><script src="${FRAME_SCRIPT_URL}"></script>`;

// Network conditions for the studio's frames, set from the studio (see
// routes/network.js). null means no throttling.
export const NETWORK_PROFILES = {
  fast: null,
  'slow-4g': { latency: 150, bitsPerSecond: 1.6e6 },
};
export const network = { profile: 'fast' };

export function createProxy({ getTarget, frameScript, passThrough = false }) {
  const server = http.createServer(async (req, res) => {
    if (!passThrough && req.url.split('?')[0] === FRAME_SCRIPT_URL) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(frameScript());
      return;
    }
    const target = getTarget();
    if (!target) return waiting(res, null);
    const conditions = passThrough ? null : NETWORK_PROFILES[network.profile];
    if (conditions) await sleep(conditions.latency);
    forward(req, res, target, { passThrough, conditions });
  });
  server.on('upgrade', (req, socket, head) => tunnel(req, socket, head, getTarget()));
  return server;
}

function forward(req, res, target, options) {
  // Behind an HTTPS tunnel the page's own origin is https.
  const proto = req.headers['x-forwarded-proto']?.split(',')[0].trim() || 'http';
  const self = `${proto}://${req.headers.host}`;
  const headers = { ...req.headers, host: target.host, 'accept-encoding': 'identity' };
  if (headers.origin) headers.origin = target.origin;
  if (headers.referer) headers.referer = headers.referer.replace(self, target.origin);

  const secure = target.protocol === 'https:';
  const upstream = (secure ? https : http).request(
    {
      hostname: bareHost(target),
      port: target.port || (secure ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
      rejectUnauthorized: !isLocal(target),
    },
    (up) => respond(req, res, up, target, self, options),
  );
  upstream.on('error', () => (res.headersSent ? res.destroy() : waiting(res, target)));
  req.pipe(upstream);
}

function respond(req, res, up, target, self, { passThrough, conditions }) {
  const headers = { ...up.headers };
  delete headers['x-frame-options'];
  delete headers['content-security-policy'];
  delete headers['strict-transport-security'];
  if (headers.location) headers.location = swapOrigin(headers.location, target, self);
  if (headers['set-cookie']) {
    headers['set-cookie'] = headers['set-cookie'].map((cookie) => cookie.replace(/;\s*domain=[^;]*/gi, ''));
  }

  const type = headers['content-type'] ?? '';
  const empty = req.method === 'HEAD' || up.statusCode === 204 || up.statusCode === 304;
  if (empty || !TEXT.test(type)) {
    res.writeHead(up.statusCode, headers);
    if (conditions) up.pipe(throttle(conditions)).pipe(res);
    else up.pipe(res);
    return;
  }

  const chunks = [];
  up.on('data', (chunk) => chunks.push(chunk));
  up.on('error', () => res.destroy());
  up.on('end', () => {
    let text = decode(Buffer.concat(chunks), headers['content-encoding']).toString('utf8');
    delete headers['content-encoding'];
    delete headers['transfer-encoding'];

    text = swapOrigin(text, target, self);
    if (!passThrough) {
      text = text.replace(SAFE_AREA, 'var(--appify-safe-area-inset-$1');
      // Only whole pages get the frame script; HTML fragments fetched by the
      // app (htmx, Turbo and the like) are left alone.
      const dest = req.headers['sec-fetch-dest'];
      const isPage = dest === 'document' || dest === 'iframe' || (!dest && /<html[\s>]/i.test(text));
      if (/^text\/html/i.test(type) && isPage) text = inject(text);
    }

    const body = Buffer.from(text);
    headers['content-length'] = body.length;
    res.writeHead(up.statusCode, headers);
    if (!conditions) return res.end(body);
    const slow = throttle(conditions);
    slow.pipe(res);
    slow.end(body);
  });
}

function inject(html) {
  const at = html.match(/<head\b[^>]*>/i) ?? html.match(/<html\b[^>]*>/i) ?? html.match(/<!doctype[^>]*>/i);
  if (!at) return INJECT + html;
  const end = at.index + at[0].length;
  return html.slice(0, end) + INJECT + html.slice(end);
}

// WebSockets (dev-server hot reload) pass straight through.
function tunnel(req, socket, head, target) {
  if (!target) return socket.destroy();
  const secure = target.protocol === 'https:';
  const host = bareHost(target);
  const port = Number(target.port) || (secure ? 443 : 80);
  const upstream = secure
    ? tls.connect({ host, port, servername: host, rejectUnauthorized: !isLocal(target) })
    : net.connect({ host, port });
  const close = () => {
    socket.destroy();
    upstream.destroy();
  };

  upstream.once(secure ? 'secureConnect' : 'connect', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i];
      const lower = name.toLowerCase();
      const value = lower === 'host' ? target.host : lower === 'origin' ? target.origin : req.rawHeaders[i + 1];
      lines.push(`${name}: ${value}`);
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on('error', close);
  socket.on('error', close);
}

function waiting(res, target) {
  const message = target
    ? `Can't reach ${escapeHtml(target.host)} yet. Start your dev server and this view loads it.`
    : 'Choose an app to preview.';
  res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Waiting for your app</title>
<style>
  html { height: 100%; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    background: #eef2f0; color: #3d4f48; font: 15px/1.5 system-ui, sans-serif; text-align: center; }
</style>
<p>${message}</p>
<script>setTimeout(() => location.reload(), 1500)</script>`);
}

// All throttled responses share one line, so parallel requests slow each
// other down the way they do on a real connection.
const SLICE = 16 * 1024;
let lineFreeAt = 0;

function throttle({ bitsPerSecond }) {
  return new Transform({
    transform(chunk, _encoding, done) {
      const slices = [];
      for (let i = 0; i < chunk.length; i += SLICE) slices.push(chunk.subarray(i, i + SLICE));
      const next = () => {
        const slice = slices.shift();
        if (!slice) return done();
        const now = Date.now();
        lineFreeAt = Math.max(now, lineFreeAt) + (slice.length * 8 * 1000) / bitsPerSecond;
        setTimeout(() => {
          this.push(slice);
          next();
        }, lineFreeAt - now);
      };
      next();
    },
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decode(buffer, encoding = '') {
  switch (encoding.trim()) {
    case 'gzip':
    case 'x-gzip':
      return zlib.gunzipSync(buffer);
    case 'br':
      return zlib.brotliDecompressSync(buffer);
    case 'deflate':
      return zlib.inflateSync(buffer);
    case 'zstd':
      return zlib.zstdDecompressSync(buffer);
    default:
      return buffer;
  }
}

const swapOrigin = (text, target, self) => text.split(target.origin).join(self);
const bareHost = (url) => url.hostname.replace(/^\[|\]$/g, '');
const isLocal = (url) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost');
const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
