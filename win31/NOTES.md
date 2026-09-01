# win31/ — internal notes

See root `CLAUDE.md` → Theme invariants → `win31/`. Redmond WM shared with
`win98/`/`xp/`/`win7/` via `shared/redmond/window-manager.js` — Program
Manager is the shell here, closing it is Exit Windows (→ `../`). No Start
menu, no taskbar, no title-bar close button — minimize is an icon on the
teal desktop, close lives only in the Control-menu (double-click the box).

- Desktop right-click is suppressed for the bare desktop background by
  `initWindowManager()` itself (`shared/redmond/window-manager.js`), same
  as every other Redmond theme — no theme-specific code needed for that
  here.
- Font is reused from `vendor/win98/fonts/`, not its own vendor dir.
- Solitaire is a joke entry (not a real game) and there are hidden
  credits — undocumented beyond this pointer.
- Don't add a title-bar close "for touch" — see `CLAUDE.md`, this is a
  deliberate period-accurate omission, not a bug.
- Screen saver is the Flying Windows remake under `vendor/screensavers/flying-windows/` (MIT; gag four-pane mark). Idle 45s, or Accessories → Screen Saver.
