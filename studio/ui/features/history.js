// Versions of the app as it becomes a phone app. A checkpoint saves the code
// and a framed screenshot of every open device (the studio's checkpoint
// service keeps them in .appify/). History lists the versions, opens one,
// compares two with a before/after slider and plays them back one by one as a
// demo reel. Restoring rewrites the project's files, so it always asks first;
// the service saves the current files as a new version before restoring.
import { studio } from '/hooks.js';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = '/features/history.css';
document.head.append(stylesheet);

const svg = (body, w = 18, h = 14) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${body}</svg>`;
const ICON = {
  history: svg('<rect x="5.65" y=".65" width="9.7" height="10.2"/><path d="M3.15 3.15v10.2h9.7"/>'),
  checkpoint: svg('<path d="M4.65 13.35V.65h9.2l-2.2 3.1 2.2 3.1h-9.2"/>'),
  view: svg('<rect x="1.65" y="2.65" width="6.2" height="10.7"/><rect x="10.15" y="2.65" width="6.2" height="10.7"/>'),
  compare: svg('<rect x="3.65" y="1.65" width="10.7" height="11.7"/><path d="M9 .5v13M6.5 7H5m7.5 0H11"/>'),
  play: svg('<path d="M5.15 1.9v10.2L13.6 7Z"/>'),
  pause: svg('<path d="M5.65 2v10M12.35 2v10"/>'),
  prev: svg('<path d="M11 2 6 7l5 5"/>'),
  next: svg('<path d="m7 2 5 5-5 5"/>'),
  close: svg('<path d="m4.5 2.5 9 9m0-9-9 9"/>'),
  restore: svg('<path d="M4.4 4.6A5.35 5.35 0 1 1 3.65 8M4.4 1.5v3.1H7.5"/>'),
};

let versions = []; // checkpoint metas, oldest first
let saving = false;
const known = new Set(); // ids this page has seen, to flag versions an agent adds

const byId = (id) => versions.find((v) => v.id === id) ?? null;
const latest = () => versions.at(-1) ?? null;
const fileUrl = (v, file) => `/api/checkpoints/${encodeURIComponent(v.id)}/files/${encodeURIComponent(file)}`;
const isOriginal = (v) => !v.parent;

function titleOf(v) {
  return v.label && v.label !== v.id ? `${v.id} · ${v.label}` : v.id;
}

function changesOf(v) {
  if (isOriginal(v)) return 'original';
  const n = v.changes?.files ?? 0;
  return n === 0 ? 'no code changes' : n === 1 ? '1 file' : `${n} files`;
}

function metaOf(v) {
  return [v.by === 'agent' ? 'agent' : 'you', ago(v.createdAt), changesOf(v)].join(' · ');
}

function ago(iso) {
  const seconds = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// A phone on the current page makes the best thumbnail.
function thumbOf(v) {
  const shots = v.shots ?? [];
  const onPage = shots.filter((s) => s.page === studio.state.path);
  return (
    onPage.find((s) => s.device !== 'desktop') ??
    shots.find((s) => s.device !== 'desktop') ??
    onPage[0] ??
    shots[0] ??
    null
  );
}

function pagesOf(...list) {
  const pages = new Set();
  for (const v of list) for (const s of v?.shots ?? []) pages.add(s.page);
  return [...pages];
}

const escapeHtml = (text) =>
  String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---- Loading -------------------------------------------------------------

async function refresh() {
  try {
    const res = await fetch('/api/checkpoints');
    if (!res.ok) throw new Error(res.statusText);
    const { checkpoints } = await res.json();
    const fresh = checkpoints.filter((v) => !known.has(v.id));
    const firstLoad = known.size === 0;
    versions = checkpoints;
    for (const v of checkpoints) known.add(v.id);
    if (!firstLoad && fresh.length) flagFresh(fresh.at(-1));
  } catch {
    versions = [];
  }
  renderPanel();
  if (!overlay.hidden) renderOverlay();
}

// ---- Bottom panel: History and Checkpoint --------------------------------

const panel = document.createElement('section');
panel.className = 'panel hist';
panel.setAttribute('aria-label', 'Versions');
panel.innerHTML = `
  <button type="button" class="hist-open" aria-haspopup="dialog" aria-expanded="false" title="Versions of this app">
    ${ICON.history}<span>History</span><span class="hist-current"></span>
  </button>
  <button type="button" class="hist-save" aria-haspopup="dialog" aria-expanded="false" title="Save this version: code and a screenshot of every device">
    ${ICON.checkpoint}<span class="hist-save-label">Checkpoint</span><i class="hist-busy" aria-hidden="true"></i>
  </button>

  <div class="panel hist-pop hist-list-pop" role="dialog" aria-label="Versions" hidden>
    <p class="caption">Versions <span class="hist-count"></span></p>
    <ol class="hist-list"></ol>
    <p class="hist-empty">No versions yet. Save a checkpoint and it becomes v1.</p>
    <div class="hist-pop-actions">
      <button type="button" class="hist-act" data-act="compare">${ICON.compare}Compare first and latest</button>
      <button type="button" class="hist-act" data-act="play">${ICON.play}Play</button>
    </div>
  </div>

  <form class="panel hist-pop hist-save-pop" aria-label="Save a version" hidden>
    <p class="caption">New version</p>
    <label class="hist-field"><span>Name</span><input name="label" maxlength="60" autocomplete="off" spellcheck="false"></label>
    <label class="hist-field"><span>Note</span><textarea name="note" rows="2" placeholder="What changed (optional)"></textarea></label>
    <p class="hist-save-what"></p>
    <div class="hist-progress" hidden><i></i></div>
    <p class="hist-error" role="alert"></p>
    <div class="hist-pop-actions">
      <button type="button" class="btn quiet hist-cancel">Cancel</button>
      <button class="btn primary hist-submit">Save</button>
    </div>
  </form>`;
studio.addPanel('bottom', panel, 5);

const openButton = panel.querySelector('.hist-open');
const saveButton = panel.querySelector('.hist-save');
const listPop = panel.querySelector('.hist-list-pop');
const savePop = panel.querySelector('.hist-save-pop');
const list = panel.querySelector('.hist-list');

function renderPanel() {
  const last = latest();
  panel.querySelector('.hist-current').textContent = last ? last.id : '';
  openButton.title = last ? `Versions of this app (latest: ${titleOf(last)})` : 'Versions of this app';
  panel.querySelector('.hist-count').textContent = versions.length || '';
  panel.querySelector('.hist-empty').hidden = versions.length > 0;
  panel.querySelector('.hist-pop-actions').hidden = versions.length < 2;
  list.innerHTML = versions.map((v) => rowHTML(v)).join('');
}

function rowHTML(v, marks = '') {
  const thumb = thumbOf(v);
  return `
    <li><button type="button" class="hist-row" data-id="${escapeHtml(v.id)}">
      <span class="hist-thumb">${thumb ? `<img src="${fileUrl(v, thumb.file)}" alt="" loading="lazy" decoding="async">` : ''}</span>
      <span class="hist-row-main">
        <span class="hist-row-title"><b>${escapeHtml(v.id)}</b><span>${escapeHtml(v.label && v.label !== v.id ? v.label : '')}</span>${marks}</span>
        <span class="hist-meta">${escapeHtml(metaOf(v))}</span>
      </span>
    </button></li>`;
}

function setPop(pop, open) {
  const button = pop === listPop ? openButton : saveButton;
  if (open) {
    for (const other of [listPop, savePop]) if (other !== pop) setPop(other, false);
  }
  pop.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (open) toastEl.hidden = true;
  if (open && pop === listPop) {
    openButton.classList.remove('fresh');
    list.scrollTop = list.scrollHeight;
  }
}

openButton.addEventListener('click', () => {
  refresh();
  setPop(listPop, listPop.hidden);
});

saveButton.addEventListener('click', () => {
  if (!savePop.hidden) return setPop(savePop, false);
  prepareSave();
  setPop(savePop, true);
  savePop.elements.label.select();
});

list.addEventListener('click', (e) => {
  const row = e.target.closest('.hist-row');
  if (!row) return;
  setPop(listPop, false);
  openOverlay({ mode: 'view', id: row.dataset.id });
});

listPop.querySelector('.hist-pop-actions').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  setPop(listPop, false);
  if (act === 'compare') openOverlay({ mode: 'compare', a: versions[0]?.id, b: latest()?.id });
  else openOverlay({ mode: 'play', id: versions[0]?.id });
});

document.addEventListener('pointerdown', (e) => {
  if (saving) return;
  if (!e.target.closest('.hist')) {
    setPop(listPop, false);
    setPop(savePop, false);
  }
});

panel.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || saving) return;
  const open = !listPop.hidden ? listPop : !savePop.hidden ? savePop : null;
  if (!open) return;
  e.stopPropagation();
  setPop(open, false);
  (open === listPop ? openButton : saveButton).focus();
});

// ---- Saving a checkpoint ---------------------------------------------------

// Pages to capture: the ones earlier versions have, plus the current one, so
// every version can be compared page by page.
function pagesToCapture() {
  return [...new Set([...pagesOf(latest()), studio.state.path])];
}

function prepareSave() {
  const n = (latest()?.n ?? versions.length) + 1;
  savePop.elements.label.value = `v${n}`;
  savePop.elements.note.value = '';
  savePop.querySelector('.hist-submit').textContent = `Save v${n}`;
  savePop.querySelector('.hist-error').textContent = '';
  const devices = studio.frames.filter((f) => !f.win.minimized).length;
  const pages = pagesToCapture();
  savePop.querySelector('.hist-save-what').textContent =
    `Saves your code and a screenshot of ${devices === 1 ? 'the open device' : `the ${devices} open devices`} on ${
      pages.length === 1 ? pages[0] : `${pages.length} pages`
    }.`;
}

savePop.querySelector('.hist-cancel').addEventListener('click', () => !saving && setPop(savePop, false));

savePop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.name === 'label') {
    e.preventDefault();
    savePop.requestSubmit();
  }
});

savePop.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving) return;
  const label = savePop.elements.label.value.trim();
  const note = savePop.elements.note.value.trim();
  const submit = savePop.querySelector('.hist-submit');
  const name = submit.textContent.replace(/^Save /, '');
  setSaving(true, `Saving ${name}…`);
  try {
    await postState(true);
    const res = await fetch('/api/checkpoints', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: label || name, note, by: 'user', pages: pagesToCapture() }),
    });
    const meta = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(meta.error ?? `The studio couldn't save this version (${res.status}).`);
    known.add(meta.id);
    setSaving(false);
    setPop(savePop, false);
    await refresh();
    flagFresh(meta, true);
    toast(`Saved ${titleOf(meta)}`, { label: 'View', run: () => openOverlay({ mode: 'view', id: meta.id }) });
  } catch (err) {
    setSaving(false);
    savePop.querySelector('.hist-error').textContent = err.message;
  }
});

