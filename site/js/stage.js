// The media panel: the appify studio, drawn live, playing the workflow in a
// loop. Desktop-only Lumen on phones → a comment pinned on the iPhone → the
// agent fixes it and saves checkpoint v2 → Home Screen app → On my phone →
// History compares v1 with v2, and round again.
//
// Everything is state on the .studio element (data-*), and stage.css draws
// each state. This file builds the markup, keeps the scene scaled to the
// panel, and runs the timeline. It pauses offscreen, in a hidden tab, and on
// request; with reduced motion it shows the fixed app and doesn't play.

import { agentMarkup } from './agent-art.js';
import { watch } from './bots.js';
import { QR_MODULES } from './qr-data.js';

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

// ---- Icons (the studio's own, 18×14 at 1.3 stroke) --------------------------

const svg = (body, w = 18, h = 14) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${body}</svg>`;
const I = {
  desktop: svg('<rect x="1.65" y="1.65" width="14.7" height="9.2"/><path d="M6 13.35h6"/>'),
  phone: svg('<rect x="5.65" y=".65" width="6.7" height="12.7" rx="1.4"/>'),
  plus: svg('<path d="M9 2v10M4 7h10"/>'),
  tab: svg('<rect x="2.65" y=".65" width="12.7" height="12.7"/><path d="M2.65 4.35h12.7"/>'),
  grid: svg('<rect x="3.15" y=".65" width="5" height="5"/><rect x="9.85" y=".65" width="5" height="5"/><rect x="3.15" y="8.35" width="5" height="5"/><rect x="9.85" y="8.35" width="5" height="5"/>'),
  comment: svg('<path d="M2.65.65h12.7v9.2H8.2L5 12.9V9.85H2.65Z"/>'),
  history: svg('<rect x="5.65" y=".65" width="9.7" height="10.2"/><path d="M3.15 3.15v10.2h9.7"/>'),
  flag: svg('<path d="M4.65 13.35V.65h9.2l-2.2 3.1 2.2 3.1h-9.2"/>'),
  reload: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.8M13 1.5v3.2H9.8"/></svg>',
  plink: '<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="1.65" y=".65" width="7.7" height="14.7" rx="1.4"/><path d="M4.3 2.6h2.4"/><rect x="11.65" y="4.65" width="5.7" height="5.7"/><path d="M13.6 6.6h1.8v1.8h-1.8z" fill="currentColor" stroke="none"/></svg>',
  check: '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m2 6.5 2.6 2.6L10 3.5"/></svg>',
};
const LOGO = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect width="18" height="18" fill="#000"/><rect x="5.5" y="13" width="7" height="1.6" fill="#fff"/></svg>';

// Lumen's own tab bar icons (demos/lumen/index.html).
const tabIcon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const TABS = [
  ['Photos', tabIcon('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'), true],
  ['Discover', tabIcon('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>')],
  ['Request', tabIcon('<path d="M12 6v12M6 12h12"/>'), false, true],
  ['Critiques', tabIcon('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/>')],
  ['Challenges', tabIcon('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4m-4 3v4m-4 3h8"/>')],
];

// ---- Lumen, the sample app (drawn in its own CSS pixels) -------------------

const PHOTOS = [
  ['Harbor at 6am', '2 critiques · Landscape'],
  ['Night market', 'Waiting · Street'],
  ['Fog on the ridge', '4 critiques · Landscape'],
  ['Crosswalk', 'Waiting · Street'],
  ['Last ferry', '1 critique · Night'],
  ['Window light', 'Waiting · Portrait'],
];
const cards = () =>
  PHOTOS.map(([t, m], i) => `<div class="l-card"><i class="l-photo p${i + 1}"></i><b>${t}</b><span>${m}</span></div>`).join('');

const lumenDesktop = () => `
<div class="l-desk">
  <div class="l-top">
    <b class="l-logo">Lumen</b>
    <span class="l-nav"><span>Discover ▾</span><span>Critiques</span><span>Challenges</span></span>
    <span class="l-search">Search photos, critics, tags</span>
    <span class="l-btn">Request a critique</span>
    <span class="l-av">MK</span>
  </div>
  <div class="l-layout">
    <div class="l-side">
      <span class="l-h">Collections</span>
      <span class="l-link on">All photos <i>6</i></span><span class="l-link">Waiting for feedback <i>3</i></span>
      <span class="l-link">Critiqued <i>3</i></span><span class="l-link">Drafts <i>0</i></span>
      <span class="l-h">Filter</span>
      <span class="l-check on">Landscape</span><span class="l-check on">Street</span><span class="l-check">Portrait</span><span class="l-check">Night</span>
    </div>
    <div class="l-content">
      <div class="l-head"><span><b class="l-title">Your photos</b><span class="l-lede">6 photos, 3 waiting for feedback</span></span><span class="l-sort">Newest first ▾</span></div>
      <div class="l-grid">${cards()}</div>
    </div>
  </div>
