# Candidate automated checks

These are checks a tool can run in a headless browser or by fetching HTML. Platform rules and their sources are in [platform-rules.md](platform-rules.md). Checked 2026-10-27.

## Run profiles

| Profile | Setup | Reproduces | Does **not** reproduce |
|---|---|---|---|
| **iOS-ish** | Playwright WebKit, `devices['iPhone 15']` (`isMobile`, `hasTouch`, DPR 3). Plus 320×568 and landscape. | WebKit layout and CSS support, the meta viewport ([`isMobile` honors it; not supported in Firefox](https://playwright.dev/docs/api/class-browser)), touch events. | Safari toolbars (dvh = svh = lvh), safe-area insets (always 0), the keyboard, zoom on focus for <16px inputs, Home Screen mode, Safari 26 tinting, the share sheet, haptics, push. It is WebKit on Linux, not iOS Safari. |
| **Android-ish** | Playwright Chromium, `devices['Pixel 7']`, plus raw CDP. | Mobile meta viewport and touch. Insets via `Emulation.setSafeAreaInsetsOverride` (experimental, 2025; [CDP](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl)). Manifest via `Page.getAppManifest` and `Page.getInstallabilityErrors` ([CDP Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getInstallabilityErrors)). `:active` via `CSS.forcePseudoState`. `Esc` is a close request, the same path as Android back ([Chrome 120](https://developer.chrome.com/blog/new-in-chrome-120)). | The chin and toolbar, the real keyboard. `setVirtualKeyboardGeometryOverride` only feeds the VirtualKeyboard API, not the viewport. Installed mode: Playwright can't emulate `display-mode` ([issue](https://github.com/microsoft/playwright/issues/26853)), and I could not verify CDP support. A fallback is an init script that patches `matchMedia` and `navigator.standalone`, but it only affects JS detection, not CSS. CDP is "not a supported API" for third parties ([CDP](https://chromedevtools.github.io/devtools-protocol/)). |
| **Fetch** | Plain HTTP GET, no JS, with crawler user agents. | What link-preview crawlers see. | Rendering. |
| **Device** (escalation) | [Mobile MCP](https://github.com/mobile-next/mobile-mcp) on the iOS Simulator or an Android emulator (`mobile_open_url`, tap, type, BACK). [Safari MCP](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) on Mac Safari 27. | Real keyboards, toolbars, Add to Home Screen, the back gesture. | Slow and not headless. Use it to confirm, not as the first pass. |

**Severity:**
- **Blocker:** content or controls are unreachable, or the app can't be used, installed or previewed.
- **Major:** fails WCAG AA or a platform rule, or clearly feels non-native.
- **Minor:** polish.

**Mode:**
- **S:** render and measure, no interaction.
- **I:** needs taps, focus or keys.
- **F:** fetch only.
- **E:** needs a CDP emulation hook.

## Fits the screen

| # | Check | Measure | Threshold (source) | Sev | Plat | Mode |
|---|---|---|---|---|---|---|
| A1 | Viewport meta | `meta[name=viewport]` has `width=device-width` and `initial-scale=1`. | Required ([Lighthouse viewport](https://developer.chrome.com/docs/lighthouse/best-practices/viewport), platform-rules §1) | blocker | both | F |
| A2 | Zoom not disabled | No `user-scalable=no`; `maximum-scale` ≥ 2. | WCAG 1.4.4 ([axe meta-viewport](https://dequeuniversity.com/rules/axe/4.10/meta-viewport)) | major | both | F |
| A3 | `viewport-fit=cover` | Present when the app has fixed top or bottom chrome. | Needed for insets and edge-to-edge ([Chrome](https://developer.chrome.com/docs/css-ui/edge-to-edge)) | minor | both | F |
| A4 | No horizontal scroll | `scrollWidth > clientWidth + 1` at 320, 360, 375, 390, 412 and 430 portrait, plus 844×390 landscape. List elements with `rect.left < 0` or `rect.right > vw`. | Reflow at 320 CSS px ([WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)) | blocker | both | S |
| A5 | Safe-area collision | Inject insets (portrait top 59 / bottom 34; landscape left and right 59, bottom 21 — *approximate iPhone values*). Flag any visible interactive element inside an inset band, and any fixed bar whose padding doesn't change when insets change. | Content must clear the insets ([WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)) | blocker (control in band), major (padding not inset-aware) | both | E |
| A6 | Content hidden under fixed bars | Scroll to the end. Run `elementFromPoint` at the center of the last and first interactive elements; it must return that element, not a fixed or sticky bar. | Reachability | major | both | I |
| A7 | `100vh` shells | CSSOM scan for `100vh` or `h-screen` on elements as tall as the viewport, without a `dvh`/`svh` fallback. Major if they hold bottom-anchored controls. | `vh` = `lvh`, so it overflows behind the toolbar ([web.dev](https://web.dev/blog/viewport-units)) | minor / major | both | S |
| A8 | Legible text | Share of text characters with computed `font-size` < 12px. | Fail at ≥40% ([Lighthouse font-size](https://developer.chrome.com/docs/lighthouse/seo/font-size)). Any body text < 11px is minor ([Apple tips](https://developer.apple.com/design/tips/)). | major | both | S |
| A9 | Root background and theme | `html`/`body` `background-color` is not transparent. `meta[name=theme-color]` exists, one per color scheme if the app has dark mode. | Safari 26 tints from the page; Chrome uses `theme-color` (platform-rules §4) | minor | iOS / And | S |

## Touch

| # | Check | Measure | Threshold (source) | Sev | Plat | Mode |
|---|---|---|---|---|---|---|
| B1 | Target size, floor | For every visible enabled `a[href]`, `button`, `input`, `select`, `[role=button]`, `summary` and clickable `label`: width and height ≥ 24, or the 24px spacing circle. Excludes inline text links. axe-core `target-size` does this. | 24×24 CSS px ([WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [axe](https://dequeuniversity.com/rules/axe/4.10/target-size)) | major | both | S |
| B2 | Target size, platform | Same set, ≥44×44 (iOS profile) or ≥48×48 (Android profile). | 44pt ([HIG](https://developer.apple.com/design/human-interface-guidelines/buttons)), 48dp ([Material](https://m3.material.io/foundations/designing/structure)) | minor | iOS / And | S |
| B3 | Target spacing | Gap between neighboring targets smaller than 48px is ≥8px. | 8dp ([Material](https://m3.material.io/foundations/designing/structure)) | minor | And | S |
| B4 | Hover-only UI | CSSOM: `:hover` rules outside `@media (hover:hover)` that reveal descendants (`display`, `visibility`, `opacity`, `max-height`). Confirm by tapping the parent once in a `hasTouch` context: the revealed item must be visible and actionable. | No hover dependency; iOS double-tap behavior ([Apple](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html), [MDN hover](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover)) | major | both | S + I |
| B5 | Press state | Force `:active` (`CSS.forcePseudoState`) on each control type and diff the computed style. Flag no change combined with `-webkit-tap-highlight-color: transparent`. | "Always include a press state" ([HIG](https://developer.apple.com/design/human-interface-guidelines/buttons)) | minor | both | E |
| B6 | Double-tap zoom | Computed `touch-action` on controls (or an ancestor) is `manipulation`. | ([Vercel guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/AGENTS.md)) | minor | both | S |
| B7 | Selection misuse | `user-select: none` on inputs or main text is major. Selectable labels in tab bars and buttons are minor. | Platform-rules §11 | major / minor | both | S |

## Input and keyboard

| # | Check | Measure | Threshold (source) | Sev | Plat | Mode |
|---|---|---|---|---|---|---|
| C1 | No zoom on focus | Computed `font-size` of text-like `input`, `select` and `textarea`. | ≥16px ([CSS-Tricks](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/); observed iOS behavior) | major | iOS | S |
| C2 | Right keyboard and autofill | Infer the field's purpose from `name`, `id`, label, placeholder or `type`. Expect: email → `type=email` + `autocomplete=email`; phone → `tel`; OTP → `inputmode=numeric` + `one-time-code`; password → `current-`/`new-password`; postcode → `postal-code`. | [MDN autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete), [web.dev OTP](https://web.dev/articles/sms-otp-form) | major (password, OTP, email) / minor | both | S |
| C3 | `type=number` misuse | `type=number` on OTP, card, phone or postcode fields. | Platform-rules §10 | minor | both | S |
| C4 | Return key | Search fields, single-field forms and chat composers have `enterkeyhint`. Fields sit inside a `<form>`, so Enter submits (I: focus, press Enter, expect a submit). | ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint)) | minor | both | S + I |
| C5 | Labels | Every field has an accessible name (axe `label`). | WCAG 4.1.2 | major | both | S |
| C6 | Autofocus | `autofocus` or `focus()` on load on mobile. | The keyboard covers the screen ([Vercel](https://github.com/vercel-labs/web-interface-guidelines/blob/main/AGENTS.md)) | minor | both | S |
| C7 | Keyboard occlusion (approx.) | Focus each field. Treat the bottom ~40% of the viewport as the keyboard. The field and its submit button must end up above it after the page's own scrolling, and no fixed element may overlap the field's center. | Both browsers only shrink the visual viewport ([Chrome](https://developer.chrome.com/blog/viewport-resize-behavior)) | major | both | I |
| C8 | Bottom composer strategy | If a fixed bottom element contains an input, the code uses `visualViewport` listeners, or the meta has `interactive-widget`. | Otherwise it sits behind the keyboard (platform-rules §9) | major | iOS (And) | S |

## Navigation

| # | Check | Measure | Threshold (source) | Sev | Plat | Mode |
|---|---|---|---|---|---|---|
| D1 | Every screen has a URL | Click the primary navigation items and record `location` after each. The URL must change, and reloading it restores the same screen. | Deep links, shares and reloads | major | both | I |
| D2 | Back closes overlays | Open each dialog, sheet or menu (triggers with `aria-haspopup`, `aria-expanded` or `aria-controls`). Then press `Esc` (Chromium close request) and/or `page.goBack()`. The overlay must close and the route must stay. Detect native `<dialog>`, `popover` or CloseWatcher. | Android back = close request ([Chrome 126](https://developer.chrome.com/release-notes/126)) | major | And | I |
| D3 | No history spam | After N in-page interactions, `history.length` grows only with real route changes. `goBack()` returns to the previous screen. | Back-trapping ([close-watcher abuse analysis](https://github.com/WICG/close-watcher#abuse-analysis)) | major | both | I |
| D4 | Standalone back button | Patch standalone detection (see run profiles). On each non-root route, a visible control named /back/i or a parent link in the top ~120px. Uses `navigation.canGoBack` when present. | iOS standalone has no back ([progressivewebapps.com](https://progressivewebapps.com/design/app-like-ux/)) | major | iOS | E + I |
| D5 | Scroll containment | Scrollers inside `dialog`, `[popover]` or fixed overlays have `overscroll-behavior` `contain` or `none`. Scroll the overlay past its end; `window.scrollY` must not change. | Scroll chaining ([Chrome](https://developer.chrome.com/blog/overscroll-behavior)) | minor | both | S + I |
| D6 | Refresh path in standalone | Data views expose a refresh control or a pull-to-refresh handler. | No pull-to-refresh in iOS Home Screen apps (unverified, platform-rules §12) | minor | iOS | S |

## Installable

| # | Check | Measure | Threshold (source) | Sev | Plat | Mode |
|---|---|---|---|---|---|---|
| E1 | HTTPS | Page, manifest and icons over HTTPS, no mixed content. | Install criteria ([web.dev](https://web.dev/articles/install-criteria)) | blocker | both | F |
| E2 | Manifest reachable | Linked from the page; returns 200 and parses as JSON (not the SPA's HTML fallback); `Content-Type: application/manifest+json`. | ([jg-pwa](https://jg-skills.jesusgraterol.dev/skills/jg-pwa/)) | blocker (no parse) / minor (MIME type) | And | F |
| E3 | Chrome install criteria | `name` or `short_name`, `start_url`, `display` in standalone/fullscreen/minimal-ui, 192 and 512 icons that load, `prefer_related_applications` ≠ true. Cross-check with `Page.getInstallabilityErrors`. | ([web.dev](https://web.dev/articles/install-criteria)) | blocker | And | F + E |
| E4 | Identity and scope | `id` set; `start_url` inside `scope`; `start_url` returns 200 with no cross-origin redirect. | ([Chrome id](https://developer.chrome.com/docs/capabilities/pwa-manifest-id)) | major | both | F |
| E5 | Icons | A separate `purpose: maskable` icon ≥512 (flag `"any maskable"`), with opaque pixels at its corners. `apple-touch-icon` ≥180×180 with no alpha. | Maskable safe zone is a circle of radius 40% ([web.dev](https://web.dev/articles/maskable-icon)). iOS prefers `apple-touch-icon` (BCD). | major (no iOS icon and no manifest icons) / minor | both | F |
| E6 | Richer install sheet | `description` plus ≥1 `narrow` or untagged screenshot: 320–3840px, long/short ≤ 2.3, one ratio per form factor, `sizes` matches the decoded image, ≤5 on mobile. | ([Chrome](https://developer.chrome.com/blog/richer-pwa-installation), [openpwa](https://openpwa.net/reference/manifest/screenshots.md)) | minor | And | F |
| E7 | Colors | `theme_color` and `background_color` set. | Splash and status bar on Android | minor | And | F |
| E8 | Service worker sanity | If one is registered: the fetch handler isn't a no-op, the script is served `no-cache`, and an offline reload (`context.setOffline(true)`) renders a page, not the browser's error page. | Chrome 112 skips no-op handlers ([Chrome](https://developer.chrome.com/blog/new-in-chrome-112)) | minor | both | F + I |
| E9 | Permission on load | An init script wraps `Notification.requestPermission` and `PushManager.subscribe`. Flag calls made before any user input. | iOS requires a user gesture ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)) | major | both | I |
| E10 | Standalone layout | With standalone patched and a top inset of 59px injected, nothing interactive sits under the status bar (A5 in standalone). | `black-translucent` draws under the bar ([Apple ref](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)) | major | iOS | E |

## Shareable

Fetch with crawler user agents: `WhatsApp/2.23.20.0 A`, `facebookexternalhit/1.1`, `Twitterbot/1.0` and `Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)`.

| # | Check | Measure | Threshold (source) | Sev | Plat | Mode |
|---|---|---|---|---|---|---|
| F1 | Bots can fetch | Every bot user agent gets 200 HTML with the same tags. Not 401, 403, 429 or a challenge page. | Previews need public metadata ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)) | blocker | both | F |
| F2 | Tags in raw HTML | `og:title`, `og:description`, `og:url` and `og:image` are non-empty in the server HTML `<head>`, without JS. `twitter:card` is set. | WhatsApp requires the first three ([Meta](https://developers.facebook.com/docs/whatsapp/link-previews/)); crawlers don't run JS | major | both | F |
| F3 | Head within 300 KB | Byte offset of the last OG tag is < 300 000. Total HTML ≤ 1 MB. | WhatsApp: 300 KB; iMessage: 1 MB ([Meta](https://developers.facebook.com/docs/whatsapp/link-previews/), [TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)) | major | both | F |
| F4 | Image fetch | `og:image` is an absolute `https://` URL, returns 200 with `image/*`, and isn't SVG. | Absolute URL and SVG rules ([X](https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image)) | major | both | F |
| F5 | Image size | Decoded width ≥ 1200 and height ≥ 630, ratio ~1.91:1 (minor if not). Width < 900 (iMessage) is minor; < 300 (WhatsApp) is major. | FB ≥1200×630 ([Meta](https://developers.facebook.com/docs/sharing/webmasters/images/)), iMessage ≥900 wide ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)), WhatsApp ≥300 | minor / major | both | F |
| F6 | Image weight | Bytes < 600 KB (major if over). Over 5 MB (X) or 8 MB (FB) is a blocker for those platforms. | WhatsApp < 600 KB ([Meta](https://developers.facebook.com/docs/whatsapp/link-previews/)) | major | both | F |
| F7 | No meta-refresh | The shared URL doesn't redirect with `<meta http-equiv=refresh>`; server redirects are fine. | iMessage doesn't follow meta redirects ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)) | major | iOS | F |
| F8 | Copy hygiene | `og:title` has no brand suffix and `og:site_name` is set. `og:url` equals `<link rel=canonical>`. Each deep link has a distinct `og:title`. | ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages), [kostja94](https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/open-graph)) | minor | both | F |
| F9 | Icon | A square `apple-touch-icon` or `icon` ≥108px. | ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)) | minor | iOS | F |
| F10 | Share button | Stub `navigator.share`, tap the share control, and assert it is called with the canonical URL. Then delete `navigator.share` and assert the fallback copies the link and confirms it. | User activation plus fallback ([web.dev](https://web.dev/articles/web-share)) | minor | both | I |
| F11 | `share_target` | If declared: `action` is inside `scope`, and file sharing uses `POST` with `multipart/form-data`. | ([Chrome](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)) | minor | And | F |

## Escalate to a device (not automatable headlessly)

- **Real keyboard:** the keyboard actually covering inputs or bottom bars (C7 is only an approximation). This includes the iOS 26.0 fixed-element bugs.
- **Safari 26:** toolbar tint and Liquid Glass clipping. Status-bar look in Home Screen mode.
- **Install flows:** the Add to Home Screen flow, the "Open as Web App" result, the Android install sheet and richer UI rendering.
- **Gestures:** Android back on custom sheets (D2 uses `Esc` as a proxy), iOS edge swipe, pull-to-refresh.
- **Device features:** push delivery, badges, haptics, the share sheet, camera capture.
- **Previews:** live caches in WhatsApp, iMessage and Slack. Re-test with a cache-busting query string.
