// Draws the keyboard a phone shows for a field, in plain HTML: iOS with its
// form accessory bar and predictive bar, or Gboard on Android. The layout
// follows the field (inputmode, type, enterkeyhint), so an email field typed
// as plain text visibly gets the wrong keyboard. Every key has data-key with
// what it types or does: a character, or shift, backspace, enter, done, next,
// previous, layer:<name>.

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const IOS_NUMBERS = ['1234567890', '-/:;()$&@"', ".,?!'"];
const ANDROID_NUMBERS = ['1234567890', '@#$_&-+()/', '*"\':;!?'];
const PAD_LETTERS = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
const IOS_BLUE = new Set(['go', 'search', 'send', 'done']);

const svg = (w, h, body, extra = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"') =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" ${extra}>${body}</svg>`;

const ICON = {
  shift: (on) => svg(22, 22, '<path d="M11 3 2.5 11.5H7V19h8v-7.5h4.5Z"/>', `fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"`),
  backspace: svg(26, 20, '<path d="M8 2h15a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8l-7-8Z"/><path d="m12.5 6.5 7 7m0-7-7 7"/>'),
  emoji: svg(24, 24, '<circle cx="12" cy="12" r="9.5"/><path d="M8 14.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>'),
  mic: svg(24, 24, '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>'),
  grid: svg(22, 22, '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="13" y="3" width="6" height="6" rx="1"/><rect x="3" y="13" width="6" height="6" rx="1"/><rect x="13" y="13" width="6" height="6" rx="1"/>'),
  up: svg(20, 20, '<path d="m4 13 6-6 6 6"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'),
  down: svg(20, 20, '<path d="m4 7 6 6 6-6"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'),
  hide: svg(22, 22, '<path d="m6 9 5 5 5-5"/>'),
};

const ANDROID_ENTER = {
  return: '<path d="M18 5v6a3 3 0 0 1-3 3H5m4-4-4 4 4 4"/>',
  enter: '<path d="M18 5v6a3 3 0 0 1-3 3H5m4-4-4 4 4 4"/>',
  go: '<path d="M4 11h13m-5-5 5 5-5 5"/>',
  next: '<path d="M4 11h11m-4-4 4 4-4 4M18 6v10"/>',
  previous: '<path d="M18 11H7m4-4-4 4 4 4M4 6v10"/>',
  search: '<circle cx="9.5" cy="9.5" r="5.5"/><path d="m14 14 5 5"/>',
  send: '<path d="M3 11 19 4l-5 15-3-6Z"/><path d="m11 13 8-9"/>',
  done: '<path d="m4 11 5 5 9-10"/>',
};

const key = (k, label = k, cls = '') => `<b class="k${cls ? ` ${cls}` : ''}" data-key="${esc(k)}">${label}</b>`;
const row = (keys, cls = '') => `<div class="kr${cls ? ` ${cls}` : ''}">${keys.join('')}</div>`;
const half = '<i class="kh"></i>';
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Number pads: iOS shows one for numeric, decimal and tel; Android also for
// type=number.
const padFor = (os, layout) => ['numeric', 'decimal', 'tel'].includes(layout) || (os === 'android' && layout === 'number');

export function keyboardHTML(device, field, { shift = false, layer = null } = {}) {
  return device.os === 'ios' ? iosKeyboard(device, field, shift, layer) : androidKeyboard(field, shift, layer);
}

