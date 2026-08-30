# dos/ — internal notes

Quick orientation for future edits. See root `CLAUDE.md` → Theme invariants
→ `dos/` for the authoritative constraints (single-tasking swap via
`hidden`, character-grid snapping, `--app-height`/`--app-top` viewport
math, router-only launch/exit). This file is just the extra detail that
doesn't fit there.

- Command line lives in `app.js`'s `runCommand(line)` (~line 585). Add new
  commands as another `else if (cmd === "X")` branch — `cmd` is already
  uppercased and `.EXE`-stripped-aware (checks both `"DICT"` and
  `"DICT.EXE"`).
- `EXIT` (added for the "quit to hub" request) sends
  `window.location.href = "../"` — no confirmation dialog, unlike win98's
  Shut Down. There's no COMMAND.COM shell underneath to return to, so this
  is the one-shot way back to the hub.
- `BUILD`/`DECON` in the `DIR` listing are placeholders — `DECON` itself
  the command works and opens the real Deconstructor via
  `window.OqRouter.navigate`, but the identically-named DIR *entry* text is
  cosmetic only.
- `DOOM` is a real command (undocumented on purpose — don't add it to any
  visible help text or `DIR` listing).
