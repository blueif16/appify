// Devices the studio can show. Sizes are CSS pixels in portrait. Browser,
// system bar and keyboard heights approximate the real UI closely enough to
// show how much room a page actually gets on each phone.
//
// landscape (iPhone): side = left/right safe-area inset, bottom = bottom inset,
//   safariTop = Safari's single top bar. (Android): cutoutSide = the strip
//   beside the camera that apps don't draw into.
// keyboard: height of the keys for each orientation; iPhones add the form
//   accessory bar (accessory) and the strip under the keys (chin).

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

const iphone = (spec) => ({
  kind: 'phone',
  os: 'ios',
  browser: 'Safari',
  ua: IOS_UA,
  keyboard: { portrait: 336, landscape: 206, accessory: 44, chin: { portrait: 76, landscape: 22 } },
  ...spec,
});
const android = (spec) => ({
  kind: 'phone',
  os: 'android',
  browser: 'Chrome',
  ua: ANDROID_UA,
  cutout: 'punch-hole',
  statusBar: 32,
  toolbar: 56,
  navBar: 24,
  landscape: { cutoutSide: 32 },
  keyboard: { portrait: 300, landscape: 206 },
  ...spec,
});

export const DEVICES = {
  desktop: { kind: 'desktop', os: 'desktop', name: 'Desktop', width: 1280, height: 800 },
  'iphone-se': iphone({
    name: 'iPhone SE',
    width: 375,
    height: 667,
    radius: 0,
    cutout: 'none',
    homeButton: true,
    safeTop: 20,
    safeBottom: 0,
    safari: { top: 20, bottom: 99 },
    landscape: { side: 0, bottom: 0, safariTop: 50 },
    keyboard: { portrait: 260, landscape: 194, accessory: 44, chin: { portrait: 0, landscape: 0 } },
  }),
  'iphone-14': iphone({
    name: 'iPhone 14 / 16e',
    width: 390,
    height: 844,
    radius: 47,
    cutout: 'notch',
    safeTop: 47,
    safeBottom: 34,
    safari: { top: 47, bottom: 133 },
    landscape: { side: 47, bottom: 21, safariTop: 50 },
  }),
  'iphone-16': iphone({
    name: 'iPhone 16',
    width: 393,
    height: 852,
    radius: 55,
    cutout: 'island',
    safeTop: 59,
    safeBottom: 34,
    safari: { top: 59, bottom: 134 },
    landscape: { side: 59, bottom: 21, safariTop: 50 },
  }),
  'iphone-17': iphone({
    name: 'iPhone 17',
    width: 402,
    height: 874,
    radius: 58,
    cutout: 'island',
    safeTop: 62,
    safeBottom: 34,
    safari: { top: 62, bottom: 134 },
    landscape: { side: 62, bottom: 21, safariTop: 50 },
  }),
  'iphone-pro-max': iphone({
    name: 'iPhone 17 Pro Max',
    width: 440,
    height: 956,
    radius: 60,
    cutout: 'island',
    safeTop: 62,
    safeBottom: 34,
    safari: { top: 62, bottom: 134 },
    landscape: { side: 62, bottom: 21, safariTop: 50 },
  }),
  'galaxy-s25': android({ name: 'Galaxy S25', width: 360, height: 780, radius: 34 }),
  'pixel-9': android({ name: 'Pixel 9', width: 412, height: 923, radius: 46 }),
};

for (const [id, device] of Object.entries(DEVICES)) device.id = id;

export const VIEWS = {
  'web-phone': { label: 'Web + phone', devices: ['desktop', 'iphone-16'] },
  phones: { label: 'Four phones', devices: ['iphone-se', 'iphone-16', 'galaxy-s25', 'pixel-9'] },
};

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export function screenSize(device, orientation = 'portrait') {
  return device.kind === 'phone' && orientation === 'landscape'
    ? { width: device.height, height: device.width }
    : { width: device.width, height: device.height };
}

// Where the page's viewport sits on the screen (how much the top, bottom,
// left and right bars take), and the safe-area insets the page sees. `mode` is
// 'browser' (a tab) or 'installed' (opened from the Home Screen). `page`
// carries what the page declares: viewport-fit=cover and the iOS status bar
// style.
export function screenLayout(device, mode, page = {}, orientation = 'portrait') {
  const box = (top, bottom, insets = NO_INSETS, left = 0, right = 0) => ({ top, bottom, left, right, insets });
  if (device.kind === 'desktop') return box(0, 0);

  const landscape = orientation === 'landscape';
  if (device.os === 'android') {
    const top = device.statusBar + (mode === 'browser' ? device.toolbar : 0);
    return box(top, device.navBar, NO_INSETS, landscape ? device.landscape.cutoutSide : 0);
  }

  // iPhones hide the status bar in landscape. Without viewport-fit=cover the
  // page is letterboxed between the side insets; with it the page fills the
  // screen and gets the insets instead.
  if (landscape) {
    const { side, bottom, safariTop } = device.landscape;
    const top = mode === 'browser' ? safariTop : 0;
    return page.fitCover
      ? box(top, 0, { top: 0, right: side, bottom, left: side })
      : box(top, 0, NO_INSETS, side, side);
  }

  if (mode === 'browser') return box(device.safari.top, device.safari.bottom);

  // Installed on iOS: black-translucent puts the page under the status bar;
  // other styles start the page below it. Either way the page runs to the
  // bottom edge, under the home indicator.
  const translucent = page.statusBarStyle === 'black-translucent';
  const insets = page.fitCover
    ? { ...NO_INSETS, top: translucent ? device.safeTop : 0, bottom: device.safeBottom }
    : NO_INSETS;
  return box(translucent ? 0 : device.safeTop, 0, insets);
}
