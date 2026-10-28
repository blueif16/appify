// Opens the app on a real phone: a pass-through proxy (the page arrives
// untouched, with no studio emulation) exposed over HTTPS by a quick tunnel.
//
// GET  /api/phone-link        -> current state, with a QR code when sharing
// POST /api/phone-link/start  -> start sharing
// POST /api/phone-link/stop   -> stop sharing
//
// The tunnel is `cloudflared tunnel --url <local>` unless APPIFY_TUNNEL_CMD is
// set; that command runs in a shell with {url} replaced by the local address
// and must print the public https URL.
import { spawn, spawnSync } from 'node:child_process';
import QRCode from 'qrcode';
import { createProxy } from '../proxy.js';

const URL_TIMEOUT = 40_000;
// The tunnel runs under a small shell that kills it as soon as the studio's
// end of its stdin pipe closes, which happens however the studio exits, even
// on kill -9, so a tunnel never outlives the studio.
const WATCHDOG = 'exec 3<&0; "$@" & pid=$!; (read _ <&3; kill 0) & wait $pid; kill 0';
const QUICK_TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const ANY_HTTPS_URL = /https:\/\/[^\s|"'<>]+/i;

export default async function create(ctx) {
  // status: off | starting | on | missing | error
  let link = { status: 'off' };
  let server = null;
  let child = null;

  const customCommand = process.env.APPIFY_TUNNEL_CMD;
  const hasCloudflared = () =>
    Boolean(customCommand) || spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).error?.code !== 'ENOENT';

  function killTunnel() {
    if (!child) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
    child = null;
  }

  // Ctrl+C or a kill must take the tunnel down with the studio.
  const onExit = () => killTunnel();
  const onSignal = (signal) => {
    killTunnel();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };

  async function stop() {
    killTunnel();
    process.off('exit', onExit);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    if (server) {
      server.closeAllConnections?.();
      server.close();
      server = null;
    }
    link = { status: 'off' };
  }

  async function start() {
    if (link.status === 'starting' || link.status === 'on') return;
    if (!ctx.getTarget()) {
      link = { status: 'error', error: 'Choose an app first, then share it.' };
      return;
    }
    if (!hasCloudflared()) {
      link = { status: 'missing' };
      return;
    }

    server = createProxy({ getTarget: ctx.getTarget, passThrough: true });
    const port = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
    const local = `http://127.0.0.1:${port}`;
    link = { status: 'starting', local };

    const command = customCommand
      ? ['sh', '-c', customCommand.replaceAll('{url}', local)]
      : ['cloudflared', 'tunnel', '--no-autoupdate', '--url', local];
    child = spawn('sh', ['-c', WATCHDOG, 'sh', ...command], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    process.on('exit', onExit);
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    const started = child;
    let output = '';
    const timer = setTimeout(() => {
      if (link.status !== 'starting' || child !== started) return;
      stop().then(() => {
        link = { status: 'error', error: "The tunnel didn't give a link within 40 seconds. Check your internet connection and try again." };
      });
    }, URL_TIMEOUT);

    const read = async (chunk) => {
      if (link.status !== 'starting' || child !== started) return;
      output = (output + chunk).slice(-4000);
      const match = output.match(QUICK_TUNNEL_URL) ?? (customCommand ? output.match(ANY_HTTPS_URL) : null);
      if (!match) return;
      clearTimeout(timer);
      const url = match[0];
      const qr = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
      if (child === started) link = { status: 'on', url, qr, local };
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('error', (err) => {
      clearTimeout(timer);
      if (child !== started) return;
      stop().then(() => (link = { status: 'error', error: `The tunnel couldn't start: ${err.message}` }));
    });
    child.on('exit', () => {
      clearTimeout(timer);
      if (child !== started) return;
      const last = output.trim().split('\n').pop()?.slice(0, 200) ?? '';
      child = null;
      stop().then(() => (link = { status: 'error', error: `The tunnel stopped.${last ? ` Last message: ${last}` : ''}` }));
    });
  }

  return async (req, res, url) => {
    if (!url.pathname.startsWith('/api/phone-link')) return false;
    if (req.method === 'POST' && url.pathname === '/api/phone-link/start') await start();
    else if (req.method === 'POST' && url.pathname === '/api/phone-link/stop') await stop();
    else if (url.pathname !== '/api/phone-link') return false;
    ctx.json(res, link);
    return true;
  };
}
