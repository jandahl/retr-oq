# CLAUDE.md

How to work in this repo. README.md is the catalogue. This file is the
constraints that are easy to violate if you only read the code.

## Rules

- **Static HTML, no bundler** inside a theme. Vendor dist CSS + fonts +
  a LICENSE. Hosted on `http(s)` (GitHub Pages), not `file://`.
- **Cache-bust `?v=N`** independently for every file you change
  (`style.css`, `app.js`, `compositor.js`, …). Stale JS next to fresh
  HTML is a real shipped bug.
- **Load order is the dependency graph.** Classic scripts share
  `window.OqDictSource` / `OqHyphenation` / `OqRouter` / `OqCompiz`.
  ES modules are fine when there's a reason.
- **`OqRouter.navigate()` owns OQ!/DECON.** Don't call open/close from a
  new UI trigger — the URL and the UI will disagree.
- **Arrow cursor** on chrome, icons, menus, buttons, and `a` / `a:link`.
  Compass cursors on resize handles. Not `pointer`. Not period `.cur`
  files.
- **Touch:** inputs ≥ 16px (iOS zoom). `html, body { position: fixed }` —
  `overflow: hidden` alone does not stop iOS from scrolling the document
  to a focused field.
- **Pointers:** listen for move/up on `window`. Start a drag (or Compiz
  grab) only after the pointer has actually moved. Don't `await` a
  snapshot on the pointer path.
- **Original art.** No trademarked logos. Easter eggs stay undocumented.
- **Git:** new branch from current `origin/master`. Don't stack on a
  just-merged branch. "Rebase" after a merge means that. Confirm with
  `git log origin/master..origin/<branch>`.

If you're in the App Builder workspace, the git repo is this tree and
the live preview serves a **copy** at `/workspace/public/`. Edit here,
then copy the theme across. Hub tiles live in two places: `index.html`
(GH Pages) and the Vite hub under `/workspace/src/` — touch both.

## Families

Don't mix window managers across families.

| Family | Dirs | WM |
| --- | --- | --- |
| Redmond | `win31/` `win98/` `xp/` `win7/` | `shared/redmond/window-manager.js` |
| Mac-lineage | `mac1984/` `mac8/` `amiga/` | each theme's own `app.js` — do not share |
| Own WM | `next/` `kde/` | each theme's own `app.js` — not Redmond |
| Text mode | `dos/` `c64/` | no overlapping windows; full-screen takeovers |
| Console | `nes/` `gb/` | one screen, one `handleInput()` |

## `shared/`

- `dict-source.js` — fetch/cache/filter. No local sort; upstream
  Kalaallisut collation is the order (`aa` after `a` is not a bug).
- `hyphenation.js` — MPL-2.0 *code* (the linguistic rules are not).
  Don't blur that in the file header.
- `router.js` — query-string router. Static hosting has no path
  rewrites, so `?screen=oq&filter=` not `/oq/`.
- `redmond/window-manager.js` — drag/resize/focus/min/max/close/taskbar
  for the Redmond family only.
- `decon-app.js` — DECON UI, reused as-is.

## Theme invariants

Only what the code won't tell you. Cache-bust and router apply everywhere.

**`dos/`** — Single-tasking: `#dos-dir` and `#dict-app` swap via
`hidden`. Movement snaps to character cells. `visualViewport` height
*and* `offsetTop` go into `--app-height` / `--app-top`;
`KEYBOARD_THRESHOLD_PX` (150) ignores the mobile Chrome address bar.
Don't call `launchDict()` / `exitDict()` except from the router
listener. Commands: `DICT`, `DIR`, `CLS`, `VER`, `DOSKEY`, `FORMAT`,
plus undocumented `DOOM`. `BUILD`/`DECON` in `DIR` are placeholders.

**`c64/`** — Same single-tasking as `dos/`. Real two-step
`LOAD"NAME",8` then `RUN`. Hand-drawn chrome; C64 Pro Mono at
`vendor/c64/fonts/`.

**`nes/` / `gb/`** — Console, not a desktop: no floating windows.
Keyboard and on-screen pad both call `handleInput()`. 16px inputs;
`html.is-keyboard` hides the pad. NES audio is Web Audio pulse/triangle/
noise — no samples, no Nintendo tunes; don't `setMusic(null)` just
because the screen isn't the title. GB reuses Press Start 2P from
`vendor/nes/fonts/`; the pad stays on the brick.

**`amiga/`** — Chrome is four Kickstart 1.3 pens (`#0055AA` white black
`#FF8800`). Art (backdrop, icons, About, copper, Boing) is 12-bit OCS.
A fifth chrome color, or flattening the painting to four pens, is a
bug. Own WM (depth gadget = to-back). TopazPlus a500, not system mono.

**`next/`** — Chrome is four MegaPixel grays. Key title black, inactive
dark gray; miniaturize left, close right, resize bar along the bottom.
Icons stay anti-aliased (`image-rendering: pixelated` is a bug).
Vertical menu + right dock; miniaturize leaves a miniwindow, not a
taskbar pill. Own WM. TeX Gyre Heros, not Helvetica. Menu items are
`<a href="#">` — set `a:link { cursor: default }`.

**`win31/`** — Redmond WM, 3.1 chrome: Program Manager is the shell
(closing it is Exit Windows → `../`). No Start, no taskbar — minimize
is an icon on the teal desktop. No X; close lives in the Control-menu
(double-click the box). Don't add a title-bar close "for touch." Font
reused from `vendor/win98/fonts/`.

**`win98/` `xp/` `win7/`** — Redmond WM. 98.css / XP.css / 7.css dist
builds under `vendor/`. Don't vendor the SCSS sources (they need a
build). Greenlandic flag, not a Windows logo. 7.css ships no fonts.

**`mac1984/` `mac8/`** — Own WM each; don't share with each other or
Redmond. Growbox only, not edge-resize. mac8 zoom toggles the prior
rect, it isn't maximize.

**`kde/`** — Own WM (Plastik + Kicker). Compiz is `compositor.js`:
spring-mesh on `#compositor` for a fine pointer, CSS transforms on the
live window for coarse / iOS / reduced-motion (`html2canvas` blanks
there). Hide N/NE/NW resize handles on `pointer: coarse`. DejaVu Sans
at `vendor/kde/fonts/`. No KDE K.

## Git

Always restart from current `master` after a merge. A PR merged into a
feature branch that was itself already merged does not land on
`master` — CLS once vanished from production that way. If you stack on
an open PR, say so in the description and check both actually reached
`master`.

## Tests

`tests/test_win98.py`, `test_nes.py`, `test_gb.py` run in GitHub
Actions when those themes change.

```bash
pip install -r tests/requirements.txt
python3 -m pytest tests/ -v
```

Reuse `tests/conftest.py` fixtures if you add a suite. Other themes:
ad hoc Playwright against a local `http.server`. Simulate a mobile
keyboard by stubbing `visualViewport.height` / `offsetTop` and firing
`resize` — you cannot drive a real IME from CI.
