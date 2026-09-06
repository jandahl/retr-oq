# Internal guidance: implementing a new theme

Use this checklist with the root `README.md` (catalogue) and `CLAUDE.md`
(cross-theme invariants). Each theme is an independent static GitHub Pages
entry point, not a component in a shared UI framework.

## Choose the right family

| Shape | Examples | Contract |
| --- | --- | --- |
| Redmond desktop | `win31/`, `win98/`, `xp/`, `win7/` | Use `shared/redmond/window-manager.js` |
| Mac-lineage desktop | `mac1984/`, `mac8/`, `amiga/` | Own window manager per theme |
| Own window manager | `next/`, `kde/` | Keep WM behavior local |
| Text mode | `dos/`, `c64/` | Single-tasking/full-screen; no overlapping windows |
| Console | `nes/`, `gb/`, `snes/`, `gg/` | One screen and one central `handleInput()` |

Before coding, record the period/hardware target, display geometry, font,
palette, controls, shell metaphor, and asset/licensing needs. Do not mix
window managers or interaction models across families.

## Required anatomy

```text
<theme>/
  index.html       # complete static entry point
  style.css        # theme layout and chrome
  app.js           # behavior and event wiring
  NOTES.md         # gotchas and deliberate exceptions
  art/             # optional original/theme-sized art
```

Keep theme-specific CSS and JavaScript in the theme directory. Reuse
`shared/` only where its contract applies. Load dependencies in order, use
relative paths, and cache-bust every changed local file (`?v=N`), including
HTML, CSS, JS, compositor code, and shared assets.

Prefer reuse when the behavior is truly common: extend an existing shared
helper or pattern before copying it into a new theme. Good reuse candidates
include `shared/dict-source.js`, `shared/hyphenation.js`, `shared/router.js`,
`shared/decon-app.js`, the Redmond window manager, shared game engines, shared
screen savers, and the test fixtures. Keep the integration boundary narrow and
document any theme-specific adapter. Do not force reuse merely to eliminate a
few lines when it would couple different window managers, palettes, input
models, or historical behaviors.

OQ!/DECON must remain reachable through `window.OqRouter.navigate(...)` so the
URL and UI stay synchronized. Use accessible native controls where possible;
inputs must remain usable on touch devices.

## Behavior by family

### Desktop themes

Implement the source system's visible primitives: desktop/shell, menu or
taskbar, icons, windows, title bars, focus, minimize/restore, and quit/back to
hub behavior. Decide explicitly which actions are real and which are
period-accurate placeholders.

Redmond themes configure the shared WM. Other desktop themes implement their
own WM and document its special rules in `NOTES.md` (growbox-only resize,
depth gadgets, miniwindows, or zoom behavior).

For all pointer interactions, listen for move/up on `window`, begin a drag only
after movement, and do not await asynchronous work on the pointer path. Use
arrow cursors for chrome, icons, menus, buttons, and links; compass cursors
only for resize handles. In `zoom: 2` layouts, convert rendered
`clientX/Y`/rect values back to pre-zoom CSS coordinates before assigning
`left`/`top`.

### Text mode

Swap shell and application views rather than stacking windows. Include mobile
keyboard and viewport-height handling. Commands belong in the theme dispatcher;
router listeners own launch and exit transitions.

### Console

Treat the screen as a single state machine. Keyboard input and on-screen
buttons must call the same `handleInput()` path. Do not add desktop windows,
taskbars, or desktop-style quit controls. Keep hardware palette/geometry
separate from shell styling where appropriate. Attract sequences belong inside
the display, dismiss on input, pause when hidden, and honor reduced motion.

## Visuals and assets

- Use original art; do not add trademarked logos or copied branded marks.
- Vendor distributable CSS/font builds under `vendor/<theme>/` with upstream
  `LICENSE`; do not vendor build-dependent SCSS sources.
- Theme-sized sprites belong in the theme directory. Reuse shared mascot art
  only when appropriate.
- Preserve meaningful target palettes. `tools/check_palette.py` checks console
  themes declaring `--<theme>-*` variables; fix gamut failures rather than
  weakening the check.
- Respect whether the target requires pixelated or anti-aliased art, and use
  licensed vendored fonts when they are part of the target.

## Hub and notes

Add the theme to `hub-data.js` with name, year, description, and a directory
URL ending in `/`. Add its catalogue entry to `README.md` (oldest first).

Add `<theme>/NOTES.md`: put stable cross-theme rules in `CLAUDE.md`, and
theme-specific gotchas, hidden behavior, licensing reminders, and deliberate
deviations in the notes. Keep easter eggs out of user-facing copy.

If the theme uses shared or vendored assets, update CI path filters so its
tests run when those dependencies change.

## Validation

```bash
npm ci --ignore-scripts
python3 -m pytest tests/ -v
```

Also run `node --check` on non-vendored JavaScript, `tools/check_css.py`,
`html-validate`, local-link checks with `http.server`/`linkinator`, and the
hub-link check. Exercise keyboard, touch, focus, drag/resize, mobile viewport,
reduced-motion, hidden-tab, routing, and return-to-hub behavior relevant to
the theme.

Add `tests/test_<theme>.py` for meaningful browser interaction and register its
paths in `.github/workflows/theme-tests.yml`. For palette-based consoles,
ensure the family/gamut checker covers the intended scope.

## Branch and PR checklist

Start from the live remote, never a stale local branch:

```bash
git fetch origin master
git switch -c codex/<theme-name> origin/master
```

Before opening the PR, confirm only intended work is present:

```bash
git status --short --branch
git log origin/master..HEAD --oneline
git diff --check
```

Describe the target, family choice, shared code, assets/licenses, cache-bust
changes, tests, and intentional omissions in the PR. Never stack new work on
a just-merged feature branch.
