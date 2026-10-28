// Holo stickers on the background, run by Jhey Tompkins' holo stickers engine
// (vendor/holo-stickers-1.0.0.min.js, MIT, kept as downloaded) with the
// studio's own art in stickers/.
//
// Peel any sticker from its edge to move it, and let go to stick it down. The
// agent's eyes follow the cursor; the phone is paper, so pull it too hard and
// it tears. Click the QR sticker for a code your phone can scan, and the share
// sticker for a few ways to share the app. Where stickers were left is kept in
// this browser; one dropped on a device or panel goes back to its spot.
//
// Tells the "On my phone" panel when sharing starts or stops here by firing
// `appify:phone-link` on window.
import { studio } from '/hooks.js';
import { createStickers, DEFAULTS } from '/vendor/holo-stickers-1.0.0.min.js';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = '/features/stickers.css';
document.head.append(stylesheet);

const SAVED = 'appify.stickers.v1';
const SMALL = matchMedia('(max-width: 1180px), (max-height: 680px)');
// Stickers live in the margins: drop one on any of these and it goes home.
const KEEP_CLEAR = '.edge .panel, .frame, .logo, .sticker-card';
const INK = '#1d1d1f';
const LIGHT = '#f5f5f7';

// The agent's face, drawn on its visor in agent.svg's own units. The engine
// calls mood() with what the sticker is going through and redraws when
// signature() changes.
const EYES = [
  [48, 68, 8],
  [72, 68, 8],
];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const agentFace = {
  eyes: EYES,
  mood({ mode, peeled, hovered, relief, ouch, blink, look }) {
    const m = { look, eyes: 'open', open: 1, brow: 0, mouth: 'smile', size: 0 };
    if (mode === 'peel') {
      Object.assign(m, { open: 1 - peeled * 0.6, brow: clamp(peeled * 1.8, 0, 1), size: peeled });
      m.mouth = peeled < 0.25 ? 'o' : 'wobble';
      if (peeled > 0.75) m.eyes = 'squeeze';
    } else if (mode === 'held') Object.assign(m, { eyes: 'wide', mouth: 'grin' });
    else if (mode === 'drop') Object.assign(m, { eyes: 'shut', mouth: 'flat' });
    else if (relief || mode === 'settle') m.eyes = 'happy';
    else if (ouch) Object.assign(m, { eyes: 'squeeze', mouth: 'o', size: 0.4 });
    else if (hovered) Object.assign(m, { eyes: 'wide', mouth: 'o', size: 0.1, brow: -0.7 });
    if (blink && (m.eyes === 'open' || m.eyes === 'wide')) m.open = 0;
    return m;
  },
  signature: (m) =>
    [m.eyes, m.mouth, m.look.map((v) => v.map((n) => Math.round(n * 8))).join(), Math.round(m.open * 8), Math.round(m.brow * 6), Math.round(m.size * 5)].join('|'),
  draw: (m) => (ctx) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    EYES.forEach(([x, y, r], i) => drawEye(ctx, m, x, y, r, i === 0 ? 1 : -1, m.look[i]));
    drawMouth(ctx, m);
  },
};

