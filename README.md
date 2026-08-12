# retr-oq

A standalone retro desktop / window-manager experiment — pinstriped
title bars, draggable fixed-size windows, active/inactive chrome, a real
desktop background — built for the original **1984 Macintosh 128K**
(System 1.0), not the 1987 Macintosh II or System 7.

## Why this is its own repo

This started as an experimental "Fun Themes" setting inside
[`jandahl/oq`](https://github.com/jandahl/oq), a Kalaallisut dictionary
PWA — an opt-in skin that swapped the app's look for a retro Mac UI. It
grew into something bigger: not just a skin, but a real window-manager
container (fixed-size windows, internal scroll, draggable title bars,
active/inactive focus) meant to eventually host oq's own views.

Splitting it out here, deliberately decoupled from oq:

- **oq's CI stays oq's CI.** oq runs a full lint/typecheck/1084-test/
  Playwright/whats-new/precache-coverage suite on every push, regardless of
  how trivial the change. None of that needs to run just because a pixel
  moved on a desktop icon.
- **Zero blast radius.** This can't break oq's dictionary, search, or PWA
  install — there's no runtime dependency in either direction.
- **A real API boundary, if one ever gets built.** If this is ever consumed
  by oq (or anything else) again, it'll be across an actual import/fetch
  boundary instead of relative paths in the same working tree — which
  surfaces API shortcomings immediately instead of hiding them behind
  same-repo convenience.
- **Low stakes, on purpose.** This is a gag feature. Breaking it here
  doesn't put a real app at risk.

**Current status: fully decoupled.** oq does not import anything from this
repo, and this repo does not import anything from oq. oq's own copy of the
Fun Themes feature (merged, live on its `develop` branch) is untouched and
left as-is — see `oq-integration/README.md` for what that relationship
looks like today.

## What's here

- **`index.html`** — the actual working prototype. A real fixed-size,
  fixed-position `.window` on a real full-viewport desktop: internal
  scrolling that never moves the frame, draggable title bars, click-to-focus
  active/inactive chrome, close/reopen. Open it directly, no build step.
- **`vendor/mac1984/`** — [`@sakun/system.css`](https://github.com/sakofchit/system.css)
  (MIT), vendored verbatim. The real retro-Mac CSS framework — not the
  same-named-but-unrelated `system.css` package that oq's first pass
  accidentally vendored instead (see the history in `oq-integration/`).
- **`oq-integration/`** — frozen copies of the oq-side glue code and
  project notes, for reference. Not wired to anything (see that
  directory's own README).

## License

MIT (`LICENSE`) for this repo's own code. `vendor/mac1984/` carries its own
MIT license from upstream (`vendor/mac1984/LICENSE.txt`) — same license,
separate notice, since that's third-party code.