function setSaving(on, text) {
  saving = on;
  const submit = savePop.querySelector('.hist-submit');
  submit.disabled = on;
  savePop.querySelector('.hist-cancel').disabled = on;
  for (const field of savePop.querySelectorAll('input, textarea')) field.disabled = on;
  savePop.querySelector('.hist-progress').hidden = !on;
  saveButton.classList.toggle('busy', on);
  saveButton.querySelector('.hist-save-label').textContent = on ? 'Saving…' : 'Checkpoint';
  if (on) submit.textContent = text;
  else prepareSave();
}

// A new version shows a marker on History until the list is opened.
function flagFresh(meta, mine = false) {
  if (listPop.hidden) openButton.classList.add('fresh');
  if (!mine) toast(`${meta.by === 'agent' ? 'The agent saved' : 'New version:'} ${titleOf(meta)}`, {
    label: 'View',
    run: () => openOverlay({ mode: 'view', id: meta.id }),
  });
}

// ---- Telling the service which devices are open ----------------------------

// CLI checkpoints (`appify checkpoint`) capture the same windows and settings
// the studio shows, so the studio reports them whenever they change.
let postedState = '';
async function postState(force = false) {
  const s = studio.state;
  const body = JSON.stringify({
    windows: s.windows,
    mode: s.mode,
    path: s.path,
    orientation: s.orientation ?? 'portrait',
    appearance: s.appearance ?? 'system',
  });
  if (body === postedState && !force) return;
  postedState = body;
  try {
    await fetch('/api/studio-state', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  } catch {}
}
let postTimer;
const postSoon = () => {
  clearTimeout(postTimer);
  postTimer = setTimeout(postState, 400);
};
studio.onFrame(postSoon);
studio.onMessage((frame, msg) => msg.type === 'page' && postSoon());
setInterval(postState, 1500);

// ---- Toast -----------------------------------------------------------------

const toastEl = document.createElement('div');
toastEl.className = 'hist-toast';
toastEl.setAttribute('role', 'status');
toastEl.hidden = true;
document.body.append(toastEl);
let toastTimer;

function toast(text, action) {
  toastEl.innerHTML = `<span></span>${action ? `<button type="button">${escapeHtml(action.label)}</button>` : ''}`;
  toastEl.querySelector('span').textContent = text;
  toastEl.querySelector('button')?.addEventListener('click', () => {
    toastEl.hidden = true;
    action.run();
  });
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 6000);
}