function drawEye(ctx, m, x, y, r, side, [lx, ly]) {
  ctx.strokeStyle = LIGHT;
  ctx.fillStyle = LIGHT;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  if (m.eyes === 'happy') {
    ctx.arc(x, y + r * 0.5, r * 0.7, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (m.eyes === 'shut' || m.open < 0.25) {
    ctx.moveTo(x - r * 0.7, y + 1);
    ctx.quadraticCurveTo(x, y + r * 0.35, x + r * 0.7, y + 1);
    ctx.stroke();
  } else if (m.eyes === 'squeeze') {
    ctx.moveTo(x - side * r * 0.6, y - r * 0.6);
    ctx.lineTo(x + side * r * 0.5, y);
    ctx.lineTo(x - side * r * 0.6, y + r * 0.6);
    ctx.stroke();
  } else {
    // A screen-pill eye with a pupil that looks where the cursor is.
    const w = r * (m.eyes === 'wide' ? 1.75 : 1.5);
    const h = r * 2.1 * (m.eyes === 'wide' ? 1.1 : 1) * clamp(m.open, 0.25, 1);
    ctx.roundRect(x - w / 2, y - h / 2, w, h, w / 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const px = x + lx * w * 0.24;
    const py = y + ly * h * 0.26;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - r * 0.17, py - r * 0.2, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Brows sit on the shell above the visor: up and apart when curious,
  // pinched when it's being peeled.
  if (Math.abs(m.brow) > 0.05) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const base = y - r - 19 - (m.brow < 0 ? -m.brow * 2.5 : 0);
    ctx.moveTo(x - side * r * 0.8, base);
    ctx.lineTo(x + side * r * 0.6, base - (m.brow > 0 ? m.brow * 4 : 0));
    ctx.stroke();
  }
}

function drawMouth(ctx, m) {
  const [x, y] = [60, 84];
  ctx.strokeStyle = LIGHT;
  ctx.fillStyle = LIGHT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  switch (m.mouth) {
    case 'o':
      ctx.ellipse(x, y, 2.6 + m.size * 3, 3 + m.size * 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wobble': {
      const half = 7 + m.size * 3;
      ctx.moveTo(x - half, y);
      for (let i = 1; i <= 6; i++) ctx.lineTo(x - half + (i * 2 * half) / 6, y + (i % 2 ? -2.2 : 2.2));
      ctx.stroke();
      break;
    }
    case 'grin':
      ctx.moveTo(x - 8, y - 2);
      ctx.quadraticCurveTo(x, y + 10, x + 8, y - 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flat':
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(x - 6.5, y - 1.5);
      ctx.quadraticCurveTo(x, y + 4, x + 6.5, y - 1.5);
      ctx.stroke();
  }
}

// Each sticker's spot is set from the window's edges, like the panels.
// material and finish are the engine's: vinyl, paper, foil, rigid and print,
// chrome, glitter, clear.
const STICKERS = [
  { key: 'agent', label: 'Agent sticker', src: '/stickers/agent.svg', width: 74, cut: 0.07, material: 'vinyl', finish: 'glitter', rot: -8, spot: { left: 88, top: 150 }, face: agentFace },
  // Paper with strong glue: peel it slowly or it tears, like a real one.
  { key: 'phone', label: 'Phone sticker', src: '/stickers/phone.svg', width: 56, cut: 0.05, material: { preset: 'paper', tack: 0.6, tear: 0.6 }, finish: 'print', rot: 9, spot: { right: 90, top: 98 } },
  // The studio's own pastel holo, printed on vinyl.
  { key: 'qr', label: 'QR code sticker', src: '/stickers/qr.svg', width: 74, cut: 0.06, material: 'vinyl', finish: 'print', rot: 6, spot: { left: 88, bottom: 80 } },
  // The flashy one: chrome holo over the whole face (cut 0 puts the holo on
  // every near-white area of the art), on foil, which keeps its creases.
  { key: 'share', label: 'Share sticker', src: '/stickers/share.svg', width: 70, cut: 0, material: 'foil', finish: 'chrome', look: { bands: 2.4, dispersion: 1, response: 0.85 }, rot: -9, spot: { right: 96, bottom: 78 } },
];

const toAt = ({ left, right, top, bottom }) => {
  const x = left ?? innerWidth - right;
  const y = top ?? innerHeight - bottom;
  return [(x - innerWidth / 2) / innerWidth, (innerHeight / 2 - y) / innerHeight];
};

let board = null;
let starting = null;

async function start() {
  if (board || starting) return;
  const container = document.querySelector('.stickers');
  starting = createStickers({
    container,
    stickers: STICKERS.map(({ spot, ...def }) => ({ ...def, at: toAt(spot) })),
    size: 1,
    // Quiet, and only once someone has pressed something: browsers block
    // sound before that anyway.
    sound: false,
    volume: 0.4,
    ignore: `${DEFAULTS.ignore}, .edge, .logo, .frame, .sticker-card`,
  });
  board = await starting;
  starting = null;
  if (SMALL.matches) return stop();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED));
    if (saved) await board.restore(saved);
  } catch {
    // Nothing saved, or storage is blocked: stickers start at their spots.
  }
  for (const s of board.stickers) keepClear(s);
  board.on('stick', ({ id }) => {
    const s = board.find(id);
    if (s) keepClear(s);
    save();
  });
  board.on('rest', save);
  board.on('tear', save);
  board.on('peel', () => (press = null));
  // While a sticker is in hand the devices' iframes would swallow the pointer
  // and it could never be let go, so they ignore it until the press ends.
  board.on('select', () => document.documentElement.toggleAttribute('data-sticker-drag', true));
  addEventListener('pointerdown', () => board?.set({ sound: true }), { once: true, capture: true });
  if (new URLSearchParams(location.search).has('debug')) window.__stickers = board;
}

function stop() {
  board?.destroy();
  board = null;
  closeCards();
  document.documentElement.removeAttribute('data-sticker-tap');
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVED, JSON.stringify(board.save()));
    } catch {
      // Storage blocked: positions just aren't kept.
    }
  }, 300);
}

