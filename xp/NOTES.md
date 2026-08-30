# xp/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win98/`/`xp/`/`win7/`. Redmond
WM via `shared/redmond/window-manager.js`. XP.css dist build vendored.

- Taskbar clock (`#taskbar-clock`) respects the browser's 24-hour
  preference the same way `win98/`'s does — see `win98/NOTES.md` for the
  detection detail, don't hardcode 12-hour AM/PM here again.
- Bare-desktop right-click is suppressed by `initWindowManager()` in
  `shared/redmond/window-manager.js`; this theme has no custom context
  menu of its own layered on top (unlike `win98/`).
- Shut Down → `../`, same reference pattern as `win98/`.
