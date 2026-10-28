// Opens a studio in headless Chromium with a given window setup and, for each
// page, saves a framed screenshot of every device (bezel and browser bars
// included) and collects that page's facts (frame/40-facts.js). Used by
// checkpoints and `appify snapshot`.

import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { DEVICES, screenLayout, screenSize } from './devices.js';

const STORE = 'appify.studio.v1';
const SCALE = 2;

// env APPIFY_CHROMIUM, then the newest Playwright Chromium, then an
// installed Chrome or Edge.
export function findBrowser() {
  if (process.env.APPIFY_CHROMIUM) return process.env.APPIFY_CHROMIUM;

  const cache = path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  const builds = (() => {
    try {
      return readdirSync(cache)
        .filter((name) => /^chromium-\d+$/.test(name))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    } catch {
      return [];
    }
  })();
  const inBuild = [
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
    'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-win64/chrome.exe',
    'chrome-win/chrome.exe',
  ];
  const system = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const found = [...builds.flatMap((build) => inBuild.map((file) => path.join(cache, build, file))), ...system].find(
    (file) => existsSync(file),
  );
  if (found) return found;
  throw new Error(
    'No Chromium found for screenshots. Install one with `npx playwright install chromium`, or set APPIFY_CHROMIUM to a Chrome or Chromium executable.',
  );
}

// state: the studio state to show (windows, mode, orientation, appearance).
// Returns { shots, facts }: shots as listed in a checkpoint's meta, facts one
// entry per visible window per page. With shots false, no screenshots are
// taken and outDir may be null.
export async function capture({ studioUrl, state, pages, outDir, shots = true, log = () => {} }) {
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 2600, height: 1600 },
      deviceScaleFactor: shots ? SCALE : 1,
    });
    const origin = new URL(studioUrl).origin;
    // The studio reads its state from localStorage; set it from the URL hash
    // before the studio's own scripts run.
    await context.addInitScript(
      ([studioOrigin, key]) => {
        if (location.origin !== studioOrigin) return;
        const match = location.hash.match(/^#appify-state=(.*)$/);
        if (match) {
          try {
            localStorage.setItem(key, decodeURIComponent(match[1]));
          } catch {}
        }
      },
      [origin, STORE],
    );
    const page = await context.newPage();
    if (shots) await mkdir(outDir, { recursive: true });

    const result = { shots: [], facts: [] };
    const seen = {};
    for (const win of state.windows) seen[win.device] = (seen[win.device] ?? 0) + 1;

    for (const pagePath of pages) {
      log(`capturing ${pagePath}`);
      const shown = { ...state, path: pagePath, zoom: 'actual', network: 'fast', keyboard: 'on' };
      await page.goto('about:blank');
      await page.goto(`${origin}/?capture=1#appify-state=${encodeURIComponent(JSON.stringify(shown))}`);
      const windows = await waitForFrames(page, state);

      // Clean framing: no dot grid, marks, stickers, comment pins, or the
      // studio's floating panels and window controls painted over a device.
      await page.addStyleTag({
        content:
          ':root { background: transparent !important; } .marks, .stickers, .edge, .logo, .win-actions, dialog { display: none !important; }',
      });
      const figures = await page.$$('.row > figure.frame');

      for (const [i, win] of windows.entries()) {
        if (win.minimized) continue;
        const frame = await (await figures[i].$('iframe')).contentFrame();
        await frame.evaluate(() => {
          const style = document.createElement('style');
          style.textContent = 'appify-overlay { display: none !important; }';
          document.documentElement.append(style);
        });

        const device = DEVICES[win.device];
        const geometry = viewportGeometry(device, state.mode, win.page, win.orientation);
        const facts = await frame
          .evaluate((opts) => window.__appify?.facts?.(opts) ?? { error: 'The page did not load in the studio.' }, {
            bands: geometry.bands,
            screenWidth: geometry.width,
          })
          .catch((err) => ({ error: err.message }));
        const { layoutWidth, ...rest } = facts;
        const entry = {
          page: pagePath,
          device: device.id,
          name: device.name,
          os: device.os,
          mode: device.kind === 'desktop' ? 'browser' : state.mode,
          ...(device.kind === 'phone' ? { orientation: win.orientation } : {}),
          viewport: { w: geometry.width, h: geometry.height, layoutWidth: layoutWidth ?? geometry.width },
          ...rest,
        };

        if (shots) {
          const file = `${slug(pagePath)}--${device.id}${seen[device.id] > 1 ? `-${win.key}` : ''}.png`;
          const el = await figures[i].$('.device');
          await el.screenshot({ path: path.join(outDir, file), omitBackground: true, animations: 'disabled' });
          const box = await el.boundingBox();
          result.shots.push({
            page: pagePath,
            device: device.id,
            name: device.name,
            windowKey: win.key,
            file,
            width: Math.round(box.width * SCALE),
            height: Math.round(box.height * SCALE),
          });
          entry.shot = file;
        }
        result.facts.push(entry);
      }
    }
    return result;
  } finally {
    await browser.close();
  }
}

