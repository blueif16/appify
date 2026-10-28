# iOS Safari vs Android Chrome

Current as of late 2026: iOS 26 / Safari 26–27, Chrome ~150. **[iOS]** = Safari and iOS Home Screen web apps, **[And]** = Chrome for Android, untagged = both.

## Contents
1. Recent changes that matter
2. Viewport and safe areas
3. Viewport units
4. Standalone (Home Screen) mode and color
5. Install
6. Keyboard and inputs
7. Touch and hover
8. Scrolling and pull-to-refresh
9. Back navigation
10. Sharing, haptics, push, camera

## 1. Recent changes that matter
- **[iOS 26] Every site added to the Home Screen opens as a web app** by default, no manifest needed. Any site can end up standalone: no back button, no reload, storage separate from Safari. Handle standalone even if the site never asked for it.
- **[iOS 26] `theme-color` is ignored in Safari tabs**; only installed apps use it. The tab toolbar tint comes from the `html`/`body` background or a solid fixed/sticky bar touching the top or bottom edge.
- **[And, Chrome 135] Edge-to-edge**: with `viewport-fit=cover` the page draws under the gesture bar; `env(safe-area-inset-bottom)` becomes dynamic and `env(safe-area-max-inset-bottom)` holds its maximum. Installed Android apps still don't draw under the status bar.
- **Install no longer needs a service worker** (Chrome 108 menu install; iOS never did). Chrome's automatic prompt still wants a real fetch handler. Lighthouse's PWA audit is gone; don't use it.
- **[And, Chrome 120/126] Back closes a modal `<dialog>`, a `popover` or a `CloseWatcher`** before navigating.
- **[iOS, Safari 26.2] Navigation API** (`navigation.canGoBack`) is available.

