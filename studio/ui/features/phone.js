// Phone interaction: rotate, the on-screen keyboard, working browser buttons
// and Android's system Back. The page side lives in frame/10-interact.js.

import { studio } from '/hooks.js';
import { screenSize } from '/devices.js';
import { keyboardHTML } from '/features/phone/keyboard.js';

const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = '/features/phone.css';
document.head.append(style);

const state = studio.state;
state.orientation ??= 'portrait';
state.keyboard ??= 'on';

// ---- Panel ---------------------------------------------------------------

const panel = document.createElement('section');
panel.className = 'panel phone-panel';
panel.setAttribute('aria-label', 'Phone');
panel.innerHTML = `
  <p class="caption">Rotate</p>
  <div class="seg seg-row" role="group" aria-label="Rotate" data-key="orientation">
    <button type="button" data-value="portrait">Portrait</button>
    <button type="button" data-value="landscape">Landscape</button>
  </div>
  <p class="caption">Keyboard</p>
  <div class="seg seg-row" role="group" aria-label="Keyboard" data-key="keyboard">
    <button type="button" data-value="on">On</button>
    <button type="button" data-value="off">Off</button>
  </div>`;
studio.addPanel('right', panel, 30);

const syncPanel = () => {
  for (const group of panel.querySelectorAll('.seg')) {
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(state[group.dataset.key] === button.dataset.value));
    }
  }
};
syncPanel();

panel.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  const key = button?.closest('.seg')?.dataset.key;
  if (!key || state[key] === button.dataset.value) return;
  state[key] = button.dataset.value;
  studio.save();
  syncPanel();
  if (key === 'orientation') {
    for (const frame of studio.frames) {
      hideKeyboard(frame);
      frame.setOrientation(state.orientation);
    }
    studio.fit();
  } else if (state.keyboard === 'off') {
    for (const frame of studio.frames) hideKeyboard(frame);
  }
});

// ---- Frames --------------------------------------------------------------

studio.onConfig((frame) =>
  frame.device.kind === 'phone'
    ? { orientation: frame.orientation, screen: { width: frame.device.width, height: frame.device.height } }
    : {},
);

studio.onFrame((frame) => {
  for (const button of frame.el.querySelectorAll('[data-act]')) {
    button.addEventListener('click', () => {
      if (!button.classList.contains('off')) frame.send({ type: 'nav', action: button.dataset.act });
    });
  }
  if (frame.device.kind !== 'phone') return;

  frame.kb = document.createElement('div');
  frame.kb.className = `kb ${frame.device.os}`;
  frame.kb.setAttribute('aria-hidden', 'true');
  frame.screen.append(frame.kb);
  // Keep focus in the page while keys are pressed.
  frame.kb.addEventListener('mousedown', (e) => {
    e.preventDefault();
    pressKey(frame, e.target.closest('[data-key]')?.dataset.key);
  });

  // Android's Back works from either screen edge. Hovering an edge shows the
  // back arrow; clicking it goes back (or closes the keyboard first).
  if (frame.device.os === 'android') {
    for (const side of ['left', 'right']) {
      const edge = document.createElement('button');
      edge.type = 'button';
      edge.className = `back-edge ${side}`;
      edge.title = 'Android Back (swipe from the edge)';
      edge.setAttribute('aria-label', 'Android Back');
      edge.innerHTML =
        '<span class="back-bubble"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg></span>';
      edge.addEventListener('click', () => {
        if (frame.kbField) frame.send({ type: 'blur' });
        else frame.send({ type: 'nav', action: 'back' });
      });
      frame.screen.append(edge);
    }
  }
});

