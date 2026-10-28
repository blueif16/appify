// Comments: point at any element in any device and say what's wrong. They are
// saved to .appify/comments.json in the project, where coding agents read them
// with `appify comments`.
import { studio } from '/hooks.js';

const ICON_COMMENT =
  '<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2.65.65h12.7v9.2H8.2L5 12.9V9.85H2.65Z"/></svg>';
const ICON_RESOLVE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m2 6.5 2.6 2.6L10 3.5"/></svg>';
const ICON_DELETE =
  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg>';

const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = '/features/comments.css';
document.head.append(style);

let comments = [];
let commenting = false;
let draft = null; // { frame, element, viewport, page } while the composer is open

// ---- Panel -------------------------------------------------------------

const panel = document.createElement('section');
panel.className = 'panel cm-panel';
panel.setAttribute('aria-label', 'Comments');
panel.innerHTML = `
  <p class="caption">Comments <span class="cm-count">0</span></p>
  <button type="button" class="cm-toggle" aria-pressed="false" title="Point at anything in a device and say what's wrong">
    ${ICON_COMMENT}<span>Comment</span><kbd>C</kbd>
  </button>
  <ol class="cm-list"></ol>`;
studio.addPanel('left', panel, 20);

const toggle = panel.querySelector('.cm-toggle');
const count = panel.querySelector('.cm-count');
const list = panel.querySelector('.cm-list');

const hint = document.createElement('p');
hint.className = 'cm-hint-bar';
hint.hidden = true;
hint.textContent = 'Click anything in a device to comment on it. Esc to stop.';
document.body.append(hint);

// ---- Composer ----------------------------------------------------------

const composer = document.createElement('form');
composer.className = 'panel cm-composer';
composer.hidden = true;
composer.innerHTML = `
  <p class="caption">Comment on <span class="cm-where"></span></p>
  <p class="cm-target"></p>
  <textarea rows="3" placeholder="What's wrong here?" aria-label="Comment"></textarea>
  <p class="cm-error" role="alert"></p>
  <div class="cm-composer-actions">
    <span class="cm-keys">Enter to save</span>
    <button type="button" class="cm-btn cm-cancel">Cancel</button>
    <button class="cm-btn primary">Save</button>
  </div>`;
document.body.append(composer);
const textarea = composer.querySelector('textarea');
const errorLine = composer.querySelector('.cm-error');

// ---- Comment mode ------------------------------------------------------

function setCommenting(on) {
  commenting = on;
  toggle.setAttribute('aria-pressed', String(on));
  hint.hidden = !on;
  if (!on) closeComposer();
  for (const frame of studio.frames) frame.send({ type: 'pick', on });
}

const openComments = () =>
  comments.filter((c) => c.status === 'open').sort((a, b) => num(a) - num(b));
const num = (comment) => Number(comment.id.slice(1));

function pinsFor(frame, page) {
  return openComments()
    .filter((c) => c.page === page && c.element?.selector)
    .map((c) => ({ id: c.id, n: num(c), selector: c.element.selector, own: c.device?.id === frame.device.id }));
}

function sync(frame, page = frame.path) {
  frame.send({ type: 'pick', on: commenting });
  frame.send({ type: 'pins', pins: pinsFor(frame, page) });
}
const syncAll = () => studio.frames.forEach((frame) => sync(frame));

studio.onMessage((frame, msg) => {
  if (msg.type === 'page') sync(frame, msg.info.path);
  else if (msg.type === 'picked') startDraft(frame, msg);
  else if (msg.type === 'pick-cancel') setCommenting(false);
  else if (msg.type === 'pin') highlight(msg.id);
});

function startDraft(frame, msg) {
  if (draft && draft.frame !== frame) draft.frame.send({ type: 'pick-clear' });
  draft = { frame, element: msg.element, viewport: msg.viewport, page: msg.page };
  composer.querySelector('.cm-where').textContent = frame.device.name;
  const target = composer.querySelector('.cm-target');
  target.textContent = msg.element.selector;
  target.title = msg.element.text ? `${msg.element.selector}\n“${msg.element.text}”` : msg.element.selector;
  errorLine.textContent = '';
  composer.hidden = false;
  place();
  textarea.focus();
}

