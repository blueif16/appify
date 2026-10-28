// Photo picker: a tap opens the camera or photo library on phones, a click opens
// files on desktop, and drag-and-drop still works. Both end in show().
const drop = document.querySelector('.drop');
if (drop) {
  const input = drop.querySelector('input[type="file"]');
  const preview = drop.querySelector('.preview');
  const show = (file) => {
    if (!file) return;
    if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
    preview.onerror = () => {
      // A format this browser can't draw (e.g. HEIC on desktop Chrome): show the name instead.
      preview.hidden = true;
      drop.classList.remove('has-photo');
      drop.querySelector('.drop-text').textContent = file.name;
    };
    preview.src = URL.createObjectURL(file);
    preview.alt = file.name;
    preview.hidden = false;
    drop.classList.add('has-photo');
  };
  input.addEventListener('change', () => show(input.files[0]));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    input.files = e.dataTransfer.files; // the form carries a dropped photo too
    show(file);
  });

  // A photo shared into the installed app from Android's share sheet (sw.js keeps it).
  if (new URLSearchParams(location.search).has('shared') && 'caches' in window) {
    caches.open('lumen-shared').then(async (cache) => {
      const response = await cache.match('/shared-photo');
      if (!response) return;
      const blob = await response.blob();
      const name = decodeURIComponent(response.headers.get('X-File-Name') ?? 'photo');
      const file = new File([blob], name, { type: blob.type });
      const list = new DataTransfer();
      list.items.add(file);
      input.files = list.files;
      show(file);
      cache.delete('/shared-photo');
    });
  }
}

// The keyboard's "Next" key sends Enter, which would submit the form: move to the
// next text field instead (iOS and Android both label it Next via enterkeyhint).
const requestForm = document.querySelector('.request');
requestForm?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing || e.target.getAttribute('enterkeyhint') !== 'next') return;
  e.preventDefault();
  const fields = [...requestForm.querySelectorAll('input[type="text"], input[type="email"], textarea')];
  fields[fields.indexOf(e.target) + 1]?.focus();
});

// Touch screens wide enough for the desktop nav (tablets) can't hover: a tap on
// "Discover" opens its menu, a tap anywhere else closes it.
const menu = document.querySelector('.menu');
if (menu) {
  menu.firstElementChild.addEventListener('click', (e) => {
    if (!matchMedia('(hover: none)').matches) return;
    e.preventDefault();
    menu.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) menu.classList.remove('open');
  });
}

// Sheets and popups are <dialog>s: Esc and Android's Back close them, focus is
// trapped while open, and each has a visible close button for iOS.
for (const button of document.querySelectorAll('[data-open]')) {
  const dialog = document.getElementById(button.dataset.open);
  button.addEventListener('click', () => {
    dialog.dispatchEvent(new Event('beforeopen'));
    dialog.showModal();
    dialog.querySelector('input[type="search"]')?.focus();
  });
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (e) => {
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if ((e.target === dialog && outside) || e.target.closest('[data-close], .sheet-list a')) dialog.close();
  });
}

// Filters: on phones the sidebar's own filter list moves into the Filter sheet
// while it is open, so there is one set of checkboxes and one state. The button
// shows the count and the active filters show as removable chips.
const filters = document.getElementById('filters');
const filterSheet = document.getElementById('filter-sheet');
if (filters && filterSheet) {
  const home = filters.parentElement;
  filterSheet.addEventListener('beforeopen', () => filterSheet.querySelector('.filter-slot').append(filters));
  filterSheet.addEventListener('close', () => home.append(filters));

  const boxes = [...filters.querySelectorAll('input[type="checkbox"]')];
  const count = document.querySelector('.filter-count');
  const chips = document.querySelector('.active-filters');
  const nameOf = (box) => box.parentElement.textContent.trim();
  // ?filter=landscape,street reopens the same filters (no parameter: the defaults).
  const fromUrl = new URLSearchParams(location.search).get('filter');
  if (fromUrl !== null) {
    const wanted = fromUrl.toLowerCase().split(',');
    for (const box of boxes) box.checked = wanted.includes(nameOf(box).toLowerCase());
  }
  const saveToUrl = () => {
    const params = new URLSearchParams(location.search);
    params.delete('filter');
    const on = boxes.filter((box) => box.checked).map((box) => nameOf(box).toLowerCase());
    const query = [params.toString(), `filter=${on.join(',')}`].filter(Boolean).join('&');
    history.replaceState(history.state, '', `${location.pathname}?${query}${location.hash}`);
  };
  const render = () => {
    const on = boxes.filter((box) => box.checked);
    count.textContent = on.length || '';
    chips.replaceChildren(
      ...on.map((box) => {
        const name = nameOf(box);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.setAttribute('aria-label', `Remove filter: ${name}`);
        const pill = document.createElement('span');
        pill.textContent = name;
        pill.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>');
        chip.append(pill);
        chip.addEventListener('click', () => {
          box.checked = false;
          saveToUrl();
          render();
        });
        return chip;
      }),
    );
  };
  filters.addEventListener('change', () => {
    saveToUrl();
    render();
  });
  render();
}

