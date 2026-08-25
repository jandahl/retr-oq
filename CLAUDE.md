# CLAUDE.md

Guidance for AI agents working in this repo. Read this before touching
`dos/` or `shared/` — it front-loads the conventions and gotchas that
otherwise take a full session of discovery to relearn.

## What this repo is

Static, no-build-step retro desktop/UI prototypes, one theme per top-level
directory (`mac1984/`, `dos/`), each built on a real vendored CSS framework
under `vendor/<theme>/`. Deployed as-is via GitHub Pages — see README.md
for the full "why this repo exists" story and the theme roadmap. This file
is about *how to work in the code*, not what it's for.

**Not a `file://` target.** An earlier session in this repo's history read
README's "open directly, no build step" as "must also work double-clicked
off local disk," verified that `type="module"` really does break under
`file://`, and then wrote that reading into a hard rule here — without it
ever actually being asked for. It wasn't: this repo targets `http(s)`
hosting (GitHub Pages, any static/dev server), not `file://`. If you find
old comments in `dos/`/`shared/` justifying classic-script-only via
`file://` compatibility, that reasoning no longer holds — don't treat it as
a constraint, and feel free to correct a comment you're already touching
for other reasons. Existing files still happen to be classic scripts
sharing state via `window.<Namespace>` globals (`window.OqDictSource`,
`window.OqHyphenation`, `window.OqRouter`) — that's just today's
convention, not a rule to defend. Nothing stops a new file from being a
real ES module if there's a reason to (e.g. actually consuming
`jandahl/oq`'s `docs/public-api.js`, which is only importable as one).

## Hard rules

- **Load order in `<script>` tags is deliberate.** The classic-script
  files here share state via `window.<Namespace>` globals instead of
  imports, so a script that reads `window.OqDictSource` etc. has to load
  after the script that sets it. Check what a new script depends on before
  reordering.
- **Cache-bust every change.** `dos/index.html` and `mac1984/index.html`
  load their own CSS/JS with a `?v=N` query string. Bump the number for
  *any* file you actually change (style.css and app.js version
  independently) before committing — a stale cached file served alongside
  fresh HTML is a real, previously-shipped bug, not a hypothetical.
- **Never introduce a real build step.** README.md says "no build step"
  for a reason: these pages need to open by double-clicking `index.html`.
  If you're reaching for a bundler, transpiler, or npm dependency to solve
  a problem, you're solving the wrong problem.

## `dos/` theme specifics

- **DOS was single-tasking.** `#dos-dir` (the `dir`-listing home screen,
  black background, light-grey text — the real `COMMAND.COM` prompt was
  never blue) and `#dict-app` (DICT.EXE) are mutually-exclusive full-screen
  takeovers via `hidden`, not floating windows. The `.dos-window`/
  `.card-header`/`.dos-growbox` drag/resize machinery in `app.js` is real
  infra kept for a future Turbo-Vision-style app, not dead code — but no
  current markup uses it (`document.querySelectorAll(".dos-window")` is
  empty today).
- **Character-grid movement only.** Dragging/resizing snaps to whole
  text-mode cells via `measureCell()` + `snap()`; wheel scrolling is
  intercepted by `stepScrollOnWheel()` to jump exactly one row at a time
  instead of the browser's smooth/momentum scroll. Never add smooth
  pixel-level movement to this theme — text mode had no in-between
  positions, unlike `mac1984/`'s deliberately-smooth GUI dragging.
- **Mobile on-screen-keyboard handling** (`dos/app.js`'s `syncAppHeight`,
  `dos/style.css`'s `--app-height`/`--app-top`): `position: fixed`
  elements track the *layout* viewport, not the *visual* one. When the
  keyboard opens, `visualViewport.height` shrinks AND
  `visualViewport.offsetTop` can go positive (the visual viewport scrolls
  within an unchanged layout viewport) — both need syncing into CSS custom
  properties, or you get exactly the two symptoms already found and fixed
  once each: a box that's the wrong size (scrolls internally for no
  reason) and a gap between its bottom and the keyboard. Also:
  `window.innerHeight - visualViewport.height` is **not** purely keyboard
  height — mobile Chrome's address bar alone accounts for tens of pixels
  of that gap with no keyboard involved, hence `KEYBOARD_THRESHOLD_PX`
  (150) gating when the shrink applies at all. Don't remove the threshold
  or the offset sync; both were regressions once already.
- **Page scroll vs. container scroll.** `html, body` are
  `position: fixed; width: 100%` (not just `overflow: hidden`, which
  mobile Safari overrides by scrolling the *document* to bring a focused
  input into view even with `overflow: hidden` set). The only real scroll
  containers are `.dos-dir` and `.dos-app-results`. If a "double scroll"
  or "page jumps when I focus the input" bug resurfaces, this is where to
  look first.