// Beside the device, level with the picked element.
function place() {
  if (!draft) return;
  const device = draft.frame.el.querySelector('.frame-scale').getBoundingClientRect();
  const iframe = draft.frame.iframe.getBoundingClientRect();
  const k = iframe.width / (draft.frame.iframe.offsetWidth || 1);
  const width = composer.offsetWidth;
  const height = composer.offsetHeight;
  let left = device.right + 16;
  if (left + width > innerWidth - 12) left = device.left - width - 16;
  if (left < 12) left = Math.min(Math.max(12, device.left + 12), innerWidth - width - 12);
  const y = iframe.top + draft.element.rect.y * k - 24;
  composer.style.left = `${left}px`;
  composer.style.top = `${Math.min(Math.max(12, y), innerHeight - height - 12)}px`;
}

function closeComposer() {
  composer.hidden = true;
  draft?.frame.send({ type: 'pick-clear' });
  draft = null;
}

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textarea.value.trim();
  if (!text || !draft) return;
  const { frame } = draft;
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      page: draft.page,
      device: { id: frame.device.id, name: frame.device.name, os: frame.device.os },
      mode: frame.device.kind === 'desktop' ? 'browser' : studio.state.mode,
      viewport: draft.viewport,
      element: draft.element,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    errorLine.textContent = data.error;
    return;
  }
  comments.push(data);
  textarea.value = '';
  closeComposer();
  renderList();
  syncAll();
});

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    composer.requestSubmit();
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    closeComposer();
  }
});
composer.querySelector('.cm-cancel').addEventListener('click', closeComposer);
toggle.addEventListener('click', () => setCommenting(!commenting));
addEventListener('resize', place);

document.addEventListener('keydown', (e) => {
  const typing = e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]');
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'c' || e.key === 'C') setCommenting(!commenting);
  else if (e.key === 'Escape' && commenting) setCommenting(false);
});

// ---- List --------------------------------------------------------------

function renderList() {
  const open = openComments();
  count.textContent = open.length;
  if (!open.length) {
    const empty = document.createElement('li');
    empty.className = 'cm-empty';
    empty.textContent = 'No open comments.';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(
    ...open.map((comment) => {
      const li = document.createElement('li');
      li.className = 'cm-item';
      li.dataset.id = comment.id;
      li.tabIndex = 0;
      li.innerHTML = `
        <span class="cm-num">${num(comment)}</span>
        <span class="cm-body"><span class="cm-text"></span><span class="cm-meta"></span></span>
        <span class="cm-actions">
          <button type="button" class="cm-resolve" title="Resolve" aria-label="Resolve comment ${num(comment)}">${ICON_RESOLVE}</button>
          <button type="button" class="cm-delete" title="Delete" aria-label="Delete comment ${num(comment)}">${ICON_DELETE}</button>
        </span>`;
      li.querySelector('.cm-text').textContent = comment.text;
      li.querySelector('.cm-meta').textContent = `${comment.device?.name ?? ''} · ${comment.page}`;
      li.addEventListener('click', (e) => !e.target.closest('button') && show(comment));
      li.addEventListener('keydown', (e) => e.key === 'Enter' && e.target === li && show(comment));
      li.querySelector('.cm-resolve').addEventListener('click', () => update(comment, { status: 'resolved' }));
      li.querySelector('.cm-delete').addEventListener('click', () => remove(comment));
      return li;
    }),
  );
}

// Opens the comment's page in every device if they're elsewhere.
function show(comment) {
  highlight(comment.id);
  if (studio.frames.every((frame) => frame.path === comment.page)) return;
  studio.state.path = comment.page;
  studio.save();
  const pathInput = document.querySelector('.path');
  if (pathInput) pathInput.value = comment.page;
  for (const frame of studio.frames) frame.navigate(comment.page);
}

function highlight(id) {
  for (const li of list.querySelectorAll('.cm-item')) li.classList.toggle('cm-active', li.dataset.id === id);
  list.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}

async function update(comment, patch) {
  const res = await fetch(`/api/comments/${comment.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return;
  Object.assign(comment, await res.json());
  renderList();
  syncAll();
}

async function remove(comment) {
  const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
  if (!res.ok) return;
  comments = comments.filter((c) => c !== comment);
  renderList();
  syncAll();
}

try {
  comments = await (await fetch('/api/comments')).json();
} catch {
  comments = [];
}
renderList();
