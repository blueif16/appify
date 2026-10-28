# Step: installable

Goal: the app can live on the Home Screen with a proper icon and name, opens full screen like an app, and shows a one-time, platform-correct way to install it. No app store.

## 1. Manifest
`/manifest.webmanifest` (stack-specific location in `stacks.md`), linked from every page with `<link rel="manifest" href="/manifest.webmanifest">`:
```json
{
  "id": "/",
  "name": "Lumen: photo critiques",
  "short_name": "Lumen",
  "description": "Get honest feedback on your photos.",
  "start_url": "/?source=home-screen",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [{ "name": "New request", "url": "/new" }],
  "screenshots": [{ "src": "/screenshots/home.png", "sizes": "786x1704", "type": "image/png", "form_factor": "narrow", "label": "Your photos" }]
}
```
- Never change `id` later: a new `id` is a new app on the user's phone.
- `start_url` must return 200 without a cross-origin redirect.
- `screenshots` and `description` turn Chrome's install sheet into a rich one. Framed device screenshots from `appify snapshot --shots` aren't suitable (they include the bezel); take a plain page screenshot at a phone size.

## 2. Icons
- `icon-192.png`, `icon-512.png`: the app mark on a solid background.
- `maskable-512.png`: the same mark inside the central circle (radius 40% of the width), full-bleed background. Never `"purpose": "any maskable"` on one file.
- `apple-touch-icon.png` 180×180, opaque (iOS ignores transparency and uses this over manifest icons): `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.
- If the app only has an SVG or text logo, make an `icon.svg` and render the PNGs with whatever is available (`sharp`, ImageMagick, or a headless browser screenshot). Check the PNGs by opening them.
- `<meta name="apple-mobile-web-app-title" content="Lumen">`.

## 3. Service worker (only if it earns its place)
Install works without one. Add one for offline use or for Chrome's automatic install prompt. Don't register it on `localhost`: it caches files and fights hot reload.
```js
// sw.js: app shell offline, everything else from the network.
const CACHE = 'shell-v1';
const SHELL = ['/', '/offline.html', '/styles.css', '/main.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))));
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    request.mode === 'navigate'
      ? fetch(request).catch(async () => (await caches.match(request)) ?? caches.match('/offline.html'))
      : caches.match(request).then((hit) => hit ?? fetch(request)),
  );
});
```
```html
<script>
  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname))
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
</script>
```
Never add an empty `fetch` handler just to look installable.

## 4. Install UX
One small, dismissible, platform-correct prompt, shown after the user has done something meaningful (not on first load), and never in standalone:
```js
const standalone = document.documentElement.classList.contains('standalone');
const dismissed = localStorage.getItem('install-dismissed');
let deferred;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });   // Android Chrome
addEventListener('appinstalled', () => hideInstall());
function maybeOfferInstall() {                      // call after a meaningful action
  if (standalone || dismissed) return;
  const iosSafari = /iPhone|iPad/.test(navigator.userAgent) && !('BeforeInstallPromptEvent' in window);
  if (deferred) showInstall('Install the app', () => deferred.prompt());
  else if (iosSafari) showInstall('Add to Home Screen: tap Share, then "Add to Home Screen"', null);
}
```
- `showInstall` renders a small bottom banner above the tab bar with a close button that sets `install-dismissed`.
- iOS steps in words: **Share → Add to Home Screen → keep "Open as Web App" on → Add**.
- Push permission, if the app has notifications: only from a tap, and on iOS only when standalone ("Add to Home Screen to get notifications" otherwise).

## Done when
`head` in the facts shows the manifest with icons and `display: standalone`, the PNG icons look right when opened, and in the studio's Home Screen mode the app opens full screen with correct bars. Checkpoint "Installable". The real install needs the studio's "On my phone" link (HTTPS).