// Where a sticker is on screen. The engine's world is centred with y up.
const toClient = (s) => [s.x + innerWidth / 2, innerHeight / 2 - s.y];

// Checks the middle and four points a third of the way out, so a sticker
// can't sit half over a device either.
function keepClear(s) {
  // Home is where it goes back to, so never send it home from there.
  const [hx, hy] = s.def.at;
  if (Math.hypot(s.x - hx * innerWidth, s.y - hy * innerHeight) < 2) return;
  const [x, y] = toClient(s);
  const d = Math.min(...s.geo.size) / 3;
  const points = [[x, y], [x - d, y], [x + d, y], [x, y - d], [x, y + d]];
  const blocked = points.some(([px, py]) =>
    px < 0 || py < 0 || px > innerWidth || py > innerHeight || document.elementsFromPoint(px, py).some((el) => el.closest(KEEP_CLEAR)),
  );
  if (blocked) board.place(s, 0);
}

// Uses the engine's own geometry (board.stage, sticker.geo) to find the
// sticker under a point; pinned to engine 1.0.0.
function stickerAt(x, y) {
  for (let i = board.stickers.length - 1; i >= 0; i--) {
    const s = board.stickers[i];
    const [wx, wy] = board.stage.toWorld(x, y, s.z);
    const [dx, dy] = [wx - s.x, wy - s.y];
    const [c, n] = [Math.cos(-s.rot), Math.sin(-s.rot)];
    if (s.geo.hit(dx * c - dy * n, dx * n + dy * c)) return s;
  }
  return null;
}

// Clicks: a press that lands on a sticker and lets go without peeling it.
const ACTIONS = { qr: openQR, share: openShare };
const actionOf = (s) => s && s.mode === 'stuck' && ACTIONS[s.parent ?? s.id];
let press = null;

addEventListener(
  'pointerdown',
  (e) => {
    press = null;
    if (!board || e.button !== 0 || e.target.closest?.('.edge, .logo, .sticker-card, button, a, input')) return;
    const s = stickerAt(e.clientX, e.clientY);
    // A second click on the sticker whose card is open just closes it.
    if (actionOf(s)) press = { s, x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, closes: card?.sticker === (s.parent ?? s.id) };
  },
  true,
);
const endDrag = () => document.documentElement.removeAttribute('data-sticker-drag');
addEventListener('pointercancel', endDrag, true);
addEventListener(
  'pointerup',
  (e) => {
    endDrag();
    if (!press || e.pointerId !== press.id) return;
    const { s, x, y, t, closes } = press;
    press = null;
    if (closes || Math.hypot(e.clientX - x, e.clientY - y) > 5 || e.timeStamp - t > 600) return;
    actionOf(s)?.(s);
  },
  true,
);
addEventListener(
  'pointermove',
  (e) => {
    if (!board || e.buttons) return;
    const s = stickerAt(e.clientX, e.clientY);
    document.documentElement.toggleAttribute('data-sticker-tap', Boolean(actionOf(s)) && board.hovered !== s);
  },
  { passive: true },
);

// Cards that open from a sticker: the QR code, bigger, and the share menu.

let card = null;

