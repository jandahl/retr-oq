# retr-oq

Retro desktops for a [Kalaallisut dictionary](https://github.com/jandahl/oq).
One static theme per directory, no build step, GitHub Pages.

Spun out of oq's "Fun Themes" so oq's CI doesn't run for a pixel shift
on a desktop icon, and so this can't break the dictionary PWA. Neither
repo imports the other. Frozen glue from that split lives in
`oq-integration/` (not wired). How to edit: `CLAUDE.md`.

## Themes

`index.html` is the hub — machine icons, launch year, oldest first.
Each theme hosts OQ! / DECON via `shared/` (`?screen=oq&filter=`).
Each theme directory also has its own `NOTES.md` — implementation
gotchas and wiring specific to that theme, meant to save an LLM (or a
person) from rediscovering them; `CLAUDE.md`'s Theme invariants section
stays the cross-theme source of truth.

| Year | | |
| ---: | --- | --- |
| 1981 | [`dos/`](dos/) | COMMAND.COM + DICT.EXE. [BOOTSTRA.386](https://github.com/kristopolous/BOOTSTRA.386) |
| 1982 | [`c64/`](c64/) | `LOAD"$",8` / `RUN`. Hand-drawn; C64 Pro Mono |
| 1984 | [`mac1984/`](mac1984/) | System 1.0. [`system.css`](https://github.com/sakofchit/system.css) |
| 1985 | [`nes/`](nes/) | Title → file select → OQ!. [NES.css](https://github.com/nostalgic-css/NES.css); Web Audio APU |
| 1988 | [`amiga/`](amiga/) | Workbench 1.3. Four-pen chrome, OCS art, TopazPlus |
| 1989 | [`gb/`](gb/) | DMG-01 brick. Hand-drawn; Press Start 2P from `vendor/nes/` |
| 1990 | [`gg/`](gg/) | Game Gear. Pocket Master System: 160×144, 32/4096. Landscape; 1/2, no Select |
| 1991 | [`snes/`](snes/) | Super Nintendo (PAL). Gray dogbone, rainbow YXBA, Super OQ! wordmark |
| 1992 | [`win31/`](win31/) | Program Manager. Redmond WM; no Start, no X |
| 1995 | [`next/`](next/) | NeXTSTEP 3.3 Workspace. Four grays, dock, TeX Gyre Heros |
| 1998 | [`mac8/`](mac8/) | Mac OS 8.1 Platinum. [`classic.css`](https://github.com/npjg/classic.css) |
| 1998 | [`win98/`](win98/) | 98 desktop. [`98.css`](https://github.com/jdan/98.css) dist |
| 2001 | [`xp/`](xp/) | XP desktop. [`XP.css`](https://github.com/botoxparty/XP.css) dist |
| 2006 | [`kde/`](kde/) | KDE 3.5 + Compiz. Hand-drawn Plastik; canvas compositor |
| 2009 | [`win7/`](win7/) | Aero. [`7.css`](https://github.com/khang-nd/7.css) + glass |

Not yet: modern macOS, Norton Commander.

## Games

Every theme has OQ!/DECON; some also carry a real minigame, a visual/
audio demo, or an easter egg. Source of truth: `shared/games.js`.

| Theme | Extra games / demos / eggs |
| --- | --- |
| `dos/` | DOOM (undocumented egg) |
| `c64/` | MORPH! |
| `mac1984/` | — |
| `nes/` | Konami Code |
| `amiga/` | Boing Ball, Copper bars |
| `gb/` | MORPH!, Konami Code |
| `gg/` | Konami Code |
| `snes/` | Super KAL-Q! (Klax), Konami Code |
| `win31/` | Solitaire (joke), hidden credits |
| `next/` | Kernel panic (undocumented egg) |
| `mac8/` | — |
| `win98/` | Hot Dog Stand scheme |
| `xp/` | — |
| `kde/` | Compiz rain, desktop cube |
| `win7/` | — |

**`shared/`** — `dict-source.js`, `hyphenation.js`, `router.js`,
`decon-app.js`, `redmond/window-manager.js` (win31/98/XP/7),
`art/fox/` (MORPH! mascot source: first-gen illustrations + 128px
hires frames — not GB-locked; theme sprites stay in the theme dir).

**`vendor/<theme>/`** — upstream dist + LICENSE, not SCSS sources.
**`tests/`** — Playwright/pytest for `win98/`, `nes/`, `gb/`, `snes/`, `gg/`.

## License

MIT for this repo. Each `vendor/<theme>/` keeps its upstream license
next to the files (system.css, 98.css, 7.css, classic.css, NES.css,
BOOTSTRA.386, C64 Pro Mono, TopazPlus GPL-FE, TeX Gyre Heros GFL,
DejaVu, html2canvas, Press Start 2P OFL).

`shared/hyphenation.js` is MPL-2.0: the *code* is a port of
`jandahl/oq`'s `docs/hyphenation.js`. The syllabification rules
themselves are linguistic facts. Provenance copy:
`vendor/oq-hyphenation/`.
