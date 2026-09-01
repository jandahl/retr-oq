# win7/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win98/`/`xp/`/`win7/`. Redmond
WM via `shared/redmond/window-manager.js`. 7.css ships no fonts (don't go
looking for a `vendor/win7/fonts/`). Minimize/restore animation style is
explicitly "genie" here (scale+fade toward the taskbar button) — see the
`animation` option passed to `initWindowManager()` — unlike the rest of
the lineage's default "outline" style.

- Taskbar clock (`#taskbar-clock`) respects the browser's 24-hour
  preference the same way `win98/`'s does — see `win98/NOTES.md`.
- Bare-desktop right-click is suppressed by `initWindowManager()`; no
  custom context menu of its own here.
- Shut Down → `../`, same reference pattern as `win98/`.
- 3D Pipes remake (`vendor/screensavers/pipes/`, MIT) on idle (45s) and Start → 3D Pipes.
