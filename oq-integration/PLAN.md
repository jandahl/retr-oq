# Fun Themes — analysis and roadmap

Experimental, opt-in setting that swaps the app's look for a vendored retro
UI skin, ignoring the normal Look and Feel theme and font selections while
enabled. Shipped in this pass: the setting scaffold plus one skin, **Mac II**
(`system.css`).

## 1. Bloat/complexity check on the existing theme system

`docs/theme-store.js` + `docs/theme-picker.js` + `docs/theme-preview.js`
already carry real complexity: five conceptual theme states (active, saved
light/dark, preview light/dark), scheme derivation from `rootHues`/`chrome`,
async fetch-and-derive with a sequence counter to discard stale mode flips,
and a localStorage migration path for an old `url`+`name` format. That
system is a **color-scheme** engine — it recolors CSS custom properties on
top of one fixed layout/typography. It doesn't touch layout, iconography, or
control chrome, so it stays proportionate to what it does.

Fun Themes is deliberately kept as a *separate, independent* layer rather
than folded into that system:
- It swaps the whole skin (buttons, scrollbars, window chrome, fonts), which
  `theme-store.js`'s model has no concept of and shouldn't grow one for.
- It's a single boolean + a (currently one-item) enum, following the same
  `EXPERIMENT_KEYS` / `SETTINGS` registry / `APP_EVENTS` pattern as every
  other experimental toggle (`web-fonts.js` was the closest existing
  analogue and this follows it almost line for line).
- Each additional skin only adds one vendored CSS file + one `THEMES` map
  entry in `docs/fun-themes.js` + one `<option>` — no new abstraction needed
  until skin-specific behavior (e.g. a screensaver, see §4) shows up.

Verdict: the existing theme system isn't bloated for what it does, and Fun
Themes doesn't add to its complexity because it deliberately doesn't touch
it — it layers on top via plain CSS cascade + a body class.

## 2. Shipped this pass

- `EXPERIMENT_KEYS.FUN_THEMES` / `FUN_THEME_ID` (`docs/settings-state.js`)
- `SETTINGS` registry entries + Experimental-tab UI (`docs/index.html`,
  `docs/settings-registry.js`, `docs/settings-modal-experimental.js`)
- `docs/fun-themes.js`: applies/removes the skin's `<link>` and a body class
- `docs/vendor/fun-themes/system.css` (MIT, vendored from npm `system.css@0.5.3`)
  — **not** added to `docs/sw.js`'s `PRECACHE` list, so it only downloads
  (and then opportunistically runtime-caches) once a user actually opts in,
  per the same "ship on Pages, not in the app shell" split cytoscape.js
  already uses in `docs/vendor/`.
- `whats-new/entries/2026-08-08-fun-themes-mac-ii.json`
- `docs/fun-themes-mac2.css`: the Mac II **adapter pass**. `system.css`
  styles its own class/tag vocabulary (`.window`, `.title-bar`, `.btn`,
  plain `<button>`/`<select>`, …), which `docs/index.html`'s markup doesn't
  use, so the vendored stylesheet alone (confirmed with a Playwright
  screenshot) barely changed anything visible. This hand-authored,
  oq-owned overlay maps the skin's palette/border idiom onto oq's real
  selectors instead (`.page-header`, `.icon-btn`, `.input-field`,
  `.preset-card`, `dialog.modal-dialog`, …) — pinstriped title bar, boxed
  logo, black-bordered hard-shadowed cards/buttons/modals, no rounded
  corners — scoped entirely under `body.oq-fun-theme-mac2`, and loaded /
  unloaded by `docs/fun-themes.js` alongside the vendored stylesheet. Not
  vendored (it's oq's own code, not third-party), so it carries no license
  file and has no upstream to track. It's a one-time hand-mapping job, not
  something kept in sync with the vendored CSS, which is itself just a
  point-in-time snapshot.
  `whats-new/entries/2026-08-08-fun-themes-mac-ii-adapter.json`
