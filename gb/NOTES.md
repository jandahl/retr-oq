# gb/ — internal notes

See root `CLAUDE.md` → Theme invariants → `nes/`/`gb/`/`snes/`/`gg/` and
the `gamut` note under Tests (this theme's 4 DMG screen vars are checked
against the real fixed Game Boy palette, not just family baseline).

- No quit-to-hub UI — console family, see `nes/NOTES.md` for why that's
  by design here.
- Pad art stays on the brick (`sprites/` is 16×16 DMG-sized); don't pull
  in `shared/art/fox/`'s hires frames directly, retarget/resize instead.
- MORPH! and Konami Code both live here — undocumented on purpose beyond
  this pointer.
- `tools/check_palette.py` GAMUT check covers just the four `--gb-*`
  screen vars, not the whole theme (the shell is plastic, not
  gamut-limited) — a gamut failure there means fix the color, not loosen
  the check.
- `tests/test_gb.py` runs in CI when this theme changes.
- In-LCD attract (45s idle): `fox-idle.png` bounces inside `#gb-lcd` only,
  never over the brick/pad. Any `handleInput` / pad press dismisses. No
  Nintendo logo, no audio. Pauses when the tab is hidden.
  `prefers-reduced-motion` parks the fox in a corner.
