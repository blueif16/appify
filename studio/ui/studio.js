import { DEVICES, VIEWS, screenLayout, screenSize } from '/devices.js';
import { desktopHTML, outerSize, phoneHTML } from '/chrome.js';
import { studio } from '/hooks.js';

const STORE = 'appify.studio.v1';
const ROW_GAP = 56;
const TAG_ROOM = 110;

const bench = document.querySelector('.bench');
const row = document.querySelector('.row');
const scaleReadout = document.querySelector('.scale-readout');
const routeForm = document.querySelector('.route');
const pathInput = document.querySelector('.path');
const originButton = document.querySelector('.origin');
const dialog = document.querySelector('.target-dialog');

const dockItems = document.querySelector('.dock-items');
const addButton = document.querySelector('.dock-add');
const addMenu = document.querySelector('.add-menu');

// Each window: { key, device, minimized }. Minimized windows keep their page
// running and wait in the dock.
const state = {
  mode: 'browser',
  zoom: 'fit',
  path: '/',
  ...restore(),
};
state.windows = Array.isArray(state.windows) ? state.windows.filter((win) => DEVICES[win.device]) : windowsFor(VIEWS['web-phone'].devices);
delete state.view;
delete state.slots;

let target = null;
let proxyOrigin = '';
let frames = [];

class Frame {
  constructor(win, path) {
    this.win = win;
    this.device = DEVICES[win.device] ?? DEVICES['iphone-16'];
    this.path = path;
    this.page = {};
    this.notes = new Map();
    this.k = 1;
    this.orientation = this.device.kind === 'phone' ? (state.orientation ?? 'portrait') : 'portrait';
    // Set by the phone feature while its keyboard is up: the screen px the
    // page can still see, and how much a resizes-content keyboard takes off
    // the layout viewport.
    this.keyboardVisible = null;
    this.keyboardCut = 0;

    const d = this.device;
    const classes = ['device', d.kind, d.os, `cutout-${d.cutout ?? 'none'}`, d.homeButton ? 'home-button' : '']
      .filter(Boolean)
      .join(' ');
    this.el = document.createElement('figure');
    this.el.className = 'frame';
    this.el.innerHTML = `
      <div class="frame-scale">
        <div class="${classes}" style="--r:${d.radius ?? 0}px">
          ${d.kind === 'desktop' ? desktopHTML() : phoneHTML(d)}
        </div>
      </div>
      <figcaption class="tag">
        <div class="tag-line">
          ${d.kind === 'desktop' ? '<span class="name">Desktop</span>' : `<select class="pick" aria-label="Phone">${phoneOptions(d.id)}</select>`}
          <span class="dims"></span>
          <span class="where"></span>
          <span class="win-actions">
            <button type="button" class="win-min" title="Minimize to the dock" aria-label="Minimize ${d.name}">${ICON_MIN}</button>
            <button type="button" class="win-close" title="Remove" aria-label="Remove ${d.name}">${ICON_CLOSE}</button>
          </span>
        </div>
        <div class="notes"></div>
      </figcaption>`;

    const q = (selector) => this.el.querySelector(selector);
    this.scaleBox = q('.frame-scale');
    this.deviceEl = q('.device');
    this.screen = q('.screen');
    this.viewport = q('.viewport');
    this.zoomLayer = q('.zoom');
    this.panLayer = q('.pan');
    this.iframe = q('iframe');
    this.dims = q('.dims');
    this.where = q('.where');
    this.notesEl = q('.notes');
    this.parts = {
      top: q('.sys-top'),
      bottom: q('.sys-bottom'),
      bar: q('.browserbar'),
      status: q('.statusbar'),
      gesture: q('.gesture'),
    };

    q('.pick')?.addEventListener('change', (e) => swapDevice(this, e.target.value));
    q('.win-min').addEventListener('click', () => setMinimized(this.win, true));
    q('.win-close').addEventListener('click', () => removeWindow(this.win));
    this.el.hidden = win.minimized;
    this.applyShape();
    this.setHost();
    this.mount();
    this.layout();
    for (const hook of studio.hooks.frame) hook(this);
  }

