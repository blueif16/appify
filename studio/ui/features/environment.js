// Theme and network for the pages in every window: light or dark (what
// prefers-color-scheme answers, see frame/15-appearance.js) and full speed or
// slow 4G (applied by the proxy, see src/routes/network.js).
import { studio } from '/hooks.js';

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = '/features/environment.css';
document.head.append(stylesheet);

const icon = (body) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${body}</svg>`;

const GROUPS = [
  {
    key: 'appearance',
    caption: 'Theme',
    options: [
      { value: 'system', label: 'Theme: same as this computer', icon: icon('<circle cx="8" cy="8" r="5.35"/><path d="M8 2.65v10.7A5.35 5.35 0 0 0 8 2.65Z" fill="currentColor"/>') },
      { value: 'light', label: 'Theme: light', icon: icon('<circle cx="8" cy="8" r="2.85"/><path d="M8 .9v2M8 13.1v2M.9 8h2M13.1 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/>') },
      { value: 'dark', label: 'Theme: dark', icon: icon('<path d="M13.6 10.1A6 6 0 0 1 5.9 2.4a6 6 0 1 0 7.7 7.7Z"/>') },
    ],
  },
  {
    key: 'network',
    caption: 'Network',
    options: [
      { value: 'fast', label: 'Network: full speed', icon: icon('<path d="M2 13.35h2V10H2zM6 13.35h2V7H6zM10 13.35h2V4h-2zM14 13.35h-.01" fill="currentColor"/>') },
      { value: 'slow-4g', label: 'Network: slow 4G, 150 ms and 1.6 Mbps', icon: icon('<path d="M2 13.35h2V10H2z" fill="currentColor"/><path d="M6.65 13.35V7.65h1.7v5.7zM10.65 13.35v-8.7h1.7v8.7z" stroke-dasharray="1.2 1.2"/>') },
    ],
  },
];

studio.state.appearance ??= 'system';
studio.state.network ??= 'fast';

const panel = document.createElement('section');
panel.className = 'panel env';
panel.setAttribute('aria-label', 'Theme and network');
panel.innerHTML = GROUPS.map(
  (group) => `
    <div class="env-group" role="group" aria-label="${group.caption}" data-key="${group.key}">
      <span class="caption" aria-hidden="true">${group.caption}</span>
      ${group.options
        .map((o) => `<button type="button" data-value="${o.value}" title="${o.label}" aria-label="${o.label}">${o.icon}</button>`)
        .join('')}
    </div>`,
).join('');
studio.addPanel('right', panel, 40);

function sync() {
  for (const group of panel.querySelectorAll('.env-group')) {
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(studio.state[group.dataset.key] === button.dataset.value));
    }
  }
}

async function applyNetwork() {
  try {
    await fetch('/api/network', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: studio.state.network }),
    });
  } catch {}
}

panel.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  const key = button.closest('.env-group').dataset.key;
  if (studio.state[key] === button.dataset.value) return;
  studio.state[key] = button.dataset.value;
  studio.save();
  sync();
  if (key === 'appearance') studio.render();
  else applyNetwork();
});

// Pages are told the chosen theme; 'system' leaves the computer's in place.
studio.onConfig(() => ({ appearance: studio.state.appearance === 'system' ? null : studio.state.appearance }));

sync();
applyNetwork();
