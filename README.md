# retr-oq

Retro desktop / window-manager prototypes — pinstriped title bars,
draggable fixed-size windows, active/inactive chrome, a real desktop
background — one theme per subdirectory, each with its own vendored
framework under `vendor/`.

## Why this repo exists

This started as an experimental "Fun Themes" setting inside
[`jandahl/oq`](https://github.com/jandahl/oq), a Kalaallisut dictionary
PWA — an opt-in skin that swapped the app's look for a retro Mac UI. It
grew into something bigger: not just a skin, but a real window-manager
container (fixed-size windows, internal scroll, draggable title bars,
active/inactive focus) meant to eventually host oq's own views — and since
the plan was always more than one retro theme (Windows 98/XP, Mac OS 8.1,
Norton Commander, C64, NES, Windows 3.1, DOS were all on the list), it made
sense to build and prove out the theme-agnostic parts here rather than
inside a single app's `docs/` folder.

Splitting it out, deliberately decoupled from oq:

- **oq's CI stays oq's CI.** oq runs a full lint/typecheck/1084-test/
  Playwright/whats-new/precache-coverage suite on every push, regardless of
  how trivial the change. None of that needs to run just because a pixel
  moved on a desktop icon.
- **Zero blast radius.** This can't break oq's dictionary, search, or PWA
  install — there's no runtime dependency in either direction.
- **A real API boundary, if one ever gets built.** If this is ever consumed
  by oq (or anything else) again, it'll be across an actual import/fetch
  boundary instead of relative paths in the same working tree — which
  surfaces API shortcomings immediately instead of hiding them behind
  same-repo convenience.
- **Low stakes, on purpose.** This is a gag feature. Breaking it here
  doesn't put a real app at risk.

**Current status: fully decoupled.** oq does not import anything from this
repo, and this repo does not import anything from oq. oq's own copy of the
Fun Themes feature (merged, live on its `develop` branch) is untouched and
left as-is — see `oq-integration/README.md` for what that relationship
looks like today.

## What's here

- **`index.html`** — landing page listing the available theme prototypes.
- **`mac1984/`** — the first (and so far only) prototype: a real
  fixed-size, fixed-position `.window` on a real full-viewport desktop for
  the original **1984 Macintosh 128K** (System 1.0) — not the 1987
  Macintosh II, not System 7. Internal scrolling that never moves the
  frame, draggable title bars, click-to-focus active/inactive chrome,
  close/reopen, a desktop icon that opens a new window, and the Apple
  menu bar pinned across the top (using the framework's real
  `ul[role="menu-bar"]`/`.apple` components). Serve `mac1984/index.html`
  as-is, no build step — not meant to be opened via `file://`, just no
  bundler/transpiler needed before it's servable.
- **`vendor/mac1984/`** — [`@sakun/system.css`](https://github.com/sakofchit/system.css)
  (MIT), vendored verbatim. The real retro-Mac CSS framework — not the
  same-named-but-unrelated `system.css` package that oq's first pass
  accidentally vendored instead (see the history in `oq-integration/`).
  Future themes get their own `vendor/<theme>/` sibling directory the same
  way, e.g. `vendor/win98/` alongside a `win98/` prototype.
- **`oq-integration/`** — frozen copies of oq's Fun Themes glue code and
  project notes, for reference. Not wired to anything (see that
  directory's own README).
- **`dos/`** — a real DOS `COMMAND.COM`-style prompt (`dos/index.html`'s
  `#dos-dir`, a black-background/light-grey-text `dir` listing, not a
  desktop with icons) with a working command line and a full-screen
  DICT.EXE program. See `CLAUDE.md` for the conventions this theme runs
  on (character-grid movement, mobile keyboard/viewport handling, the
  command shims below) before editing it.
- **`c64/`** — a Commodore 64 `LOAD"$",8` disk listing (`c64/index.html`'s
  `#c64-dir`, light-blue-on-blue, 40 columns) with a real `LOAD"NAME",8`
  → `RUN` command line, a border-color-cycling loading-screen flicker, and
  the same DICT full-screen program as `dos/`. `vendor/c64/` holds the real
  C64 Pro Mono font (`@font-face`-embedded, style64.org, unmodified/
  original filenames per their license) — no framework, though; see
  "Prospective themes" below for why.
- **`nes/`** — an NES cartridge, not a desktop. A title screen (PRESS
  START), a file-select menu, then full-screen OQ! / DECON takeovers —
  the same single-tasking reasoning `dos/` and `c64/` already use, because
  a real NES never had overlapping windows. Built on the real
  [`nostalgic-css/NES.css`](https://github.com/nostalgic-css/NES.css)
  v2.2.1 (MIT), vendored as its published `css/nes.min.css` dist build
  (the GitHub tree is SCSS; npm/unpkg ship the compiled CSS), plus Press
  Start 2P (SIL OFL, the font NES.css itself recommends) at
  `vendor/nes/fonts/` rather than a runtime Google Fonts import. D-pad /
  A / B / Start on an on-screen pad (and keyboard arrows / Enter / Esc)
  drive the same `handleInput()` path; OQ! and DECON reuse
  `shared/router.js` / `shared/dict-source.js` / `shared/hyphenation.js` /
  `shared/decon-app.js` with `?screen=oq&filter=...` /
  `?screen=decon&word=...&order=...`. An undocumented Konami code on the
  title screen is this theme's `DOOM` / Hot Dog Stand: a GAME OVER /
  CONTINUE? screen that claims 30 lives. Square-wave bloops and a looping
  title/menu chiptune are synthesized in `nes/app.js` from pulse/triangle/
  noise (no sample pack, nothing ripped from a Nintendo soundtrack). The
  title loop keeps playing at a lower level on the menu and in OQ!/DECON
  rather than dying the moment PRESS START is hit.
- **`gb/`** — an original Game Boy (DMG-01), not a desktop and not the
  NES living-room TV. The brick is the computer: olive 4-shade LCD up
  top, D-pad / A / B / Select / Start molded into the same piece of
  plastic. No drop-in CSS component library exists for this (the GitHub
  "gameboy.css" hits are CSS-art of a whole brick, not a kit), so the
  chrome is hand-drawn the same way `c64/` is. Press Start 2P is reused
  from `vendor/nes/fonts/` rather than duplicated. Same
  `handleInput()` / router / OQ! / DECON / Konami path as `nes/`.
- **`shared/` — theme-agnostic code any prototype can reuse:
  `dict-source.js` (fetch/cache/filter the live Oqaasileriffik dictionary
  data), `hyphenation.js` (real Kalaallisut syllabification, MPL-2.0 —
  see License below), and `router.js` (a tiny query-string router for
  shareable-state URLs, e.g. `dos/index.html?screen=dict&filter=word`
  opens straight into DICT.EXE pre-filtered).
- **`win98/`** — a Windows 98 desktop (`win98/index.html`'s `#desktop`):
  boots to a bare desktop, same as the real thing — no windows open, an
  empty taskbar apart from Start/clock, until the visitor opens one. A
  taskbar with a real Start menu, desktop icons that open windows on click
  (single-click on touch, real double-click on a mouse/trackpad), and
  windows that drag by the title bar and resize from any edge or corner
  (not just the bottom-right growbox `mac1984/`/`dos/` have), with real
  minimize/maximize/close via the title bar's own button trio and a
  live-updating taskbar clock. **OQ!** is the one window with a real app
  behind it — a Kalaallisut dictionary lookup, reusing
  `shared/dict-source.js` and `shared/hyphenation.js` the same way `dos/`'s
  DICT.EXE does, with clickable/tappable result rows highlighted in
  98.css's own real selection color (navy/white); My Computer/About
  retr-oq/Recycle Bin stay chrome-only on purpose, same as `mac1984/`'s own
  icons with no window content behind them. A real Settings window
  (Start menu > Settings) holds one working applet, Display, opening a
  Display Properties dialog -- also reachable by right-clicking the bare
  desktop for its own Properties item, mouse-only since there's no real
  right-click gesture on touch; Settings is the touch-reachable path to
  the same dialog. Its Scheme dropdown includes a genuine, if famously
  ugly, built-in Windows 98 color scheme (**Hot Dog Stand**, ketchup red
  and mustard yellow) deliberately not listed anywhere more obvious than
  that dropdown, same idea as `dos/`'s undocumented `DOOM` command below.
  The Start button's flag is the real Greenlandic
  flag, not a Windows-logo stand-in. Shut Down sends the
  visitor back to this repo's own theme picker (`../`).
- **`tests/`** — `win98/`'s own Playwright/pytest regression suite
  (`test_win98.py`, shared fixtures in `conftest.py`), wired into GitHub
  Actions on every push/PR touching `win98/` — see `CLAUDE.md`'s Testing
  section for how to run it locally and how this fits the "no CI" framing
  above (that's about staying out of *oq's* CI, not about this repo never
  having any of its own).
- **`win7/`** — a Windows 7 (Aero) desktop, the third member of the
  "Redmond" window-chrome family alongside `win98/` and `xp/`, sharing the
  same `shared/redmond/window-manager.js` drag/resize/focus/minimize/
  maximize/close/taskbar/desktop-icon/Start-menu behavior and the same
  `shared/router.js`-backed OQ!/DECON window state. Built on the real
  [`khang-nd/7.css`](https://github.com/khang-nd/7.css) v0.21.1 (MIT),
  vendored as its published `dist/7.css` build the same way `win98/`
  vendors `98.css`'s dist build — it ships no external font files, unlike
  `win98/`, since its `--w7-font` stack is entirely system fonts (Segoe
  UI/Noto Sans). The distinctive, genuinely new work here is Aero's glass
  look, which no vendored framework actually supplies: title bars and the
  taskbar use `backdrop-filter: blur()` layered over a semi-transparent
  gradient (so a browser without `backdrop-filter` support still reads as
  glassy, just without the live blur), plus a diagonal glossy highlight
  sweep and soft drop shadows, replacing 98/XP's flat pixel bevels
  entirely. The Start button is a real circular Aero "orb" (inline SVG,
  the four Windows-flag quadrant colors with a glass highlight) rather
  than 98/XP's rectangular pill — genuinely new art, since a rectangular
  Start button doesn't translate to a circle. Taskbar buttons are
  icon-only (no text label next to the glyph), a deliberate divergence
  from `win98/`'s and `xp/`'s labeled-button convention, following real
  Windows 7's own default rather than matching its siblings for
  consistency's sake (the real title stays in the DOM, visually hidden
  rather than removed, so it's still available to assistive tech). The
  desktop background is a from-scratch inline SVG evocation of Windows
  7's real default wallpaper, "Harmony" — a dark blue-to-black gradient
  with soft glowing abstract swirl shapes — not a copy of the actual
  Microsoft-licensed artwork, same precedent `xp/`'s own Bliss evocation
  set for its wallpaper.
- **`mac8/`** — a Mac OS 8.1 (Platinum) desktop. Mac-lineage, not part of
  the "Redmond" family `win98/`/`xp/`/`win7/` share
  (`shared/redmond/window-manager.js`): a top menu bar instead of a
  taskbar, a single close box and zoom box in the title bar's corners
  instead of min/max/close buttons, and its own from-scratch drag/resize/
  focus/menu-bar logic in `mac8/app.js`, adapted in spirit from
  `mac1984/app.js`'s own approach rather than sharing code with it (same
  explicit "don't touch or share code with `mac1984/`'s own bespoke
  window logic" rule this repo already applies to that theme). Built on
  the real [`npjg/classic.css`](https://github.com/npjg/classic.css)
  (MIT, vendored at `vendor/mac8/base.css` plus its `fonts/` — the real
  public-domain ChicagoFLF TrueType font — and `img/` — the desktop
  stipple pattern and a bomb icon). classic.css itself ships only a
  single fixed-size window primitive (`.content`/`.inner`/`.title`/
  `.control-box`/`.command_button`) and the desktop background pattern —
  no menu bar, no desktop icons, no floating/resizable windows, so all of
  those are this theme's own CSS on top, the same "override the box
  model, keep the vendored surface" split `mac1984/style.css` makes
  against its own framework. Windows resize from a single bottom-right
  growbox only, not the omnidirectional edge handles `win98/`/`xp/`/
  `win7/` share — the real Mac OS 8.1 Finder never offered edge-drag
  resizing, only that one striped corner box — and the zoom box toggles
  between the window's current dragged/resized rect and one filling the
  desktop, restoring the exact prior rect on a second click (the real
  classic zoom-box behavior, not a fixed "maximized" size). Desktop icons
  (Macintosh HD, OQ!, DECON, About This Computer, Trash) are hand-drawn
  inline SVGs rather than reused Windows-theme shapes — Mac OS 8.1's own
  icon language is more colorful/detailed than Windows 9x's flat glyphs,
  and only five icons were needed here. OQ!/DECON reuse
  `shared/router.js`/`shared/dict-source.js`/`shared/hyphenation.js`/
  `shared/decon-app.js` exactly as every other theme does, with the same
  `?screen=oq&filter=...`/`?screen=decon&word=...&order=...` URL scheme.

## Prospective themes

Shipped so far: **1984 Mac** (`mac1984/`), **DOS** (`dos/`),
**Commodore 64** (`c64/`), **NES** (`nes/`), **Game Boy** (`gb/`), **Windows 98** (`win98/`),
**Windows XP** (`xp/`), **Windows 7** (`win7/`), and **Mac OS 8.1**
(`mac8/`), all above.
`c64/` is a deliberate exception to
the "vendor a real framework" pattern the other two follow: the candidate
named below (`bootstrap-c64`) ships no `LICENSE` file at all, which fails
this repo's own vendoring bar, and what it does have is a thin
jQuery+Bootstrap skin with no disk-list/loading-screen pieces anyway.
`c64/style.css` is hand-written from scratch instead — a real C64 screen is
mostly just a monospace grid, a 16-color palette, and a border, not much of
a framework to begin with. The real PETSCII font, C64 Pro Mono
([style64.org](https://style64.org/c64-truetype)), IS vendored though, at
`vendor/c64/fonts/` with `vendor/c64/LICENSE.txt` copied verbatim from their
distribution zip (their license permits unmodified, original-filename
`@font-face` embedding — same `vendor/<theme>/LICENSE.txt` pattern
`vendor/mac1984/` and `vendor/dos/` use, it just took getting the actual
zip in hand to find they ship a real license file, not just a license
page).
`c64/`'s command line follows the real two-step BASIC/KERNAL idiom —
`LOAD"DICT",8` reports success but does nothing on its own; `RUN` is what
actually starts whatever was last loaded, with the genuine
`?SYNTAX ERROR`/`?FILE NOT FOUND ERROR` messages BASIC gave for the wrong
one alone or an unknown name. `LOAD"$",8` + `LIST` reprints the disk
directory, same idempotent idea as `dos/`'s own `DIR`.

DOS is built on the real `kristopolous/BOOTSTRA.386` v4.4.1 (Apache 2.0,
cloned from source — the only npm distribution of it is an unofficial
third-party mirror, not something to vendor sight-unseen), which ships a
genuine DOS-EGA reskin of Bootstrap 4 plus the real Px437 IBM EGA8 font,
not a hand-rolled approximation. Unlike `mac1984/`'s smooth pixel dragging
(a GUI convention), `dos/` windows move and resize in whole character-cell
steps only — text mode never had anything in between, so free pixel
dragging on top of a text-mode skin would be a lie, not a period-accurate
feel.

`dos/` also has a working command line at the `A:\OQ>` prompt: `DICT`
(launches DICT.EXE, with real DOS-style `/?` and `/F:word` switches),
`DIR`, `CLS`, `VER`, `DOSKEY`, `FORMAT` (harmless — there's no real drive
behind it), and a `DOOM` Easter egg (not listed in `DIR`'s own output)
that prints the real DOS/4GW pre-386 protected-mode fatal error DOOM
actually gave on anything below a 386. DICT.EXE's own state (open/closed,
current filter) round-trips through the URL via `shared/router.js`, so
`dos/index.html?screen=dict&filter=nuna` is a real shareable link, not
just a starting point. Text entry has autocorrect/autocapitalize/
spellcheck off throughout, and the full-screen `.dos-dir`/`.dos-app`
takeovers track `window.visualViewport` so the mobile on-screen keyboard
shrinks them instead of covering the prompt.

**Noted, not yet built:** `dos/`'s overlapping draggable windows are
period-accurate *inside* a single Turbo Vision-style app (Turbo Pascal
IDE, DOS Navigator), but that's not how DOS itself launched separate
programs — there was no desktop, no icons, and no persistent view
underneath a running app (DOS was single-tasking; a program took the
whole screen, and exiting it returned to whatever launched it). The
authentic way to *get into* one of these window-based apps would be a
Norton Utilities Batch Enhancer (`BE.EXE`)-style launcher: a boxed,
numbered menu, keypress-to-select, full clear-and-redraw on launch —
closer to a modal takeover than an icon grid. Not built yet.

`win98/` is built on the real [`jdan/98.css`](https://github.com/jdan/98.css)
v0.1.21 (MIT), vendored as its published `dist/98.css` build rather than
its raw `style.css` source — the source relies on a `svg-load()` build-time
function (from the framework's own `build.js`/PostCSS pipeline) to inline
its icon SVGs, and this repo takes "no real build step" (see the Hard
rules above) as a constraint on itself too, not just its own theme code.
The published dist build already has every icon inlined as a `data:` URI,
so it drops in as a plain `<link>` the same as any other vendored
stylesheet; only the two woff/woff2 font files stayed external, copied
into `vendor/win98/fonts/` alongside it.

The rest of the original list, roughly in the order they'd be worth doing
— each needs its own adapter work (the framework's class names/markup
shape almost never match what a page's real markup uses, `mac1984/` and
`dos/` are the templates for that), and a license/bundle-size check at
vendoring time since none of these have been vendored yet:

| Theme | Framework | License (unverified until vendored) |
| --- | --- | --- |
| Modern macOS | [`Puppertino`](https://github.com/brayanjeshua/Puppertino) | check upstream |
| Norton Commander | *no drop-in CSS framework found* — closest is [`victorantos/NC`](https://github.com/victorantos/NC), a full JS file-manager clone, not a CSS library. Would likely need to be hand-built from the 8x16 DOS box-drawing look, closer to how `mac1984/`'s desktop icons/menu bar were added on top of `@sakun/system.css`. |
| Windows 3.1 | *no drop-in CSS framework found* — closest is [`karol-kiersnowski/win31`](https://github.com/karol-kiersnowski/win31), a full simulator, not a CSS library. Same situation as Norton Commander. |

## License

MIT (`LICENSE`) for this repo's own code. Each `vendor/<theme>/` carries
its own license file from its actual upstream project (third-party code,
kept separate on purpose) — `vendor/mac1984/LICENSE.txt` is
`@sakun/system.css`'s own MIT license, copied verbatim, and
`vendor/win98/LICENSE` is `jdan/98.css`'s own MIT license, likewise
copied verbatim, `vendor/win7/LICENSE` is `khang-nd/7.css`'s own MIT
license, also copied verbatim, and `vendor/mac8/LICENSE` is
`npjg/classic.css`'s own MIT license, likewise copied verbatim (confirmed
via its actual GitHub `LICENSE` file, resolving the "check upstream" this
README carried for it before it was vendored), `vendor/nes/LICENSE` is
`nostalgic-css/NES.css`'s own MIT license, likewise copied verbatim, and
`vendor/nes/fonts/OFL.txt` is Press Start 2P's own SIL OFL (a different
license from the framework, kept next to the TTF on purpose).

`shared/hyphenation.js` is the one file in this repo under a different
license than the rest of its own code: MPL-2.0, not MIT. To be precise
about what that covers — the underlying Kalaallisut syllabification rules
are linguistic facts published by Oqaasileriffik, not copyrightable and
not under any stated license either way. What's actually MPL-2.0 is the
*code*: this file is a classic-script port of `jandahl/oq`'s
`docs/hyphenation.js`, a specific copyrightable implementation of those
rules, and a Modification of MPL-2.0 Covered Software carries the same
license as the original. An unmodified copy of the upstream file lives at
`vendor/oq-hyphenation/hyphenation.js` alongside its own `LICENSE.txt` for
provenance.