// Sharing: the phone's own share sheet; on desktop, copy the link and say so.
async function shareLink({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

// Card actions. Every photo has its own link (/#harbor-at-6am). "Request critique"
// opens the form with the title filled in; on phones a ⋯ button opens the same
// actions as a sheet (run straight from the tap, which sharing needs).
const cardSheet = document.getElementById('card-sheet');
let sheetCard = null;
for (const card of document.querySelectorAll('.card')) {
  const title = card.querySelector('h3').textContent;
  const [request, share] = card.querySelectorAll('.actions button');
  request.addEventListener('click', () => location.assign(`/submit.html?title=${encodeURIComponent(title)}`));
  share.addEventListener('click', async () => {
    const url = `${location.origin}/#${card.id}`;
    const result = await shareLink({ title: `${title} · Lumen`, text: `“${title}” on Lumen`, url });
    if (result === 'copied') toast('Link copied');
    else if (result === 'failed') prompt('Copy this link:', url);
  });
  card.querySelector('.more')?.addEventListener('click', () => {
    sheetCard = card;
    cardSheet.querySelector('.action-title').textContent = title;
    cardSheet.showModal();
  });
}
for (const [value, index] of [['request', 0], ['share', 1]]) {
  cardSheet?.querySelector(`button[value="${value}"]`).addEventListener('click', () => {
    sheetCard?.querySelectorAll('.actions button')[index].click();
  });
}

const titleField = document.querySelector('.request input[name="title"]');
const presetTitle = new URLSearchParams(location.search).get('title');
if (titleField && presetTitle) titleField.value = presetTitle;

// Install: offered once on phones, after sending a request, never inside the
// installed app. Android gets the real install prompt; iOS has none, so we say how.
let installEvent = null;
const remember = (key) => {
  try {
    localStorage.setItem(key, '1');
  } catch {}
};
const recalled = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const installBox = document.querySelector('.install');
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});
addEventListener('appinstalled', () => {
  remember('install-dismissed');
  if (installBox) installBox.hidden = true;
});
installBox?.querySelector('.install-close').addEventListener('click', () => {
  remember('install-dismissed');
  installBox.hidden = true;
});
function offerInstall() {
  const standalone = document.documentElement.classList.contains('standalone');
  if (!installBox || standalone || recalled('install-dismissed') || !matchMedia('(max-width: 640px), (pointer: coarse) and (max-height: 500px)').matches) return;
  const text = installBox.querySelector('.install-text');
  const go = installBox.querySelector('.install-go');
  if (installEvent) {
    text.innerHTML = '<strong>Get the Lumen app</strong>Opens full screen from your Home Screen.';
    go.hidden = false;
    go.onclick = async () => {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      installEvent = null;
      if (outcome === 'accepted') installBox.hidden = true;
    };
  } else if ('standalone' in navigator) {
    text.innerHTML = '<strong>Put Lumen on your Home Screen</strong>Tap Share, then “Add to Home Screen”.';
    go.hidden = true;
  } else return;
  installBox.hidden = false;
}

const sent = document.querySelector('dialog.modal-box');
document.querySelector('.request')?.addEventListener('submit', (e) => {
  e.preventDefault();
  offerInstall();
  sent.showModal();
});

// "‹ Photos" and Cancel on the request page: when we came from the photo list,
// go back to it (it keeps its scroll position) instead of stacking a new entry.
for (const link of document.querySelectorAll('[data-back]')) {
  link.addEventListener('click', (e) => {
    const from = document.referrer ? new URL(document.referrer) : null;
    if (from && from.origin === location.origin && from.pathname === new URL(link.href).pathname && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

// Offline support for the installed app. Not on localhost: the dev server's hot
// reload and a service worker's cache don't mix.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
