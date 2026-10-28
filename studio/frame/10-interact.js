// Phone interaction inside a studio frame: the drawn browser buttons, Android's
// system Back, the on-screen keyboard's effect on the viewport, typing from
// the studio keyboard and rotation. Runs after 00-core.js (see __appify there).
(() => {
  const a = window.__appify;
  if (!a) return;
  const { cfg, post, on } = a;
  const nav = window.navigation;

  // ---- Browser buttons and system Back ----------------------------------
  // The Navigation API moves through this frame's own history; history.back()
  // would walk the history shared with the other frames.

  const reportHistory = () =>
    post({
      type: 'history',
      canGoBack: nav ? nav.canGoBack : history.length > 1,
      canGoForward: nav ? nav.canGoForward : false,
    });
  nav?.addEventListener('currententrychange', reportHistory);
  addEventListener('pageshow', reportHistory);

  on('nav', ({ action }) => {
    if (action === 'reload') return location.reload();
    if (action === 'home') return location.assign('/');
    if (action === 'back' || action === 'forward') {
      const can = nav ? (action === 'back' ? nav.canGoBack : nav.canGoForward) : true;
      if (!can) return post({ type: 'nav-edge', action });
      if (!nav) return history[action]();
      const result = nav[action]();
      result.committed.catch(() => {});
      result.finished.catch(() => {});
    }
  });

  on('blur', () => document.activeElement?.blur?.());

  if (!a.phone) return;

  // ---- Rotation ----------------------------------------------------------

  let orientation = cfg.orientation ?? 'portrait';
  const landscape = () => orientation === 'landscape';
  const portraitScreen = cfg.screen ?? { width: screen.width, height: screen.height };
  const define = (proto, key, get) => {
    try {
      Object.defineProperty(proto, key, { get, configurable: true });
    } catch {}
  };
  define(ScreenOrientation.prototype, 'type', () => (landscape() ? 'landscape-primary' : 'portrait-primary'));
  define(ScreenOrientation.prototype, 'angle', () => (landscape() ? 90 : 0));
  define(window, 'orientation', () => (landscape() ? 90 : 0));
  // iPhones keep reporting the portrait screen; Android swaps it.
  define(Screen.prototype, 'width', () =>
    !a.ios && landscape() ? portraitScreen.height : portraitScreen.width,
  );
  define(Screen.prototype, 'height', () =>
    !a.ios && landscape() ? portraitScreen.width : portraitScreen.height,
  );

  on('orientation', ({ value }) => {
    orientation = value;
    // window.name carries the config to pages loaded later in this frame.
    cfg.orientation = value;
    window.name = `appify:${JSON.stringify(cfg)}`;
    screen.orientation?.dispatchEvent(new Event('change'));
    dispatchEvent(new Event('orientationchange'));
  });

  // ---- Keyboard ------------------------------------------------------------

  const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
  const takesKeyboard = (el) =>
    !!el &&
    !el.readOnly &&
    !el.disabled &&
    (el.isContentEditable ||
      el.nodeName === 'TEXTAREA' ||
      (el.nodeName === 'INPUT' && TEXT_TYPES.has(el.type))) &&
    (el.getAttribute('inputmode') ?? '').toLowerCase() !== 'none';

  // Which keyboard the phone would show, from inputmode, type and enterkeyhint.
  function keyboardFor(el) {
    const type = el.nodeName === 'INPUT' ? el.type : 'text';
    const mode = (el.getAttribute('inputmode') ?? '').toLowerCase();
    const layout = mode || { email: 'email', url: 'url', tel: 'tel', number: 'number', search: 'search' }[type] || 'text';
    const multiline = el.nodeName === 'TEXTAREA' || el.isContentEditable;
    const hint = (el.getAttribute('enterkeyhint') ?? '').toLowerCase();
    const enter = hint || (layout === 'search' ? 'search' : multiline ? 'return' : el.form ? 'go' : 'return');
    return { layout, enter, multiline, secure: type === 'password' };
  }

  // On Android the viewport tag's interactive-widget decides what the keyboard
  // resizes. iPhones ignore it and behave like resizes-visual.
  function interactiveWidget() {
    const content = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
    return content.match(/interactive-widget\s*=\s*([\w-]+)/i)?.[1].toLowerCase() ?? 'resizes-visual';
  }

  let closeTimer;
  addEventListener('focusin', (e) => {
    if (!takesKeyboard(e.target)) return;
    clearTimeout(closeTimer);
    post({ type: 'keyboard', open: true, ...keyboardFor(e.target), widget: interactiveWidget() });
  });
  addEventListener('focusout', () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!takesKeyboard(document.activeElement)) post({ type: 'keyboard', open: false });
    }, 80);
  });

  // While the keyboard is up the visual viewport is the part above it; pages
  // that listen to visualViewport see it shrink and pan, as on a phone.
  const vv = window.visualViewport;
  let shrunk = null; // { height, offsetTop } in CSS px
  for (const key of ['height', 'offsetTop', 'pageTop']) {
    const native = Object.getOwnPropertyDescriptor(VisualViewport.prototype, key)?.get;
    if (!native) continue;
    define(VisualViewport.prototype, key, function () {
      if (!shrunk) return native.call(this);
      if (key === 'height') return shrunk.height;
      if (key === 'offsetTop') return shrunk.offsetTop;
      return native.call(this) + shrunk.offsetTop;
    });
  }

  on('keyboard-shown', ({ visibleHeight, resizesLayout, overlays }) => {
    if (overlays) return;
    if (!resizesLayout) {
      shrunk = { height: visibleHeight, offsetTop: 0 };
      vv?.dispatchEvent(new Event('resize'));
    }
    // Bring the field into view above the keyboard: scroll its scroll
    // containers and the page, then pan the visual viewport for the rest
    // (the iOS move that slides fixed headers off screen).
    requestAnimationFrame(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return;
      const limit = resizesLayout ? innerHeight : visibleHeight;
      const margin = 12;
      let need = el.getBoundingClientRect().bottom + margin - limit;
      for (let node = el.parentElement; node && need > 0; node = node.parentElement) {
        const style = getComputedStyle(node);
        const scrolls = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
        if (!scrolls || node === document.body || node === document.documentElement) continue;
        const before = node.scrollTop;
        node.scrollTop += need;
        need -= node.scrollTop - before;
      }
      if (need > 0) {
        const before = scrollY;
        scrollBy(0, need);
        need -= scrollY - before;
      }
      const pan = !resizesLayout && need > 0 ? Math.min(need, innerHeight - visibleHeight) : 0;
      if (shrunk) {
        shrunk.offsetTop = pan;
        vv?.dispatchEvent(new Event('scroll'));
      }
      post({ type: 'keyboard-pan', pan });
    });
  });

  on('keyboard-hidden', () => {
    if (!shrunk) return;
    shrunk = null;
    vv?.dispatchEvent(new Event('resize'));
    vv?.dispatchEvent(new Event('scroll'));
  });

  // Keys pressed on the studio keyboard.
  on('key', ({ key }) => {
    const el = document.activeElement;
    if (!takesKeyboard(el)) return;
    if (key === 'backspace') return document.execCommand('delete');
    if (key === 'done') return el.blur();
    if (key === 'next' || key === 'previous') {
      const fields = [...document.querySelectorAll('input, textarea, select, [contenteditable]')].filter(
        (field) => !field.disabled && field.type !== 'hidden' && field.getClientRects().length,
      );
      return fields[fields.indexOf(el) + (key === 'next' ? 1 : -1)]?.focus();
    }
    if (key === 'enter') {
      if (el.nodeName === 'TEXTAREA' || el.isContentEditable) return document.execCommand('insertText', false, '\n');
      const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      const proceed = el.dispatchEvent(new KeyboardEvent('keydown', init));
      el.dispatchEvent(new KeyboardEvent('keyup', init));
      if (proceed && el.form) el.form.requestSubmit();
      return;
    }
    document.execCommand('insertText', false, key);
  });
})();
