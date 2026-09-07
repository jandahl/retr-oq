# beos/ — internal notes

See root `CLAUDE.md` → Theme invariants → `beos/`. Own WM (`app.js`,
not Redmond). Yellow title *tab* (not a full-width bar), Deskbar in the
upper right, double-click the tab to hide (there is no minimize
gadget). Close is a square with a hollow circle on the left of the tab;
zoom is a square-in-a-square on the right. Font is TeX Gyre Heros from
`vendor/next/fonts/`, not Swiss 721.

- The tab slant is adapted from NovusGFX/retro-design-system
  `styles/07-beos` (MIT) — see `vendor/beos/`. Palette is R5, not
  theirs: desktop `#336698`, tab `#FFC000`, chrome `#D8D8D8`.
- No Be logo, no Haiku leaf. Deskbar menu button is a yellow rectangle
  with an original concentric-ring mark.
- Deskbar is three strips: yellow Be menu, darker Status View (workspaces
  replicant, Pulse, clock, gripper), then the application list. Clock
  click flashes the date. Gripper click toggles compact; drag toward
  the bottom docks the Deskbar along the bottom edge.
- Clicking a Deskbar app opens the App Menu (the window, Hide, Show,
  Close) rather than just focusing — same as R5.
- Four workspaces. Replicant in the Status View, or Window → Workspaces,
  or Alt+1..4. Windows remember which workspace they were opened on.
  Speedlines on a Deskbar item mean that window lives on another workspace.
- Twitcher is Control-Tab (hold Control, tap Tab). Team Monitor is
  Control-Alt-Delete. Alt+W closes the front window.
- Hide (double-click tab) is UI state, not URL state — same as NeXT
  miniaturize. Closing OQ!/DECON still goes through `OqRouter`.
- Desktop icons: click selects, double-click opens. Coarse pointers
  (touch) open on a single tap. Icons drag; Clean Up snaps to a column.
- Tracker is a list view (Name / Size / Kind) with File / Window menus.
- `html, body { position: fixed }` — iOS will otherwise scroll the
  document to a focused field. Inputs are ≥ 16px.
- Drag starts only after the pointer has actually moved; move/up are
  on `window` (CLAUDE.md Pointers).
- Shift-drag the tab along its own window to slide the tab (R5
  WindowShade-less tab parking). Regular drag moves the window.
- Kernel debugger is an undocumented egg (`panic` / `debugger` /
  `kernel` in Terminal). Overlay uses `.is-on`, not the `hidden`
  attribute — the UA `[hidden] { display: none !important }` would
  otherwise swallow it.