// ---- Overlay: view, compare, play -------------------------------------------

const overlay = document.createElement('div');
overlay.className = 'hx';
overlay.hidden = true;
overlay.setAttribute('role', 'dialog');
overlay.setAttribute('aria-modal', 'true');
overlay.setAttribute('aria-label', 'Version history');
overlay.tabIndex = -1;
overlay.innerHTML = `
  <div class="hx-stage"></div>

  <section class="panel hx-side hx-versions" aria-label="Versions">
    <p class="caption">Versions <span class="hx-count"></span></p>
    <ol class="hist-list hx-list"></ol>
  </section>

  <section class="panel hx-side hx-info" aria-live="polite"></section>

  <div class="hx-title" aria-live="polite"></div>

  <div class="panel hx-bar">
    <div class="hx-seg hx-modes" role="group" aria-label="Show">
      <button type="button" data-mode="view">${ICON.view}View</button>
      <button type="button" data-mode="compare">${ICON.compare}Compare</button>
      <button type="button" data-mode="play">${ICON.play}Play</button>
    </div>
    <div class="hx-seg hx-pages" role="group" aria-label="Page"></div>
    <div class="hx-pair">
      <label><span class="caption">Before</span><select class="hx-a" aria-label="Before"></select></label>
      <span class="hx-arrow" aria-hidden="true">→</span>
      <label><span class="caption">After</span><select class="hx-b" aria-label="After"></select></label>
    </div>
    <div class="hx-step">
      <button type="button" class="hx-icon hx-prev" aria-label="Previous version (←)" title="Previous version (←)">${ICON.prev}</button>
      <span class="hx-pos"></span>
      <button type="button" class="hx-icon hx-next" aria-label="Next version (→)" title="Next version (→)">${ICON.next}</button>
      <button type="button" class="hx-auto" aria-pressed="false" title="Play automatically (Space)">${ICON.play}<span>Auto</span></button>
    </div>
    <button type="button" class="hx-icon hx-close" aria-label="Close history (Esc)" title="Close (Esc)">${ICON.close}</button>
  </div>`;
