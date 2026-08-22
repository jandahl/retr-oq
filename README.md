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
- **`shared/`** — theme-agnostic code any prototype can reuse:
  `dict-source.js` (fetch/cache/filter the live Oqaasileriffik dictionary
  data), `hyphenation.js` (real Kalaallisut syllabification, MPL-2.0 —
  see License below), and `router.js` (a tiny query-string router for
  shareable-state URLs, e.g. `dos/index.html?screen=dict&filter=word`
  opens straight into DICT.EXE pre-filtered).
- **`win98/`** — a Windows 98 desktop (`win98/index.html`'s `#desktop`):
  a taskbar with a real Start menu, desktop icons that open windows on
  click (single-click on touch, real double-click on a mouse/trackpad),
  and windows that drag by the title bar and resize from any edge or
  corner (not just the bottom-right growbox `mac1984/`/`dos/` have), with
  real minimize/maximize/close via the title bar's own button trio and a
  live-updating taskbar clock. **OQ!** is the one window with a real app
  behind it — a Kalaallisut dictionary lookup, reusing
  `shared/dict-source.js` and `shared/hyphenation.js` the same way `dos/`'s
  DICT.EXE does; My Computer/About retr-oq/Recycle Bin stay chrome-only on
  purpose, same as `mac1984/`'s own icons with no window content behind
  them. The Start button's flag is the real Greenlandic flag, not a
  Windows-logo stand-in. Shut Down sends the visitor back to this repo's
  own theme picker (`../`).
- **`tests/`** — `win98/`'s own Playwright/pytest regression suite
  (`test_win98.py`, shared fixtures in `conftest.py`), wired into GitHub
  Actions on every push/PR touching `win98/` — see `CLAUDE.md`'s Testing
  section for how to run it locally and how this fits the "no CI" framing
  above (that's about staying out of *oq's* CI, not about this repo never
  having any of its own).

## Prospective themes

Shipped so far: **1984 Mac** (`mac1984/`), **DOS** (`dos/`),
**Commodore 64** (`c64/`), and **Windows 98** (`win98/`), all above.
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
| Windows XP | [`XP.css`](https://github.com/botoxparty/XP.css) | MIT |
| Mac OS 8.1 | [`classic.css`](https://github.com/npjg/classic.css) | check upstream |
| NES | [`NES.css`](https://github.com/nostalgic-css/NES.css) | MIT |
| Windows 7 *(bonus, same family as 98.css/XP.css)* | [`7.css`](https://github.com/khang-nd/7.css) | MIT |
| Modern macOS | [`Puppertino`](https://github.com/brayanjeshua/Puppertino) | check upstream |
| Norton Commander | *no drop-in CSS framework found* — closest is [`victorantos/NC`](https://github.com/victorantos/NC), a full JS file-manager clone, not a CSS library. Would likely need to be hand-built from the 8x16 DOS box-drawing look, closer to how `mac1984/`'s desktop icons/menu bar were added on top of `@sakun/system.css`. |
| Windows 3.1 | *no drop-in CSS framework found* — closest is [`karol-kiersnowski/win31`](https://github.com/karol-kiersnowski/win31), a full simulator, not a CSS library. Same situation as Norton Commander. |

## License

MIT (`LICENSE`) for this repo's own code. Each `vendor/<theme>/` carries
its own license file from its actual upstream project (third-party code,
kept separate on purpose) — `vendor/mac1984/LICENSE.txt` is
`@sakun/system.css`'s own MIT license, copied verbatim, and
`vendor/win98/LICENSE` is `jdan/98.css`'s own MIT license, likewise
copied verbatim.

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
