# mac8/ — internal notes

See root `CLAUDE.md` → Theme invariants → `mac1984/`/`mac8/`. Own WM, not
shared with `mac1984/` or Redmond, built on vendored `classic.css`. Growbox
resize only (no edge-resize); zoom toggles the prior rect, it isn't a real
maximize.

- Menu-bar clock (`#menu-clock`) respects the browser's 24-hour
  preference — same detection pattern as `win98/`'s taskbar clock, see
  `win98/NOTES.md`.
- Bare-desktop (`#desktop`) right-click now suppresses the native browser
  menu (`app.js`, right after the `desktop`/`windows` consts). No custom
  Mac OS 8 context menu is built yet.
- Analog Clock app (`#win-clock`, `drawClock()`) is a separate thing from
  the menu-bar digital clock above — it draws hour/minute hands via
  `now.getHours() % 12`, which is correct as-is (an analog face has no
  12/24-hour text mode to respect).
- Undocumented teddy-bear About credits live here.
