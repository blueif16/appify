# appify

Make a web app feel like an app on phones while it stays one URL: no app store,
no separate mobile site. appify is two parts:

- **The skill** (`skills/appify/`): instructions your coding agent follows, one
  step and one checkpoint at a time: shell, navigation, layout, input,
  installable, shareable.
- **The studio and the `appify` command** (`studio/`): the studio shows your
  running app on a desktop window and several phones side by side at
  http://localhost:4747. The command gives your agent measurements, screenshots
  and saved versions.

Website: https://appify-studio-zeta.vercel.app

## Install

The quickest way is the setup prompt on the website: copy it and paste it into
Claude Code, Codex, Cursor or any coding agent, from your project's folder. It
does the steps below.

Needs Node 20 or later, git, and Chrome or Chromium. Works on macOS, Linux and
WSL.

**1. The appify command**

```sh
npm install -g https://github.com/blueif16/appify/releases/latest/download/appify.tgz
```

Install it from this URL. Don't use `npx appify`: the npm package called
`appify` is an unrelated project.

**2. The skill**, from your project's root folder, for Claude Code:

```sh
mkdir -p .claude/skills && curl -fsSL https://github.com/blueif16/appify/releases/latest/download/skill.tgz | tar -xz -C .claude/skills
```

This creates `.claude/skills/appify/SKILL.md`. To use it in every project,
extract it into `~/.claude/skills` instead. Other agents: extract it into the
folder your agent loads skills from.

**3. The studio.** Add `.appify/` to `.gitignore`: the studio keeps its versions
and comments there. Start your app's dev server, then, from the project root:

```sh
appify studio http://localhost:3000
```

Use your app's own address, or leave it out and the studio looks for a dev
server on the usual ports. If it says no Chromium was found, run
`npx -y playwright install chromium`, or set `APPIFY_CHROMIUM` to a Chrome
executable. The **On my phone** link also needs
[`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

**4.** Ask your agent to make the app feel like an app on phones. It follows the
skill, and you pin comments on any device in the studio for it to read.

| Command | What it does |
|---|---|
| `appify studio [url]` | The side-by-side view, for you |
| `appify comments` | What you pointed at in the studio |
| `appify snapshot [--shots]` | Facts per device and page, and optional screenshots |
| `appify checkpoint "label"` | Save the code, screenshots and facts as the next version |
| `appify history` / `appify restore vN` | List the versions, or go back to one |

## The studio

- Every window sits on one bench: minimize one to the dock, or add any phone
  with **+**.
- **Browser tab / Home Screen app** switches between opening the app in Safari
  or Chrome and opening it from the Home Screen.
- The numbers under each phone are the room the page actually gets after the
  browser and system bars.

Inside each phone the page sees that phone's user agent, no hover, a touch
pointer, its display mode and its safe-area insets. Hover-only controls stay
hidden until tapped, pages without a mobile viewport tag render shrunk the way
phones show them, and on iPhones a field with text under 16px zooms in when
tapped.

It is still desktop Chrome underneath: no WebKit, no on-screen keyboard and no
real touch gestures. Treat it as a fast first look; check on a real phone
before calling something done.

## Working on appify

```sh
npm install
npm run example   # the desktop-only sample app on http://localhost:5173
npm run studio    # the studio on http://localhost:4747
npm run demo      # the Lumen demo, transformed step by step, on :5180
```

- `site/` is the landing page. `npm run site:deploy` deploys it to Vercel.
- `npm run release` packs `studio/` and `skills/appify/` and attaches them to
  the GitHub release for the version in `studio/package.json`. That's what the
  install commands download, so run it after changing either.