// Waits until every visible window's page has loaded and reported to the
// studio. Returns the windows in the studio's order with what each page
// declared (viewport tag, status bar style) and its orientation.
async function waitForFrames(page, state) {
  const deadline = Date.now() + 30_000;
  let windows = [];
  while (Date.now() < deadline) {
    windows = await page
      .evaluate(async () => {
        const { studio } = await import('/hooks.js');
        return studio.frames.map((f) => ({
          key: f.win.key,
          device: f.device.id,
          minimized: f.win.minimized,
          orientation: f.orientation ?? 'portrait',
          page: f.page,
        }));
      })
      .catch(() => []);
    const visible = windows.filter((win) => !win.minimized);
    if (visible.length && visible.every((win) => win.page?.path !== undefined)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const visible = windows.filter((win) => !win.minimized);
  if (!visible.length || !visible.every((win) => win.page?.path !== undefined)) {
    throw new Error("The app didn't load in the studio within 30 seconds. Is its dev server running?");
  }

  const figures = await page.$$('.row > figure.frame');
  await Promise.all(
    windows.map(async (win, i) => {
      if (win.minimized) return;
      const frame = await (await figures[i].$('iframe')).contentFrame();
      await frame.waitForFunction(() => document.readyState === 'complete', null, { timeout: 15_000 }).catch(() => {});
      await frame.evaluate(() => document.fonts?.ready.then(() => true)).catch(() => {});
    }),
  );
  await page.evaluate(() => document.fonts?.ready.then(() => true));
  await page.waitForTimeout(600); // images decode, studio layout settles
  return windows;
}

// The page's viewport in screen px, and the strips of it that phone hardware
// covers (status bar, camera side, home indicator), in viewport coordinates.
function viewportGeometry(device, mode, page = {}, orientation = 'portrait') {
  if (device.kind === 'desktop') return { width: device.width, height: device.height, bands: [] };
  const L = screenLayout(device, mode, page, orientation);
  const size = screenSize(device, orientation);
  const width = size.width - L.left - L.right;
  const height = size.height - L.top - L.bottom;
  const bands = [];
  if (device.os === 'ios') {
    if (orientation === 'landscape') {
      const { side, bottom } = device.landscape;
      if (L.left === 0 && side) {
        bands.push({ name: 'side inset', x: 0, y: 0, w: side, h: height });
        bands.push({ name: 'side inset', x: width - side, y: 0, w: side, h: height });
      }
      if (L.bottom === 0 && bottom) bands.push({ name: 'home indicator', x: 0, y: height - bottom, w: width, h: bottom });
    } else if (mode === 'installed') {
      if (L.top === 0) bands.push({ name: 'status bar', x: 0, y: 0, w: width, h: device.safeTop });
      if (device.safeBottom) {
        bands.push({ name: 'home indicator', x: 0, y: height - device.safeBottom, w: width, h: device.safeBottom });
      }
    }
  }
  return { width, height, bands };
}

const slug = (pagePath) =>
  pagePath
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'home';
