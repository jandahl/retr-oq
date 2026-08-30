# gg/ — internal notes

See root `CLAUDE.md` → Theme invariants → `nes/`/`gb/`/`snes/`/`gg/`. Game
Gear here means a pocket Master System, not a color DMG: landscape slab,
D-pad left of the LCD, 1/2 right of it, Start under the glass, **no
Select** (Tab still cycles in keyboard mode). VDP chrome is navy/cyan/
magenta/gold on 160×144 cells, with a washed teal LCD-filter overlay that
is a filter, not the UI palette itself.

- No quit-to-hub UI — console family, see `nes/NOTES.md`.
- Reuses Press Start 2P from `vendor/nes/fonts/` (not a Game-Gear-specific
  font vendor dir).
- `tools/check_palette.py` FAMILY check applies to the whole theme here
  (no separate GAMUT check for `gg/`, unlike `c64/`/`gb/`).
- `tests/test_gg.py` runs in CI when this theme changes.
