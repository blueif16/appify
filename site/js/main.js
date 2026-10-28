import { startBots } from './bots.js';
import { startMarquee } from './marquee.js';
import { startSheet } from './sheet.js';
import { startStage } from './stage.js';

// Announcement: dismissed for this visit only.
const announce = document.querySelector('[data-announce]');
try {
  if (sessionStorage.getItem('appify.announce') === 'closed') announce.hidden = true;
} catch {
  // Storage blocked: the bar just shows.
}
announce?.querySelector('.announce-close')?.addEventListener('click', () => {
  announce.hidden = true;
  document.querySelector('.nav .logo')?.focus();
  try {
    sessionStorage.setItem('appify.announce', 'closed');
  } catch {
    // Nothing to keep.
  }
});

// The setup prompt a visitor pastes into their coding agent. It installs from
// the latest GitHub release (npm run release attaches both files).
const repo = 'https://github.com/blueif16/appify';
const download = `${repo}/releases/latest/download`;
const setupPrompt = `Set up appify in this project. appify helps you make this web app feel like an app on phones while it stays one URL, with no app store and no separate mobile site. It is a skill (instructions for you) plus a local studio that shows the app on desktop and phones side by side. Source: ${repo}

1. Install the appify command (needs Node 20+, git and Chrome or Chromium):
   npm install -g ${download}/appify.tgz
   Use this URL, not \`npx appify\`: the npm package named "appify" is an unrelated project.

2. Install the skill. For Claude Code, from the project root:
   mkdir -p .claude/skills && curl -fsSL ${download}/skill.tgz | tar -xz -C .claude/skills
   That creates .claude/skills/appify/SKILL.md. Other agents: extract it into the folder you load skills from; if you have none, read appify/SKILL.md from wherever you put it.

3. Add .appify/ to .gitignore.

4. Start this app's dev server if it isn't running. Then start the studio in the background from the project root and leave it running:
   appify studio http://localhost:<the app's port>
   If it says no Chromium was found, run \`npx -y playwright install chromium\` and start it again.

5. Tell me to open http://localhost:4747 to see the app on desktop and phones. Then ask whether to start making it feel like an app on phones with the appify skill.

Full instructions: ${repo}#install`;

const sheet = startSheet(document.querySelector('[data-sheet-dialog]'));
const bots = startBots(document.querySelector('.title-wrap'));
const promptText = document.querySelector('[data-prompt-text]');
promptText.textContent = setupPrompt;

const say = (text) => document.querySelectorAll('[data-copy-status]').forEach((el) => (el.textContent = text));
for (const button of document.querySelectorAll('[data-copy-prompt]')) {
  const label = button.textContent;
  const short = Boolean(button.closest('.sheet'));
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(setupPrompt);
      button.textContent = short ? 'Copied' : 'Copied. Paste it into your agent';
      say('Setup prompt copied to the clipboard.');
      if (!short) {
        burst(button);
        bots?.cheer();
      }
    } catch {
      // No clipboard access (http, or denied): show the prompt selected instead.
      sheet.open('skill');
      const range = document.createRange();
      range.selectNodeContents(promptText);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      promptText.focus({ preventScroll: true });
      button.textContent = short ? 'Press Ctrl+C' : 'Selected. Press Ctrl+C or Cmd+C';
      say('Setup prompt selected. Press Ctrl+C or Cmd+C to copy.');
    }
    clearTimeout(button.reset);
    button.reset = setTimeout(() => (button.textContent = label), 2400);
  });
}

// Get started: the top of the page floods yellow out of the button, the
// headline stands up in 3D and the copy button takes the stage (css/site.css).
// Clicking Get started again, or Escape, turns it back.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const getStarted = document.querySelector('[data-get-started]');
const heroCopy = document.querySelector('.hero [data-copy-prompt]');
const flood = document.querySelector('[data-go-flood]');
const isGo = () => document.body.classList.contains('is-go');

// The wipe grows from the Get started button and just covers the far corner.
function aimFlood() {
  const f = flood.getBoundingClientRect();
  const b = getStarted.getBoundingClientRect();
  const x = b.left + b.width / 2 - f.left;
  const y = b.top + b.height / 2 - f.top;
  const r = Math.hypot(Math.max(x, f.width - x), Math.max(y, f.height - y)) + 2;
  flood.style.setProperty('--x', `${x.toFixed(1)}px`);
  flood.style.setProperty('--y', `${y.toFixed(1)}px`);
  flood.style.setProperty('--r', `${Math.ceil(r)}px`);
  // The page's dots start at the top of the document; so do the yellow's.
  flood.style.setProperty('--dy', `${-Math.round(f.top + scrollY)}px`);
}

function setGo(on) {
  if (on === isGo()) return;
  aimFlood();
  document.body.classList.toggle('is-go', on);
  getStarted.setAttribute('aria-pressed', String(on));
  if (!on) return;
  sheet.close();
  if (scrollY > 0) scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
  heroCopy.focus({ preventScroll: true });
  setTimeout(() => bots?.cheer(), 500);
}

getStarted.addEventListener('click', () => setGo(!isGo()));
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !isGo() || document.querySelector('.sheet[open]')) return;
  setGo(false);
  getStarted.focus();
});
// Aimed from the start, so the first wipe doesn't slide in from a default spot.
aimFlood();
addEventListener('resize', aimFlood);

// A copied prompt: holo bits fly out of the button and fall away.
const bits = ['#ffb3d9', '#c3b2ff', '#9edcff', '#b6f5cf', '#ffeaa0', '#fff'];
function burst(button) {
  if (reduce.matches) return;
  const box = button.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'burst';
  layer.style.left = `${box.left + box.width / 2}px`;
  layer.style.top = `${box.top + box.height / 2}px`;
  for (let i = 0; i < 30; i++) {
    const bit = document.createElement('i');
    const strip = i % 3 === 0;
    const w = strip ? 4 : 6 + Math.random() * 5;
    const h = strip ? 12 : w;
    bit.style.width = `${w}px`;
    bit.style.height = `${h}px`;
    bit.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
    bit.style.background = bits[i % bits.length];
    // Out from the button's face, mostly up and sideways, then down.
    const sx = (Math.random() - 0.5) * box.width;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const speed = 90 + Math.random() * 140;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const spin = (Math.random() - 0.5) * 720;
    bit.animate(
      [
        { transform: `translate(${sx}px, 0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${sx + dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
        { transform: `translate(${sx + dx * 1.4}px, ${dy + 160}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(0, 0.6, 0.4, 1)', fill: 'forwards' },
    );
    layer.append(bit);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1600);
}

startMarquee(document.querySelector('[data-marquee]'));
startStage(document.querySelector('[data-media]'));
