// "On my phone": share a temporary HTTPS link and show it as a QR code, so the
// app can be opened on a real iPhone or Android. See src/routes/phone-link.js.
import { studio } from '/hooks.js';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = '/features/phone-link.css';
document.head.append(stylesheet);

const ICON =
  '<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="1.65" y=".65" width="7.7" height="14.7" rx="1.4"/><path d="M4.3 2.6h2.4"/><rect x="11.65" y="4.65" width="5.7" height="5.7"/><path d="M13.6 6.6h1.8v1.8h-1.8z" fill="currentColor" stroke="none"/></svg>';

const panel = document.createElement('section');
panel.className = 'panel phone-link';
panel.setAttribute('aria-label', 'Open on your phone');
panel.innerHTML = `
  <button type="button" class="phone-link-button" aria-haspopup="dialog" aria-expanded="false">
    ${ICON}<span>On my phone</span>
  </button>
  <div class="phone-link-pop panel" role="dialog" aria-label="Open on your phone" hidden></div>`;
studio.addPanel('bottom', panel, 10);

const button = panel.querySelector('.phone-link-button');
const label = button.querySelector('span');
const pop = panel.querySelector('.phone-link-pop');
let link = { status: 'off' };
let poll;

async function call(path = '', method = 'GET') {
  try {
    const res = await fetch(`/api/phone-link${path}`, { method });
    link = await res.json();
  } catch {
    link = { status: 'error', error: "The studio didn't answer. Is it still running?" };
  }
  show();
}

function show() {
  const sharing = link.status === 'on';
  panel.classList.toggle('sharing', sharing);
  label.textContent = sharing ? 'Sharing to phone' : 'On my phone';

  clearTimeout(poll);
  if (link.status === 'starting') poll = setTimeout(() => call(), 800);

  pop.innerHTML = POPOVER[link.status]?.(link) ?? POPOVER.off(link);
  pop.querySelector('.pl-start')?.addEventListener('click', () => {
    link = { status: 'starting' };
    show();
    call('/start', 'POST');
  });
  pop.querySelector('.pl-stop')?.addEventListener('click', () => call('/stop', 'POST'));
  pop.querySelector('.pl-copy-link')?.addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(link.url);
      e.currentTarget.textContent = 'Copied';
    } catch {
      e.currentTarget.textContent = 'Select and copy';
    }
  });
}

const WARNING = 'Anyone with this link can open your app while sharing is on.';

const POPOVER = {
  off: () => `
    <p class="caption">Open on your phone</p>
    <p class="pl-copy">Get a temporary HTTPS link to open this app on a real iPhone or Android. The phone gets your app as it is, without the studio's emulation.</p>
    <p class="pl-warn">${WARNING}</p>
    <div class="pl-actions"><button type="button" class="btn primary pl-start">Start sharing</button></div>`,
  starting: () => `
    <p class="caption">Open on your phone</p>
    <p class="pl-copy">Starting a secure link. This takes a few seconds.</p>
    <div class="pl-actions"><button type="button" class="btn quiet pl-stop">Cancel</button></div>`,
  on: ({ url, qr }) => `
    <p class="caption">Scan with your phone's camera</p>
    <div class="pl-qr">${qr}</div>
    <div class="pl-url"><code title="${escape(url)}">${escape(url)}</code><button type="button" class="btn quiet pl-copy-link">Copy</button></div>
    <p class="pl-warn">${WARNING}</p>
    <div class="pl-actions"><button type="button" class="btn primary pl-stop">Stop sharing</button></div>`,
  missing: () => `
    <p class="caption">Open on your phone</p>
    <p class="pl-copy">Sharing needs cloudflared, Cloudflare's free tunnel tool, on the computer running the studio. Install it, then try again.</p>
    <dl class="pl-install">
      <dt>macOS</dt><dd><code>brew install cloudflared</code></dd>
      <dt>Windows</dt><dd><code>winget install --id Cloudflare.cloudflared</code></dd>
      <dt>Linux, WSL</dt><dd><a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" target="_blank" rel="noreferrer">Cloudflare's downloads page</a></dd>
    </dl>
    <div class="pl-actions"><button type="button" class="btn primary pl-start">Try again</button></div>`,
  error: ({ error }) => `
    <p class="caption">Open on your phone</p>
    <p class="pl-copy">${escape(error ?? 'Sharing stopped.')}</p>
    <div class="pl-actions"><button type="button" class="btn primary pl-start">Try again</button></div>`,
};

function toggle(open = pop.hidden) {
  pop.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (open) call();
}

button.addEventListener('click', () => toggle());
document.addEventListener('pointerdown', (e) => {
  if (!pop.hidden && !panel.contains(e.target)) toggle(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !pop.hidden) {
    toggle(false);
    button.focus();
  }
});

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

call();
// The stickers feature can start and stop sharing too.
addEventListener('appify:phone-link', () => call());