</div>`;

const lumenMobile = () => `
<div class="l-mob">
  <div class="l-mtop">
    <b class="l-logo">Lumen</b>
    <span class="l-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/></svg></span>
    <span class="l-av">MK</span>
  </div>
  <div class="l-mbody">
    <b class="l-title">Your photos</b>
    <span class="l-lede">6 photos, 3 waiting for feedback</span>
    <span class="l-mtools"><span class="l-mfilter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filter <i>2</i></span><span class="l-msort">Newest first</span></span>
    <div class="l-mgrid">${cards()}</div>
  </div>
  <div class="l-tabbar">${TABS.map(([label, icon, on, primary]) => `<span class="l-tab${on ? ' on' : ''}${primary ? ' primary' : ''}"><i>${icon}</i>${label}</span>`).join('')}</div>
</div>`;

// ---- Devices ---------------------------------------------------------------

const iosStatus = `
<div class="s-status">
  <span>9:41</span>
  <span class="s-sb-icons">
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Zm-4.2-4.3a6 6 0 0 1 8.4 0l1.4-1.4a8 8 0 0 0-11.2 0Zm-2.8-2.8a10 10 0 0 1 14 0L16.4 3a12 12 0 0 0-16.8 0Z"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2"/><path d="M25 4.5v4a2 2 0 0 0 0-4Z" opacity=".4"/></svg>
  </span>
</div>`;

const androidStatus = `
<div class="s-status">
  <span>9:41</span>
  <span class="s-sb-icons">
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 13 0 4.5a11 11 0 0 1 14 0Z"/></svg>
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M14 0v14H0Z"/></svg>
    <svg width="9" height="15" viewBox="0 0 9 15" aria-hidden="true"><path d="M2.5 0h4v1.5H9V15H0V1.5h2.5Z"/></svg>
  </span>
</div>`;

const safari = `
<div class="s-safari">
  <div class="s-surl"><span class="s-aa">A<span>A</span></span><span class="s-host">localhost</span>${I.reload}</div>
  <div class="s-stools">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>
    <svg viewBox="0 0 24 24" aria-hidden="true" class="off"><path d="m9 5 7 7-7 7"/></svg>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 11H5v10h14V11h-3"/></svg>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Zm0 0v13"/></svg>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="13" height="13" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/></svg>
  </div>
</div>`;

const chrome = `
<div class="s-chrome">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5"/></svg>
  <span class="s-curl"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14M5 15h14"/><circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/></svg>localhost:5173</span>
  <span class="s-ctabs">1</span>
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
</div>`;

const tag = (name, browserDims, installedDims, where) => `
<figcaption class="s-tag">
  <b>${name}</b>
  <span class="s-dims"><span class="when-b">${browserDims}</span><span class="when-i">${installedDims}</span></span>
  <span class="s-where"><span class="when-b">in ${where}</span><span class="when-i">from Home Screen</span></span>
</figcaption>`;

// Room numbers from studio/src/devices.js: the screen minus the browser and
// system bars. iPhone 16: 852 − 59 − 134 = 659 in Safari, 852 − 59 = 793 from
// the Home Screen. Pixel 9: 923 − 32 − 56 − 24 = 811 in Chrome, 867 installed.
const desktopFrame = () => `
<figure class="s-frame s-desk" style="--dw:1280;--dh:840">
  <div class="s-fscale"><div class="s-device s-desktop">
    <div class="s-winbar"><span class="s-lights"><i></i><i></i><i></i></span><span class="s-wnav">‹&nbsp;&nbsp;›</span><span class="s-addr">localhost:5173</span></div>
    <div class="s-dview">${lumenDesktop()}</div>
  </div></div>
  <figcaption class="s-tag"><b>Desktop</b><span class="s-dims">1280 × 800</span><span class="s-where">browser window</span></figcaption>
