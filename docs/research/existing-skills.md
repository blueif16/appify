# Existing agent skills for mobile web, PWA and link previews

Checked 2026-10-27. I read every source file listed here (SKILL.md, references, scripts) where it was still reachable. "Dead" means the listing exists but the content can no longer be fetched.

## At a glance

| Skill | Source | Status | Shape | Verifies? |
|---|---|---|---|---|
| mobile-responsiveness | [hoodini/ai-agents-skills](https://github.com/hoodini/ai-agents-skills/tree/master/skills/mobile-responsiveness) | Live (292★, pushed Oct 2026) | 1 SKILL.md, snippets only | No |
| mobile-ux-optimizer (+ pwa-expert) | [erichowens/some_claude_skills](https://github.com/erichowens/some_claude_skills/tree/main/.claude/skills/mobile-ux-optimizer) | Live | SKILL.md + 2 refs (3 more refs are linked but missing) | Manual checklist |
| mobile-web-adaptation | [meet-student/skills](https://github.com/meet-student/skills) | Live (1★) | SKILL.md + 5 refs, in Chinese | Self-reported checklist |
| mobile-responsive | [AsadSumbul/mobile-responsive](https://github.com/AsadSumbul/mobile-responsive) | Live | SKILL.md + 4 refs + `scripts/check-overflow.js` | **Yes**: Playwright overflow scan |
| pwa-setup, mobile-components | [mcp.directory](https://mcp.directory/skills/pwa-setup) → dadbodgeoff/drift | **Dead**: the download API returns "Skill has no content to download" and the repo no longer has a `skills/` folder | none | n/a |
| dotagents pwa | [playbooks.com](https://playbooks.com/skills/sebastiaanwouters/dotagents/pwa) | **Dead**: 404, and the [repo](https://github.com/SebastiaanWouters/dotagents) has no pwa skill | none | n/a |
| og-image | [stevysmith/og-image-skill](https://github.com/stevysmith/og-image-skill) | Live (104★) | Plugin: SKILL.md + examples | Partly: Playwright screenshot plus a tag checklist |
| open-graph (+ twitter-cards) | [kostja94/marketing-skills](https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page/open-graph) | Live (1k★, v2.0.0) | SKILL.md each | Manual: external debuggers |
| social-share-generator | [claudskills listing](https://claudskills.com/skills/social-share-generator/) | **Moved**: the listed path 404s, and the original is now a stub pointing to [kostja94/bricks](https://github.com/kostja94/bricks) | Stub | n/a |
| Capgo skills (48) | [Cap-go/capgo-skills](https://github.com/Cap-go/capgo-skills) | Live | SKILL.md + metadata.json + refs | **Yes**: on-device steps, console probes, greps |
| Mobile MCP | [mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp) | Live (10k★) | An MCP server, not a skill | It is a verification tool |

## Per skill

### mobile-responsiveness (hoodini)
- **Covers:** mobile-first breakpoints, Tailwind examples, `clamp()` fluid type, a touch swipe hook (50px threshold), a hamburger drawer, safe areas (`max(1rem, env(safe-area-inset-bottom))`), the `viewport-fit=cover` meta, and a `useMediaQuery` hook.
- **Gaps:** It swaps whole components by JS media query (`isMobile ? <MobileView/> : <DesktopView/>`), which risks hydration mismatches and builds a separate mobile site. It has nothing on dvh, the keyboard, inputs, target size, install or sharing, and it never verifies anything.

### mobile-ux-optimizer + pwa-expert (erichowens)
- **Covers:** the 44pt (HIG) and 48dp (Material) target rule, `100dvh` with a `vh` fallback, safe-area utilities (`pb-safe`, `pt-safe`), a bottom nav (`min-h-[56px]`), a drawer that locks body scroll and closes on Esc, swipe and pull-to-refresh hooks, skeletons, and a quick-reference table (`touch-action: manipulation`, "use `visualViewport`" for the keyboard).
- **Structure:** clear "use for / don't use for" routing, with `pairs-with` metadata pointing to pwa-expert. The SKILL.md links `keyboard-handling.md`, `animations.md` and `accessibility.md`, but **none of the three exist** (only `gestures.md` and `navigation.md` do).
- **Verification:** a manual DevTools device-mode checklist plus ngrok or BrowserStack.
- **Outdated advice:** pwa-expert says to run the "Lighthouse → PWA audit". Lighthouse removed the PWA category in v12 (Apr 2024) ([release](https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0)). It also leans on `apple-mobile-web-app-capable`, which iOS 26 no longer needs.

### mobile-web-adaptation (meet-student)
- **Covers:** practical H5/WeChat-WebView fixes: `text-size-adjust`, `-webkit-tap-highlight-color`, `overscroll-behavior: contain`, `rem` from a 750px design, a scroll lock done as `position: fixed` plus a saved `scrollTop`, `user-select: none` scoped away from inputs, `inputmode`/`tel`, iOS `Date` parsing, `format-detection`, and bfcache handling via `pageshow.persisted`.
- **Structure:** a decision tree for picking the layout strategy, then a symptom-to-fix table. The output contract ("what changed / why / how verified / remaining risk") is a good model.
- **Gaps:** It never mentions safe areas, `env()`, dvh, `visualViewport` or `enterkeyhint`. It still recommends `-webkit-overflow-scrolling: touch`, which is obsolete since iOS 13. Its keyboard fix is the old blur-then-`scrollIntoView` hack.

### mobile-responsive (AsadSumbul)
- **Covers:** "Step 0: learn the project's conventions" (tokens, breakpoints, spacing scale; never add a second CSS system), mobile-first `min-width` queries, an exhaustive overflow-cause list (fixed widths, flex `min-w-0`, media `max-w-full`, long strings, tables, `100vw`), 44px targets, ~65ch line length, and a 320–1440px device matrix.
- **Verification:** `check-overflow.js` loads the URL at 8 widths in Playwright Chromium, flags every element whose right edge passes `clientWidth`, and exits 1 for CI. This is the only skill with a deterministic check.
- **Gaps in the check:** It uses a desktop Chromium context (no `isMobile`, `hasTouch` or `deviceScaleFactor`, so the meta viewport is ignored), checks only right-edge overflow, and has no WebKit run, no safe-area check and no keyboard check.

### og-image (stevysmith)
- **Covers:** read the design system → build a `/og-image` route at exactly 1200×630 → screenshot it with Playwright MCP → write OG and Twitter tags (`summary_large_image`, width, height, alt, `metadataBase` for absolute URLs) → list cache-busting debuggers.
- **Verification:** confirms the file exists and the tags render, then runs a checklist.
- **Gaps and conflicts:** Its design puts the product name and tagline as text in the image, but Apple's TN3156 says "Avoid text in preview images" ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)). It never checks WhatsApp's 600 KB cap or iMessage's ≥900px width. It links the legacy X Card Validator, which I could not confirm still renders previews. It also sets `appleWebApp.statusBarStyle: "black-translucent"` without adding safe-area padding, which pushes content under the status bar in Home Screen mode.

### open-graph + twitter-cards (kostja94)
- **Covers:** four essential tags (`og:title`, `og:description`, `og:image`, `og:url`), absolute HTTPS image URLs, 1200×630, `og:url` equal to the canonical URL, and copy that may differ from the SEO title. "Inspect the raw initial HTML; a client-only tag insertion may not be available to every scraper." twitter-cards adds 2:1 with a 300×157 minimum and `twitter:image:alt` up to 420 characters.
- **Gaps:** No per-crawler limits (WhatsApp, iMessage, Slack), no automated check (verification belongs to a separate `page-metadata` skill), and nothing on icons.

### Capgo skills (Capacitor, so native wrapper: out of scope, but the best-built)
- **Relevant:** `safe-area-handling`, `capacitor-keyboard`, `capacitor-testing` (with a `device-verification-loop.md`).
- **Notable rules:** a version-keyed facts table, e.g. "`env(safe-area-inset-*)` works only with `viewport-fit=cover`" and "Android WebView < 140 reports wrong/0 insets". Never hard-code 20/44/47/59px bar heights. Insets change at runtime, so never cache them. "On iOS the bottom inset stays while the keyboard is visible."
- **Verification:** a named device matrix (Dynamic Island, SE-class, iPad, Android gesture vs 3-button, landscape), console probes, and a grep for legacy config. This is the model for appify's verification section.

### Mobile MCP (mobile-next)
- **What it is:** an MCP server that drives iOS simulators, Android emulators and real devices through the accessibility tree, falling back to screenshots. Tools include `mobile_open_url`, tap, swipe, long-press, `mobile_type_keys`, `mobile_press_button` (BACK, HOME), orientation and screenshots.
- **Why it matters:** it is the only way in this list to test real iOS Safari and Chrome Android behavior: the keyboard, toolbars, Add to Home Screen, the back gesture. It has no web-specific checks of its own.

## More skills found

- **[vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/AGENTS.md):** terse MUST/NEVER rules. Hit target ≥24px (≥44 on mobile); "Mobile `<input>` font-size ≥16px to prevent iOS zoom"; never disable zoom; `touch-action: manipulation`; `overscroll-behavior: contain` in modals and drawers; keep pull-to-refresh on coarse pointers; `autocomplete` + `inputmode`; respect safe areas. It is a rules list with no checker.
- **[ibelick/ui-skills `baseline-ui`](https://github.com/ibelick/ui-skills/blob/main/skills/baseline-ui/SKILL.md):** "NEVER use `h-screen`, use `h-dvh`" and "MUST respect `safe-area-inset` for fixed elements".
- **[mattiasgeniar/offline-first-pwa](https://github.com/mattiasgeniar/offline-first-pwa):** a single SKILL.md, measurement-driven. Rules: cache-first navigations; precache everything the launch needs; "test slow, not offline" (DevTools throttling skips service-worker fetches); iOS reads the icon and title from `apple-touch-icon` and `apple-mobile-web-app-title`, not the manifest; detect standalone with an inline `<head>` script; pad with `max(env(safe-area-inset-top), <min>)`; the page itself never scrolls (a `100dvh` shell with an inner scroller); a fix for iOS's "Copy / Look Up" bar on repeated taps.
- **[jg-pwa](https://jg-skills.jesusgraterol.dev/skills/jg-pwa/) ([repo](https://github.com/jesusgraterol/jg-skills)):** the most current PWA rules I found (Safari 26-aware):
  - set `id` and never change it
  - separate `any` and `maskable` icons, never `"any maskable"`
  - `narrow` + `wide` screenshots with labels
  - serve the manifest as `application/manifest+json` with `no-cache`, and never let the SPA fallback answer its URL
  - `theme-color` per color scheme ("Safari 26+ uses it only for installed web apps")
  - a 180px opaque `apple-touch-icon`
  - "Never add a service worker … only to qualify for the install prompt"
- **[stealth-engine `safari26-liquid-glass`](https://github.com/stealth-engine/skills/blob/main/skills/safari26-liquid-glass/SKILL.md):** on-device notes for iOS 26. The toolbar tint is sampled from fixed or sticky elements and `body`; `theme-color` is ignored; `position: fixed` content is clipped at the glass bars; the keyboard bug is WebKit #297779. Single setup, so treat its thresholds as approximate.
- **Generic PWA skills:** [secondsky](https://github.com/secondsky/claude-skills/blob/main/plugins/progressive-web-app/skills/progressive-web-app/SKILL.md), [sickn33](https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/progressive-web-app/SKILL.md), [juanmorales1810/pwa-service-worker](https://github.com/juanmorales1810/pwa-service-worker), [acaprino pwa-development](https://github.com/acaprino/claude-code-daodan/blob/master/plugins/pwa-expert/skills/pwa-development/SKILL.md). They repeat the same manifest, service-worker and `beforeinstallprompt` boilerplate, and several still say a service worker is required to install or point to the removed Lighthouse PWA audit.
- **Agent browser tooling (new):** Safari 27 (Sep 2026) ships a **Safari MCP** server for coding agents: DOM, screenshots, console and accessibility checks ([WebKit](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)). It drives Safari on the Mac; the post says nothing about iOS or the Simulator. Chrome documents **Chrome DevTools for agents** as the supported automation path ([CDP page](https://chromedevtools.github.io/devtools-protocol/)).

## Core pieces to adopt

1. **Read the project's conventions first** (tokens, breakpoints, styling system) and never add a second system (AsadSumbul).
2. **Route with explicit "use for / not for" lists** and a `pairs-with` hand-off (erichowens), keeping SKILL.md short with topic references loaded on demand (meet-student, Capgo).
3. **Use a version-keyed facts table** ("platform/version → behavior → what to write") instead of prose (Capgo). Date every platform claim, because iOS 26 and Chrome 135 broke several old rules.
4. **Keep the overflow-cause catalog**, plus a deterministic Playwright overflow scan that exits non-zero for CI (AsadSumbul). Upgrade it to real mobile contexts.
5. **Make safe-area patterns non-negotiable:** `viewport-fit=cover` + `max(env(...), floor)` applied once in the layout shell, never hard-coded bar heights (Capgo, geniar).
6. **Use an app-shell layout:** a `100dvh` shell, an inner scroller, `overscroll-behavior: contain` on sheets (geniar, Vercel).
7. **Treat input hygiene as rules:** ≥16px inputs, `type`/`inputmode`/`autocomplete`, never disable zoom (Vercel).
8. **Follow current manifest rules:** stable `id`, separate maskable icons, screenshots, no fake service worker (jg-pwa).
9. **Build OG images as a generated route** captured at 1200×630 by Playwright (og-image), and check that tags appear in the raw HTML (open-graph).
10. **End with an output contract:** changed / why / how verified / remaining risk (meet-student), plus a named real-device matrix (Capgo).

## What nobody covers

- **One end-to-end "make this existing app feel native at the same URL" flow.** Every skill covers a slice: layout, PWA, OG, or a native wrapper.
- **Automated mobile checks beyond horizontal overflow:** target size, input zoom, hover-only UI, keyboard occlusion, safe-area collisions (Chromium can emulate insets via `Emulation.setSafeAreaInsetsOverride`), manifest and installability (`Page.getInstallabilityErrors`), and crawler-view link previews.
- **The 2025–26 platform shifts:**
  - iOS 26 makes every Home Screen site a web app, so standalone mode must be handled even without a manifest.
  - Safari 26 ignores `theme-color` in tabs and samples the tint from fixed or sticky elements.
  - Chrome 135 went edge-to-edge with `safe-area-max-inset-bottom`.
  - Installed Android PWAs still don't draw under the status bar (fix in progress).
  - The Navigation API reached Safari 26.2.
  - The Lighthouse PWA audit is gone.
- **Back-navigation design in standalone mode:** the iOS in-app back button, and the Android back gesture closing sheets via `<dialog>`, popover or CloseWatcher.
- **Per-crawler link-preview limits** (WhatsApp: 600 KB and the first 300 KB of HTML; iMessage: ≥900px wide, no JS, 1 MB page; Slack: no robots.txt) and testing them with bot user agents.
- **Testing honesty:** none of the skills say what Playwright WebKit on Linux cannot reproduce (toolbars, keyboard, insets, input zoom, haptics), or when to escalate to a simulator or device (Mobile MCP, Safari MCP).