function closeCards() {
  if (!card) return;
  const closing = card;
  card = null;
  closing.el.animate([{ opacity: 1 }, { opacity: 0, transform: `${closing.el.style.transform} scale(0.96)` }], { duration: 140, easing: 'ease-in' }).finished.then(() => closing.el.remove());
}

// Puts a card next to the sticker, inside the window, and grows it out of it.
function showCard(el, s, { gap = 18, spring = false } = {}) {
  closeCards();
  document.body.append(el);
  const [sx, sy] = toClient(s);
  const { width, height } = el.getBoundingClientRect();
  const half = Math.max(...s.geo.size) / 2;
  const toward = (v, size, view) => (v < view / 2 ? v + half + gap : v - half - gap - size);
  const left = clamp(toward(sx, width, innerWidth), 16, innerWidth - width - 16);
  const top = clamp(sy < innerHeight / 2 ? sy - height / 3 : sy - height + half, 16, innerHeight - height - 16);
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  const from = `translate(${sx - left - width / 2}px, ${sy - top - height / 2}px) scale(${(half * 2) / width}) rotate(${(-s.rot * 180) / Math.PI}deg)`;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.animate(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: from, opacity: 0.4 }, { transform: 'none', opacity: 1 }], {
    duration: spring ? 420 : 320,
    easing: spring ? 'cubic-bezier(.3, 1.5, .5, 1)' : 'cubic-bezier(.2, .9, .3, 1)',
  });
  card = { el, sticker: s.parent ?? s.id };
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
  return card;
}

addEventListener('pointerdown', (e) => {
  if (card && !card.el.contains(e.target)) closeCards();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCards();
});

async function phoneLink(path = '', method = 'GET') {
  try {
    const res = await fetch(`/api/phone-link${path}`, { method });
    return await res.json();
  } catch {
    return { status: 'error', error: "The studio didn't answer. Is it still running?" };
  }
}

const changed = () => dispatchEvent(new CustomEvent('appify:phone-link'));

async function openQR(s) {
  const first = await phoneLink();
  const el = document.createElement('section');
  el.className = 'sticker-card sc-qr';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Open on your phone');
  el.innerHTML = `<div class="sc-qr-face"><div class="sc-qr-plate"></div></div><div class="sc-qr-foot panel"></div>`;
  let shown = false;
  const plate = el.querySelector('.sc-qr-plate');
  const foot = el.querySelector('.sc-qr-foot');

  const render = (link) => {
    if (shown && card?.el !== el) return;
    el.dataset.status = link.status;
    if (link.status === 'on') {
      plate.innerHTML = link.qr;
      foot.innerHTML = `
        <p class="caption">Scan with your phone's camera</p>
        <div class="sc-url"><code title="${escape(link.url)}">${escape(link.url)}</code><button type="button" class="btn quiet sc-copy">Copy</button></div>
        <div class="sc-actions"><button type="button" class="btn quiet sc-stop">Stop sharing</button></div>`;
    } else if (link.status === 'starting') {
      plate.innerHTML = '<span class="sc-wait" aria-hidden="true"></span>';
      foot.innerHTML = `<p class="caption">Open on your phone</p><p class="sc-copytext">Starting a secure link. This takes a few seconds.</p>`;
      setTimeout(async () => card?.el === el && render(await phoneLink()), 800);
    } else {
      plate.innerHTML = '<img class="sc-qr-ghost" src="/stickers/qr.svg" alt="">';
      const message =
        link.status === 'missing'
          ? 'Sharing needs cloudflared on this computer. The On my phone panel has the install steps.'
          : link.status === 'error'
            ? escape(link.error ?? 'Sharing stopped.')
            : 'Start a temporary HTTPS link and this turns into a code your phone can open.';
      foot.innerHTML = `
        <p class="caption">Open on your phone</p>
        <p class="sc-copytext">${message}</p>
        <p class="sc-warn">Anyone with the link can open your app while sharing is on.</p>
        <div class="sc-actions"><button type="button" class="btn primary sc-start">${link.status === 'off' ? 'Start sharing' : 'Try again'}</button></div>`;
    }
    foot.querySelector('.sc-start')?.addEventListener('click', async () => {
      render({ status: 'starting' });
      render(await phoneLink('/start', 'POST'));
      changed();
    });
    foot.querySelector('.sc-stop')?.addEventListener('click', async () => {
      render(await phoneLink('/stop', 'POST'));
      changed();
    });
    foot.querySelector('.sc-copy')?.addEventListener('click', (e) => copy(e.currentTarget, link.url));
  };
  render(first);
  showCard(el, s, { gap: 22 });
  shown = true;
}