document.body.append(overlay);

const stage = overlay.querySelector('.hx-stage');
const sideList = overlay.querySelector('.hx-list');
const info = overlay.querySelector('.hx-info');
const titleEl = overlay.querySelector('.hx-title');
const selectA = overlay.querySelector('.hx-a');
const selectB = overlay.querySelector('.hx-b');
const autoButton = overlay.querySelector('.hx-auto');

const view = { mode: 'view', id: null, a: null, b: null, page: '/', pos: 50, auto: null, bare: false };

function openOverlay({ mode = 'view', id, a, b } = {}) {
  if (!versions.length) return;
  view.mode = mode;
  view.id = byId(id)?.id ?? latest().id;
  if (mode === 'compare') {
    view.b = byId(b)?.id ?? view.id;
    view.a = byId(a)?.id ?? previousOf(view.b)?.id ?? versions[0].id;
  }
  const pages = pagesOf(...versions);
  view.page = pages.includes(studio.state.path) ? studio.state.path : (pages[0] ?? '/');
  view.bare = false;
  overlay.hidden = false;
  document.body.classList.add('hx-open');
  renderOverlay(true);
  overlay.focus();
}

function closeOverlay() {
  stopAuto();
  overlay.hidden = true;
  view.bare = false;
  document.body.classList.remove('hx-open', 'hx-bare');
  stage.replaceChildren();
  openButton.focus();
}