studio.onMessage((frame, msg) => {
  if (msg.type === 'keyboard') {
    if (msg.open && state.keyboard === 'on') showKeyboard(frame, msg);
    else if (!msg.open) hideKeyboard(frame);
  } else if (msg.type === 'keyboard-pan') {
    // A zoomed-in field is already placed above the keyboard.
    if (frame.panLayer && !frame.lastZoom) {
      frame.panLayer.style.transform = msg.pan ? `translateY(${-msg.pan * frame.k}px)` : '';
    }
  } else if (msg.type === 'history') {
    frame.el.querySelector('[data-act="back"]')?.classList.toggle('off', !msg.canGoBack);
    frame.el.querySelector('[data-act="forward"]')?.classList.toggle('off', !msg.canGoForward);
  } else if (msg.type === 'nav-edge' && msg.action === 'back' && frame.device.os === 'android') {
    const where = state.mode === 'installed' ? 'leaves the app' : 'closes the tab';
    flashNote(frame, `Back here ${where}: there's no earlier screen in this app. A sheet or modal that's open should close on Back instead.`);
  } else if (msg.type === 'page' && frame.kbField && msg.info.path !== frame.path) {
    hideKeyboard(frame);
  }
});

// ---- Keyboard ------------------------------------------------------------

function showKeyboard(frame, field) {
  const d = frame.device;
  const o = frame.orientation;
  const keys = d.keyboard[o];
  const cover = keys + (d.os === 'ios' ? d.keyboard.accessory : d.navBar);
  frame.kbField = field;
  frame.kbShift = false;
  frame.kbLayer = null;
  drawKeyboard(frame);
  frame.kb.style.height = `${cover}px`;
  frame.kb.style.setProperty('--keys', `${keys}px`);
  frame.kb.style.setProperty('--chin', `${d.os === 'ios' ? d.keyboard.chin[o] : 0}px`);
  frame.kb.style.setProperty('--kb-side', o === 'landscape' && d.os === 'ios' ? `${d.landscape.side}px` : '0px');
  frame.kb.classList.add('up');

  // What's left of the page above the keyboard, in screen px.
  const size = screenSize(d, o);
  const { top, bottom } = frame.geometry;
  const visible = Math.max(0, size.height - cover - top);
  const resizes = d.os === 'android' && field.widget === 'resizes-content';
  const overlays = d.os === 'android' && field.widget === 'overlays-content';
  frame.keyboardVisible = overlays ? null : Math.min(visible, frame.vp.height);
  if (resizes) {
    frame.keyboardCut = Math.max(0, size.height - top - bottom - visible);
    frame.layout();
  }
  if (frame.lastZoom) frame.zoom(frame.lastZoom);
  frame.send({
    type: 'keyboard-shown',
    visibleHeight: (frame.keyboardVisible ?? frame.vp.height) / frame.k,
    resizesLayout: resizes,
    overlays,
  });
}

function hideKeyboard(frame) {
  if (!frame.kbField) return;
  frame.kbField = null;
  frame.kb.classList.remove('up');
  frame.keyboardVisible = null;
  if (frame.panLayer) frame.panLayer.style.transform = '';
  if (frame.keyboardCut) {
    frame.keyboardCut = 0;
    frame.layout();
  }
  frame.send({ type: 'keyboard-hidden' });
}

function drawKeyboard(frame) {
  frame.kb.innerHTML = keyboardHTML(frame.device, frame.kbField, { shift: frame.kbShift, layer: frame.kbLayer });
}

function pressKey(frame, key) {
  if (!key || !frame.kbField || key === 'emoji') return;
  if (key === 'shift') {
    frame.kbShift = !frame.kbShift;
    return drawKeyboard(frame);
  }
  if (key.startsWith('layer:')) {
    frame.kbLayer = key.slice(6);
    frame.kbShift = false;
    return drawKeyboard(frame);
  }
  frame.send({ type: 'key', key });
  if (frame.kbShift && key.length === 1) {
    frame.kbShift = false;
    drawKeyboard(frame);
  }
}

function flashNote(frame, text) {
  frame.setNote('back', text);
  clearTimeout(frame.backNoteTimer);
  frame.backNoteTimer = setTimeout(() => frame.setNote('back', null), 6000);
}
