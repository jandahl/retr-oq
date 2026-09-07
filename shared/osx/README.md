# shared/osx/ — OS X family shell

Reusable behavior for early-to-mid OS X desktop themes (`aqua/` and
future Tiger / Leopard / etc. skins). Analogous to
`shared/redmond/window-manager.js`, but for the Cupertino OS X shell:

- global menu bar (not per-window menus)
- Dock (not a taskbar)
- traffic-light title-bar controls (close / minimize / zoom)
- focus via inactive chrome classes + z-order
- OQ!/DECON routing hooks (`routeOpen` / `routeClose`)

Classic Mac (`mac1984/`, `mac8/`) stay on their own bespoke WMs —
Platinum / System 1 interaction (growbox-only, no Dock) is different
enough that forcing them through this module would fight the
abstraction. See root `CLAUDE.md`.

## Scripts

| File | Global | Role |
| --- | --- | --- |
| `window-manager.js` | `window.OqOsx.initWindowManager` | drag, resize, focus, open/close/minimize/zoom, clamp |
| `menubar.js` | `window.OqOsx.initMenuBar` | menu-bar open/close + hover-switch |
| `dock.js` | `window.OqOsx.initDock` | Dock launch + running-dot helpers |
| (inline helpers) | `window.OqOsx.getZoomFactor`, `initMenuClock` | shared utilities |

Load order in a theme: `dict-source` → `hyphenation` → `router` →
`oq-analysis` (module) → `decon-app` → **these three** → theme `app.js`.

## DOM contract

Themes own the markup and CSS. The shared layer only expects:

```html
<section class="osx-window" id="win-…">
  <header class="osx-titlebar" id="win-…-titlebar">
    <button type="button" class="osx-traffic osx-btn-close" …></button>
    <button type="button" class="osx-traffic osx-btn-minimize" …></button>
    <button type="button" class="osx-traffic osx-btn-zoom" …></button>
    <h1 class="osx-title">…</h1>
  </header>
  <div class="osx-body">…</div>
  <!-- optional resize -->
  <div class="osx-growbox" id="win-…-growbox"></div>
  <!-- and/or edge handles: -->
  <div class="osx-resize" data-dir="e"></div>
  …
</section>
```

State classes (configurable; defaults shown):

- `.inactive` — unfocused chrome
- `.closed` — not on the desktop (hidden)
- `.minimized` — in the Dock only (hidden window; Dock item stays)

## What a future OS X skin should override

Put in the theme directory (not here):

- Chrome CSS (Aqua jelly vs Tiger unified toolbar vs Leopard brushed
  metal / reflective Dock)
- Art / icons / wallpaper (original only — no Apple marks)
- Menu labels and which items are real vs placeholders
- Dock magnification feel, Stacks, Spaces (Leopard+)
- Minimize "genie" animation via optional `onMinimizeAnimating(win, finish)` on the WM (backward compatible; omit = instant hide)
- Fonts (Lucida-like sans; this family reuses TeX Gyre Heros from
  `vendor/next/` unless a theme vendors its own)

Keep calling the same `OqOsx.*` APIs so behavior stays shared.
