# win98/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win98/`/`xp/`/`win7/`. Redmond
WM via `shared/redmond/window-manager.js`. 98.css dist build vendored,
not the SCSS source. Greenlandic flag, not a Windows logo.

- **Shut Down**: Start menu → Shut Down opens `#shutdown-overlay`; its OK
  button navigates to `../`. This is the reference implementation the
  other Redmond themes' Shut Down and `mac1984`'s Shut Down menu item both
  copy the comment/pattern from — keep them in sync if this one changes.
- **Desktop right-click menu**: the *only* deliberately hidden feature in
  this theme — right-clicking bare desktop (not an icon) opens a real
  context menu whose Properties item is the sole path to the color-scheme
  picker (`app.js` ~line 118 onward, `#desktop-context-menu`). The native
  browser context menu itself is now suppressed for every Redmond theme
  by `initWindowManager()` in `shared/redmond/window-manager.js`; this
  theme's own listener runs alongside that and additionally opens the
  real menu.
- Taskbar clock (`#taskbar-clock`) now respects
  `Intl.DateTimeFormat().resolvedOptions().hour12` and falls back to
  24-hour when the browser doesn't expose a preference — don't reintroduce
  a hardcoded 12-hour AM/PM format.
- Hot Dog Stand scheme is a real, selectable Display Properties option,
  not an egg.
- Screen saver idle (45s) is Aquarium (`vendor/screensavers/aquarium/`, MIT,
  original Plus!-style remake). Start → Screen Savers flyout lists Aquarium,
  3D Pipes, 3D Maze, Backrooms (same host injects the flyout on xp/win7).

- **OQ!/DECON chrome:** one main window + **tab strip** (Dictionary ↔ Word Deconstructor), one taskbar button. Desktop + Start entries for both labels still work; `data-open=win-decon` resolves to `#win-oq` with the Deconstructor tab. Router `screen=oq` / `screen=decon` switches tabs.

- **DECON label:** user-visible name is **Word Deconstructor** (desktop icon, titlebar, Start menu; taskbar clones the titlebar text). Ids stay `win-decon` / `screen=decon`.
