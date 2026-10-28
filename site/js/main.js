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

// Get started: bring the hero's copy button into view and make it call out,
// since copying the prompt is the first step.
const heroCopy = document.querySelector('.hero [data-copy-prompt]');
const heroNote = document.querySelector('[data-hero-note]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let calling;
document.querySelector('[data-get-started]').addEventListener('click', () => {
  sheet.close();
  const box = heroCopy.getBoundingClientRect();
  if (box.top < 0 || box.bottom > innerHeight) heroCopy.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' });
  heroCopy.focus({ preventScroll: true });
  for (const el of [heroCopy, heroNote]) {
    el.classList.remove('is-calling');
    void el.offsetWidth;
    el.classList.add('is-calling');
  }
  clearTimeout(calling);
  calling = setTimeout(() => [heroCopy, heroNote].forEach((el) => el.classList.remove('is-calling')), 2600);
});

startMarquee(document.querySelector('[data-marquee]'));
startBots(document.querySelector('.title-wrap'));
startStage(document.querySelector('[data-media]'));