</figure>`;

const iphoneFrame = () => `
<figure class="s-frame s-ip" style="--dw:417;--dh:876">
  <div class="s-cmp"><span class="s-cmp-a">v1 · Original</span><span class="s-cmp-b">v2 · Bottom tab bar</span></div>
  <div class="s-fscale">
    <div class="s-device s-phone s-ios">
      <div class="s-screen">
        <div class="s-view">
          <div class="s-app s-before">${lumenDesktop()}</div>
          <div class="s-app s-after">${lumenMobile()}</div>
          <i class="s-handle"><b></b></i>
        </div>
        ${iosStatus}
        <i class="s-island"></i>
        ${safari}
        <i class="s-home"></i>
      </div>
    </div>
    <i class="s-mark"></i>
    <span class="s-pin">1</span>
    <div class="st-panel s-composer">
      <p class="st-cap">Comment on <b>iPhone 16</b></p>
      <p class="c-target">header.topbar</p>
      <p class="c-text"><span data-typed></span><i class="c-caret"></i></p>
      <div class="c-actions"><span class="c-keys">Enter to save</span><span class="c-btn">Cancel</span><span class="c-btn primary" data-save>Save</span></div>
    </div>
  </div>
  ${tag('iPhone 16', '393 × 659', '393 × 793', 'Safari')}
</figure>`;

const pixelFrame = () => `
<figure class="s-frame s-px" style="--dw:436;--dh:947">
  <div class="s-fscale">
    <div class="s-device s-phone s-android">
      <div class="s-screen">
        <div class="s-view">
          <div class="s-app s-before">${lumenDesktop()}</div>
          <div class="s-app s-after">${lumenMobile()}</div>
        </div>
        ${androidStatus}
        <i class="s-punch"></i>
        ${chrome}
        <div class="s-navbar"><i></i></div>
      </div>
    </div>
  </div>
  ${tag('Pixel 9', '412 × 811', '412 × 867', 'Chrome')}
</figure>`;

const qr = `
<svg viewBox="-2 -2 25 25" aria-hidden="true">
  <rect x="-2" y="-2" width="25" height="25" fill="#fff"/>
  <g fill="none" stroke="#1d1d1f" stroke-width="1">
    <rect x=".5" y=".5" width="6" height="6" rx="1.7"/><rect x="14.5" y=".5" width="6" height="6" rx="1.7"/><rect x=".5" y="14.5" width="6" height="6" rx="1.7"/>
  </g>
  <g fill="#1d1d1f">
    <rect x="2" y="2" width="3" height="3" rx=".8"/><rect x="16" y="2" width="3" height="3" rx=".8"/><rect x="2" y="16" width="3" height="3" rx=".8"/>
    <path d="${QR_MODULES}"/>
  </g>
</svg>`;

const sceneHTML = () => `
<div class="st-bar"><span class="s-lights"><i></i><i></i><i></i></span><span class="st-addr">localhost:4747</span></div>
<div class="st-bench">
  <i class="st-cross st-cross-tl"></i><i class="st-cross st-cross-tr"></i><i class="st-cross st-cross-bl"></i><i class="st-cross st-cross-br"></i>
  <div class="st-logo">${LOGO}<span>appify</span><span class="st-logo-sub">studio</span></div>

  <section class="st-panel st-dock">
    <p class="st-cap">Windows</p>
    <span class="st-item">${I.desktop}<span>Desktop</span><i class="st-lamp"></i></span>
    <span class="st-item">${I.phone}<span>iPhone 16</span><i class="st-lamp"></i></span>
    <span class="st-item">${I.phone}<span>Pixel 9</span><i class="st-lamp"></i></span>
    <span class="st-item st-add">${I.plus}<span>Add device</span></span>
  </section>

  <div class="st-right">
    <section class="st-panel st-open">
      <p class="st-cap">Open as</p>
      <div class="st-seg">
        <span class="st-item" data-mode-btn="browser">${I.tab}<span>Browser tab</span></span>
        <span class="st-item" data-mode-btn="installed">${I.grid}<span>Home Screen app</span></span>
      </div>
    </section>
    <section class="st-panel st-comments">
      <p class="st-cap">Comments <b data-ccount>0</b></p>
      <span class="st-item st-ctoggle">${I.comment}<span>Comment</span><kbd>C</kbd></span>
      <span class="st-citem"><span class="st-cnum">1</span><span><span class="st-ctext">Nav doesn't fit. Put it under the thumb.</span><span class="st-cmeta">iPhone 16 · header.topbar</span></span></span>
    </section>
  </div>

  <div class="st-bottom">
    <div class="st-panel st-route"><span class="st-origin">localhost:5173</span><span class="st-path">/</span><span class="st-icon">${I.reload}</span></div>
    <div class="st-panel st-hist"><span class="st-hbtn">${I.history}<span class="st-hlabel">History</span><span class="st-hcur" data-hist>v1</span></span><span class="st-save">${I.flag}<span>Checkpoint</span></span></div>
    <div class="st-panel st-plink">
      <span class="st-pbtn" data-plink>${I.plink}<span>On my phone</span></span>
      <div class="st-panel st-qrpop">
        <p class="st-cap">Scan with your phone's camera</p>
        <div class="st-qr">${qr}</div>
        <p class="st-qrurl">https://amber-lake-tide.trycloudflare.com</p>
      </div>
    </div>
  </div>

  <div class="st-stage"><div class="st-row">${desktopFrame()}${iphoneFrame()}${pixelFrame()}</div></div>

  <p class="st-hint">Saved to .appify/comments.json</p>
  <p class="st-toast"><span>The agent saved v2 · Bottom tab bar</span><b>View</b></p>
  <svg class="st-cursor" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 2v15.5l4.2-3.9 2.6 6 3-1.3-2.6-5.9H16Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>
