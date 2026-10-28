// The fixed parts of each device: bezel, status bar, cutout and browser bars.
// Sizes are CSS pixels at the device's own scale; the studio scales the whole
// device to fit. Elements with data-act are working browser buttons; the
// phone feature sends their action to the page.

const PHONE_BEZEL = 12;
const SE_BEZEL = { side: 20, chin: 84 };
const DESKTOP_BAR = 40;

export function outerSize(device, orientation = 'portrait') {
  if (device.kind === 'desktop') return { width: device.width, height: device.height + DESKTOP_BAR };
  const size = device.homeButton
    ? { width: device.width + SE_BEZEL.side * 2, height: device.height + SE_BEZEL.chin * 2 }
    : { width: device.width + PHONE_BEZEL * 2, height: device.height + PHONE_BEZEL * 2 };
  return orientation === 'landscape' ? { width: size.height, height: size.width } : size;
}

const act = (action, label, icon) =>
  `<button type="button" class="ctl" data-act="${action}" title="${label}" aria-label="${label}">${icon}</button>`;

const svg = (w, h, body, extra = '') =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" ${extra}>${body}</svg>`;

const ICONS = {
  signal: svg(18, 12, '<rect y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" width="3" height="12" rx="1"/>', 'fill="currentColor"'),
  wifi: svg(16, 12, '<path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .5 10.4 10.4 0 0 0 .8 3.4L2 4.7a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.7 6.7 0 0 0 8 4.1c-1.8 0-3.4.7-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3Zm0 3.6c-.5 0-1 .2-1.3.5L8 11.5l1.3-1.5c-.3-.3-.8-.5-1.3-.5Z"/>', 'fill="currentColor"'),
  battery: svg(27, 13, '<rect x=".5" y=".5" width="22" height="12" rx="3.5" stroke="currentColor" fill="none" opacity=".4"/><rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor"/><path d="M24 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2Z" fill="currentColor" opacity=".45"/>'),
  androidSignal: svg(14, 14, '<path d="M14 0v14H0Z"/>', 'fill="currentColor"'),
  androidWifi: svg(16, 14, '<path d="M8 13.5 0 3.6A12.5 12.5 0 0 1 8 .8a12.5 12.5 0 0 1 8 2.8Z"/>', 'fill="currentColor"'),
  androidBattery: svg(9, 15, '<rect x="2.5" width="4" height="2" rx=".5"/><rect y="1.5" width="9" height="13.5" rx="1.5"/>', 'fill="currentColor"'),
  back: svg(22, 22, '<path d="M14 4 7 11l7 7" stroke-width="2.2"/>', 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'),
  forward: svg(22, 22, '<path d="m8 4 7 7-7 7" stroke-width="2.2"/>', 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'),
  share: svg(22, 22, '<path d="M11 13V2.5M7 6l4-4 4 4M6.5 9H5v11h12V9h-1.5" stroke-width="1.8"/>', 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'),
  book: svg(24, 22, '<path d="M12 5c-2-1.6-5-2-9-1.6V18c4-.4 7 0 9 1.6 2-1.6 5-2 9-1.6V3.4C17 3 14 3.4 12 5Zm0 0v14.6" stroke-width="1.7"/>', 'fill="none" stroke="currentColor" stroke-linejoin="round"'),
  tabs: svg(22, 22, '<rect x="2.5" y="6.5" width="13" height="13" rx="2.5" stroke-width="1.7"/><path d="M6.5 3h10.5A2.5 2.5 0 0 1 19.5 5.5V16" stroke-width="1.7"/>', 'fill="none" stroke="currentColor" stroke-linecap="round"'),
  reload: svg(16, 16, '<path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.8M13 1.5v3.2H9.8" stroke-width="1.6"/>', 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'),
  home: svg(22, 22, '<path d="M3.5 10 11 3.5l7.5 6.5V19h-5v-5.5h-5V19h-5Z" stroke-width="1.8"/>', 'fill="none" stroke="currentColor" stroke-linejoin="round"'),
  tune: svg(16, 16, '<path d="M2 4.5h7M12.5 4.5H14M2 11.5h1.5M7 11.5h7" stroke-width="1.6"/><circle cx="10.8" cy="4.5" r="1.8" stroke-width="1.6"/><circle cx="5.2" cy="11.5" r="1.8" stroke-width="1.6"/>', 'fill="none" stroke="currentColor" stroke-linecap="round"'),
  kebab: svg(4, 18, '<circle cx="2" cy="2.5" r="2"/><circle cx="2" cy="9" r="2"/><circle cx="2" cy="15.5" r="2"/>', 'fill="currentColor"'),
};

function iosStatus(device) {
  if (device.cutout === 'none') {
    return `<span class="sb-l">${ICONS.signal}${ICONS.wifi}</span><b class="sb-time">9:41</b><span class="sb-r">${ICONS.battery}</span>`;
  }
  return `<span class="sb-l"><b class="sb-time">9:41</b></span><span></span><span class="sb-r">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</span>`;
}

const androidStatus = () =>
  `<span class="sb-l"><span class="sb-time">9:41</span></span><span class="sb-r">${ICONS.androidWifi}${ICONS.androidSignal}${ICONS.androidBattery}</span>`;

const safariBar = () => `
  <div class="browserbar safari">
    <div class="safari-url"><span class="aa">a<span>A</span></span><span class="host"></span>${act('reload', 'Reload', ICONS.reload)}</div>
    <div class="safari-tools">
      ${act('back', 'Back', ICONS.back)}${act('forward', 'Forward', ICONS.forward)}
      <span class="ctl">${ICONS.share}</span><span class="ctl">${ICONS.book}</span><span class="ctl">${ICONS.tabs}</span>
    </div>
  </div>`;

const chromeBar = () => `
  <div class="browserbar chrome">
    ${act('home', 'Home page', ICONS.home)}
    <div class="chrome-url">${ICONS.tune}<span class="host"></span></div>
    <span class="chrome-tabs">1</span>
    ${act('reload', 'Reload (in Chrome’s menu)', ICONS.kebab)}
  </div>`;

export function phoneHTML(device) {
  const ios = device.os === 'ios';
  return `
    <div class="screen">
      <div class="sys sys-top"></div>
      <div class="viewport"><div class="zoom"><div class="pan"><iframe title="${device.name}"></iframe></div></div></div>
      <div class="sys sys-bottom"></div>
      ${ios ? safariBar() : chromeBar()}
      <div class="statusbar">${ios ? iosStatus(device) : androidStatus()}</div>
      ${device.cutout === 'none' ? '' : '<div class="cutout"></div>'}
      ${device.homeButton ? '' : '<div class="gesture"></div>'}
    </div>
    ${device.homeButton ? '<div class="speaker"></div><div class="home-btn"></div>' : ''}`;
}

export const desktopHTML = () => `
  <div class="winbar">
    <span class="lights"><i></i><i></i><i></i></span>
    <span class="win-nav">${act('back', 'Back', ICONS.back)}${act('forward', 'Forward', ICONS.forward)}${act('reload', 'Reload', ICONS.reload)}</span>
    <div class="addr"><span class="host"></span></div>
  </div>
  <div class="viewport"><iframe title="Desktop"></iframe></div>`;
