# Step: navigation

Goal: moving around feels like an app. Main destinations sit under the thumb, menus and panels open as sheets, Back (gesture or button) closes what's open before it leaves, and a Home Screen app on iOS still has a way back.

## 1. Pick the pattern (from `app-types.md`)
- **Bottom tab bar:** apps with 3–5 main destinations (dashboards, feeds, tools with sections).
- **Top bar + menu sheet:** content sites and apps with one main screen.
Keep the desktop navigation exactly as it is; the phone pattern appears only under the phone breakpoint.

## 2. Bottom tab bar
```html
<nav class="tabbar" aria-label="Main">
  <a href="/" aria-current="page"><svg aria-hidden="true">…</svg><span>Photos</span></a>
  <a href="/critiques"><svg aria-hidden="true">…</svg><span>Critiques</span></a>
  <a href="/new" class="tab-primary"><svg aria-hidden="true">…</svg><span>New</span></a>
  <a href="/challenges"><svg aria-hidden="true">…</svg><span>Challenges</span></a>
  <a href="/me"><svg aria-hidden="true">…</svg><span>You</span></a>
</nav>
```
```css
.tabbar { display: none; }
@media (max-width: 640px) {
  .tabbar {
    position: fixed; inset: auto 0 0; z-index: 20;
    display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    padding-bottom: max(env(safe-area-inset-bottom), 6px);
    background: #fff; border-top: 1px solid rgb(0 0 0 / .08);   /* solid: Safari tints from it */
  }
  .tabbar a {
    min-height: 52px; display: grid; place-items: center; align-content: center; gap: 2px;
    font-size: 11px; color: #6b7280; text-decoration: none;
  }
  .tabbar a[aria-current="page"] { color: var(--brand); }
  .tabbar svg { width: 24px; height: 24px; }
  body { padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px)); }  /* room for the bar */
}
```
- Labels one word; icons outlined, the active one filled or tinted.
- Use real links to real URLs so tabs reload, deep-link and share. Destinations that don't exist yet can point to the closest existing page; say so in the checkpoint note.
- Hide the desktop sidebar or nav links on phones once the tab bar covers them; secondary items go to a "You"/"More" screen or a menu sheet.

## 3. Compact top bar
On phones: title or logo, plus at most two icon buttons (search, an overflow "⋯"). Search becomes an icon that opens a search sheet with an `<input type="search" enterkeyhint="search">`. Height 48–56px plus the top inset (from the shell step).

## 4. Sheets, menus and popups
Use the platform so Android's Back closes them and focus is handled:
```html
<button type="button" data-open="filters">Filter</button>
<dialog id="filters" class="sheet" aria-labelledby="filters-title">
  <form method="dialog">
    <header><h2 id="filters-title">Filter</h2><button value="close" aria-label="Close">✕</button></header>
    …
  </form>
</dialog>
```
```css
.sheet { border: 0; padding: 0; overscroll-behavior: contain; }
.sheet::backdrop { background: rgb(0 0 0 / .4); }
@media (max-width: 640px) {
  .sheet {
    margin: auto 0 0; width: 100%; max-width: 100%; max-height: 85dvh;
    border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```
```js
for (const button of document.querySelectorAll('[data-open]')) {
  const dialog = document.getElementById(button.dataset.open);
  button.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // tap outside
}
```
- Small menus (a hover dropdown) → `<button popovertarget="menu">` + `<div id="menu" popover>`: opens on tap, closes on outside tap, Esc and Android Back.
- Custom overlays that can't become `<dialog>`: push a history entry when opening and close on `popstate`, so Back closes them.
- Existing modals become sheets on phones by the CSS above; keep a visible close button (iOS has no Back).

## 5. Back in iOS Home Screen apps
No browser back exists there. Show your own on non-root pages, only in standalone:
```html
<button class="app-back" aria-label="Back" hidden>‹ Back</button>
<script>
  const back = document.querySelector('.app-back');
  back.hidden = !(document.documentElement.classList.contains('standalone') && location.pathname !== '/');
  back.addEventListener('click', () =>
    (window.navigation?.canGoBack ?? history.length > 1) ? history.back() : location.assign('/'));
</script>
```

## 6. Transitions (optional polish)
Multi-page apps: `@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }` (Chrome 126, Safari 18.2). SPAs: wrap route changes in `document.startViewTransition()` when it exists. Keep them under ~300 ms.

## Done when
On each phone: the main destinations are one thumb tap away, nothing needs hover to open, every sheet closes with Back on Android and with a visible button on iOS, and the desktop navigation is unchanged. `tapTargets.small` in the nav should be 0. Checkpoint "Navigation".