function previousOf(id) {
  const i = versions.findIndex((v) => v.id === id);
  return i > 0 ? versions[i - 1] : null;
}

function setMode(mode) {
  if (mode === view.mode) return;
  stopAuto();
  if (mode === 'compare') {
    const current = byId(view.id) ?? latest();
    const before = previousOf(current.id);
    // The selected version against the one before it; from v1, the whole way.
    view.b = before ? current.id : latest().id;
    view.a = before ? before.id : versions[0].id;
  }
  if (mode === 'view' && view.mode === 'compare') view.id = view.b;
  view.mode = mode;
  renderOverlay(true);
}

function step(delta) {
  if (view.mode === 'compare') return;
  const i = versions.findIndex((v) => v.id === view.id);
  const next = versions[Math.min(versions.length - 1, Math.max(0, i + delta))];
  if (!next || next.id === view.id) return false;
  view.id = next.id;
  renderOverlay();
  return true;
}

function renderOverlay(reset = false) {
  overlay.dataset.mode = view.mode;
  setBare(view.bare);
  for (const button of overlay.querySelectorAll('.hx-modes button')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === view.mode));
  }

  // Side list
  overlay.querySelector('.hx-count').textContent = versions.length;
  sideList.innerHTML = versions
    .map((v) => {
      let marks = '';
      if (view.mode === 'compare') {
        if (v.id === view.a) marks += '<i class="hist-mark">before</i>';
        if (v.id === view.b) marks += '<i class="hist-mark">after</i>';
      }
      return rowHTML(v, marks);
    })
    .join('');
  const current = view.mode === 'compare' ? view.b : view.id;
  for (const row of sideList.querySelectorAll('.hist-row')) {
    row.setAttribute('aria-current', String(row.dataset.id === current));
  }
  sideList.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });

  // Pages
  const relevant = view.mode === 'compare' ? [byId(view.a), byId(view.b)] : versions;
  const pages = pagesOf(...relevant);
  if (!pages.includes(view.page)) view.page = pages[0] ?? '/';
  const pageGroup = overlay.querySelector('.hx-pages');
  pageGroup.hidden = pages.length < 2;
  pageGroup.innerHTML = pages
    .map((p) => `<button type="button" data-page="${escapeHtml(p)}" aria-pressed="${p === view.page}">${escapeHtml(p)}</button>`)
    .join('');

  // Before / after pickers
  const options = (selected) =>
    versions
      .map((v) => `<option value="${escapeHtml(v.id)}"${v.id === selected ? ' selected' : ''}>${escapeHtml(titleOf(v))}</option>`)
      .join('');
  selectA.innerHTML = options(view.a);
  selectB.innerHTML = options(view.b);

  // Stepper
  const i = versions.findIndex((v) => v.id === view.id);
  overlay.querySelector('.hx-prev').disabled = i <= 0;
  overlay.querySelector('.hx-next').disabled = i >= versions.length - 1;
  overlay.querySelector('.hx-pos').innerHTML =
    view.mode === 'play'
      ? versions
          .map((v, n) => `<button type="button" class="hx-dot" data-id="${escapeHtml(v.id)}" aria-label="${escapeHtml(titleOf(v))}" aria-current="${n === i}"></button>`)
          .join('')
      : `<span>${escapeHtml(versions[i]?.id ?? '')}</span><span class="hx-of">of ${versions.length}</span>`;

  renderInfo();
  renderTitle();
  renderStage(reset);
}

