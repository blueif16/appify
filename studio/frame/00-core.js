// Injected by appify studio into every page it serves, followed by the other
// files in frame/ in name order. Inside a studio phone frame it makes desktop
// Chrome act like that phone: its user agent, no hover, a coarse pointer, the
// display mode, safe-area insets, tap highlights and the iOS zoom on small
// form fields. It also tells the studio what the page declares (viewport tag,
// theme color, status bar style). Outside a studio frame it does nothing.
//
// Feature files reach the frame through window.__appify (set up below):
//   cfg, phone, ios, installed   what this frame is emulating
//   post(msg)                    send a message to the studio
//   on(type, fn)                 handle a message type from the studio
//   media                        [pattern, replacement] pairs applied to every
//                                media query; push before the page's styles load
(() => {
  let cfg;
  try {
    if (window.top === window || !window.name.startsWith('appify:')) return;
    cfg = JSON.parse(window.name.slice('appify:'.length));
  } catch {
    return;
  }

  const phone = cfg.kind === 'phone';
  const ios = cfg.os === 'ios';
  const installed = cfg.mode === 'installed';
  const nativeMatchMedia = window.matchMedia.bind(window);
  const post = (msg) => parent.postMessage({ appify: true, ...msg }, cfg.studio);

  // ---- Talking to the studio -------------------------------------------

  const handlers = {
    insets: [(msg) => setInsets(msg.insets)],
    reload: [() => location.reload()],
  };
  addEventListener('message', (e) => {
    if (e.origin !== cfg.studio || !e.data?.appify) return;
    for (const handler of handlers[e.data.type] ?? []) handler(e.data);
  });

  function setInsets(insets) {
    let style = document.getElementById('appify-insets');
    if (!style) {
      style = document.createElement('style');
      style.id = 'appify-insets';
      (document.head ?? document.documentElement).prepend(style);
    }
    const vars = ['top', 'right', 'bottom', 'left'].map(
      (side) => `--appify-safe-area-inset-${side}:${insets[side] || 0}px`,
    );
    style.textContent = `:root{${vars.join(';')}}`;
  }

  let lastReport = '';
  let reportTimer;
  const reportSoon = () => {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(report, 60);
  };

  function report() {
    const info = pageInfo();
    const json = JSON.stringify(info);
    if (json === lastReport) return;
    lastReport = json;
    post({ type: 'page', info });
  }

  function pageInfo() {
    const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
    const themeColor =
      [...document.querySelectorAll('meta[name="theme-color"]')]
        .find((m) => !m.media || window.matchMedia(m.media).matches)
        ?.getAttribute('content') ?? null;
    return {
      path: location.pathname + location.search + location.hash,
      title: document.title,
      ...readViewport(meta('viewport')),
      themeColor,
      statusBarStyle: meta('apple-mobile-web-app-status-bar-style'),
      background: pageBackground(),
    };
  }

  // Phones read the viewport tag this way: no tag means a 980px-wide desktop
  // layout shrunk to fit the screen. layoutWidth null means device width.
  function readViewport(content) {
    if (content == null) return { layoutWidth: 980, fitCover: false };
    const props = Object.fromEntries(
      content
        .split(/[,;]/)
        .map((part) => part.split('=').map((s) => s.trim().toLowerCase()))
        .filter(([key]) => key),
    );
    let layoutWidth = null;
    if (props.width && props.width !== 'device-width' && !Number.isNaN(Number(props.width))) {
      layoutWidth = Number(props.width);
    } else if (!props.width && !props['initial-scale']) {
      layoutWidth = 980;
    }
    return { layoutWidth, fitCover: props['viewport-fit'] === 'cover' };
  }

  function pageBackground() {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const color = getComputedStyle(el).backgroundColor;
      if (color && color !== 'transparent' && !/,\s*0\)$/.test(color)) return color;
    }
    return 'rgb(255, 255, 255)';
  }

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      reportSoon();
      return result;
    };
  }
  addEventListener('popstate', reportSoon);
  addEventListener('hashchange', reportSoon);
  addEventListener('load', reportSoon);
  document.addEventListener('DOMContentLoaded', reportSoon);

  // ---- Phone emulation -------------------------------------------------

  if (phone) {
    // Identity. Server-side code still sees the desktop user agent.
    const define = (key, value) => {
      try {
        Object.defineProperty(Navigator.prototype, key, { get: () => value, configurable: true });
      } catch {}
    };
    const realUAData = navigator.userAgentData;
    define('userAgent', cfg.ua);
    define('appVersion', cfg.ua.replace(/^Mozilla\//, ''));
    define('platform', ios ? 'iPhone' : 'Linux armv81');
    define('vendor', ios ? 'Apple Computer, Inc.' : 'Google Inc.');
    define('maxTouchPoints', 5);
    if (ios) {
      define('userAgentData', undefined);
      define('standalone', installed);
      define('vibrate', undefined);
    } else if (realUAData) {
      const brands = realUAData.brands;
      const low = { brands, mobile: true, platform: 'Android' };
      define('userAgentData', {
        ...low,
        getHighEntropyValues: async () => ({ ...low, platformVersion: '15.0.0', model: cfg.name }),
        toJSON: () => low,
      });
    }
  }

  // Media queries a desktop answers differently from a phone. Feature files
  // can add their own pairs through __appify.media.
  const TRUE = '(min-width: 0px)';
  const FALSE = '(max-width: 0px)';
  const MEDIA = phone
    ? [
        [/\(\s*(any-)?hover\s*:\s*hover\s*\)/gi, FALSE],
        [/\(\s*(any-)?hover\s*:\s*none\s*\)/gi, TRUE],
        [/\(\s*(any-)?hover\s*\)/gi, FALSE],
        [/\(\s*(any-)?pointer\s*:\s*fine\s*\)/gi, FALSE],
        [/\(\s*(any-)?pointer\s*:\s*coarse\s*\)/gi, TRUE],
        [/\(\s*display-mode\s*:\s*standalone\s*\)/gi, installed ? TRUE : FALSE],
        [/\(\s*display-mode\s*:\s*browser\s*\)/gi, installed ? FALSE : TRUE],
        [/\(\s*display-mode\s*:\s*(fullscreen|minimal-ui|window-controls-overlay|picture-in-picture)\s*\)/gi, FALSE],
      ]
    : [];
  const rewriteMedia = (text) => MEDIA.reduce((out, [pattern, to]) => out.replace(pattern, to), text);

  function fixRules(rules) {
    for (const rule of rules) {
      const media = rule.media;
      if (media?.mediaText) {
        const text = rewriteMedia(media.mediaText);
        if (text !== media.mediaText) media.mediaText = text;
      }
      // :hover only applies to what was tapped last (see below).
      if (phone && rule.selectorText?.includes(':hover')) {
        rule.selectorText = rule.selectorText.replace(/:hover\b/g, '[data-appify-hover]');
      }
      if (rule.styleSheet) fixSheet(rule.styleSheet);
      if (rule.cssRules) fixRules(rule.cssRules);
    }
  }

  function fixSheet(sheet) {
    try {
      if (sheet.media?.mediaText) {
        const text = rewriteMedia(sheet.media.mediaText);
        if (text !== sheet.media.mediaText) sheet.media.mediaText = text;
      }
      fixRules(sheet.cssRules);
    } catch {
      // Cross-origin stylesheets can't be read.
    }
  }

  function fixAllSheets() {
    if (!phone && !MEDIA.length) return;
    for (const sheet of document.styleSheets) fixSheet(sheet);
    for (const sheet of document.adoptedStyleSheets ?? []) fixSheet(sheet);
  }

  window.matchMedia = (query) => nativeMatchMedia(rewriteMedia(String(query)));

  const insertRule = CSSStyleSheet.prototype.insertRule;
  CSSStyleSheet.prototype.insertRule = function (rule, index = 0) {
    const at = insertRule.call(this, rule, index);
    if (phone || MEDIA.length) {
      try {
        fixRules([this.cssRules[at]]);
      } catch {}
    }
    return at;
  };

  document.addEventListener('load', (e) => e.target.nodeName === 'LINK' && fixAllSheets(), true);
  document.addEventListener('DOMContentLoaded', fixAllSheets);

  window.__appify = {
    cfg,
    phone,
    ios,
    installed,
    post,
    media: MEDIA,
    on: (type, fn) => (handlers[type] ??= []).push(fn),
  };

  if (phone) {
    const style = document.createElement('style');
    style.id = 'appify-phone';
    style.textContent = `html, html * {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34'%3E%3Ccircle cx='17' cy='17' r='12' fill='rgba(20,20,20,0.16)' stroke='rgba(255,255,255,0.95)' stroke-width='2'/%3E%3C/svg%3E") 17 17, auto !important;
      scrollbar-width: none !important;
    }`;
    (document.head ?? document.documentElement).append(style);
  }

  // Watch the page for new styles (hot reload, CSS-in-JS) and head changes.
  new MutationObserver((mutations) => {
    let styles = false;
    let head = false;
    for (const m of mutations) {
      const node = m.target;
      if (node.nodeName === 'STYLE' || node.parentNode?.nodeName === 'STYLE') styles = true;
      for (const added of m.addedNodes) {
        if (added.nodeName === 'STYLE' || added.nodeName === 'LINK') styles = true;
      }
      if (node === document.head || node.parentNode === document.head) head = true;
    }
    if (styles) fixAllSheets();
    if (head) reportSoon();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['content', 'media'],
  });

  if (!phone) return;

  // Phones have no hover. Mouse movement without a press never reaches the
  // page. A tap sets [data-appify-hover] on the tapped element and its
  // ancestors and leaves it until the next tap, the way phones keep :hover,
  // and fires the mouseover/mouseenter events a phone fires on tap.
  let hovered = [];
  let synthetic = false;
  const MOVES = [
    'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'mousemove',
    'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'pointermove',
  ];
  for (const type of MOVES) {
    addEventListener(type, (e) => !synthetic && e.buttons === 0 && e.stopImmediatePropagation(), true);
  }

  addEventListener(
    'pointerdown',
    (e) => {
      const chain = [];
      for (let node = e.target; node?.nodeType === 1; node = node.parentElement) chain.push(node);
      const left = hovered.filter((node) => !chain.includes(node));
      const entered = chain.filter((node) => !hovered.includes(node));
      for (const node of left) node.removeAttribute('data-appify-hover');
      for (const node of entered) node.setAttribute('data-appify-hover', '');

      const previous = hovered[0] ?? null;
      const init = { clientX: e.clientX, clientY: e.clientY, view: window };
      synthetic = true;
      try {
        if (previous && previous !== e.target) {
          previous.dispatchEvent(new MouseEvent('mouseout', { ...init, bubbles: true, relatedTarget: e.target }));
          for (const node of left) node.dispatchEvent(new MouseEvent('mouseleave', { ...init, relatedTarget: e.target }));
        }
        if (previous !== e.target) {
          e.target.dispatchEvent(new MouseEvent('mouseover', { ...init, bubbles: true, relatedTarget: previous }));
          for (const node of entered.reverse()) {
            node.dispatchEvent(new MouseEvent('mouseenter', { ...init, relatedTarget: previous }));
          }
        }
      } finally {
        synthetic = false;
      }
      hovered = chain;
    },
    true,
  );

  // The grey flash phones draw over tapped links and buttons, unless the page
  // turns it off with -webkit-tap-highlight-color.
  const TAPPABLE =
    'a[href], button, input, select, textarea, label, summary, [role="button"], [role="link"], [onclick], [tabindex]';
  addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target.closest?.(TAPPABLE);
      if (!el) return;
      const computed = getComputedStyle(el);
      const color = computed.webkitTapHighlightColor;
      if (!color || color === 'transparent' || /,\s*0\)$/.test(color)) return;
      const rect = el.getBoundingClientRect();
      const mark = document.createElement('div');
      mark.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;background:${color};border-radius:${computed.borderRadius};pointer-events:none;z-index:2147483647`;
      document.documentElement.append(mark);
      const clear = () => setTimeout(() => mark.remove(), 120);
      addEventListener('pointerup', clear, { once: true });
      addEventListener('pointercancel', clear, { once: true });
    },
    true,
  );

  // iOS zooms the page in when a field's text is under 16px.
  if (ios) {
    const FIELD =
      'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="color"], [type="file"], [type="image"], [type="hidden"]), textarea, select, [contenteditable=""], [contenteditable="true"]';
    addEventListener('focusin', (e) => {
      const el = e.target;
      if (!el.matches?.(FIELD)) return;
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
      if (/maximum-scale\s*=\s*1(\.0+)?\s*(,|;|$)/i.test(viewport)) return;
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      const r = el.getBoundingClientRect();
      post({ type: 'zoom', fontSize, rect: { x: r.x, y: r.y, width: r.width, height: r.height } });
    });
    addEventListener('focusout', () => post({ type: 'unzoom' }));
  }
})();