- **Command line** (`runCommand()` in `app.js`): uppercases the first
  token, matches both `CMD` and `CMD.EXE` forms. Currently implemented:
  `DICT` (`/?` help, `/F:word` filtered launch), `DIR`, `CLS`, `VER` (the
  real MS-DOS version command — `VERSION.EXE` was never a thing), `DOSKEY`,
  `FORMAT` (harmless, always "cancels" — there's no real drive to format),
  `DOOM` (Easter egg, not listed in `DIR`'s output, prints the real
  DOS/4GW pre-386 protected-mode fatal error). `BUILD`/`DECON` are listed
  in `DIR` but print "not yet implemented" — they're placeholders for
  future oq-integration work, not broken commands. Unrecognized input
  prints the real MS-DOS "Bad command or file name".
- **Shareable URLs**: `window.OqRouter` (`shared/router.js`) is the single
  source of truth for DICT.EXE's open/closed/filter state, via
  `?screen=dict&filter=word` in the query string (not path segments —
  these are static files served from GitHub Pages with no server-side
  rewrite rule, so a real path like `dos/dict/` has nothing to resolve it
  to a route; a query string needs no such rule). Every
  user-facing trigger (click, Esc, the `DICT` command) calls
  `OqRouter.navigate(...)`; a single `onChange` listener is what actually
  calls `launchDict()`/`exitDict()`. **Never call `launchDict()`/
  `exitDict()` directly from a new UI trigger** — route it through
  `navigate()` or the URL and the UI will silently disagree about what
  route is active.

## `shared/` (theme-agnostic, reusable by any theme)

- `dict-source.js` — fetch/cache/filter for the live Oqaasileriffik
  dictionary JSON. No sorting is applied anywhere in this repo; entries
  render in whatever order the upstream data provides, which uses
  Oqaasileriffik's own Kalaallisut collation (e.g. a doubled/long vowel
  like `aa` alphabetizes *after* the single vowel — that's their editorial
  convention, not a bug here).
- `hyphenation.js` — real Kalaallisut syllabification, ported from
  `jandahl/oq`'s `docs/hyphenation.js`. MPL-2.0 (the *code*, not the
  underlying linguistic rules — see README.md's License section for the
  precise distinction; don't blur it if you touch this file's header).
- `router.js` — generic query-string router (`getParams`/`navigate`/
  `onChange`), modeled on oq's path-based `docs/router.js` but
  intentionally query-string based instead (see its own file comment for
  why). Any future theme wanting shareable-link state should reuse this,
  not reinvent it.

## `nes/` theme specifics

- **NES was a console, not a window manager.** `#title-screen` / `#menu-screen`
  / `#oq-screen` / `#decon-screen` are mutually-exclusive full-screen
  takeovers via `hidden`, same single-tasking reasoning as `dos/`'s
  `#dos-dir` / `#dict-app`. Do not add overlapping draggable windows on
  top of NES.css chrome -- a real NES never had any, and free-floating
  windows on this skin would be the same lie as free pixel dragging on
  `dos/`'s text-mode grid.
- **One input path.** Keyboard arrows/Enter/Esc and the on-screen pad's
  `[data-input]` buttons both call `handleInput(action)`. Don't add a
  third click-only code path that bypasses it (menu item buttons are
  allowed to call `chooseMenuItem()` directly -- that's the mouse
  equivalent of highlighting a file-select row and pressing A).
- **Router owns the screen.** Same rule as `dos/`/`c64/`: never call
  `launchOq()` / `showScreen()` from a new UI trigger -- go through
  `OqRouter.navigate()`. Shareable URLs are `?screen=oq&filter=word` and
  `?screen=decon&word=...&order=...`.
- **Konami code is title-screen only** and undocumented on purpose (see
  `dos/`'s `DOOM` and `win98/`'s Hot Dog Stand). Don't list it in the
  SELECT menu or the ABOUT balloon.
- **16px input floor, hide the pad while typing.** iOS Safari auto-zooms
  any focused control under 16px; `--nes-font-size` floors at 8px, so
  SEARCH/WORD used to get magnified until the field sat off-screen and
  the D-pad filled the leftover visual viewport. `.nes-input` is 16px on
  purpose (anti-zoom, not a second type ramp) and `html.is-keyboard`
  hides `#nes-controller` for the duration of the focus. Don't drop
  either to "look more pixel-accurate."
