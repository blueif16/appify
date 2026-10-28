---
name: appify
description: Make an existing web app look, behave and share like a native app on iPhone and Android phones, at the same URL, with no app store and no native code. Covers the phone app shell (safe areas, notch, home indicator), bottom tab navigation, sheets that the back gesture closes, phone layouts for grids/tables/sidebars, forms and the on-screen keyboard, Add to Home Screen / install (manifest, icons, service worker), and link previews and sharing. Use this whenever someone wants their site or web app to "feel like an app", work well or look right on phones, be mobile-friendly, be installable or a PWA, open from the home screen, or share nicely as a link, even if they only say "fix it on mobile", "make the mobile version", or point at a phone screenshot. Not for wrapping an app for the App Store/Play Store (Capacitor and the like) or for building a new native app.
---

# appify

Turn a web app into something that feels like an app on phones while it stays one URL and keeps working on desktop. You change the app's own code (HTML, CSS, JS, framework files); the `appify` command gives you measurements, screenshots and versions so you can see what's wrong and prove what you fixed.

## Principles

- **One URL, every device.** A shared link must open correctly wherever it lands, so adapt the same pages with CSS and capability checks. Never build a separate mobile site, never sniff the user agent to choose layouts.
- **Desktop must not regress.** Put phone changes behind width or capability media queries, and keep checking the desktop window.
- **Fix the shell once.** Safe areas, bars and scrolling belong to the app shell (layout, header, tab bar), not to every component.
- **Measure, don't guess.** Facts from `appify snapshot` say exactly what overflows, what is too small and what hides behind hover. Use screenshots only when the facts aren't enough; they cost far more tokens.

## The appify command

Run from the project root (where `.appify/` lives). If `appify` isn't on the PATH, install it with `npm install -g https://github.com/blueif16/appify/releases/latest/download/appify.tgz`. Never run `npx appify`: that fetches an unrelated npm package with the same name. The app's dev server must be running; pass `--url http://localhost:PORT` the first time.

| Command | Use it to |
|---|---|
| `appify comments` | Read what the human pointed at in the studio (JSON, one comment per line). Do these first. |
| `appify snapshot --pages / /other` | Get facts per device and page. Add `--shots` to save framed screenshots you can open. |
| `appify checkpoint "label" --note "…"` | Save a version (code + screenshots + facts) after each finished step. |
| `appify history` / `appify restore vN` | List versions; go back (it saves the current state first). |
| `appify comments resolve c1 c2` | Mark comments you addressed. |
| `appify studio` | The human's visual side-by-side view. You don't need it running. |

Snapshots use the devices last shown in the studio. Facts are measurements; you decide what they mean. Key fields: `overflowX` (px the page is wider than the screen; target 0, `overflowBy` and `wideRules` name the cause), `tapTargets.small` (under 44px on iOS / 48px on Android), `smallFields` (inputs under 16px: iOS zooms in on focus), `hoverOnly` (CSS that hides things until hover: invisible on phones), `fixed` and `unsafe` (bars and what sits under the notch, status bar or home indicator), `smallText`, and `head` (viewport, theme-color, manifest, service worker, share tags).

## Workflow

1. **Set up.** Make sure `.appify/` is in `.gitignore`. Read `appify comments`. If there are no checkpoints yet, save `appify checkpoint "Original"` before you touch anything.
2. **Look.** Run `appify snapshot` on the main pages (home, a list, a detail, a form). Note the worst facts per device.
3. **Classify.** Identify the stack from the project files and read the matching section of `references/stacks.md`. Identify the app type of each main page and read its plan in `references/app-types.md`. These two decide where edits go and what changes.
4. **Plan.** Order the work as steps, one checkpoint each, usually: shell → navigation → layout → input → installable → shareable. Skip steps the app doesn't need. Comments come first in whichever step they belong to. If someone is following along, share the plan in a few lines.
5. **Do each step.** Read that step's module file in `references/modules/`, make the change, then run `appify snapshot` again and compare against the previous facts. Check the desktop entry too. Fix regressions before moving on. Then `appify checkpoint "<step name>" --note "<what changed and why, one or two sentences>"` and resolve the comments you addressed.
6. **Finish.** Summarize the versions (`appify history`), what improved in numbers, and what still needs a real phone: the studio is desktop Chrome underneath, so the keyboard, Safari's toolbars and installing need a final check through the studio's "On my phone" link.

Small, verified steps beat one big rewrite: each checkpoint is something the human can compare, keep or roll back.

## Reference files

Read only what the current step needs.

| File | Read when |
|---|---|
| `references/app-types.md` | Classifying pages: dashboard, feed/gallery, tool, chat, content site, checkout/forms |
| `references/stacks.md` | Deciding where edits go: Next.js, Vite/React/Vue SPA, plain HTML or MPA, SvelteKit, Nuxt, Astro |
| `references/platforms.md` | Any iOS vs Android question: insets, standalone mode, keyboard, back, theme color, install rules |
| `references/modules/shell.md` | Step: viewport, safe areas, overflow, scrolling, tap and hover basics |
| `references/modules/navigation.md` | Step: tab bar, top bar, sheets and menus, back behavior, transitions |
| `references/modules/layout.md` | Step: grids, sidebars, tables, cards, hover-only actions, spacing |
| `references/modules/input.md` | Step: forms, keyboards, autofill, file and camera inputs, the on-screen keyboard |
| `references/modules/installable.md` | Step: manifest, icons, service worker, install prompts |
| `references/modules/shareable.md` | Step: link previews, share button, deep links, receiving shares |
