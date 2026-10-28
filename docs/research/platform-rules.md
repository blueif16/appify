# Platform rules: iOS Safari and Android Chrome

Rules an agent must follow to make an existing web app feel native at the same URL. Each rule says what to write and why. **[iOS]** means Safari or iOS Home Screen web apps; **[And]** means Chrome for Android; untagged means both. Checked 2026-10-27. Current versions are iOS 26.x / Safari 26.x (Safari 27 shipped Sep 2026) and Chrome ~150. Browser support numbers come from [MDN browser-compat-data](https://github.com/mdn/browser-compat-data) unless noted otherwise.

## What changed in 2025–2026

| When | Change | Source |
|---|---|---|
| Chrome 135 (Apr 2025) | Chrome for Android draws edge-to-edge into the gesture bar. `viewport-fit=cover` opts in. A new `env(safe-area-max-inset-bottom)`. | [Chrome](https://developer.chrome.com/docs/css-ui/edge-to-edge) |
| iOS 18.4 (Mar 2025) | Declarative Web Push and Screen Wake Lock in Home Screen apps. | [WebKit 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) |
| iOS 26 (Sep 2025) | **Every site added to the Home Screen opens as a web app by default**, with no manifest required: "zero requirements for installability". | [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) |
| Safari 26 | `theme-color` is used **only for installed web apps**. The tab toolbar tint comes from the page (body/html background or fixed/sticky elements at an edge). | [BCD PR](https://github.com/mdn/browser-compat-data/pull/28503), [WebKit bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756) |
| Safari 26.0 → 26.1 | Liquid Glass floating toolbar. 26.0 had `position: fixed` bottom-gap and jump bugs, fixed in 26.1. The iOS UA string is frozen at 18_6. | [WebKit 26.1](https://webkit.org/blog/17541/webkit-features-in-safari-26-1/), [bug 297779](https://bugs.webkit.org/show_bug.cgi?id=297779) |
| Safari 26.2 (Dec 2025) | Navigation API (`navigation.canGoBack`). | BCD `api.Navigation` |
| Chrome 146 (2026) | `<meta name="text-scale" content="scale">`: root font size follows the OS text size. | [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/text-scale) |
| 2026, in progress | Installed Android PWAs still **don't** draw under the status bar. A fix (`WebAppShortEdgesCutoutMode`) is landing. | [crbug 407420295](https://issues.chromium.org/issues/407420295), [report](https://tech-ish.com/2026/07/15/google-chrome-for-android-pwa-edge-to-edge/) |
| Safari 27 (Sep 2026) | Safari MCP for agents, scroll anchoring, service-worker static routing. Nothing specific to web apps. | [WebKit 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) |

## 1. Viewport

- **Write:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
  - `width=device-width` also removes the 300 ms tap delay ([WebKit](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/), [Chrome](https://developer.chrome.com/blog/300ms-tap-delay-gone-away)).
  - `viewport-fit=cover` is required for non-zero `env(safe-area-inset-*)` [iOS] and for edge-to-edge [And] ([WebKit iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [Chrome](https://developer.chrome.com/docs/css-ui/edge-to-edge)).
- **Never write** `user-scalable=no` or `maximum-scale` < 2. It fails WCAG 1.4.4 ([axe meta-viewport](https://dequeuniversity.com/rules/axe/4.10/meta-viewport)). Fix input zoom with 16px fonts instead (§10).
- Once you add `cover`, you own the edges: you must pad with insets (§2).

## 2. Safe-area insets

| Context | When the insets are non-zero (needs `cover`) |
|---|---|
| [iOS] Safari tab | Left and right in landscape on notch/Dynamic Island phones. Bottom changes as the toolbar collapses or expands. Top is usually 0 in portrait. *Observed, not documented by Apple.* ([breakpane](https://breakpane.com/en/guides/safe-area-inset-not-working)) |
| [iOS] Home Screen app | Top = status bar height when content draws under it (`black-translucent`). Bottom = home indicator (~34pt on Face ID phones). Left and right in landscape. |
| [And] Chrome tab, 135+ | Bottom is dynamic: the inset grows as "the chin" retracts. `safe-area-max-inset-bottom` holds the maximum. Small-screen devices only. |
| [And] Installed PWA | Typically 0 at the top today, because the app isn't edge-to-edge under the status bar (see the table above). |

**Write:**
- `padding-top: max(env(safe-area-inset-top), 12px)` and the same for the other edges. Apply it once in the app shell (header, tab bar), never per component. A bare `env()` is 0 in a tab, so always give a floor ([geniar](https://github.com/mattiasgeniar/offline-first-pwa)).
- For a fixed bottom bar [And], use Chrome's fast-path pattern:
  - `--max: env(safe-area-max-inset-bottom, 36px)`
  - `bottom: calc(env(safe-area-inset-bottom, 0px) - var(--max))`
  - `padding-bottom: var(--max)`

  This avoids layout thrash ([Chrome](https://developer.chrome.com/docs/css-ui/edge-to-edge)).
- Never hard-code 20/44/47/59px bar heights. Insets change with rotation and the keyboard, so read them from CSS. On iOS the bottom inset stays while the keyboard is open ([Capgo](https://github.com/Cap-go/capgo-skills/tree/main/skills/safe-area-handling)).

## 3. Viewport units

- `100vh` equals the **large** viewport (`lvh`) in Safari 15.4+ and Chrome 108+. It is taller than the visible area while the toolbars show, so bottom content is hidden ([web.dev](https://web.dev/blog/viewport-units)).
- **Write:**
  - app shell: `height: 100dvh` (with `100vh` before it as a fallback)
  - must-be-fully-visible blocks: `min-height: 100svh`
  - backgrounds: `lvh`

  Support: dvh, svh and lvh are in Safari 15.4 and Chrome 108.
- The keyboard does **not** change `vh`/`dvh` by default on either platform (§9).
- [iOS 26] Prefer inset anchoring (`position: fixed; inset: 0`) over `height: 100lvh` for drawers. 26.0 clipped fixed content past the layout viewport ([example fix](https://github.com/openreplay/documentation/commit/c90b52b01d5748bc8492830e957fb3b010def29d)).
- App-shell pattern: the page never scrolls. Make `body` a `100dvh` flex column and let one `flex:1; min-height:0; overflow-y:auto` pane scroll ([geniar](https://github.com/mattiasgeniar/offline-first-pwa)).

## 4. Standalone (Home Screen) mode

| | iOS 26 | Android Chrome |
|---|---|---|
| Entry | Any site, added from Share → Add to Home Screen. "Open as Web App" is on by default ([Apple](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)). | Install from the menu or a prompt (§5). |
| `display` values | `standalone` and `browser` only (`fullscreen` and `minimal-ui` aren't supported). | `fullscreen`, `standalone`, `minimal-ui`, `browser`, plus `display_override`. |
| Detect | `matchMedia('(display-mode: standalone)')` or `navigator.standalone`. | `matchMedia('(display-mode: standalone)')` |
| Status bar | `<meta name="apple-mobile-web-app-status-bar-style">`: `default`, `black` or `black-translucent`. Only applies in standalone. `black-translucent` draws under the bar, so pad the top inset ([Apple ref](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)). | Colored from the manifest `theme_color` or the `theme-color` meta. Not edge-to-edge yet. |
| Tint/color | `theme-color` is used only when installed. In tabs, Safari 26 samples `body`/`html` `background-color`, or a fixed/sticky element touching the top or bottom edge (≥~80% wide on iOS: *observed* by [andesco](https://github.com/andesco/safari-color-tinting)). | `theme-color` colors the toolbar. It is ignored in system dark mode unless installed (BCD note). |
| Name/icon | `apple-touch-icon` (180×180, opaque) **takes precedence** over manifest icons. `apple-mobile-web-app-title` sets the name. | Manifest `icons` and `short_name`. |

**Write:**
- `<meta name="theme-color" media="(prefers-color-scheme: light|dark)">`, one per scheme.
- Explicit `html` and `body` `background-color`.
- Solid backgrounds on fixed headers and tab bars, so Safari 26 tints correctly. Avoid fixed full-screen overlays as tint sources ([WebKit bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756)).
- Detect standalone in an inline `<head>` script so browser-only chrome doesn't flash.
- `apple-mobile-web-app-capable` is unnecessary on iOS 26+. It is harmless for older iOS.
- [iOS] Home Screen apps don't share cookies or storage with Safari, so users must sign in again ([jg-pwa](https://jg-skills.jesusgraterol.dev/skills/jg-pwa/)). Links outside `scope` open in an in-app browser sheet.

## 5. Install UX

- **[And] Install criteria:** HTTPS; a manifest with `name`/`short_name`, 192 and 512 icons, `start_url`, a non-browser `display`, and `prefer_related_applications` not `true`. Engagement: one tap and 30 s on the page ([web.dev](https://web.dev/articles/install-criteria)).
  - A service worker is **not** needed for menu install (Chrome 108 Android).
  - The automatic prompt heuristic still looks for a fetch handler ([Chrome, 2023](https://developer.chrome.com/blog/update-install-criteria)).
  - Never add a no-op fetch handler: Chrome 112+ skips it and warns ([Chrome 112](https://developer.chrome.com/blog/new-in-chrome-112)).
- **[And] Write the prompt flow:**
  - On `beforeinstallprompt`, call `preventDefault()` and stash the event. Show your own Install button after a meaningful action, then call `event.prompt()`.
  - On `appinstalled`, hide the button. Also hide it when `display-mode: standalone` matches.
- **[And] Richer install sheet:** add `description` and ≥1 `screenshots` entry with `form_factor: "narrow"` (or untagged), plus a `label` ([Chrome](https://developer.chrome.com/blog/richer-pwa-installation)).
  - Each side 320–3840px; long side ≤2.3× the short side; one aspect ratio per form factor; PNG or JPEG.
  - Mobile shows at most 5, desktop needs `wide` ([DevTools source via openpwa](https://openpwa.net/reference/manifest/screenshots.md)).
- **[iOS]** There is no `beforeinstallprompt` (BCD). Show a dismissible hint only in iOS Safari and only when not standalone. Remember the dismissal. Spell out the path: **••• → Share → Add to Home Screen → keep "Open as Web App" on → Add**. In the Bottom or Top tab layouts, Share sits on the toolbar ([Apple](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)). Third-party iOS browsers can add to the Home Screen too (iOS 16.4+).

## 6. Manifest fields that matter

Link `<link rel="manifest" href="/manifest.webmanifest">` on every page. Serve it as `application/manifest+json` with `Cache-Control: no-cache` ([jg-pwa](https://jg-skills.jesusgraterol.dev/skills/jg-pwa/)).

| Field | Write | iOS | Android |
|---|---|---|---|
| `id` | An explicit stable string, e.g. `"/"`. Never change it: a new `id` means a new app ([Chrome](https://developer.chrome.com/docs/capabilities/pwa-manifest-id)). | 16.4+ | 96+ |
| `start_url` | Inside `scope`. Must return 200 with no cross-origin redirect. | yes | yes |
| `scope` | `"/"` (covers `start_url`). | yes | yes |
| `display` | `"standalone"` | standalone/browser | all |
| `icons` | 192 and 512 PNG `purpose:"any"`, plus a **separate** 512 `purpose:"maskable"` with the key art inside a circle of radius 40% of the width ([web.dev](https://web.dev/articles/maskable-icon)). Never `"any maskable"`. | only used when there is no `apple-touch-icon` | required |
| `name` / `short_name` | A short `short_name` for the launcher. | Home Screen name (the user can edit it) | yes |
| `theme_color` / `background_color` | Brand color / splash background. | `background_color` is not supported | splash + status bar |
| `shortcuts` | ≤4 deep links shown on long-press. | **no** | 84+ |
| `share_target` | Receive shares (§15). | **no** | 76+, installed only |
| `screenshots`, `description` | Richer install sheet (§5). | ignored | yes |
| `orientation` | Omit unless the app truly needs one. | ignored | yes |

## 7. Service worker basics

- Optional for install on both platforms. Required for offline use, for push (except Declarative Web Push on iOS), and for Chrome's automatic install prompt ([WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [Chrome](https://developer.chrome.com/blog/update-install-criteria)).
- **Write:**
  - Register `/sw.js` at the root after `load`. Serve it with `Cache-Control: no-cache` and never rename it per release.
  - Precache hashed build assets, the app shell and an offline page.
  - Handle only same-origin `GET`. Never cache authenticated or `no-store` responses.
  - Show an "Update available → Reload" prompt instead of an unconditional `skipWaiting()` ([web.dev](https://web.dev/learn/pwa/service-workers), [jg-pwa](https://jg-skills.jesusgraterol.dev/skills/jg-pwa/)).
- Test on a slow network, not only offline. DevTools throttling does not apply to fetches made inside the service worker ([geniar](https://github.com/mattiasgeniar/offline-first-pwa)).
- [iOS] Under tracking prevention, script-writable storage is deleted after 7 days of Safari use without visiting the site. Home Screen apps keep their own counter. Call `navigator.storage.persist()` ([jg-pwa](https://jg-skills.jesusgraterol.dev/skills/jg-pwa/)).

## 8. Push and badging

- **[iOS]** Web Push works **only in Home Screen web apps** (16.4+). Request permission only from a user tap, e.g. a "Turn on notifications" button ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Declarative Web Push (18.4+) adds `window.pushManager.subscribe()` and a JSON payload (`"web_push": 8030`) that displays without a service worker ([WebKit](https://webkit.org/blog/16535/meet-declarative-web-push/)). The badge (`navigator.setAppBadge`) also works only in Home Screen apps.
- **[And]** Push works in tabs and installed apps. It needs a service worker. Ask after a user action. `setAppBadge` is not supported on Android.
- **Write:** feature-detect `PushManager`. On iOS when not standalone, show "Add to Home Screen to get notifications" instead of a broken button.

## 9. On-screen keyboard

- Both browsers resize only the **visual** viewport by default (Chrome since 108). The layout viewport, `vh` and `dvh` stay the same, so `position: fixed; bottom: 0` bars can end up behind the keyboard ([Chrome](https://developer.chrome.com/blog/viewport-resize-behavior)).
- **Write (both):** to keep a composer or primary button above the keyboard, listen to `visualViewport` `resize` and `scroll`. Set `bottom = innerHeight − (visualViewport.height + visualViewport.offsetTop)`, plus `max()` with the bottom inset. `visualViewport` is in Safari 13 and Chrome 61.
- **[And] only:**
  - `interactive-widget=resizes-content` in the viewport meta shrinks the layout viewport, which is the simplest choice for chat UIs.
  - Alternatively, use `overlays-content` with the VirtualKeyboard API: `navigator.virtualKeyboard.overlaysContent = true` and `env(keyboard-inset-height)` (Chrome 94+; not in Safari) ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API)).
- **[iOS]** No `interactive-widget` and no VirtualKeyboard API. iOS 26.0 had fixed-element and keyboard jump bugs, fixed in 26.1 ([bug 297779](https://bugs.webkit.org/show_bug.cgi?id=297779)). Don't `autofocus` inputs on mobile, because the keyboard covers half the screen on load ([Vercel](https://github.com/vercel-labs/web-interface-guidelines/blob/main/AGENTS.md)).

## 10. Inputs

| Need | Write |
|---|---|
| Right keyboard | `type="email|tel|url|search"`. For digits that aren't quantities (OTP, card numbers): `type="text" inputmode="numeric" pattern="[0-9]*"`. Money: `inputmode="decimal"`. |
| Return key label | `enterkeyhint="go|search|send|next|done"` (Safari 13.1, Chrome 77). |
| Autofill | `autocomplete="email|tel|name|street-address|postal-code|cc-number|current-password|new-password|one-time-code"`, plus a meaningful `name` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)). `one-time-code` enables SMS code autofill ([web.dev](https://web.dev/articles/sms-otp-form)). |
| No "smart" mangling | `autocapitalize="none" autocorrect="off" spellcheck="false"` on usernames, codes and emails. |
| **[iOS] No zoom on focus** | `input, select, textarea { font-size: max(16px, 1rem) }`. iOS zooms into fields under 16px ([CSS-Tricks](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)). This is observed behavior; Apple doesn't document it. Chrome Android doesn't zoom. |
| Submit | Wrap fields in `<form>` so the Go or Enter key submits. Keep visible `<label>`s. |

## 11. Touch, tap and hover

- **Target size:** ≥44×44pt ([HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)) and ≥48×48dp with ≥8dp spacing ([Material 3](https://m3.material.io/foundations/designing/structure)). The hard floor is 24×24 CSS px or equivalent spacing ([WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Grow the hit area with padding or `::after`, not the icon.
- `touch-action: manipulation` on controls removes double-tap-to-zoom while keeping pinch zoom.
- `-webkit-tap-highlight-color: transparent` **only** if you add your own `:active` or pressed style. HIG: "Always include a press state."
- **Hover:** put hover effects in `@media (hover: hover) and (pointer: fine)` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover)). Never hide actions or menus behind `:hover`. [iOS] If hover changes visible content, the first tap only triggers hover and a second tap is needed to click ([Apple archive](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html)).
- Use `user-select: none` and `-webkit-touch-callout: none` only on UI chrome (tab bars, buttons, canvases), never on content or inputs ([geniar](https://github.com/mattiasgeniar/offline-first-pwa)).

## 12. Scrolling, overscroll and pull-to-refresh

- Put `overscroll-behavior: contain` on sheet, drawer and modal scrollers to stop scroll chaining (Safari 16+, Chrome 63+; since Chrome 144 it also works on non-overflowing containers).
- **Pull-to-refresh:**
  - [And] Built in, in tabs and installed apps.
  - [iOS] Built in, in Safari tabs. **None in Home Screen apps** (not documented by Apple; see [progressivewebapps.com](https://progressivewebapps.com/design/app-like-ux/)).
  - **Write:** a visible refresh control or a custom pull-to-refresh in standalone mode. Only if you do, set `overscroll-behavior-y: contain` on `html`/`body` to suppress the browser's version ([Chrome](https://developer.chrome.com/blog/overscroll-behavior)).
- For modal scroll lock, prefer `<dialog>.showModal()` (inert background) plus `overscroll-behavior: contain`.

## 13. Back navigation

- **[And]** The system back gesture walks history and then leaves the app.
  - In Chrome 120+ (re-enabled in 126), back is also a **close request**: it closes a modal `<dialog>`, a `popover`, or a `CloseWatcher` before navigating ([Chrome 120](https://developer.chrome.com/blog/new-in-chrome-120), [Chrome 126](https://developer.chrome.com/release-notes/126)).
  - **Write:** build sheets and menus as `<dialog>` or `popover`, or wrap custom sheets in `new CloseWatcher()` with a fallback that pushes a history entry on open and closes on `popstate`.
  - Close requests only block back after user activation, which prevents back-trapping, so never spam history.
- **[iOS] standalone:** there is no back button and no system back. Edge-swipe back has been observed since 12.2 ([Firtman](https://www.progressiveweb.app/ios-12.2/)) but is undocumented and undiscoverable.
  - **Write:** a visible in-app back button on every non-root screen, shown only in standalone mode.
  - Use `navigation.canGoBack` (Chrome 102, Safari 26.2) with a fallback to a home URL for cold-launch deep links ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)).
- Keep the URL meaningful for every screen, so deep links, reloads and shares land in the same place.

## 14. View Transitions

- Same-document: `document.startViewTransition(update)` (Chrome 111, Safari 18).
- Cross-document (MPA): `@view-transition { navigation: auto; }` (Chrome 126, Safari 18.2) ([Chrome](https://developer.chrome.com/docs/web-platform/view-transitions)).
- Feature-detect it, keep transitions under ~300 ms, and turn them off under `prefers-reduced-motion`.

## 15. Web Share and share_target

- **Send:** call `navigator.share({title, text, url})` from a tap handler on HTTPS. Use `navigator.canShare({files})` before sharing files ([web.dev](https://web.dev/articles/web-share)). Support: iOS Safari 12.1 (files 14), Chrome Android 61 (files 75). Always have a fallback, such as copying the link with feedback that reflects whether the copy actually worked, because some desktop browsers lack `share`. Desktop Chrome supported it only on Windows and ChromeOS before v128.
- **Receive:** the manifest `share_target` with `action`, `method` (`POST` with `enctype` `multipart/form-data` for files) and `params` ([Chrome](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)). [And] only, installed apps only. [iOS] is not supported.

## 16. Vibration and haptics

- **[And]** `navigator.vibrate(10)` for a light tick or `[20,40,20]` for a pattern. It requires a user gesture (Chrome 60+). Respect reduced-motion and settings.
- **[iOS]** No Vibration API. The only native haptic is toggling `<input type="checkbox" switch>` (iOS 18+) ([WebKit 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)). Since 2025 it requires a real user gesture ([WebKit PR](https://github.com/WebKit/WebKit/pull/38473)). Overlay-switch libraries exist ([ios-haptics](https://github.com/tijnjh/ios-haptics)), but treat them as a fragile enhancement, never as feedback that carries meaning.

## 17. Files and camera

- `<input type="file" accept="image/*">` opens the system chooser (camera, library, files). This is usually the best default.
- `capture="environment"` (rear camera) or `capture="user"` (front) skips the chooser. Supported on iOS 10+ and Chrome Android 25+; desktop ignores it ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)).
- Add `multiple` for galleries. Expect HEIC from iPhone, or let iOS convert by accepting `image/jpeg`. *Conversion behavior is unverified.*

## 18. Link previews (Open Graph and cards)

Crawlers don't run JavaScript. **Tags must be in the server-rendered `<head>`** at the shared URL itself, and the image needs an absolute `https://` URL.

**Write:**
```html
<meta property="og:title" content="Page name, no brand suffix">
<meta property="og:description" content="≤ ~80 chars">
<meta property="og:url" content="https://example.com/canonical">
<meta property="og:site_name" content="Brand">
<meta property="og:image" content="https://example.com/og/page.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="...">
<meta name="twitter:card" content="summary_large_image">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

One 1200×630 JPEG under ~300–600 KB satisfies every platform below.

| Crawler | Needs | Limits |
|---|---|---|
| iMessage ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)) | `og:title` (no site name; use `og:site_name`), `og:image`, an icon. `og:video` autoplays muted. | Image ≥900px wide (<150px may render as an icon). Icon square ≥108px. HTML ≤1 MB, assets ≤10 MB in total. No JS, no meta-refresh redirects (server redirects are fine). Avoid text in the image. Auth pages should still return real metadata. |
| WhatsApp ([Meta](https://developers.facebook.com/docs/whatsapp/link-previews/)) | Non-empty `og:title`, `og:description`, `og:url` inside `<head>`, plus `og:image`. | `<head>` within the **first 300 KB** of HTML. Image **<600 KB**, ≥300px wide, aspect ≤4:1. UA `WhatsApp/2.x.x.x A\|I\|N`. Sends `Accept-Language`. |
| Facebook / Messenger ([Meta](https://developers.facebook.com/docs/sharing/webmasters/images/)) | OG tags. | ≥1200×630 best, ≥600×315 for a large card, min 200×200, ≤8 MB. Width and height tags let the first share render. |
| X ([docs, quoted via mirrors](https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image)) | `twitter:card=summary_large_image`. Falls back to `og:*`. | 2:1, ≥300×157, ≤4096², <5 MB. JPG, PNG, WEBP or GIF; no SVG. |
| Slack ([robots](https://api.slack.com/robots)) | oEmbed, Twitter Card or OG. | UA `Slackbot-LinkExpanding 1.0`. Uses Range requests, so put tags early. Caches ~30 min. Ignores robots.txt. |

Don't block these user agents at the WAF or behind a login.

## 19. Text size (new)

- [And] `<meta name="text-scale" content="scale">` (Chrome 146) makes the root `font-size` follow the OS text-size setting. If you use it, size text in `rem`/`em`, don't set the root to `16px`, and test up to 200–300% ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/text-scale)). Don't combine it with `env(preferred-text-scale)`. Safari doesn't support it.
- Body text ≥16px; nothing below 11pt ([Apple tips](https://developer.apple.com/design/tips/)). Lighthouse fails a page when ≥40% of its text is under 12px ([Lighthouse](https://developer.chrome.com/docs/lighthouse/seo/font-size)).

## Could not verify / in flux

- Exact iOS safe-area values per context and toolbar state (Apple publishes none).
- The Safari 26 tint thresholds (4px from the edge, ≥80% width) come from community testing, not WebKit docs.
- Whether iOS Home Screen apps support edge-swipe back on iOS 26, and whether pull-to-refresh is truly absent. Apple documents neither.
- The claim that iOS 26.5 further restricted switch-haptic tricks (secondary source: [haptics playground](https://sergey-grishchev.github.io/haptics-playground/)).
- When the Android installed-PWA edge-to-edge fix ships to Stable.
- X card limits: developer.x.com returned 402. The figures are quoted from mirrors of the official page.
