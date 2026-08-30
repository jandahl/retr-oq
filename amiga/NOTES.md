# amiga/ — internal notes

See root `CLAUDE.md` → Theme invariants → `amiga/`. Chrome is exactly four
Kickstart 1.3 pens (`#0055AA`, white, black, `#FF8800`) — a fifth chrome
color, or flattening painted art to four pens, is a bug, not a variant.
Own WM; depth gadget acts as to-back, not close. Font is TopazPlus a500,
not system monospace.

- Screen clock (`#screen-clock`) is already 24-hour (`HH:MM:SS` via plain
  `getHours()`, no AM/PM branch) — this was the one digital clock in the
  repo that didn't need the 24-hour-preference fix applied to the other
  themes; don't "fix" it to add AM/PM.
- Boing Ball and copper bars are 12-bit OCS art — real hardware fidelity,
  not a style approximation, so keep any edits within that palette.
- No quit-to-hub UI currently wired here; Workbench 1.3 has no real
  concept of one on this hardware, so this is consistent with the source
  material rather than an oversight.
