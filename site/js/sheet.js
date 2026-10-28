// The full-screen sheet behind the Studio and Skill tabs. Any [data-sheet]
// button toggles it: the view that's open closes, another view swaps in.
// Escape, Close and the sheet's logo close it.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export function startSheet(dialog) {
  const views = [...dialog.querySelectorAll('[data-view]')];
  const triggers = [...document.querySelectorAll('[data-sheet]')];
  let current = null;

  const mark = () => {
    for (const button of triggers) {
      const on = button.dataset.sheet === current;
      button.classList.toggle('is-active', on);
      if (dialog.contains(button)) button.setAttribute('aria-pressed', String(on));
      else button.setAttribute('aria-expanded', String(on));
    }
  };

  const show = (name) => {
    for (const view of views) view.hidden = view.dataset.view !== name;
    current = name;
    mark();
  };

  function open(name) {
    // Switching views: showing the other one replays its entrance in CSS.
    if (dialog.open) return show(name);
    dialog.classList.remove('is-closing');
    show(name);
    dialog.showModal();
    dialog.querySelector(`.sheet-tabs [data-sheet="${name}"]`)?.focus({ preventScroll: true });
  }

  function close() {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    const done = () => {
      dialog.classList.remove('is-closing');
      dialog.close();
      current = null;
      mark();
    };
    if (reduce.matches) return done();
    dialog.classList.add('is-closing');
    // Only the sheet's own wipe ends the close, not a view still fading in.
    const onEnd = (e) => {
      if (e.target !== dialog) return;
      dialog.removeEventListener('animationend', onEnd);
      done();
    };
    dialog.addEventListener('animationend', onEnd);
  }

  for (const button of triggers) {
    button.addEventListener('click', () => (dialog.open && current === button.dataset.sheet ? close() : open(button.dataset.sheet)));
  }
  for (const el of dialog.querySelectorAll('[data-close]')) el.addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  mark();

  return { open, close, get current() { return dialog.open ? current : null; } };
}