function iosKeyboard(device, field, shift, layer) {
  const pad = padFor('ios', field.layout);
  const current = layer ?? (field.layout === 'number' ? 'numbers' : 'letters');
  const enterLabel = { enter: 'return' }[field.enter] ?? field.enter;
  const enter = key('enter', enterLabel, `fn enter${IOS_BLUE.has(field.enter) ? ' blue' : ''}`);
  const accessory = `<div class="kb-accessory">${key('previous', ICON.up, 'ka')}${key('next', ICON.down, 'ka')}<span class="kb-fill"></span>${key('done', 'Done', 'ka done')}</div>`;

  let body;
  if (pad) {
    const corner = field.layout === 'decimal' ? key('.', '.') : field.layout === 'tel' ? key('+', '+*#', 'fn') : '<b class="k blank"></b>';
    const digit = (n) => key(String(n), `${n}<small>${PAD_LETTERS[n - 1] ?? ''}</small>`, 'pad');
    body = `<div class="kb-rows pad">${row([1, 2, 3].map(digit))}${row([4, 5, 6].map(digit))}${row([7, 8, 9].map(digit))}${row([corner, key('0', '0', 'pad'), key('backspace', ICON.backspace, 'fn plain')])}</div>`;
  } else {
    const letters = current === 'letters';
    const rows = letters ? LETTERS : IOS_NUMBERS;
    const char = (c) => key(letters && shift ? c.toUpperCase() : c);
    const third = letters
      ? [key('shift', ICON.shift(shift), `fn wide${shift ? ' on' : ''}`), ...[...rows[2]].map(char), key('backspace', ICON.backspace, 'fn wide')]
      : [key('layer:letters', 'ABC', 'fn wide'), ...[...rows[2]].map(char), key('backspace', ICON.backspace, 'fn wide')];
    const switcher = key(letters ? 'layer:numbers' : 'layer:letters', letters ? '123' : 'ABC', 'fn wide');
    const extras =
      field.layout === 'email' ? [key(' ', 'space', 'space'), key('@'), key('.')]
      : field.layout === 'url' ? [key('.'), key('/'), key('.com', '.com', 'fn'), '<b class="k gap"></b>']
      : [key(' ', 'space', 'space')];
    const homeButton = device.homeButton ? [key('emoji', ICON.emoji, 'fn')] : [];
    body = `
      <div class="kb-predict"><span>“I”</span><span>The</span><span>I’m</span></div>
      <div class="kb-rows">
        ${row([...rows[0]].map(char))}
        ${row([half, ...[...rows[1]].map(char), half])}
        ${row(third)}
        ${row([switcher, ...homeButton, ...extras, enter], 'bottom')}
      </div>`;
  }
  const chin = device.homeButton ? '' : `<div class="kb-chin">${ICON.emoji}${ICON.mic}</div>`;
  return `${accessory}<div class="kb-body">${body}${chin}</div>`;
}

function androidKeyboard(field, shift, layer) {
  const pad = padFor('android', field.layout);
  const enter = key('enter', svg(22, 22, ANDROID_ENTER[field.enter] ?? ANDROID_ENTER.return), 'fn enter');
  const strip = `<div class="kb-predict">${ICON.grid}<span>the</span><span>I</span><span>and</span>${ICON.mic}</div>`;
  const nav = `<div class="kb-nav"><span data-key="done" class="kb-hide">${ICON.hide}</span></div>`;

  if (pad) {
    const corner = field.layout === 'tel' ? key('+') : key(',');
    const body = `<div class="kb-rows pad">
      ${row([key('1'), key('2'), key('3'), key('-', '-', 'fn')])}
      ${row([key('4'), key('5'), key('6'), key(' ', '␣', 'fn')])}
      ${row([key('7'), key('8'), key('9'), key('backspace', ICON.backspace, 'fn')])}
      ${row([corner, key('0'), key('.'), enter])}
    </div>`;
    return `${body}${nav}`;
  }

  const letters = (layer ?? 'letters') === 'letters';
  const rows = letters ? LETTERS : ANDROID_NUMBERS;
  const char = (c, i, hint) =>
    key(letters && shift ? c.toUpperCase() : c, `${letters && shift ? c.toUpperCase() : c}${hint ? `<sup>${hint}</sup>` : ''}`);
  const first = [...rows[0]].map((c, i) => char(c, i, letters ? String((i + 1) % 10) : ''));
  const third = letters
    ? [key('shift', ICON.shift(shift), `fn wide${shift ? ' on' : ''}`), ...[...rows[2]].map((c) => char(c)), key('backspace', ICON.backspace, 'fn wide')]
    : [key('layer:letters', '=\\<', 'fn wide'), ...[...rows[2]].map((c) => char(c)), key('backspace', ICON.backspace, 'fn wide')];
  const left = field.layout === 'email' ? key('@') : field.layout === 'url' ? key('/') : key(',');
  const bottom = [
    key(letters ? 'layer:numbers' : 'layer:letters', letters ? '?123' : 'ABC', 'fn wide'),
    left,
    key('emoji', ICON.emoji, 'fn'),
    key(' ', '', 'space'),
    key('.'),
    enter,
  ];
  return `${strip}<div class="kb-rows">
    ${row(first)}
    ${row([half, ...[...rows[1]].map((c) => char(c)), half])}
    ${row(third)}
    ${row(bottom, 'bottom')}
  </div>${nav}`;
}