- **Correction to the adapter approach above**: the first adapter pass
  chased individual leaking selectors (`.tab-btn--active`, `.icon-btn`
  states, `.whats-new-badge`, `.chrome-surface`, …) one at a time from
  screenshots. That never converges — every additional view (Builder,
  Deconstruct, Tornasuk) surfaced more consumers of oq's own theme color
  (checkbox/radio/range `accent-color`, warning banners, Tornasuk's result
  list, EN/DA badges inside modals, …), and a blanket `filter: grayscale(1)`
  safety net was tried and explicitly rejected: it hides the exact signal
  that catches a missed selector (color bleeding through means "not
  adapted yet"), and would wrongly desaturate a future skin that's
  supposed to have real color. The actual fix: almost every leak traces
  back to one of oq's own design tokens (`--kc-accent`, `--kc-bg`,
  `--kc-warning`, `--kc-text-faint`, …, defined in `docs/style.css`'s
  `:root`/`[data-theme]` blocks). `docs/fun-themes-mac2.css` now redefines
  those tokens directly at `body.oq-fun-theme-mac2` scope — that compound
  selector (element + class, specificity 0,1,1) outranks `:root` alone
  (0,1,0), and the adapter stylesheet also loads after `docs/style.css` —
  the same mechanism oq's own light/dark toggle already uses, so it
  cascades to every current *and
  future* consumer instead of whatever's been screenshotted so far. What
  still needs an explicit per-selector override: colors baked in as
  literal hex rather than a `var()` (`.card-valence`/`.card-archaic`'s
  per-variant backgrounds) and the inline `--preset-border`/`--preset-text`
  word-class colors `dictionary.js` sets per card (inline style beats any
  stylesheet's attempt to redefine the custom property itself, so the
  *consuming* property has to be overridden instead).
- **Window chrome**: the fixes above got Mac II's *colors* right, but the
  layout was still oq's flat, edge-to-edge page — nothing read as an actual
  window sitting on a desktop. Added: `.page-wrapper` gets an inset margin
  (so the grey desktop shows around it), a hard drop shadow, and a border,
  turning the whole app into one floating window; every `dialog.modal-dialog`
  and the command palette get a pinstriped title bar (reusing the same
  gradient as the main window's) with a boxed title and oq's real
  `.modal-close` button restyled and reordered to the left as a Mac-style
  close box (`.modal-header-actions` — the flex group `.modal-close` already
  lives in — gets `order: -1` so the whole control cluster moves left of the
  title, not just the close button alone). Deliberately visual-only: no
  dragging. If dragging is wanted later, it's a separate follow-up (real
  drag interaction needs pointer-event JS, not just CSS) — see the note in
  the PR that shipped this.
- **Drag, step one**: `docs/fun-themes-mac2-drag.js` makes the main window
  (`.page-header` as the grab handle, `.page-wrapper` as what moves)
  draggable via a small pointer-event helper — translates the target
  relative to its own last position, ignores drags starting on a real
  interactive descendant (button/link/input/...) so the toolbar and nav
  keep working, and resets the offset when the setting turns off so
  toggling it back on starts fresh. Wired from `docs/fun-themes.js`
  alongside the rest of the skin. Scoped deliberately narrow — one window,
  no z-index/focus management, no bring-to-front — as the first slice of
  the bigger ask: full multi-window support (desktop icons replacing the
  tab strip, Builder/Deconstruct/Tornasuk opening as their own separate
  draggable windows instead of swapping the single view, per-window
  dynamic titles) is real scope, not a CSS tweak, and is being built
  incrementally on top of this rather than landed in one drop.
- **Multi-window desktop**: the rest of the bigger ask from the previous
  entry. `docs/fun-themes-mac2-windows.js` turns Builder/Deconstruct/
  Tornasuk into their own independent floating windows instead of views
  that swap inside the single main window — each gets a real title bar
  (`OQ! Word Builder`, …) built as DOM (not a pseudo-element, since the
  text is per-window), a close box, and drag via the same `makeDraggable()`
  primitive `fun-themes-mac2-drag.js` already exports for the main window.
  `.view-switch` (the former tab strip) is reparented to `document.body`
  and restyled as a fixed-position column of desktop icons along the real
  viewport's left edge — reparenting was necessary, not just a style
  choice: `.view-switch` lives inside `.sticky-chrome`, which sets
  `will-change: transform` for scroll-perf reasons, and per spec that makes
  `.sticky-chrome` (not the viewport) the containing block for any
  `position: fixed` descendant left in place, the same containing-block
  gotcha already hit and worked around for the tool-palette earlier in this
  file. Both the new module's window logic and the CSS are gated to the
  same `(min-width: 88rem)` breakpoint as the tool-palette, so narrower
  viewports keep oq's plain single-view tab behavior untouched.
  Deliberately layered on top of `docs/router.js`, not integrated into it:
  router still owns the URL/history and toggles each view-section's
  `.hidden` class exactly as before (so deep links and back/forward keep
  working unchanged); the new module only overrides the *visual* effect of
  that class for windows the user has explicitly opened, via a
  `.mac2-window-open` class that outranks a bare `.hidden` on specificity.
  Dictionary itself stays the main window (it already shares the header/
  search chrome built for that in the "Window chrome" entry above), so only
  the other three views get this treatment.
