# mac1984/ — internal notes

See root `CLAUDE.md` → Theme invariants → `mac1984/` (System 1.0 look via
vendored `system.css`, own WM — don't share with `mac8/` or Redmond).

- No `#desktop` element like the other own-WM themes (`mac8/`, `next/`,
  `kde/`) — the whole `<body>` is the desktop. Right-click capture is on
  `document.body`, with an escape hatch for `.window-pane` content so
  scrollable window bodies keep their native menu.
- Menu bar items are almost all placeholders (`href="#"`, real MS
  `preventDefault()` + `closeMenu()` only) — see the comment above the
  link-click loop in `app.js`. **Special → Shut Down** is the one wired
  exception: it has `id="mac1984-shutdown"` in `index.html` and its own
  branch in that loop that navigates to `../` instead of no-opping. Any
  other menu item you wire up for real should follow the same pattern
  (give it an id, special-case it in that loop) rather than genericizing
  the placeholder handler.
- **Special → Restart** is still a placeholder — not wired to a page
  reload. Wire it the same way as Shut Down if that's ever wanted.
- Windows (`.desktop-window`) use `.title-bar`/`.inactive-title-bar` class
  swapping as the entire activation mechanism — there's no separate
  "active window" state to keep in sync elsewhere.
