# oq-integration/

Frozen copies of the "Fun Themes" feature as it existed in
[`jandahl/oq`](https://github.com/jandahl/oq) at the point this repo split
off — `fun-themes.js`, `fun-themes-mac2.css`, `fun-themes-mac2-drag.js`,
`fun-themes-mac2-windows.js`, and the project notes (`PLAN.md`, originally
`plans/fun-themes.md`).

**These files are not wired to anything here.** They import from oq
internals that don't exist in this repo (`./events.js`, `./settings-state.js`,
`./router.js`, `./i18n.js`, …), so they won't run standalone. They're kept
for reference and history — the actual working prototype in this repo is
`/index.html` at the repo root, built directly on `vendor/mac1984/`.

oq itself still has its own copy of this code, live and merged on its
`develop` branch, untouched by this split. Nothing in either repo currently
imports from the other.
