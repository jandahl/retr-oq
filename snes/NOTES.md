# snes/ — internal notes

See root `CLAUDE.md` → Theme invariants → `nes/`/`gb/`/`snes/`/`gg/`. This
is PAL Super Nintendo specifically: gray dogbone controller, rainbow
Y/X/B/A face buttons (not the NA purple toaster shell), X=A / Y=B /
L=Select / R=Start mapping. Title wordmark is Super (TeX Gyre Heros
italic) + OQ! (Press Start 2P). Audio is sampled + echo at a high clip —
not NES-style pulse/triangle/noise, despite sharing a family row in
`CLAUDE.md`.

- No quit-to-hub UI — console family, see `nes/NOTES.md`.
- Super KAL-Q! (Klax-alike) and Konami Code both live here.
- `tools/check_palette.py` GAMUT does *not* single this theme out the way
  it does `c64/`/`gb/` — SNES's real gamut is dense enough that FAMILY
  (RGB-distance against the theme's own declared palette) is the only
  check that runs.
- `tests/test_snes.py` runs in CI when this theme changes.
- In-LCD attract (45s idle, Mode 7 checkerboard on `#attract-canvas` inside `#snes-tv` only — PAL dogbone stays). Any `handleInput` / pad / key dismisses. Pauses on `document.hidden`. `prefers-reduced-motion` freezes the camera. Silent.
