// Lumen service worker: the app opens from the Home Screen even offline.
// Network first for everything, so an online app is never stale; the cache is
// only the fallback (pages, styles and scripts as they were last seen).
const CACHE = 'lumen-v1';
const PAGES = ['/', '/submit.html', '/offline.html'];
const SHARED = 'lumen-shared';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(PAGES.map((url) => cache.add(new Request(url, { cache: 'reload' }))))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== SHARED).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A photo shared into the installed app (Android share sheet, manifest share_target):
  // keep it for the request form and open that form.
  if (request.method === 'POST' && url.origin === location.origin && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        const form = await request.formData();
        const photo = form.getAll('photos').find((item) => item instanceof File && item.size > 0);
        if (photo) {
          const cache = await caches.open(SHARED);
          const headers = { 'Content-Type': photo.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(photo.name) };
          await cache.put('/shared-photo', new Response(photo, { headers }));
        }
        const title = form.get('title');
        return Response.redirect(`/submit.html?shared=1${title ? `&title=${encodeURIComponent(title)}` : ''}`, 303);
      })(),
    );
    return;
  }
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules/')) return; // dev server internals
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      } catch {
        const navigate = request.mode === 'navigate';
        const hit = await caches.match(request, { ignoreSearch: navigate });
        return hit ?? (navigate ? caches.match('/offline.html') : Response.error());
      }
    })(),
  );
});