function renderInfo() {
  const v = byId(view.id);
  if (!v || view.mode !== 'view') return (info.innerHTML = '');
  const files = v.changes?.list ?? [];
  const shown = files.slice(0, 8);
  const lines =
    v.changes && !isOriginal(v)
      ? `${changesOf(v)}${v.changes.files ? `, +${v.changes.insertions ?? 0} −${v.changes.deletions ?? 0}` : ''}`
      : 'The app as the studio first saw it.';
  info.innerHTML = `
    <p class="caption">${escapeHtml(v.id)} <span>${v.by === 'agent' ? 'agent' : 'you'}</span></p>
    <h2 class="hx-info-title">${escapeHtml(v.label && v.label !== v.id ? v.label : v.id)}</h2>
    ${v.note ? `<p class="hx-info-note">${escapeHtml(v.note)}</p>` : ''}
    <p class="hx-info-meta">${escapeHtml(when(v.createdAt))}</p>
    <p class="caption hx-files-caption">Changes</p>
    <p class="hx-info-meta">${escapeHtml(lines)}</p>
    ${shown.length ? `<ul class="hx-files">${shown.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}${files.length > shown.length ? `<li class="hx-more">and ${files.length - shown.length} more</li>` : ''}</ul>` : ''}
    <button type="button" class="hx-restore-open">${ICON.restore}Restore ${escapeHtml(v.id)}…</button>`;
  info.querySelector('.hx-restore-open').addEventListener('click', () => askRestore(v));
}

function renderTitle() {
  const v = byId(view.id);
  if (!v || view.mode !== 'play') return (titleEl.innerHTML = '');
  const i = versions.indexOf(v);
  titleEl.innerHTML = `
    <p class="hx-title-step">${escapeHtml(v.id)} <span>${i + 1} / ${versions.length}</span></p>
    <h2>${escapeHtml(v.label && v.label !== v.id ? v.label : v.id)}</h2>
    ${v.note ? `<p class="hx-title-note">${escapeHtml(v.note)}</p>` : ''}`;
}

// Lays shots out side by side at one scale, like the live devices.
function measure(items) {
  const css = getComputedStyle(overlay);
  const num = (name) => parseFloat(css.getPropertyValue(name)) || 0;
  const gap = num('--hx-gap');
  const roomW = innerWidth - num('--hx-x') * 2 - gap * (items.length - 1);
  const roomH = innerHeight - num('--hx-top') - num('--hx-bottom') - num('--hx-caption');
  const sumW = items.reduce((sum, s) => sum + s.width, 0);
  const maxH = Math.max(...items.map((s) => s.height));
  return Math.min(1, roomW / sumW, roomH / maxH);
}

function shotsOn(v, page) {
  return (v?.shots ?? []).filter((s) => s.page === page);
}

function renderStage(reset) {
  const row = document.createElement('div');
  row.className = 'hx-row';

  if (view.mode === 'compare') {
    const a = byId(view.a);
    const b = byId(view.b);
    const before = shotsOn(a, view.page);
    const after = shotsOn(b, view.page);
    const devices = [...new Set([...after, ...before].map((s) => s.device))];
    const pairs = devices.map((device) => ({
      device,
      a: before.find((s) => s.device === device),
      b: after.find((s) => s.device === device),
    }));
    const s = measure(pairs.map((p) => p.b ?? p.a));
    stage.style.setProperty('--pos', `${view.pos}%`);
    for (const pair of pairs) row.append(comparison(pair, a, b, s));
  } else {
    const v = byId(view.id);
    const shots = shotsOn(v, view.page);
    if (shots.length) {
      const s = measure(shots);
      for (const shot of shots) row.append(figure(v, shot, s));
    } else {
      row.innerHTML = `<p class="hx-none">${escapeHtml(v.id)} has no screenshots of ${escapeHtml(view.page)}.</p>`;
    }
  }

  const old = stage.querySelector('.hx-row:not(.leaving)');
  if (old && !reset && view.mode === 'play') {
    old.classList.add('leaving');
    setTimeout(() => old.remove(), 450);
    row.classList.add('entering');
    stage.append(row);
    requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('entering')));
  } else {
    stage.replaceChildren(row);
  }
}

function figure(v, shot, s) {
  const el = document.createElement('figure');
  el.className = 'hx-shot';
  const w = Math.round(shot.width * s);
  const h = Math.round(shot.height * s);
  el.innerHTML = `<img src="${fileUrl(v, shot.file)}" alt="${escapeHtml(`${shot.name} at ${titleOf(v)}`)}" width="${w}" height="${h}" decoding="async"><figcaption>${escapeHtml(shot.name)}</figcaption>`;
  return el;
}