const SHARE_ICONS = {
  copy: '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="6.15" y="3.65" width="8.7" height="9.7"/><path d="M3.15 10.35V.65h8.7"/></svg>',
  share: '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M9 9V.9M6.2 3.6 9 .8l2.8 2.8M6.6 5.65H4.65v7.7h8.7v-7.7H11.4"/></svg>',
  mail: '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="2.15" y="2.15" width="13.7" height="9.7"/><path d="m2.4 2.6 6.6 5 6.6-5"/></svg>',
  qr: '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="2.65" y=".65" width="4.7" height="4.7"/><rect x="10.65" y=".65" width="4.7" height="4.7"/><rect x="2.65" y="8.65" width="4.7" height="4.7"/><path d="M10.5 8.5h2v2h-2zM13.5 11.5h2v2h-2z" fill="currentColor" stroke="none"/></svg>',
  link: '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M7.6 8.9a3 3 0 0 0 4.2 0l2.4-2.4a3 3 0 0 0-4.2-4.2l-1 1M10.4 5.1a3 3 0 0 0-4.2 0L3.8 7.5a3 3 0 0 0 4.2 4.2l1-1"/></svg>',
};

async function openShare(s) {
  const el = document.createElement('section');
  el.className = 'sticker-card sc-share panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Share this app');
  el.innerHTML = '<p class="caption">Share</p><div class="sc-list"></div><p class="sc-where"></p>';
  const list = el.querySelector('.sc-list');
  const where = el.querySelector('.sc-where');

  const render = (link) => {
    const sharing = link.status === 'on';
    const url = sharing ? link.url : studio.target && String(studio.target);
    const title = 'App preview from appify studio';
    const rows = [
      !sharing && { id: 'public', icon: 'link', label: link.status === 'starting' ? 'Starting a public link…' : 'Get a public link' },
      { id: 'copy', icon: 'copy', label: 'Copy link' },
      navigator.share && { id: 'native', icon: 'share', label: 'Share…' },
      { id: 'mail', icon: 'mail', label: 'Email' },
      { id: 'qr', icon: 'qr', label: 'QR code' },
    ].filter(Boolean);
    list.innerHTML = rows
      .map((r) => `<button type="button" class="sc-row" data-id="${r.id}"${r.id === 'public' && link.status === 'starting' ? ' disabled' : ''}>${SHARE_ICONS[r.icon]}<span>${r.label}</span></button>`)
      .join('');
    where.innerHTML = url
      ? `<code>${escape(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</code> ${sharing ? 'Anyone with the link can open it.' : 'Only this computer can open it.'}`
      : 'Choose an app first.';
    const on = (id, fn) => list.querySelector(`[data-id="${id}"]`)?.addEventListener('click', fn);
    on('public', async () => {
      render({ status: 'starting' });
      changed();
      let next = await phoneLink('/start', 'POST');
      while (next.status === 'starting' && card?.el === el) {
        await new Promise((r) => setTimeout(r, 800));
        next = await phoneLink();
      }
      if (card?.el === el) render(next);
      changed();
    });
    on('copy', (e) => copy(e.currentTarget.querySelector('span'), url));
    on('native', () => navigator.share({ title, url }).catch(() => {}));
    on('mail', () => (location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url ?? '')}`));
    on('qr', () => {
      const qr = board.find('qr');
      if (qr) openQR(qr);
    });
  };
  render(await phoneLink());
  showCard(el, s, { gap: 14, spring: true });
}

async function copy(label, text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    label.textContent = 'Copied';
  } catch {
    label.textContent = 'Select and copy';
  }
}

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const fitScreen = () => (SMALL.matches ? stop() : start());
SMALL.addEventListener('change', fitScreen);
fitScreen();
