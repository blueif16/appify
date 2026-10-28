# Where the edits go, per stack

Find the stack from `package.json` and the folder layout. Each section says where the head tags, global styles, static files (manifest, icons), the service worker and per-page share tags go.

## Contents
- Plain HTML / multi-page (incl. Vite MPA)
- Vite SPA (React, Vue, Svelte)
- Next.js (App Router; Pages Router notes)
- SvelteKit
- Nuxt
- Astro

## Plain HTML / multi-page (incl. Vite MPA)
- **Head tags:** in every `.html` file's `<head>`. If there are many pages, keep the shared block identical across pages (or a build include) so none drifts.
- **Global styles:** the shared stylesheet. Put phone rules in clearly marked `@media` blocks at the end of the relevant section, or in a separate `mobile.css` linked after the main one.
- **Static files:** manifest, icons, `sw.js` at the web root (`public/` in Vite; the site root otherwise).
- **Share tags:** each page's own `<head>`; these are server-rendered by definition.
- **Navigation:** full page loads. A tab bar is the same markup on each page with `aria-current="page"` on the active tab. `@view-transition { navigation: auto; }` gives app-like transitions between pages.

## Vite SPA (React, Vue, Svelte)
- **Head tags:** `index.html` for the shared ones (viewport, theme-color, manifest, apple tags). Per-route titles from the router.
- **Global styles:** the root CSS (`src/index.css`, `App.css`, `main.css`) or the CSS framework config. With Tailwind, prefer `max-sm:`/`sm:` variants and add safe-area utilities like `pb-[max(env(safe-area-inset-bottom),12px)]`.
- **Static files:** `public/`. `vite-plugin-pwa` can generate the manifest and service worker if the project already uses plugins; a hand-written `public/sw.js` is fine otherwise.
- **Share tags:** a client-rendered SPA serves the same `index.html` for every route, and crawlers don't run JavaScript, so per-route previews need a server or edge function that injects tags per URL, prerendering, or one good site-wide card. Say which you chose.
- **Navigation:** the router. Sheets that open must be `<dialog>` or push a history entry so Back closes them; keep a scroll position per tab.

## Next.js (App Router)
- **Head tags:** `export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [...] }` and `export const metadata = { appleWebApp: { capable: true, title, statusBarStyle }, manifest: '/manifest.webmanifest', ... }` in `app/layout.tsx`; per page `generateMetadata`.
- **Manifest:** `app/manifest.ts` returning the manifest object.
- **Icons:** `app/icon.png`, `app/apple-icon.png` (180×180).
- **Share images:** `app/<route>/opengraph-image.tsx` with `ImageResponse` renders a card per route; `twitter-image` likewise.
- **Global styles:** `app/globals.css`; the shell in `app/layout.tsx` (tab bar as a client component using `usePathname`).
- **Service worker:** `public/sw.js`, registered from a small client component.
- **Pages Router:** head tags in `pages/_document.tsx` (viewport in `_app.tsx` via `next/head`), manifest and icons in `public/`.

## SvelteKit
- **Head tags:** `src/app.html` for shared tags; `<svelte:head>` in `+layout.svelte` and `+page.svelte` for per-page ones (server-rendered).
- **Static files:** `static/`. Service worker: `src/service-worker.js` (built in, gets the asset list).
- **Shell:** `src/routes/+layout.svelte`; active tab from `$page.url.pathname`.

## Nuxt
- **Head tags:** `app.head` in `nuxt.config` for shared ones; `useSeoMeta()` / `useHead()` per page (server-rendered).
- **Static files:** `public/`. Service worker: `@vite-pwa/nuxt` if modules are welcome, or `public/sw.js`.
- **Shell:** `app.vue` / `layouts/default.vue`.

## Astro
- **Head tags:** the shared layout component's `<head>`, with props for per-page title, description and image.
- **Static files:** `public/`. Share images can be generated at build time per page.
- **Navigation:** multi-page by default; `@view-transition { navigation: auto; }` or Astro's `<ClientRouter />` for transitions.