function comparison({ a: shotA, b: shotB }, a, b, s) {
  const shot = shotB ?? shotA;
  if (!shotA || !shotB) {
    const el = figure(shotB ? b : a, shot, s);
    el.querySelector('figcaption').textContent = `${shot.name} · only in ${shotB ? b.id : a.id}`;
    return el;
  }
  const el = document.createElement('figure');
  el.className = 'hx-shot hx-cmp';
  const w = Math.round(shot.width * s);
  const h = Math.round(shot.height * s);
  el.innerHTML = `
    <div class="hx-cmp-box" style="width:${w}px;height:${h}px">
      <img class="hx-before" src="${fileUrl(a, shotA.file)}" alt="${escapeHtml(`${shotA.name} at ${titleOf(a)}`)}" decoding="async">
      <img class="hx-after" src="${fileUrl(b, shotB.file)}" alt="${escapeHtml(`${shotB.name} at ${titleOf(b)}`)}" decoding="async">
      <span class="hx-tag hx-tag-a">${escapeHtml(a.id)}</span>
      <span class="hx-tag hx-tag-b">${escapeHtml(b.id)}</span>
      <span class="hx-handle" role="slider" tabindex="0" aria-label="Before and after, ${escapeHtml(shot.name)}"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(view.pos)}"><i></i></span>
    </div>
    <figcaption>${escapeHtml(shot.name)}</figcaption>`;
  const box = el.querySelector('.hx-cmp-box');
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    const move = (ev) => setPos(((ev.clientX - box.getBoundingClientRect().left) / box.offsetWidth) * 100);
    move(e);
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', () => box.removeEventListener('pointermove', move), { once: true });
    el.querySelector('.hx-handle').focus({ preventScroll: true });
  });
  el.querySelector('.hx-handle').addEventListener('keydown', (e) => {
    const delta = { ArrowLeft: -5, ArrowRight: 5, Home: -100, End: 100 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    setPos(view.pos + delta);
  });
  return el;
}

// One slider position for every device, so they move together.
function setPos(pos) {
  view.pos = Math.min(100, Math.max(0, pos));
  stage.style.setProperty('--pos', `${view.pos}%`);
  for (const handle of stage.querySelectorAll('.hx-handle')) handle.setAttribute('aria-valuenow', String(Math.round(view.pos)));
}

function setBare(bare) {
  view.bare = bare;
  overlay.classList.toggle('bare', bare);
  document.body.classList.toggle('hx-bare', bare);
}

function startAuto() {
  if (view.auto) return;
  if (versions.findIndex((v) => v.id === view.id) >= versions.length - 1) {
    view.id = versions[0].id;
    renderOverlay();
  }
  view.auto = setInterval(() => !step(1) && stopAuto(), 2600);
  autoButton.setAttribute('aria-pressed', 'true');
  autoButton.innerHTML = `${ICON.pause}<span>Pause</span>`;
}

function stopAuto() {
  clearInterval(view.auto);
  view.auto = null;
  autoButton.setAttribute('aria-pressed', 'false');
  autoButton.innerHTML = `${ICON.play}<span>Auto</span>`;
}

overlay.querySelector('.hx-modes').addEventListener('click', (e) => {
  const mode = e.target.closest('[data-mode]')?.dataset.mode;
  if (mode) setMode(mode);
});
overlay.querySelector('.hx-pages').addEventListener('click', (e) => {
  const page = e.target.closest('[data-page]')?.dataset.page;
  if (page && page !== view.page) {
    view.page = page;
    renderOverlay(true);
  }
});
overlay.querySelector('.hx-prev').addEventListener('click', () => (stopAuto(), step(-1)));
overlay.querySelector('.hx-next').addEventListener('click', () => (stopAuto(), step(1)));
overlay.querySelector('.hx-pos').addEventListener('click', (e) => {
  const id = e.target.closest('.hx-dot')?.dataset.id;
  if (!id) return;
  stopAuto();
  view.id = id;
  renderOverlay();
});
autoButton.addEventListener('click', () => (view.auto ? stopAuto() : startAuto()));
overlay.querySelector('.hx-close').addEventListener('click', closeOverlay);
selectA.addEventListener('change', () => ((view.a = selectA.value), renderOverlay(true)));
selectB.addEventListener('change', () => ((view.b = selectB.value), renderOverlay(true)));

