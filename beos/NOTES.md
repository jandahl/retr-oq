# beos/ — internal notes

See root `CLAUDE.md` → Theme invariants → `beos/`. Own WM (`app.js`,
not Redmond). Yellow title *tab* (not a full-width bar), Deskbar in the
upper right, double-click the tab to hide (there is no minimize
gadget). Close is the circle on the left of the tab; zoom is the square
on the right. Font is TeX Gyre Heros from `vendor/next/fonts/`, not
Swiss 721.

- The tab slant is adapted from NovusGFX/retro-design-system
  `styles/07-beos` (MIT) — see `vendor/beos/`. Palette is R5, not
  theirs: desktop `#336698`, tab `#FFC000`, chrome `#D8D8D8`.
- No Be logo, no Haiku leaf. Deskbar menu button is a yellow rectangle
  with an original concentric-ring mark.
- Deskbar clock uses the same 24-hour detection as `next/` / `win98/`.
- Hide (double-click tab) is UI state, not URL state — same as NeXT
  miniaturize. Closing OQ!/DECON still goes through `OqRouter`.
- `html, body { position: fixed }` — iOS will otherwise scroll the
  document to a focused field. Inputs are ≥ 16px.
- Drag starts only after the pointer has actually moved; move/up are
  on `window` (CLAUDE.md Pointers).
- Shift-drag the tab along its own window to slide the tab (R5
  WindowShade-less tab parking). Regular drag moves the window.
