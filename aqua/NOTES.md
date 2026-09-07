# aqua/ — internal notes

Early OS X **Aqua** (roughly 10.0–10.4 / 2001). Shell behavior lives in
`shared/osx/`; this directory is mostly skin + thin wiring.

See root `CLAUDE.md` → Families → OS X (`shared/osx/`).

## Directory name

Chose `aqua/` (not `osx/`) so a later Tiger / Leopard skin can sit beside
it without renaming. Year on the hub is **2001** (Cheetah / early Aqua).

## Vendor CSS search (2026-09)

Looked for a 98.css-style static Aqua kit (permissive license, ready
dist CSS, no SCSS-only, period-correct early Aqua, original art):

| Candidate | License | Verdict |
| --- | --- | --- |
| [willmeyers/aqua-ui](https://github.com/willmeyers/aqua-ui) (`website/aqua.css`) | MIT (code) | **Rejected for this repo.** Dist embeds Lucida Grande from “the original suitcase” and many PNG data-URIs the project itself notes are derived from Apple artwork. Conflicts with retr-oq’s original-art / no-trademark bar. |
| [thatdhruv/aqua2](https://github.com/thatdhruv/aqua2) | MIT | Controls-only; CSS injected via a single JS file — not a static vendor dist. Modern reimagining, not 2001 chrome. |
| [febLey/aqua.css](https://github.com/febLey/aqua.css) | WTFPL | Joke stylesheet (`color: aqua !important` everywhere) — not OS X chrome. |
| [codedgar/Puppertino](https://github.com/codedgar/Puppertino) | MIT | Modern macOS HIG — wrong era. |
| NovusGFX `styles/04-aqua-osx` | MIT (already used for BeOS tab slant) | Partial tokens only — not a full window/menubar/Dock kit. |

**Result:** hand-rolled `aqua/style.css` + original SVG icons. Behavior
still shared via `shared/osx/`. Font: TeX Gyre Heros from
`vendor/next/` (same Lucida/Helvetica stand-in `next/` and `beos/` use).

## Shared vs skin

| Shared (`shared/osx/`) | Theme (`aqua/`) |
| --- | --- |
| WM: drag, growbox, focus, open/close/min/zoom | Jelly traffic lights, pinstripe, window chrome CSS |
| Menu bar open/hover/close | Menu labels, Apple-menu substitute mark |
| Dock launch + running/bounce classes | Dock glass art, icons, magnification CSS |
| Menu clock | Placement in menubar |

## Gotchas

- **No Apple mark.** Leftmost menu uses an original abstract “system”
  glyph (concentric arcs), not an apple silhouette.
- **Traffic lights** stay on the left (close / minimize / zoom). Inactive
  windows mute them via `.inactive` — early Aqua grayed the jewels.
  Active titlebar hover reveals × − + via CSS `::before` (no glyph art
  assets).
- **Dock magnify** is theme JS in `app.js` (pointer-distance cosine
  falloff on `#dock`). Shared `OqOsx.initDock` stays launch/running/
  bounce only. `prefers-reduced-motion` skips continuous magnify and
  keeps a mild CSS hover (or none).
- **Genie minimize** uses optional WM `onMinimizeAnimating(win, finish)`
  — aqua animates toward the matching Dock icon, then `finish()` applies
  `.minimized`. Reduced motion = instant hide. Approximation only (no
  Core Graphics mesh).
- **Shut Down sheet** (`#shutdown-overlay .osx-sheet`) hangs under the
  menu bar (top-aligned overlay + flat-top dialog), not a centered
  modal.
- **Minimize** hides the window (`.minimized`) and leaves a running dot
  on the Dock item; click the Dock icon to restore. Not a Redmond
  taskbar button.
- **Zoom** toggles the prior rect (Finder-style), not a permanent
  maximize — same idea as mac8’s zoom box, implemented in
  `OqOsx.initWindowManager`.
- **Resize** is growbox-only in this skin (`resizeMode: "growbox"`).
  Later OS X skins can pass `"edges"` or `"both"`.
- **OQ!/DECON** only open/close through `window.OqRouter.navigate` —
  `routeOpen` / `routeClose` in `app.js`.
- **Cache-bust** `?v=N` on every local file you change.
- Touch: inputs ≥ 16px; `html, body { position: fixed }` to stop iOS
  document scroll on focus.

## What Tiger / Leopard should override

- Unified toolbar / metal window variants (CSS only)
- Reflective Dock, Stacks, Spaces (theme JS + CSS; keep calling
  `OqOsx.initDock`)
- Graphite appearance (swap CSS variables)
- Keep `shared/osx/` APIs stable — do not fork the WM for chrome alone.
