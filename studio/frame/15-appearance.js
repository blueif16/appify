// Light / Dark: when the studio picks an appearance, the page sees that
// prefers-color-scheme instead of the computer's. Pages that support both
// schemes also get their built-in colors (form controls, default background)
// in the chosen one.
(() => {
  const appify = window.__appify;
  const scheme = appify?.cfg.appearance;
  if (scheme !== 'light' && scheme !== 'dark') return;

  const TRUE = '(min-width: 0px)';
  const FALSE = '(max-width: 0px)';
  const dark = scheme === 'dark';
  appify.media.push(
    [/\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi, dark ? TRUE : FALSE],
    [/\(\s*prefers-color-scheme\s*:\s*light\s*\)/gi, dark ? FALSE : TRUE],
  );

  const pickScheme = () => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? '';
    const supported = `${getComputedStyle(root).colorScheme} ${meta}`;
    if (supported.includes('light') && supported.includes('dark')) root.style.colorScheme = scheme;
  };
  document.addEventListener('DOMContentLoaded', pickScheme);
  addEventListener('load', pickScheme);
})();