## 2. Viewport and safe areas
- Write `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Never `user-scalable=no` or `maximum-scale` below 2 (fails WCAG 1.4.4); fix input zoom with 16px fonts instead.
- With `cover` you own the edges. Pad with `max(env(safe-area-inset-*), <floor>)`, because a bare `env()` is 0 in most browser-tab contexts.

| Context | Non-zero insets |
|---|---|
| [iOS] Safari tab | Left/right in landscape on notch and Dynamic Island phones; bottom varies with the toolbar; top usually 0 in portrait |
| [iOS] Home Screen app | Top = status bar when drawing under it (`black-translucent`); bottom ≈34 on Face ID phones; sides in landscape |
| [And] Chrome tab | Bottom, dynamic as the toolbar retracts |
| [And] Installed app | Usually 0 |

- Never hard-code 20/44/47/59px bar heights; read insets from CSS. On iOS the bottom inset stays while the keyboard is open.
- Android fixed bottom bar, fast path: `--max: env(safe-area-max-inset-bottom, 36px); bottom: calc(env(safe-area-inset-bottom, 0px) - var(--max)); padding-bottom: var(--max);`.

## 3. Viewport units
- `100vh` is the *large* viewport: taller than what's visible while the toolbars show, so bottom content hides. Use `100dvh` (after a `100vh` fallback) for an app shell, `100svh` for blocks that must be fully visible.
- The keyboard does not change `vh`/`dvh` on either platform.
- [iOS 26] For drawers prefer `position: fixed; inset: 0` over `height: 100lvh`.

## 4. Standalone (Home Screen) mode and color

| | iOS 26 | Android Chrome |
|---|---|---|
| Entry | Share → Add to Home Screen ("Open as Web App" on by default) | Menu install or your install button |
| `display` | `standalone` or `browser` only | all, plus `display_override` |
| Detect | `matchMedia('(display-mode: standalone)')` or `navigator.standalone` | `matchMedia('(display-mode: standalone)')` |
| Status bar | `apple-mobile-web-app-status-bar-style`: `default`, `black`, `black-translucent` (draws under the bar, so pad the top inset) | From `theme_color` / `theme-color` |
| Icon and name | `apple-touch-icon` 180×180 opaque PNG wins over manifest icons; `apple-mobile-web-app-title` | Manifest `icons`, `short_name` |

- Write explicit `html` and `body` `background-color`, solid backgrounds on fixed headers and tab bars (Safari tints from them), and `<meta name="theme-color" media="(prefers-color-scheme: light|dark)">` for installed apps.
- Detect standalone in an inline `<head>` script and set a class, so browser-only UI (install hints) doesn't flash.
- [iOS] Home Screen apps don't share cookies or storage with Safari: users sign in again there. Links outside `scope` open in an in-app browser sheet.

## 5. Install
- [And] Criteria: HTTPS; manifest with `name`/`short_name`, 192 and 512 PNG icons, `start_url`, non-browser `display`. Flow: catch `beforeinstallprompt`, `preventDefault()`, show your own Install button after a meaningful action, call `event.prompt()`; hide on `appinstalled` or when standalone. Add `description` and `screenshots` (`form_factor: "narrow"`) for the richer install sheet.
- [iOS] No `beforeinstallprompt`. Show a dismissible hint only in iOS Safari, only when not standalone, remembered once dismissed: **Share → Add to Home Screen → keep "Open as Web App" on → Add**.
- Never add a no-op fetch handler to a service worker (Chrome skips it and warns).

## 6. Keyboard and inputs
- Both platforms resize only the *visual* viewport when the keyboard opens. `position: fixed; bottom: 0` bars end up behind it. To keep a composer or button above it, follow `visualViewport` `resize`/`scroll` and set `bottom = innerHeight - (visualViewport.height + visualViewport.offsetTop)`.
- [And] only: `interactive-widget=resizes-content` in the viewport tag shrinks the layout instead (simplest for chat), or the VirtualKeyboard API with `env(keyboard-inset-height)`. [iOS] has neither.
- [iOS] Fields with text under 16px zoom the page on focus: `input, select, textarea { font-size: max(16px, 1rem); }`.
- Right keyboard: `type="email|tel|url|search"`; digits that aren't amounts: `inputmode="numeric" pattern="[0-9]*"`; money: `inputmode="decimal"`. Return key: `enterkeyhint="go|search|send|next|done"`. Autofill: `autocomplete` plus a meaningful `name`; `one-time-code` for SMS codes. `autocapitalize="none" autocorrect="off" spellcheck="false"` on emails, usernames, codes. Wrap fields in a `<form>` so Go submits.
- Don't `autofocus` on phones: the keyboard covers half the screen on load.

## 7. Touch and hover
- Targets ≥44×44pt (Apple) / 48×48dp with 8dp spacing (Material); hard floor 24×24 CSS px (WCAG 2.5.8). Grow the hit area with padding, not the icon.
- `touch-action: manipulation` on controls. `-webkit-tap-highlight-color: transparent` only if you add your own `:active` style.
- Hover effects go in `@media (hover: hover) and (pointer: fine)`. Never hide actions or menus behind `:hover`; on iOS a hover that reveals content turns the first tap into a hover and needs a second tap.
- `user-select: none` only on UI chrome (tab bars, buttons), never on content or inputs.

## 8. Scrolling and pull-to-refresh
- `overscroll-behavior: contain` on sheets, drawers and modal scrollers.
- Pull-to-refresh: built in on Android and in iOS Safari tabs, **absent in iOS Home Screen apps**. In standalone, give a visible refresh control (or your own pull-to-refresh, and only then `overscroll-behavior-y: contain` on the page).

## 9. Back navigation
- [And] The back gesture walks history, then leaves the app, but first closes a modal `<dialog>`, `popover` or `CloseWatcher`. Build sheets and menus that way, or push a history entry on open and close on `popstate`. Don't spam history.
- [iOS] Home Screen apps have no back button. Show a visible in-app back button on non-root screens in standalone mode; use `navigation.canGoBack` with a fallback to home for cold-launched deep links.
- Keep every screen at a meaningful URL so reloads, deep links and shares land in the same place.

## 10. Sharing, haptics, push, camera
- Send: `navigator.share({title, text, url})` from a tap, with a copy-link fallback that confirms it copied. Receive: manifest `share_target`, [And] installed apps only; not on iOS.
- Link previews: crawlers don't run JavaScript. Tags must be in the server-rendered `<head>` with absolute https image URLs. One 1200×630 JPEG under ~300 KB works everywhere (WhatsApp: head within the first 300 KB of HTML, image < 600 KB; iMessage: image ≥ 900px wide, no meta-refresh). See `modules/shareable.md`.
- Haptics: [And] `navigator.vibrate(10)` from a tap; [iOS] no Vibration API. Never carry meaning with haptics alone.
- Push: [iOS] only in Home Screen apps, permission only from a tap; on iOS in Safari show "Add to Home Screen to get notifications". [And] works in tabs, needs a service worker.
- Camera and photos: `<input type="file" accept="image/*">` opens camera, library and files; `capture="environment"` goes straight to the camera; `multiple` for galleries; expect HEIC from iPhones.
- View Transitions: same-document `document.startViewTransition()` (Chrome 111, Safari 18); multi-page `@view-transition { navigation: auto; }` (Chrome 126, Safari 18.2). Keep under ~300 ms; off under `prefers-reduced-motion`.