  mount() {
    this.configure();
    this.iframe.allow = 'clipboard-read; clipboard-write; web-share; camera; microphone; geolocation; fullscreen';
    this.iframe.src = proxyOrigin + this.path;
  }

  // The page's frame script reads its config from window.name, which follows
  // the iframe's name, so pages loaded later in this frame see changes too.
  configure() {
    const d = this.device;
    const cfg = { studio: location.origin, kind: d.kind, os: d.os, mode: state.mode, ua: d.ua, name: d.name };
    for (const hook of studio.hooks.config) Object.assign(cfg, hook(this));
    this.iframe.name = `appify:${JSON.stringify(cfg)}`;
  }

  navigate(path) {
    this.path = path;
    this.iframe.src = proxyOrigin + path;
    this.setHost();
  }

  setHost() {
    const pathShown = this.device.kind === 'desktop' ? this.path : '';
    for (const host of this.el.querySelectorAll('.host')) {
      host.textContent = this.device.os === 'ios' ? target.hostname : target.host + pathShown;
    }
  }

  // Screen size, outer size and the CSS variables that follow the orientation.
  applyShape() {
    const d = this.device;
    const landscape = this.orientation === 'landscape';
    const size = screenSize(d, this.orientation);
    this.outer = outerSize(d, this.orientation);
    this.deviceEl.classList.toggle('landscape', landscape);
    const vars = {
      '--w': `${size.width}px`,
      '--h': `${size.height}px`,
      '--sb-h': `${d.os === 'ios' ? (landscape ? 0 : d.safeTop) : (d.statusBar ?? 0)}px`,
      '--cut-side': `${d.os === 'android' && landscape ? d.landscape.cutoutSide : 0}px`,
      '--side': `${d.os === 'ios' && landscape ? d.landscape.side : 0}px`,
    };
    for (const [name, value] of Object.entries(vars)) this.deviceEl.style.setProperty(name, value);
  }

  setOrientation(orientation) {
    if (this.device.kind !== 'phone' || this.orientation === orientation) return;
    this.orientation = orientation;
    this.keyboardVisible = null;
    this.keyboardCut = 0;
    this.applyShape();
    this.layout();
    this.configure();
    this.send({ type: 'orientation', value: orientation });
  }

  setScale(s) {
    this.scaleBox.style.width = `${this.outer.width * s}px`;
    this.scaleBox.style.height = `${this.outer.height * s}px`;
    this.deviceEl.style.transform = `scale(${s})`;
    this.el.style.width = `${Math.max(this.outer.width * s, 180)}px`;
  }

