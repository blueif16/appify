// Page facts for checkpoints and `appify snapshot`: measurements, not
// judgments; the agent reading them decides what matters. capture.js calls
// window.__appify.facts({ bands, screenWidth }); the studio can also send
// 'collect-facts' and gets a 'facts' message back.
//
// Sizes are in screen px (what a person sees on the phone) except overflowX
// and offender widths, which are in the page's own layout px.
(() => {
  const appify = window.__appify;
  if (!appify) return;

  const phone = appify.phone;
  const mediaMatches = (media) => {
    try {
      return !media || window.matchMedia(media).matches;
    } catch {
      return true;
    }
  };
  const TAP_MIN = appify.ios ? 44 : 48;
  const TAPPABLE =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"])';
  const FIELD =
    'input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="color"], [type="file"], [type="image"]), textarea, select, [contenteditable=""], [contenteditable="true"]';

  appify.facts = collect;
  appify.on('collect-facts', async (msg) => appify.post({ type: 'facts', id: msg.id, facts: await collect(msg) }));

  async function collect({ bands = [], screenWidth } = {}) {
    const vw = innerWidth;
    const k = screenWidth ? screenWidth / vw : 1; // screen px per layout px
    const styles = new Map();
    const style = (el) => {
      if (!styles.has(el)) styles.set(el, getComputedStyle(el));
      return styles.get(el);
    };
    const visible = (el) =>
      el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : el.getClientRects().length > 0;
    const all = document.body
      ? [...document.body.querySelectorAll('*')].filter(
          (el) => el.localName !== 'appify-overlay' && !(el.closest('svg') && el.localName !== 'svg'),
        )
      : [];
    const round = (n) => Math.round(n);

    // Horizontal overflow and the widest elements causing it (skipping
    // anything inside its own horizontal scroller).
    const overflowX = Math.max(0, document.documentElement.scrollWidth - vw);
    let overflowBy = [];
    if (overflowX > 0) {
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (style(p).overflowX !== 'visible' && p.getBoundingClientRect().right <= vw + 1) return true;
        }
        return false;
      };
      overflowBy = all
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => r.width > 0 && r.right > vw + 1 && !clipped(el))
        .sort((a, b) => b.r.width - a.r.width)
        .slice(0, 5)
        .map(({ el, r }) => ({ selector: selectorFor(el), width: round(r.width) }));
    }

    // The CSS behind it: rules in effect here that fix a width wider than
    // the viewport (width, min-width, flex-basis, or the px tracks of
    // grid-template-columns) on an element that's showing.
    const wideRules = [];
    if (phone) {
      const px = (value) => {
        const repeat = value.match(/repeat\(\s*(\d+)\s*,\s*([\d.]+)px\s*\)/);
        const rest = value.replace(/repeat\([^)]*\)/g, '');
        return (repeat ? repeat[1] * repeat[2] : 0) + [...rest.matchAll(/([\d.]+)px/g)].reduce((sum, m) => sum + Number(m[1]), 0);
      };
      const walk = (rules) => {
        for (const rule of rules) {
          if (wideRules.length >= 8) return;
          if (rule.media && !mediaMatches(rule.media.mediaText)) continue;
          if (rule.selectorText) {
            for (const prop of ['width', 'min-width', 'flex-basis', 'grid-template-columns']) {
              const value = rule.style.getPropertyValue(prop);
              if (!value || px(value) <= vw) continue;
              let shown = false;
              try {
                shown = [...document.querySelectorAll(rule.selectorText)].some(visible);
              } catch {}
              if (shown) {
                wideRules.push({ rule: rule.selectorText.replace(/\[data-appify-hover\]/g, ':hover'), [prop]: value });
              }
            }
          }
          let children;
          try {
            children = rule.cssRules;
          } catch {}
          if (children?.length) walk(children);
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules);
        } catch {}
      }
    }

    // Tap targets below the platform minimum. A checkbox or radio inside a
    // label counts at the label's size, since the whole label is tappable.
    let tapTargets = null;
    if (phone) {
      const small = [];
      let total = 0;
      for (const el of document.querySelectorAll(TAPPABLE)) {
        if (!visible(el)) continue;
        const target = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest('label') ?? el) : el;
        const r = target.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        total += 1;
        const w = r.width * k;
        const h = r.height * k;
        if (w < TAP_MIN || h < TAP_MIN) small.push({ el, w, h });
      }
      small.sort((a, b) => a.w * a.h - b.w * b.h);
      tapTargets = {
        min: TAP_MIN,
        total,
        small: small.length,
        smallest: small.slice(0, 5).map(({ el, w, h }) => ({ selector: selectorFor(el), w: round(w), h: round(h) })),
      };
    }

    // Form fields whose text is under 16px (iOS zooms the page on focus).
    let smallFields = null;
    if (phone) {
      const list = [];
      for (const el of document.querySelectorAll(FIELD)) {
        if (!visible(el)) continue;
        const size = parseFloat(style(el).fontSize) * k;
        if (size < 16) list.push({ selector: selectorFor(el), fontSize: Math.round(size * 10) / 10 });
      }
      smallFields = { count: list.length, list: list.slice(0, 10) };
    }

    // CSS that only shows or hides something on :hover, not guarded by a
    // (hover: hover) media query. On phones the core frame script has
    // already rewritten :hover to [data-appify-hover].
    const hoverRules = new Set();
    const scan = (rules, guarded) => {
      for (const rule of rules) {
        const media = rule.media?.mediaText ?? '';
        const guard = guarded || /max-width:\s*0px|\(\s*(any-)?hover\s*:\s*hover\s*\)/.test(media);
        if (rule.selectorText && !guard && /:hover\b|\[data-appify-hover\]/.test(rule.selectorText)) {
          const s = rule.style;
          if (s.display || s.visibility || s.opacity) {
            hoverRules.add(rule.selectorText.replace(/\[data-appify-hover\]/g, ':hover'));
          }
        }
        let children;
        try {
          children = rule.cssRules;
        } catch {}
        if (children?.length) scan(children, guard);
      }
    };
    for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])]) {
      try {
        scan(sheet.cssRules, false);
      } catch {
        // Cross-origin stylesheets can't be read.
      }
    }

    // Fixed and sticky elements, and anything visible under the parts of the
    // screen the hardware covers (bands come in screen px).
    const fixed = [];
    const unsafe = [];
    const overlap = (r, b) =>
      Math.max(0, Math.min(r.right * k, b.x + b.w) - Math.max(r.left * k, b.x)) *
      Math.max(0, Math.min(r.bottom * k, b.y + b.h) - Math.max(r.top * k, b.y));
    const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    let smallText = 0;
    const smallTextSample = [];
    for (const el of all) {
      const cs = style(el);
      const positioned = cs.position === 'fixed' || cs.position === 'sticky';
      const text = hasText(el);
      const tappable = el.matches(TAPPABLE);
      if (!positioned && !text && !tappable) continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (positioned && fixed.length < 8) {
        fixed.push({ selector: selectorFor(el), position: cs.position, top: round(r.top * k), bottom: round(r.bottom * k), h: round(r.height * k) });
      }
      for (const band of bands) {
        if (unsafe.length < 8 && overlap(r, band) > 0) {
          unsafe.push({ selector: selectorFor(el), position: cs.position, under: band.name });
          break;
        }
      }
      if (phone && text && parseFloat(cs.fontSize) * k < 12) {
        smallText += 1;
        if (smallTextSample.length < 3) smallTextSample.push(selectorFor(el));
      }
    }

    return compact({
      layoutWidth: vw,
      overflowX: round(overflowX),
      overflowBy,
      wideRules,
      tapTargets,
      smallFields,
      hoverOnly: phone ? { count: hoverRules.size, rules: [...hoverRules].slice(0, 8) } : null,
      fixed,
      unsafe,
      smallText: phone ? { count: smallText, sample: smallTextSample } : null,
      head: await head(),
    });
  }

  async function head() {
    const content = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
    const themeColor = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
      m.media ? `${m.content} (${m.media})` : m.content,
    );
    const apple = Object.fromEntries(
      [...document.querySelectorAll('meta[name^="apple-mobile-web-app"]')].map((m) => [
        m.name.replace('apple-mobile-web-app-', ''),
        m.content,
      ]),
    );
    const manifestLink = document.querySelector('link[rel="manifest"]');
    let manifest = null;
    if (manifestLink) {
      manifest = { href: manifestLink.getAttribute('href') };
      try {
        const res = await fetch(manifestLink.href, { signal: AbortSignal.timeout(3000) });
        const m = await res.json();
        Object.assign(manifest, {
          name: m.name ?? null,
          short_name: m.short_name ?? null,
          display: m.display ?? null,
          start_url: m.start_url ?? null,
          id: m.id ?? null,
          theme_color: m.theme_color ?? null,
          icons: m.icons?.length ?? 0,
          maskable: m.icons?.some((i) => /maskable/.test(i.purpose ?? '')) ?? false,
          screenshots: m.screenshots?.length ?? 0,
          shortcuts: m.shortcuts?.length ?? 0,
          share_target: Boolean(m.share_target),
        });
      } catch (err) {
        manifest.error = `Couldn't read it: ${err.message}`;
      }
    }
    let serviceWorker = false;
    try {
      serviceWorker = Boolean(await navigator.serviceWorker?.getRegistration());
    } catch {}
    return compact({
      title: document.title || null,
      lang: document.documentElement.lang || null,
      viewport: content('meta[name="viewport"]'),
      themeColor: themeColor.length ? themeColor : null,
      apple: Object.keys(apple).length ? apple : null,
      appleTouchIcon: Boolean(document.querySelector('link[rel~="apple-touch-icon"]')),
      manifest,
      serviceWorker,
      og: compact({
        title: content('meta[property="og:title"]'),
        description: content('meta[property="og:description"]'),
        image: content('meta[property="og:image"]'),
        url: content('meta[property="og:url"]'),
      }),
      twitterCard: content('meta[name="twitter:card"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    });
  }

  // Drops null, empty lists and empty objects so the JSON stays small.
  function compact(obj) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value == null) continue;
      if (Array.isArray(value) && !value.length) continue;
      if (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) continue;
      out[key] = value;
    }
    return out;
  }

  // Same short, unique selectors as comments (frame/20-pick.js).
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
})();