- **Mobile polish pass**: user-reported bugs found after using the
  multi-window build on a phone, all traced to `.chrome-surface` (the
  sticky header/nav/toolbar band) staying 60% opaque behind `blur(8px)`
  from the "Window chrome" pass's original neutralize -- the comment there
  said "neutralize the tint, keep the blur," which reads fine on desktop
  where the header sits over a mostly-static viewport, but on a small
  screen with content scrolled underneath it, cards visibly ghosted
  through the "title bar," and looked like it explained three separate
  complaints at once (stray translucency, search results appearing to
  render above the search field, the whole top chrome reading as if it
  had no window edges). Fixed by making `.chrome-surface` fully opaque and
  turning its blur off too -- a blur is a no-op without translucency to
  blur through, so leaving it on was one remaining half-measure, not a
  second bug. Also added: a matching neutralize rule for the *nested*
  Liquid Ass "pill" selectors in `docs/style.css` (`.icon-btn`,
  `.input-field`, `.select-field`, `.tab-strip`, `.add-btn`,
  `.look-preview-sticky`, `.look-save-section` riding on top of a glass
  surface) -- these set their own translucent background and a second,
  lighter blur, separate from the surface-level rule the earlier pass
  covered, so they weren't reached by it. And `.page-footer` now sits
  `calc(0.75rem + env(safe-area-inset-bottom))` above the true viewport
  bottom instead of flush against it (base oq pins it to `bottom: 0` by
  design, fine for the normal floating-pill footer) -- flush against the
  real edge was the one place left where the window illusion broke, with
  no desktop visible beneath the "window's" own bottom edge the way there
  is on every other side.

## 3. Other themes — sequencing suggestion

Ship in roughly this order, each as its own PR (new vendored CSS + one
`THEMES` entry + one `<option>`, following the Mac II pattern exactly):

1. **Windows 98** (`98.css`) and **Windows XP** (`XP.css`) — both small,
   MIT/permissive, high name recognition, no build step.
2. **Mac OS 8.1** (`classic.css`) — same shape as Mac II, good pairing.
3. **NES.css** — small, playful, good contrast with the desktop-metaphor
   skins above.
4. **Modern macOS** (Puppertino), **Commodore 64**, **Norton Commander**,
   **Windows 3.1**, **DOS** (Bootstra.386) — lower priority; check license
   and bundle size before vendoring (some of these are less actively
   maintained, so verify they still build/apply cleanly against current
   `docs/index.html` markup rather than assuming API compatibility).

Framework CSS generally expects specific class names/markup shapes (e.g.
`.window`, `.title-bar`) that `docs/index.html` doesn't use, so each skin
needs a small adapter overlay — `docs/fun-themes-mac2.css` is the template:
a hand-authored, oq-owned stylesheet scoped under that skin's body class,
loaded after the vendored CSS. Budget real per-skin time for this, not just
"drop in the CSS file." It's a one-off job per skin, not ongoing upkeep —
there's no upstream to track since the vendored CSS is a point-in-time
snapshot, not a dependency kept in sync.

Two layers to that overlay, in order of leverage — **do the first one
first**, per §2's correction:
1. **Redefine oq's own `--kc-*` design tokens** (`--kc-accent`, `--kc-bg`,
   `--kc-warning`, `--kc-text-faint`, …, the full list is enumerated in
   `docs/fun-themes-mac2.css`) to the new skin's palette, scoped under that
   skin's body class. This is what actually cascades to every current and
   future consumer across the whole app (all views, not just whichever one
   got screenshotted), the same mechanism oq's own light/dark toggle uses.
   For a skin that's supposed to have real color rather than Mac
   II's black-and-white, map the tokens to that skin's palette instead of
   to black/white — the technique is the redefinition, not "always
   monochrome."
2. **Explicit per-selector overrides** for oq's real structural
   selectors (`.page-header`, `.icon-btn`, `.preset-card`,
   `dialog.modal-dialog`, …) — shape only (borders, shadows, corner
   radius, a pinstriped title bar, …), plus anything the token layer
   can't reach: colors baked in as literal hex instead of a `var()`
   (`.card-valence`/`.card-archaic`'s per-variant backgrounds), and the
   inline `--preset-border`/`--preset-text` word-class colors
   `dictionary.js` sets per card (inline style always beats a
   stylesheet's attempt to redefine the custom property itself, so
   override the *consuming* property instead).

## 4. Screensavers

Not trivial to add as a genuine gag: a real screensaver needs an idle-timer
(`docs/` has no existing idle-detection module), a full-viewport overlay,
and `requestAnimationFrame` animation loop, none of which exist today. It's
a reasonable **future** experimental sub-feature (`kc_exp_screensaver` or
similar) gated the same way, but shouldn't be bundled into this pass — it's
a different engineering surface (idle detection + canvas/CSS animation) than
"swap a stylesheet."

## 5. Further "fun CSS framework" candidates

From swyxio/spark-joy's list, beyond what's already in scope above:
worth a look later — `mvp.css`/`sakura.css`-style classless skins (near-zero
adapter cost since they style bare elements, unlike the desktop-metaphor
frameworks above), and any framework's own screensaver companion project
(as already linked for 98.css and Windows 3.1 above) once §4 lands.