  layout() {
    const d = this.device;
    if (d.kind === 'desktop') {
      Object.assign(this.iframe.style, { width: `${d.width}px`, height: `${d.height}px` });
      this.dims.textContent = `${d.width} × ${d.height}`;
      this.where.textContent = 'browser window';
      return;
    }

    const size = screenSize(d, this.orientation);
    const L = screenLayout(d, state.mode, this.page, this.orientation);
    const width = size.width - L.left - L.right;
    const height = size.height - L.top - L.bottom - this.keyboardCut;
    const layoutWidth = this.page.layoutWidth ?? width;
    this.k = width / layoutWidth;
    this.vp = { width, height };
    this.geometry = { ...L, size };

    Object.assign(this.viewport.style, {
      top: `${L.top}px`,
      left: `${L.left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    Object.assign(this.iframe.style, {
      width: `${layoutWidth}px`,
      height: `${height / this.k}px`,
      transform: this.k === 1 ? '' : `scale(${this.k})`,
    });
    this.paintBars(L);
    this.send({ type: 'insets', insets: L.insets });

    this.dims.textContent = `${width} × ${height}`;
    this.dims.title = `The page gets ${width} × ${height} px of the ${size.width} × ${size.height} screen.`;
    this.where.textContent = state.mode === 'browser' ? `in ${d.browser}` : 'from Home Screen';
    this.setNote(
      'layout',
      this.page.layoutWidth
        ? `This page has no mobile viewport tag, so the phone lays it out ${layoutWidth}px wide and shrinks it to fit.`
        : null,
    );
  }

  // Colors the status bar, browser bars and home indicator from what the page
  // declares, the way each phone does.
  paintBars(L) {
    const d = this.device;
    const { top, bottom, bar, status, gesture } = this.parts;
    const browser = state.mode === 'browser';
    const background = this.page.background ?? '#ffffff';
    const theme = this.page.themeColor ?? null;
    const landscape = this.orientation === 'landscape';
    bar.hidden = !browser;
    // Letterboxed sides show the page background on iPhones; Android leaves
    // the strip beside the camera black.
    this.screen.style.background = d.os === 'android' && landscape ? '#000000' : background;

    let topColor = null;
    let statusInk;
    if (d.os === 'ios') {
      bottom.hidden = true;
      status.hidden = landscape;
      bar.style.height = `${landscape ? L.top : d.safari.bottom}px`;
      if (landscape) topColor = null;
      // Safari 26 ignores theme-color in tabs and tints from the page background.
      else if (browser) topColor = background;
      else if (L.top > 0) topColor = this.page.statusBarStyle === 'black' ? '#000000' : (theme ?? '#ffffff');
      else statusInk = '#ffffff'; // black-translucent: white text over the page
      // The home indicator adapts to whatever is under it.
      if (gesture) {
        gesture.style.color = browser ? '#000000' : '#ffffff';
        gesture.style.mixBlendMode = browser ? '' : 'difference';
      }
    } else {
      topColor = theme ?? (browser ? '#ffffff' : background);
      const barColor = theme ?? '#ffffff';
      Object.assign(bar.style, { background: barColor, color: ink(barColor) });
      const navColor = browser ? '#ffffff' : background;
      bottom.hidden = false;
      Object.assign(bottom.style, { height: `${d.navBar}px`, background: navColor });
      gesture.style.color = ink(navColor);
    }

    top.style.height = `${topColor ? (d.os === 'ios' ? L.top : d.statusBar) : 0}px`;
    top.style.background = topColor ?? 'transparent';
    status.style.color = statusInk ?? ink(topColor ?? background);
  }

  onMessage(msg) {
    for (const hook of studio.hooks.message) hook(this, msg);
    if (msg.type === 'page') {
      this.page = msg.info;
      this.path = msg.info.path;
      this.setHost();
      this.layout();
      this.showAway();
    } else if (msg.type === 'zoom') {
      this.zoom(msg);
    } else if (msg.type === 'unzoom') {
      this.unzoomTimer = setTimeout(() => {
        this.lastZoom = null;
        this.zoomLayer.style.transform = '';
        this.setNote('zoom', null);
      }, 150);
    }
  }

  // iOS zooms until the field's text reads at 16px, keeping the field in view.
  zoom(msg) {
    const { fontSize, rect } = msg;
    clearTimeout(this.unzoomTimer);
    const shown = fontSize * this.k;
    const z = Math.min(16 / shown, 5);
    if (z <= 1.01) return;
    this.lastZoom = msg;
    const { width: W, height: H } = this.vp;
    const V = this.keyboardVisible ?? H; // room above the keyboard, if it's up
    const x = rect.x * this.k;
    const y = rect.y * this.k;
    const w = rect.width * this.k;
    const h = rect.height * this.k;
    const tx = clamp(w * z < W - 24 ? W / 2 - (x + w / 2) * z : 12 - x * z, W - W * z, 0);
    const ty = clamp(V * 0.38 - (y + h / 2) * z, H - H * z, 0);
    this.zoomLayer.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    this.setNote(
      'zoom',
      `iOS zooms in when this field is tapped: its text shows at ${round(shown)}px, and iPhones zoom anything under 16px.`,
    );
  }

  showAway() {
    const away = this.path !== state.path;
    let line = this.el.querySelector('.away');
    if (!away) return line?.remove();
    if (!line) {
      line = document.createElement('p');
      line.className = 'away';
      line.innerHTML = '<span></span> <button type="button">Show in all</button>';
      line.querySelector('button').addEventListener('click', () => {
        state.path = this.path;
        save();
        pathInput.value = state.path;
        for (const frame of frames) if (frame !== this) frame.navigate(state.path);
        for (const frame of frames) frame.showAway();
      });
      this.el.querySelector('.tag').append(line);
    }
    line.querySelector('span').textContent = `Now on ${this.path}`;
  }

  setNote(key, text) {
    if (text) this.notes.set(key, text);
    else this.notes.delete(key);
    this.notesEl.replaceChildren(
      ...[...this.notes.values()].map((note) => {
        const p = document.createElement('p');
        p.className = 'note';
        p.textContent = note;
        return p;
      }),
    );
  }

  send(msg) {
    this.iframe.contentWindow?.postMessage({ appify: true, ...msg }, proxyOrigin);
  }
}

// Rebuilds every window. Pages keep the path they were on.
function render() {
  const paths = new Map(frames.map((frame) => [frame.win.key, frame.path]));
  frames = state.windows.map((win) => new Frame(win, paths.get(win.key) ?? state.path));
  studio.frames = frames;
  row.replaceChildren(...frames.map((frame) => frame.el), emptyHint);
  bench.classList.remove('empty');
  layoutChanged();
  syncControls();
}

function swapDevice(frame, id) {
  frame.win.device = id;
  const next = new Frame(frame.win, frame.path);
  frame.el.replaceWith(next.el);
  frames[frames.indexOf(frame)] = next;
  layoutChanged();
}

function addWindow(id) {
  const win = { key: nextKey(), device: id, minimized: false };
  state.windows.push(win);
  const frame = new Frame(win, state.path);
  frames.push(frame);
  row.insertBefore(frame.el, emptyHint);
  layoutChanged();
}

function removeWindow(win) {
  const frame = frames.find((f) => f.win === win);
  state.windows = state.windows.filter((w) => w !== win);
  frames = frames.filter((f) => f !== frame);
  studio.frames = frames;
  frame?.el.remove();
  layoutChanged();
}

function setMinimized(win, minimized) {
  win.minimized = minimized;
  const frame = frames.find((f) => f.win === win);
  if (frame) frame.el.hidden = minimized;
  layoutChanged();
}

function useSet(ids) {
  state.windows = windowsFor(ids);
  frames = [];
  render();
}

function layoutChanged() {
  studio.frames = frames;
  save();
  renderDock();
  fit();
}

// The dock lists every window: click to minimize it or bring it back.
function renderDock() {
  dockItems.replaceChildren(
    ...state.windows.map((win) => {
      const device = DEVICES[win.device];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dock-item';
      button.setAttribute('aria-pressed', String(!win.minimized));
      button.title = win.minimized ? `Bring back ${device.name}` : `Minimize ${device.name}`;
      button.innerHTML = `${glyph(device)}<span></span><i class="lamp"></i>`;
      button.querySelector('span').textContent = device.name;
      button.addEventListener('click', () => setMinimized(win, !win.minimized));
      return button;
    }),
  );
  const visible = state.windows.filter((win) => !win.minimized).length;
  emptyHint.hidden = visible > 0;
  emptyHint.textContent = state.windows.length
    ? 'Every window is minimized. Bring one back from the dock.'
    : 'Add a device from the dock to start.';
}

function renderAddMenu() {
  const group = (label, devices) =>
    `<p class="caption">${label}</p>` +
    devices
      .map((d) => `<button type="button" role="menuitem" data-device="${d.id}">${glyph(d)}${d.name}</button>`)
      .join('');
  const all = Object.values(DEVICES);
  addMenu.innerHTML =
    group('Desktop', all.filter((d) => d.kind === 'desktop')) +
    group('iPhone', all.filter((d) => d.os === 'ios')) +
    group('Android', all.filter((d) => d.os === 'android')) +
    `<p class="caption">Sets</p>` +
    Object.entries(VIEWS)
      .map(([id, view]) => `<button type="button" role="menuitem" data-set="${id}">${ICON_SET}${view.label}</button>`)
      .join('');
}

function toggleAddMenu(open = addMenu.hidden) {
  addMenu.hidden = !open;
  addButton.setAttribute('aria-expanded', String(open));
  if (open) addMenu.querySelector('button')?.focus();
}

addButton.addEventListener('click', () => toggleAddMenu());
addMenu.addEventListener('click', (e) => {
  const item = e.target.closest('button');
  if (!item) return;
  toggleAddMenu(false);
  if (item.dataset.device) addWindow(item.dataset.device);
  else useSet(VIEWS[item.dataset.set].devices);
});
document.addEventListener('pointerdown', (e) => {
  if (!addMenu.hidden && !e.target.closest('.dock-add-wrap')) toggleAddMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !addMenu.hidden) {
    toggleAddMenu(false);
    addButton.focus();
  }
});

function windowsFor(ids) {
  return ids.map((device, i) => ({ key: Date.now() + i, device, minimized: false }));
}

function nextKey() {
  return Math.max(0, ...state.windows.map((win) => win.key)) + 1;
}

function glyph(device) {
  const body =
    device.kind === 'desktop'
      ? '<rect x="1.65" y="1.65" width="14.7" height="9.7"/><path d="M6 13.35h6"/>'
      : device.os === 'ios'
        ? '<rect x="5.15" y=".65" width="7.7" height="12.7" rx="1.6"/><path d="M7.8 2.4h2.4"/>'
        : '<rect x="5.15" y=".65" width="7.7" height="12.7" rx=".8"/><circle cx="9" cy="2.6" r=".5"/>';
  return `<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${body}</svg>`;
}

// Devices fit inside the gutters the floating panels leave free (see the
// --gutter-* variables in studio.css).
function fit() {
  const shown = frames.filter((frame) => !frame.win.minimized);
  if (!shown.length) return;
  let s = 1;
  let perRow = shown.length;
  if (state.zoom === 'fit') {
    const css = getComputedStyle(document.documentElement);
    const gutter = (name) => parseFloat(css.getPropertyValue(`--gutter-${name}`)) || 0;
    const roomX = bench.clientWidth - gutter('x') * 2;
    const roomY = bench.clientHeight - gutter('top') - gutter('bottom');
    // One row, or wrap into two or three (four landscape phones fit far
    // better as two rows); keep whichever shows the devices largest.
    let best = 0;
    for (let rows = 1; rows <= Math.min(3, shown.length); rows++) {
      const across = Math.ceil(shown.length / rows);
      const lines = Array.from({ length: rows }, (_, i) => shown.slice(i * across, (i + 1) * across));
      const width = Math.max(...lines.map((line) => line.reduce((sum, frame) => sum + frame.outer.width, 0)));
      const height = lines.reduce((sum, line) => sum + Math.max(0, ...line.map((frame) => frame.outer.height)), 0);
      const fits = Math.min(
        1,
        (roomX - ROW_GAP * (across - 1)) / width,
        (roomY - TAG_ROOM * rows - ROW_GAP * (rows - 1)) / height,
      );
      if (fits > best * 1.1) {
        best = fits;
        perRow = across;
      }
    }
    s = Math.max(0.2, best);
  }
  row.style.display = 'grid';
  row.style.gridTemplateColumns = `repeat(${perRow}, auto)`;
  row.style.justifyItems = 'center';
  for (const frame of frames) frame.setScale(s);
  document.documentElement.style.setProperty('--s', s);
  scaleReadout.textContent = `${Math.round(s * 100)}%`;
}

function syncControls() {
  for (const group of document.querySelectorAll('.seg')) {
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(state[group.dataset.key] === button.dataset.value));
    }
  }
  bench.classList.toggle('actual', state.zoom === 'actual');
  pathInput.value = state.path;
  originButton.textContent = target?.host ?? 'Choose app';
}

for (const group of document.querySelectorAll('.seg')) {
  group.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    const key = group.dataset.key;
    if (!button || state[key] === button.dataset.value) return;
    state[key] = button.dataset.value;
    save();
    if (key === 'zoom') {
      syncControls();
      fit();
    } else if (target) {
      render();
    } else {
      syncControls();
    }
  });
}

routeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!target) return openTargetDialog();
  let path = pathInput.value.trim() || '/';
  try {
    const url = new URL(path, target);
    path = url.pathname + url.search + url.hash;
  } catch {}
  state.path = path;
  pathInput.value = path;
  save();
  for (const frame of frames) frame.navigate(path);
});

document.querySelector('.reload').addEventListener('click', () => {
  for (const frame of frames) frame.navigate(frame.path);
});

originButton.addEventListener('click', openTargetDialog);

function openTargetDialog() {
  dialog.querySelector('input').value = target?.href ?? '';
  dialog.querySelector('.error').textContent = '';
  dialog.querySelector('.cancel').hidden = !target;
  dialog.showModal();
}

dialog.querySelector('.cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (e) => !target && e.preventDefault());
dialog.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/target', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: dialog.querySelector('input').value }),
  });
  const data = await res.json();
  if (!res.ok) {
    dialog.querySelector('.error').textContent = data.error;
    return;
  }
  setServer(data);
  state.path = '/';
  frames = [];
  save();
  dialog.close();
  render();
});

addEventListener('message', (e) => {
  if (e.origin !== proxyOrigin || !e.data?.appify) return;
  frames.find((frame) => frame.iframe.contentWindow === e.source)?.onMessage(e.data);
});

new ResizeObserver(fit).observe(bench);

function setServer({ target: url, proxyPort }) {
  target = url ? new URL(url) : null;
  proxyOrigin = `${location.protocol}//${location.hostname}:${proxyPort}`;
  studio.target = target;
  studio.proxyOrigin = proxyOrigin;
}

function phoneOptions(selected) {
  const group = (os, label) =>
    `<optgroup label="${label}">${Object.values(DEVICES)
      .filter((d) => d.os === os)
      .map((d) => `<option value="${d.id}"${d.id === selected ? ' selected' : ''}>${d.name}</option>`)
      .join('')}</optgroup>`;
  return group('ios', 'iPhone') + group('android', 'Android');
}

const ctx = document.createElement('canvas').getContext('2d');
function ink(color) {
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const value = ctx.fillStyle;
  const [r, g, b] = value.startsWith('#')
    ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
    : value.match(/[\d.]+/g).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#000000' : '#ffffff';
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10) / 10;

function restore() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) ?? {};
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {}
}

const ICON_MIN =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 9.5h8"/></svg>';
const ICON_CLOSE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg>';
const ICON_SET =
  '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x=".65" y="3.65" width="3.3" height="7"/><rect x="5.15" y="3.65" width="3.3" height="7"/><rect x="9.65" y="3.65" width="3.3" height="7"/><rect x="14.15" y="3.65" width="3.3" height="7"/></svg>';

const emptyHint = document.createElement('p');
emptyHint.className = 'empty-hint';
emptyHint.hidden = true;

Object.assign(studio, { state, save, render, fit });
setServer(await (await fetch('/api/state')).json());
renderAddMenu();
renderDock();
syncControls();

// Feature modules register their panels and hooks before the first render.
const features = await (await fetch('/api/features')).json();
await Promise.all(features.map((url) => import(url).catch((err) => console.error(`Feature ${url} failed`, err))));

if (target) render();
else {
  bench.classList.add('empty');
  openTargetDialog();
}
