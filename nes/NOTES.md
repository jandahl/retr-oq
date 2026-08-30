# nes/ — internal notes

See root `CLAUDE.md` → Theme invariants → `nes/`/`gb/`/`snes/`/`gg/`
(console family: no floating windows, keyboard + on-screen pad both call
`handleInput()`, Web Audio-only pulse/triangle/noise, no samples).

- Consoles have no "quit to hub" concept — there's no power/shut-down UI,
  matching a real console (you unplug it, you don't `EXIT` a game). Don't
  add one; if a "back to hub" link is ever wanted here, it should look
  like a title-screen menu option, not a desktop metaphor.
- Screens are swapped via `window.OqRouter.navigate({ screen: ... })`
  (title/file-select/OQ!/DECON/about) — same router, no window manager at
  all.
- Konami Code egg lives here — intentionally undocumented beyond this
  pointer; don't add the actual sequence to any comment or help text.
- `tests/test_nes.py` runs in CI for this theme — check it before
  reworking `handleInput()` or the screen IDs it drives.