</div>`;

const terminalHTML = () => `
${agentMarkup('t-agent')}
<p class="t-cap"><span>Your agent's terminal</span><span>any coding agent</span></p>
<div class="t-body">
  <p class="t-line"><span class="t-ps">$</span> appify comments</p>
  <p class="t-line t-out">[{"id":"c1","status":"open","text":"Nav doesn't fit. Put it under the thumb.","device":"iphone-16",…}]</p>
  <p class="t-line t-note">edited index.html, mobile.css</p>
  <p class="t-line"><span class="t-ps">$</span> appify checkpoint "Bottom tab bar"</p>
  <p class="t-line t-out">v2 · Bottom tab bar · agent · 3 files +86 −4</p>
  <p class="t-line"><span class="t-ps">$</span> appify comments resolve c1</p>
  <p class="t-line t-out">Resolved c1: Nav doesn't fit. Put it under the thumb.</p>
</div>`;

const stickersHTML = () => `
<img class="m-sticker m-sticker-phone" src="./stickers/phone.svg" alt="" width="104" height="204">
<img class="m-sticker m-sticker-qr" src="./stickers/qr.svg" alt="" width="100" height="100">`;

// ---- Timeline ----------------------------------------------------------------

const COMMENT = "Nav doesn't fit. Put it under the thumb.";

const BASE = {
  fixed: '0', mode: 'browser', share: '0', compare: '0', sweep: '0', wobble: '0',
  pin: '', mark: '0', composer: '0', cmt: '', cmode: '0', hint: '0', toast: '0',
  fresh: '0', cursor: '0', saving: '0', term: 0, hist: 'v1', ccount: '0', typed: '',
};

const BEATS = [
  {
    label: 'Desktop-only',
    caption: 'Lumen is a desktop-only app. On phones it runs off the screen.',
    len: 3000,
    events: [
      [500, { wobble: '1' }],
      [1700, { wobble: '0' }],
    ],
  },
  {
    label: 'Comment',
    caption: 'Pin a comment on the phone. It is saved to .appify/comments.json.',
    len: 3900,
    events: [
      [0, { cursor: '1', aim: 'mark', cmode: '1' }],
      [850, { click: 1, mark: '1' }],
      [1050, { composer: '1', type: COMMENT }],
      [2500, { aim: 'save' }],
      [3050, { click: 1 }],
      [3200, { composer: '0', pin: 'drop', cmt: 'open', ccount: '1', cmode: '0', hint: '1', cursor: '0' }],
    ],
  },
  {
    label: 'Checkpoint',
    caption: 'Your coding agent reads it, fixes the app and saves checkpoint v2.',
    len: 4200,
    events: [
      [0, { hint: '0', term: 1 }],
      [350, { term: 2 }],
      [1000, { term: 3 }],
      [1400, { fixed: '1', mark: '0' }],
      [2100, { term: 4, saving: '1' }],
      [2600, { term: 5, saving: '0', toast: '1', hist: 'v2', fresh: '1' }],
      [3200, { term: 6 }],
      [3500, { term: 7, pin: 'resolved', cmt: '', ccount: '0' }],
    ],
  },
  {
    label: 'Home Screen',
    caption: 'Switch to Home Screen app to see it without the browser bars.',
    len: 3100,
    events: [
      [0, { toast: '0', pin: '', cursor: '1', aim: 'installed' }],
      [900, { click: 1, mode: 'installed' }],
      [1600, { cursor: '0' }],
    ],
  },
  {
    label: 'On my phone',
    caption: 'On my phone gives you a temporary HTTPS link as a QR code.',
    len: 3300,
    events: [
      [0, { cursor: '1', aim: 'plink' }],
      [900, { click: 1, share: '1' }],
      [1500, { cursor: '0' }],
    ],
  },
  {
    label: 'History',
    caption: 'History compares any two checkpoints, and plays the steps back.',
    len: 3600,
    events: [
      [0, { share: '0', compare: '1', fresh: '0' }],
      [450, { sweep: '1' }],
      [2700, { fixed: '0' }],
      [3200, { compare: '0', hist: 'v1' }],
    ],
  },
];

// Layouts by the panel's width: the design size of the studio window, and how
// much of the panel it may take.
const LAYOUTS = {
  wide: { W: 1280, H: 754, share: 0.86, max: 1.25 },
  medium: { W: 860, H: 754, share: 0.92, max: 1.05 },
  narrow: { W: 400, H: 700, share: 1, max: 1.1 },
};

export function startStage(media) {
  const studio = media.querySelector('[data-studio]');
  const box = media.querySelector('[data-window-box]');
  const term = media.querySelector('[data-terminal]');
  const list = media.querySelector('.beats-list');
  const caption = media.querySelector('[data-caption]');
  const pauseBtn = media.querySelector('.beats-pause');
  media.querySelector('.media-stickers').innerHTML = stickersHTML();
  studio.innerHTML = sceneHTML();
  term.innerHTML = terminalHTML();
  watch(term.querySelector('.t-agent'));

  const bench = studio.querySelector('.st-bench');
  const cursorEl = studio.querySelector('.st-cursor');
  const typedEl = studio.querySelector('[data-typed]');
  const histEl = studio.querySelector('[data-hist]');
  const countEl = studio.querySelector('[data-ccount]');
  const lines = [...term.querySelectorAll('.t-line')];

  list.innerHTML = BEATS.map(
    (b, i) => `<li><button type="button" class="beat" data-beat="${i}"><span class="beat-n">${String(i + 1).padStart(2, '0')}</span><span class="beat-label">${b.label}</span><span class="beat-track"><i></i></span></button></li>`,
  ).join('');
  const beatBtns = [...list.querySelectorAll('.beat')];
  const bars = beatBtns.map((b) => b.querySelector('.beat-track i'));

  let k = 1;
  let state = {};
  let aim = null;
  let typing = null; // { text, start }
  let beat = 0;
  let t = 0;
  let next = 0;
  let paused = false;
  let onscreen = false;
  let raf = 0;
  let last = 0;

  // ---- Applying state ----

  function apply(patch, instant = false) {
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'aim') {
        aim = value;
        placeCursor(instant);
      } else if (key === 'click') {
        if (!instant) {
          cursorEl.classList.remove('click');
          void cursorEl.getBBox?.();
          cursorEl.classList.add('click');
        }
      } else if (key === 'type') {
        typing = instant ? null : { text: value, start: t };
        typedEl.textContent = instant ? value : '';
      } else if (key === 'typed') {
        typing = null;
        typedEl.textContent = value;
      } else if (key === 'term') {
        lines.forEach((l, i) => l.classList.toggle('on', i < value));
        term.dataset.term = value;
      } else if (key === 'hist') {
        histEl.textContent = value;
      } else if (key === 'ccount') {
        countEl.textContent = value;
        studio.dataset.ccount = value;
      } else {
        studio.dataset[key] = value;
      }
      state[key] = value;
    }
  }

  function instantly(fn) {
    media.classList.add('instant');
    fn();
    void media.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => media.classList.remove('instant')));
  }

  // Everything up to the start of beat n (or its end, with through).
  function stateAt(n, through = false) {
    instantly(() => {
      apply(BASE, true);
      for (let i = 0; i < n + (through ? 1 : 0); i++) for (const [, patch] of BEATS[i].events) apply(patch, true);
      if (!state.cursor || state.cursor === '0') aim = null;
    });
  }

  const AIMS = {
    mark: ['.s-ip .s-mark', 0.62, 0.55],
    save: ['.s-composer [data-save]', 0.5, 0.6],
    installed: ['[data-mode-btn="installed"]', 0.4, 0.55],
    plink: ['[data-plink]', 0.45, 0.55],
  };

  function placeCursor(instant) {
    const spec = AIMS[aim];
    if (!spec) return;
    const el = studio.querySelector(spec[0]);
    if (!el) return;
    const b = bench.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const x = (r.left - b.left + r.width * spec[1]) / k;
    const y = (r.top - b.top + r.height * spec[2]) / k;
    if (instant) cursorEl.style.transition = 'none';
    cursorEl.style.setProperty('--cx', `${x.toFixed(1)}px`);
    cursorEl.style.setProperty('--cy', `${y.toFixed(1)}px`);
    if (instant) {
      void cursorEl.getBoundingClientRect();
      cursorEl.style.transition = '';
    }
  }

  // ---- Layout ----

  function layout() {
    const mw = media.clientWidth;
    const name = mw >= 1000 ? 'wide' : mw >= 600 ? 'medium' : 'narrow';
    const L = LAYOUTS[name];
    const room = name === 'narrow' ? mw - 24 : mw * L.share;
    k = Math.min(room / L.W, L.max);
    studio.dataset.layout = name;
    studio.style.width = `${L.W}px`;
    studio.style.height = `${L.H}px`;
    studio.style.transform = `scale(${k})`;
    box.style.width = `${Math.round(L.W * k)}px`;
    box.style.height = `${Math.round(L.H * k)}px`;
    media.dataset.layout = name;
    placeCursor(true);
  }

  // ---- Playback ----

  function showBeat(n) {
    beatBtns.forEach((b, i) => {
      b.toggleAttribute('aria-current', i === n);
      if (i === n) b.setAttribute('aria-current', 'step');
      b.classList.toggle('done', i < n);
    });
    caption.textContent = BEATS[n].caption;
  }

  function progress() {
    bars.forEach((bar, i) => {
      const p = i < beat ? 1 : i > beat ? 0 : Math.min(1, t / BEATS[beat].len);
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    });
  }

  function goTo(n, { fromStart = true } = {}) {
    beat = n;
    t = 0;
    next = 0;
    typing = null;
    if (n === 0 && fromStart) apply(BASE);
    showBeat(n);
    progress();
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min(64, now - (last || now));
    last = now;
    t += dt;
    const b = BEATS[beat];
    while (next < b.events.length && b.events[next][0] <= t) apply(b.events[next++][1]);
    if (typing) {
      const n = Math.floor((t - typing.start) / 30);
      typedEl.textContent = typing.text.slice(0, n);
      if (n >= typing.text.length) typing = null;
    }
    if (t >= b.len) goTo((beat + 1) % BEATS.length);
    progress();
    schedule();
  }

  function schedule() {
    const run = onscreen && !paused && !document.hidden && !reduceQuery.matches;
    if (run && !raf) {
      raf = requestAnimationFrame(tick);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    // Restart the clock only after a stop; tick() reschedules every frame.
    if (!run) last = 0;
    media.classList.toggle('is-paused', !run);
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.beat');
    if (!btn) return;
    const n = Number(btn.dataset.beat);
    if (paused || reduceQuery.matches) {
      // Still: show how that step ends.
      stateAt(n, true);
      apply({ cursor: '0' }, true);
      beat = n;
      t = BEATS[n].len;
      showBeat(n);
      progress();
    } else {
      stateAt(n);
      goTo(n, { fromStart: false });
    }
  });

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
    schedule();
  });

  function settle() {
    if (reduceQuery.matches) {
      // A still frame of the fixed app, opened from the Home Screen.
      stateAt(3, true);
      apply({ cursor: '0', toast: '0', pin: '' }, true);
      beat = 3;
      t = BEATS[3].len;
      showBeat(3);
      progress();
    } else {
      stateAt(0);
      goTo(0, { fromStart: false });
    }
    schedule();
  }

  new IntersectionObserver(
    ([entry]) => {
      onscreen = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.12 },
  ).observe(media);
  document.addEventListener('visibilitychange', schedule);
  reduceQuery.addEventListener?.('change', settle);
  new ResizeObserver(layout).observe(media);

  layout();
  settle();
}