sideList.addEventListener('click', (e) => {
  const id = e.target.closest('.hist-row')?.dataset.id;
  if (!id) return;
  if (view.mode === 'compare') {
    view.b = id;
    view.a = previousOf(id)?.id ?? view.a;
  } else {
    view.id = id;
  }
  renderOverlay(true);
});

// Keys while the history is open: Esc closes, ←/→ step (or move the
// slider when comparing), Space plays, H hides the controls for recording.
addEventListener(
  'keydown',
  (e) => {
    if (overlay.hidden || restoreDialog.open) return;
    e.stopPropagation();
    if (e.target.closest?.('select, input, textarea')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (view.bare) {
        view.bare = false;
        renderOverlay();
      } else {
        closeOverlay();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.target.closest?.('.hx-handle')) return;
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? -1 : 1;
      if (view.mode === 'compare') setPos(view.pos + delta * 5);
      else {
        stopAuto();
        step(delta);
      }
    } else if (e.key === ' ' && view.mode === 'play') {
      e.preventDefault();
      view.auto ? stopAuto() : startAuto();
    } else if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) {
      setBare(!view.bare);
    }
  },
  true,
);

addEventListener('resize', () => !overlay.hidden && renderStage(true));

// ---- Restore ---------------------------------------------------------------

const restoreDialog = document.createElement('dialog');
restoreDialog.className = 'target-dialog hx-restore';
restoreDialog.innerHTML = `
  <form method="dialog">
    <p class="caption">Restore</p>
    <h2></h2>
    <p class="dialog-copy"></p>
    <p class="error" role="alert"></p>
    <div class="dialog-actions">
      <button type="button" class="btn quiet hx-r-cancel">Cancel</button>
      <button type="button" class="btn primary hx-r-go"></button>
    </div>
  </form>`;
document.body.append(restoreDialog);
let restoring = null;

function askRestore(v) {
  restoring = v;
  restoreDialog.querySelector('h2').textContent = `Go back to ${v.id}?`;
  restoreDialog.querySelector('.dialog-copy').textContent =
    `This rewrites your project's files to how they were at ${titleOf(v)}. ` +
    'First the studio saves your current files as a new version, so you can come back to them.';
  restoreDialog.querySelector('.error').textContent = '';
  const go = restoreDialog.querySelector('.hx-r-go');
  go.textContent = `Restore ${v.id}`;
  go.disabled = false;
  restoreDialog.querySelector('.hx-r-cancel').disabled = false;
  restoreDialog.showModal();
  restoreDialog.querySelector('.hx-r-cancel').focus();
}

restoreDialog.querySelector('.hx-r-cancel').addEventListener('click', () => restoreDialog.close());
restoreDialog.addEventListener('cancel', (e) => restoreDialog.querySelector('.hx-r-go').disabled && e.preventDefault());
restoreDialog.querySelector('.hx-r-go').addEventListener('click', async () => {
  const v = restoring;
  const go = restoreDialog.querySelector('.hx-r-go');
  go.disabled = true;
  restoreDialog.querySelector('.hx-r-cancel').disabled = true;
  go.textContent = `Restoring ${v.id}…`;
  try {
    const res = await fetch(`/api/checkpoints/${encodeURIComponent(v.id)}/restore`, { method: 'POST' });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error ?? `The studio couldn't restore ${v.id} (${res.status}).`);
    restoreDialog.close();
    closeOverlay();
    await refresh();
    for (const frame of studio.frames) frame.navigate(frame.path);
    const backup = typeof result.backup === 'string' ? result.backup : result.backup?.id;
    toast(`Restored ${titleOf(v)}.${backup ? ` Your files from before are saved as ${backup}.` : ''}`);
  } catch (err) {
    restoreDialog.querySelector('.error').textContent = err.message;
    go.disabled = false;
    restoreDialog.querySelector('.hx-r-cancel').disabled = false;
    go.textContent = `Restore ${v.id}`;
  }
});

// ---- Start -----------------------------------------------------------------

renderPanel();
refresh();
postState();
setInterval(() => document.visibilityState === 'visible' && refresh(), 4000);
