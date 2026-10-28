// Comments. While the studio is in comment mode the element under the pointer
// is outlined and a click selects it instead of activating it; the studio gets
// a compact description of it. Open comments on this page are drawn as
// numbered pins on their elements.
(() => {
  const appify = window.__appify;
  if (!appify) return;

  let picking = false;
  let hovered = null;
  let selected = null;
  let pins = [];

  // Everything we draw lives in a shadow root so page styles can't touch it.
  const host = document.createElement('appify-overlay');
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    .box { position: fixed; display: none; box-sizing: border-box; border: 1.5px solid #000;
      box-shadow: 0 0 0 1px #fff, inset 0 0 0 1px #fff; background: rgb(0 0 0 / 0.04); }
    .label { position: fixed; display: none; padding: 2px 5px; background: #000; color: #fff;
      font: 500 10px/1.3 ui-monospace, Menlo, Consolas, monospace; white-space: nowrap; }
    .pin { position: fixed; width: 18px; height: 18px; display: grid; place-items: center;
      box-sizing: border-box; background: #000; color: #fff; border: 1px solid #000;
      font: 600 10px/1 ui-monospace, Menlo, Consolas, monospace; pointer-events: auto; cursor: pointer;
      box-shadow: 0 0 0 1.5px #fff; }
    .pin.other { background: #fff; color: #000; }
  </style><div class="box"></div><div class="label"></div><div class="pins"></div>`;
  const box = root.querySelector('.box');
  const label = root.querySelector('.label');
  const pinLayer = root.querySelector('.pins');
  // Added only once there is something to draw, after the page has parsed.
  const attach = () => document.body && !host.isConnected && document.documentElement.append(host);

  const cursorStyle = document.createElement('style');
  cursorStyle.textContent =
    'html[data-appify-picking], html[data-appify-picking] * { cursor: crosshair !important; }';

  function setPicking(on) {
    picking = on;
    if (on) {
      document.documentElement.setAttribute('data-appify-picking', '');
      (document.head ?? document.documentElement).append(cursorStyle);
    } else {
      document.documentElement.removeAttribute('data-appify-picking');
      cursorStyle.remove();
      hovered = null;
    }
    draw();
  }

  appify.on('pick', ({ on }) => setPicking(Boolean(on)));
  appify.on('pick-clear', () => {
    selected = null;
    draw();
  });
  appify.on('pins', (msg) => {
    pins = msg.pins ?? [];
    draw();
  });

  const pickable = (el) => (el?.nodeType === 1 && el !== host && el !== document.documentElement ? el : null);

  // The core frame script swallows hover-only pointer moves on phones;
  // pointerrawupdate still arrives, and plain pointermove covers desktops.
  // Its coordinates can be in the studio's space when the frame is scaled, so
  // use the target the browser hit-tested.
  for (const type of ['pointerrawupdate', 'pointermove']) {
    addEventListener(
      type,
      (e) => {
        if (!picking) return;
        const el = pickable(e.target);
        if (el && el !== hovered) {
          hovered = el;
          draw();
        }
      },
      true,
    );
  }

  // While picking, presses never reach the page.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu', 'auxclick']) {
    addEventListener(
      type,
      (e) => {
        if (!picking) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      { capture: true, passive: false },
    );
  }

  addEventListener(
    'click',
    (e) => {
      const pin = e.composedPath().find((node) => node.dataset?.pin);
      if (pin) {
        e.preventDefault();
        e.stopImmediatePropagation();
        appify.post({ type: 'pin', id: pin.dataset.pin });
        return;
      }
      if (!picking) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const el = pickable(e.target);
      if (!el) return;
      selected = el;
      draw();
      appify.post({
        type: 'picked',
        element: describe(el),
        viewport: { w: innerWidth, h: innerHeight },
        page: location.pathname + location.search + location.hash,
      });
    },
    true,
  );

  addEventListener(
    'keydown',
    (e) => {
      if (picking && e.key === 'Escape') appify.post({ type: 'pick-cancel' });
    },
    true,
  );

  // ---- Describing an element -------------------------------------------

  function describe(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const field = el.matches('input, textarea, select');
    const text = (field ? el.value || el.placeholder || '' : el.innerText || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return {
      selector: selectorFor(el),
      tag: el.localName,
      classes: [...el.classList].slice(0, 6),
      text,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      style: { fontSize: cs.fontSize, width: cs.width, height: cs.height, position: cs.position },
    };
  }

  // Short and stable: an id or test id when there is one, otherwise the
  // shortest tag(.class)(:nth-of-type) path that matches only this element.
  function selectorFor(el) {
    const unique = (sel) => {
      try {
        return document.querySelectorAll(sel).length === 1;
      } catch {
        return false;
      }
    };
    if (el.id && unique(`#${CSS.escape(el.id)}`)) return `#${CSS.escape(el.id)}`;
    for (const attr of ['data-testid', 'data-test', 'data-cy']) {
      const value = el.getAttribute(attr);
      if (value && unique(`[${attr}="${CSS.escape(value)}"]`)) return `[${attr}="${CSS.escape(value)}"]`;
    }

    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      if (node !== el && node.id && unique(`#${CSS.escape(node.id)}`)) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let part = node.localName;
      const cls = [...node.classList].find((c) => /^[a-zA-Z][\w-]{0,29}$/.test(c) && !/\d{3}/.test(c));
      if (cls) part += `.${CSS.escape(cls)}`;
      const sameTag = node.parentElement ? [...node.parentElement.children].filter((c) => c.localName === node.localName) : [];
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      parts.unshift(part);
      if (node.localName === 'body' || unique(parts.join(' > '))) break;
    }
    return parts.join(' > ');
  }

  const shortName = (el) => {
    const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join('');
    return `${el.localName}${el.id ? `#${el.id}` : ''}${cls}`;
  };

  // ---- Drawing -----------------------------------------------------------

  function draw() {
    if (picking || selected || pins.length) attach();
    const target = selected ?? (picking ? hovered : null);
    if (target?.isConnected) {
      const r = target.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      label.textContent = shortName(target);
      const top = r.top >= 18 ? r.top - 18 : r.bottom + 2;
      Object.assign(label.style, { display: 'block', left: `${Math.max(0, r.left)}px`, top: `${top}px` });
    } else {
      box.style.display = 'none';
      label.style.display = 'none';
    }

    pinLayer.replaceChildren(
      ...pins.flatMap(({ id, n, selector, own }) => {
        let el;
        try {
          el = document.querySelector(selector);
        } catch {}
        const r = el?.getBoundingClientRect();
        if (!r || (!r.width && !r.height)) return [];
        const pin = document.createElement('div');
        pin.className = own ? 'pin' : 'pin other';
        pin.dataset.pin = id;
        pin.textContent = n;
        pin.title = own ? 'Comment' : 'Comment made on another device';
        pin.style.left = `${Math.min(Math.max(r.right - 9, 2), innerWidth - 20)}px`;
        pin.style.top = `${Math.min(Math.max(r.top - 9, 2), innerHeight - 20)}px`;
        return [pin];
      }),
    );
  }

  // Keep the outline and pins on their elements as the page scrolls and changes.
  let queued = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  };
  addEventListener('scroll', redraw, { capture: true, passive: true });
  addEventListener('resize', redraw);
  setInterval(() => (pins.length || selected || picking) && redraw(), 400);
  document.addEventListener('DOMContentLoaded', draw);
})();
