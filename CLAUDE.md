# CLAUDE.md

Guidance for AI agents working in this repo. Read this before touching
`dos/` or `shared/` — it front-loads the conventions and gotchas that
otherwise take a full session of discovery to relearn.

## What this repo is

Static, no-build-step retro desktop/UI prototypes, one theme per top-level
directory (`mac1984/`, `dos/`), each built on a real vendored CSS framework
under `vendor/<theme>/`. Deployed as-is via GitHub Pages and meant to also
work opened directly via `file://` — see README.md for the full "why this
repo exists" story and the theme roadmap. This file is about *how to work
in the code*, not what it's for.

## Hard rules

- **No `type="module"` scripts, ever.** `file://` always fails a module's
  CORS-restricted fetch, silently breaking the entire page (verified: it
  killed window drag/resize *and* DICT.EXE, not just the one import).
  Every `.js` file here is a classic script, sharing state via
  `window.<Namespace>` globals set by an IIFE (`window.OqDictSource`,
  `window.OqHyphenation`, `window.OqRouter`). Load order in `<script>` tags
  matters and is deliberate — check what a new script depends on before
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
  these are static files with no server-side rewrite, so a query string is
  what survives both `file://` and GitHub Pages identically). Every
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

No test framework/CI is wired up for this repo (see README.md's "why this
repo exists" — deliberately decoupled from oq's CI). Verification is
Playwright, run ad hoc:

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

Mobile keyboard/viewport behavior can't be driven for real from this
sandbox — simulate it by overriding `window.visualViewport.height`/
`offsetTop` with `Object.defineProperty` (see git history of
`dos/app.js`'s viewport-fix commits for worked examples) and firing a
`resize` event on `visualViewport`, then reading the resulting
`--app-height`/`--app-top` custom properties.

Always test against a live `python3 -m http.server`, **and** sanity-check
`file://dos/index.html` directly at least once after touching script
loading/module boundaries — that's the failure mode a local server can't
catch.