- **APU, not samples.** `nes/app.js` synthesizes pulse/triangle/noise with
  Web Audio -- no ripped Nintendo tracks, no MP3s, no build step. Don't
  drop in a Mario/Zelda loop. Title/menu music starts after the first
  pad/key gesture (autoplay) and silences on OQ!/DECON so the bloops
  stay readable.
- **Cache-bust `nes/index.html`'s `?v=N`** for style.css/app.js on every
  change, same convention as every other theme.

## `gb/` theme specifics

Same console-not-desktop rules as `nes/` (one LCD at a time, one
`handleInput()` path, router owns the screen, Konami is title-only,
16px input floor, `html.is-keyboard` hides `#gb-controller`). Differences:

- **No vendored framework.** Hand-drawn DMG chrome, like `c64/`. Don't
  pull in a CSS-art Game Boy page as if it were NES.css.
- **The pad is on the brick**, not a second slab under a TV. Don't
  break it out into a separate controller strip.
- **Font reuse.** `@font-face` points at `vendor/nes/fonts/PressStart2P-Regular.ttf`
  rather than duplicating the TTF.
- **Cache-bust `gb/index.html`'s `?v=N`.**

## Git workflow gotcha: stranded commits

This repo's branch convention is "always restart the working branch from
current `master` after a merge, never stack on already-merged history."
That already burned a set of commits once: a PR was merged into a
*feature branch* (not `master`) after that feature branch's own earlier
PR had *already* been merged into `master` — so the second PR's commits
sat on a branch that continued to exist but was never itself merged again,
and `master` silently never got them (a live regression — CLS and a
scroll fix both vanished from production — went unnoticed for a full
session). Before assuming "PR merged" means "commit is in `master`":
`git log origin/master..origin/<branch> --oneline` — if that's non-empty,
something didn't make it and needs a follow-up merge PR, exactly like
`claude/dos-merge-stranded-fixes` did. If you stack a PR on another
unmerged PR's branch (reasonable when the base PR is still open), say so
explicitly in the new PR's description and double check both actually
landed in `master` once both show "merged".

## Testing

`win98/`, `nes/`, and `gb/` each have a Playwright/pytest suite under `tests/`
(`tests/test_win98.py`, `tests/test_nes.py`, `tests/test_gb.py`, shared fixtures in
`tests/conftest.py`), wired into GitHub Actions
(`.github/workflows/win98-tests.yml` / `.github/workflows/nes-tests.yml` /
`.github/workflows/gb-tests.yml`)
on every push/PR that touches that theme. This is a deliberate,
narrow reversal of an earlier version of this section, which said no test
framework/CI was wired up at all, "deliberately decoupled from oq's CI"
(see README.md's "why this repo exists"). That reasoning about *oq's own*
CI hasn't changed — this repo still can't break oq's dictionary, search,
or PWA install, and still doesn't run oq's lint/typecheck/1084-test/
Playwright/whats-new/precache-coverage suite on every push regardless of
triviality. What changed is narrower: once a theme's own bugs (like
win98's touch-hit-testing and stacking-order regressions) got expensive
enough to keep rediscovering by hand, codifying the checks that already
existed as ad hoc scripts was worth it for that one theme specifically.

Run it locally the same way CI does:

```bash
pip install -r tests/requirements.txt
playwright install chromium   # skip if PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 already points at a system Chromium (see conftest.py's _SANDBOX_CHROMIUM)
python3 -m pytest tests/ -v
```

`mac1984/`, `dos/`, and `c64/` have no `tests/test_<theme>.py` yet and
aren't part of either CI workflow above -- verification for those is
still Playwright run ad hoc:

```bash
python3 -m http.server 9091 &          # serve the repo root
python3 - <<'EOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    page = browser.new_page()
    page.goto('http://localhost:9091/dos/index.html')
    # ... assertions ...
    browser.close()
EOF
```

If you're adding a `tests/test_<theme>.py` for one of these, reuse
`tests/conftest.py`'s `base_url`/`browser`/`page`/`touch_page` fixtures
rather than hand-rolling a new `http.server` + `sync_playwright()` block,
and widen `.github/workflows/win98-tests.yml`'s trigger paths (or add a
sibling workflow) to cover it.

Mobile keyboard/viewport behavior can't be driven for real from a
sandbox or a CI runner — simulate it by overriding
`window.visualViewport.height`/`offsetTop` with `Object.defineProperty`
(see git history of `dos/app.js`'s viewport-fix commits for worked
examples) and firing a `resize` event on `visualViewport`, then reading
the resulting `--app-height`/`--app-top` custom properties.

Test against a live `python3 -m http.server` (or equivalent) — this repo
targets `http(s)` hosting, not `file://`, so there's no need to
additionally sanity-check the bare file path.
