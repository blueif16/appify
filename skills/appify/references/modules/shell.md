# Step: app shell

Goal: the page fits the phone, respects the notch and home indicator, scrolls like an app and answers touch instead of hover. Do this first; every later step sits on it.

## 1. Head and colors
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">  <!-- add media="(prefers-color-scheme: dark)" variants if the app has a dark theme -->
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script>
  // Before first paint, so CSS can tell Home Screen apps from browser tabs.
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone)
    document.documentElement.classList.add('standalone');
</script>
```
- Use `black-translucent` only when the header is designed to sit under the status bar; then the header must pad `env(safe-area-inset-top)`.
- Give `html` and `body` an explicit `background-color`: Safari 26 tints its bars from it (it ignores `theme-color` in tabs).

## 2. One phone breakpoint
Pick one and use it everywhere: the project's existing small breakpoint, or `@media (max-width: 640px)`. Layout follows width; hover styling follows capability: `@media (hover: hover) and (pointer: fine)`. Leave desktop rules as they are and add phone rules after them.

## 3. No sideways scrolling
`overflowX` must be 0 on every phone. `overflowBy` and `wideRules` name the cause. Fix the cause:
- Fixed widths → `width: 100%; max-width: <old width>`.
- Fixed grid tracks → `grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr))`.
- `min-width` tables → the layout step turns them into lists; until then, wrap them in `overflow-x: auto`.
- Long words and URLs → `overflow-wrap: anywhere`.
- Media → `img, video, canvas, svg { max-width: 100%; height: auto; }`.

`overflow-x: hidden` on `body` hides the symptom, cuts content off and breaks `position: sticky`. Don't use it as the fix.

## 4. Bars and safe areas
```css
@media (max-width: 640px) {
  .app-header {                       /* desktop fixed header → sticky on phones */
    position: sticky; top: 0; z-index: 10;
    padding-top: env(safe-area-inset-top, 0px);
    background: #fff;                 /* solid: Safari tints from it */
  }
  body { padding-top: 0; }            /* undo the desktop offset for a fixed header */
}
body { padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px); }
```
- A fixed bottom bar (tab bar, action bar) pads `max(env(safe-area-inset-bottom), 8px)` and the page reserves its height at the bottom (see `navigation.md`).
- `unsafe` in the facts lists anything still under the status bar, notch or home indicator. Re-run in the studio's Home Screen mode too.

## 5. Touch basics
```css
input, select, textarea { font-size: max(16px, 1rem); }               /* no iOS zoom on focus */
a, button, label, summary, [role="button"] { touch-action: manipulation; }
@media (hover: none) {
  a, button, label, summary, [role="button"] { -webkit-tap-highlight-color: transparent; }
  button:active, .button:active, [role="button"]:active { opacity: .6; }  /* own press state replaces the grey flash */
}
```
- Move every `:hover` effect into `@media (hover: hover) and (pointer: fine)`. Things that only appear on hover are fixed in the layout step.
- On phones, give controls at least 44px of height via padding (`tapTargets.small`). Body text 15–16px; nothing under 12px (`smallText`).

## 6. Scrolling
- Most apps keep the document scrolling: browser bars collapse and pull-to-refresh keeps working.
- Chat and single-screen tools use a fixed shell instead: `body { height: 100vh; height: 100dvh; display: flex; flex-direction: column; } main { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }`.
- Replace `100vh` with `100dvh` (keep `100vh` on the line before as a fallback).

## Done when
`overflowX` is 0 and `smallFields` is 0 on every phone, `unsafe` is empty in both modes, `head.viewport` has `viewport-fit=cover`, and the desktop entry hasn't gained overflow. Checkpoint "App shell".
