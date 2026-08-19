// A real ES module -- not a classic script, unlike every other shared/*.js
// in this repo. Per CLAUDE.md: that's a deliberate exception, not a
// convention break. This is the one file that actually needs it --
// consuming jandahl/oq's docs/public-api.js "properly" (a real `import`,
// not re-fetching raw upstream data the way shared/dict-source.js does)
// means the module itself has to be an ES module, since public-api.js only
// documents itself as importable that way ("consume by importing this file
// directly (browser ES module or Node)"). This repo targets http(s)
// hosting, not file://, so that's not a constraint here.
//
// Imported straight from oq's own live production deployment
// (oq.spacepope.dk, tracks its master branch) rather than vendored --
// public-api.js's whole point is to be a stable, versioned import
// boundary; vendoring a copy would defeat that and silently drift stale.
// jandahl/oq#819 is exactly this repo finding a real gap in that surface
// (Deconstruct's analyzeWord() wasn't reachable at all) and getting it
// fixed upstream (oq#821, API_VERSION 0.3.0) -- this file is what actually
// consuming the fixed surface looks like.
//
// Dynamic import(), not a static top-level `import` -- a static import
// that fails (network error, CORS, oq.spacepope.dk 404ing/reshaping) would
// throw before ANY of this module's own code runs, including a top-level
// try/catch, which would leave window.OqAnalysis unset and
// "oq-analysis-ready" never dispatched -- dos/app.js's waitForOqAnalysis()
// would then hang forever with no error surfaced, since nothing ever
// settles the promise it's awaiting. Wrapping the whole thing in an async
// IIFE lets a genuine load failure be caught and turned into a real error
// state instead.
(async () => {
  let api;
  try {
    api = await import("https://oq.spacepope.dk/public-api.js");
  } catch (err) {
    // window.OqAnalysis.analyzeWord still exists and is still a function
    // that returns a rejected Promise -- callers (dos/app.js's
    // searchDecon()) already have a catch path for a rejected
    // analyzeWord() call, so this reuses that instead of needing a
    // separate "module failed to load" branch on every caller.
    window.OqAnalysis = {
      API_VERSION: null,
      analyzeWord: () => Promise.reject(new Error(`oq public API failed to load (${err.message})`)),
    };
    window.dispatchEvent(new Event("oq-analysis-ready"));
    return;
  }

  const {
    API_VERSION,
    analyzeWordAsync,
    mergeMorphemeSources,
    glossSummary,
    findExactDictMatch,
    GRAMMAR_MORPHEMES_URL,
    SCHEMA_MAJOR_VERSION,
  } = api;

  // Grammarian only, not katersat too -- oq's own Deconstruct view merges
  // both (docs/deconstruct.js's MORPHEME_SOURCES), but grammarian alone is
  // oq's authoritative "buildable" source; katersat is supplementary
  // lexicon coverage. Matches shared/dict-source.js's own precedent of
  // intentionally not porting every source oq has (see that file's own
  // comment on why it skips oq's local-vendored-snapshot fast-path) -- a
  // possible future addition, not built here.
  const GRAMMAR_SOURCE_CONFIG = {
    source: "grammarian",
    buildable: true,
    schemaMajorVersion: SCHEMA_MAJOR_VERSION,
  };

  let presetsPromise = null; // in-flight/settled Promise<preset[]> or null

  function loadPresets() {
    if (!presetsPromise) {
      presetsPromise = fetch(GRAMMAR_MORPHEMES_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((value) => {
          const { presets, anyOk } = mergeMorphemeSources(
            [{ status: "fulfilled", value }],
            [GRAMMAR_SOURCE_CONFIG],
          );
          if (!anyOk) throw new Error("grammarian morpheme source failed");
          return presets;
        })
        .catch((err) => {
          presetsPromise = null; // let a retry actually retry, not replay the same rejection
          throw err;
        });
    }
    return presetsPromise;
  }

  /**
   * Deconstructs `word` into its constituent morphemes via oq's real
   * analysis engine, plus a same-spelling dictionary cross-reference.
   * Cancels a still-running search when `signal` fires (an unparseable
   * word can take real seconds against the full grammarian set) -- the
   * caller is expected to abort a stale search itself on every new
   * keystroke, same as oq's own Deconstruct view does. Presets and the
   * dictionary lookup are independent of each other -- kicked off
   * together, not one after the other, so a cold-cache first search
   * doesn't pay for both fetches back-to-back.
   * @param {string} word
   * @param {{ signal?: AbortSignal }} [opts]
   * @returns {Promise<{
   *   query: string,
   *   matches: Array<{ word: string, approximate: boolean, glossLines: string[] }>,
   *   dictMatch: any | null,
   *   elapsedMs: number,
   *   evalCount: number,
   * }>}
   */
  async function analyzeWord(word, { signal } = {}) {
    const [{ query, matches, elapsedMs, evalCount }, dictMatch] = await Promise.all([
      loadPresets().then((presets) => analyzeWordAsync(word, presets, {}, { signal })),
      findExactDictMatch(word),
    ]);
    return {
      query,
      matches: matches.map((m) => ({
        word: m.word,
        approximate: m.approximate,
        // glossSummary(), not glossSummaryItems() -- only the
        // string-joining wrapper is on the public surface (public-api.js
        // re-exports glossSummary but not glossSummaryItems from
        // morpheme-meta.js), so there's no per-item surface-position data
        // available here to render oq's own bullet-padded column-aligned
        // breakdown. One "marker+text — gloss" line per morpheme instead
        // -- a real simplification, not a bug, and worth revisiting if
        // glossSummaryItems ever joins the public surface too.
        glossLines: glossSummary(m.seq),
      })),
      dictMatch,
      elapsedMs,
      evalCount,
    };
  }

  window.OqAnalysis = { API_VERSION, analyzeWord };
  // type="module" scripts are deferred until after classic scripts (like
  // dos/app.js) have already run their own top-level code, so a classic
  // script can't just destructure window.OqAnalysis at parse time the way
  // it does with window.OqDictSource. This lets a caller that ran before
  // this line (e.g. a deep-link ?screen=decon&word=... firing OqRouter's
  // onChange immediately on registration) wait for the module to actually
  // finish instead of seeing undefined.
  window.dispatchEvent(new Event("oq-analysis-ready"));
})();
