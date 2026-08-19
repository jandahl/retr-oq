// Shared oq dictionary-data plumbing, reusable by any retr-oq theme that
// wants a lexeme/gloss list (dos/DICT.EXE today; mac1984 or a future theme
// tomorrow) -- no theme-specific DOM or rendering here, just fetch/cache/
// filter, so each theme's own app.js stays free to render results however
// fits its chrome (a DOS table, a Mac window-pane, whatever's next).
//
// Fetches the real Oqaasileriffik 2018 Chicago Kalaallisut-English
// dictionary (CC-BY-SA 4.0) from the same published JSON jandahl/oq itself
// consumes, rather than importing oq's own docs/public-api.js -- that
// surface is explicitly v0.x/unstable ("any commit may rename, reshape, or
// drop any export" per its own docs), not worth coupling a gag prototype
// to just for a filtered list. Sticks to this CC-BY-SA source over the
// katersat lexicon on purpose too: katersat is GPL-3.0-or-later with no
// CC-BY-SA grant, a copyleft obligation this repo doesn't take on anywhere
// else. See docs/public-api.md / docs/SOURCES.md in jandahl/oq for both.
//
// The fetch/cache shape below is deliberately ported from jandahl/oq's own
// docs/upstream-sources.js + docs/dict-data.js (fetchFirstAvailable() and
// loadFullSource()'s in-flight-call dedup) rather than invented fresh --
// no reason to reinvent a pattern the actual dictionary app already had to
// get right. NOT ported: oq's same-origin vendored-snapshot ("local")
// fast-path with background revalidation (jandahl/oq#611) -- that needs a
// committed local mirror file and a periodic-refresh story neither of
// which exist here yet. Noted as a possible future addition, not built.
//
// A plain classic script attaching one namespaced global (window.OqDictSource),
// not an ES module -- today's convention across this repo's theme files
// (not a file:// requirement -- this repo targets http(s) hosting, see
// CLAUDE.md). Load this script tag before the theme's own app.js and read
// off window.OqDictSource.
(() => {
  "use strict";

  // Ordered, primary first -- mirrors oq's UpstreamSource.urls shape so a
  // fallback mirror can be appended later without any call site changing,
  // exactly the reason oq's own version of this list is structured this way.
  const DICT_SOURCE_URLS = ["https://jandahl.github.io/Oqaasileriffik-dicts/all_entries.json"];

  // CC-BY-SA 4.0 requires this exact string wherever the data is shown --
  // docs/SOURCES.md in jandahl/oq. Exposed here so every consumer shows the
  // identical, correct attribution instead of each copying its own string.
  const DICT_ATTRIBUTION =
    "Oqaasileriffik (Greenlandic Language Secretariat), 2018 Chicago Kalaallisut–English Dictionary, CC-BY-SA 4.0";

  /**
   * Ported from jandahl/oq's docs/upstream-sources.js. Tries each of `urls`
   * in order, returning the first one that succeeds; a URL counts as failed
   * (and the next one gets tried) on network error, a non-ok HTTP response,
   * or `validateShape` returning false for its parsed result. Rejects with
   * the last attempted URL's error if every URL fails.
   * @param {string[]} urls
   * @param {{ validateShape?: (data: any) => boolean }} [opts]
   */
  async function fetchFirstAvailable(urls, opts = {}) {
    const { validateShape } = opts;
    let lastErr;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (validateShape && !validateShape(data)) {
          throw new Error(`Unrecognized response shape from ${url}`);
        }
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  let loaded = null; // the settled entries array, once a load has succeeded
  let loading = null; // the in-flight promise, while a load is in progress

  /**
   * Fetches and caches in memory on first call. Concurrent calls (from any
   * consumer, any theme) share the same in-flight request instead of each
   * firing its own 5.75MB fetch -- ported from oq's loadFullSource(), which
   * dedupes the exact same way via its own _FULL_LOADING map. A failed load
   * clears the in-flight state so the next call retries instead of being
   * stuck rejecting forever.
   * @returns {Promise<Array<{lexeme: string, gloss_en: string}>>}
   */
  function loadDictEntries() {
    if (loaded) return Promise.resolve(loaded);
    if (loading) return loading;
    const validateShape = (data) => Array.isArray(data?.dictionary_entries);
    loading = fetchFirstAvailable(DICT_SOURCE_URLS, { validateShape })
      .then((data) => {
        loaded = data.dictionary_entries.filter((e) => e.lexeme && e.gloss_en);
        return loaded;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  // Pure -- doesn't touch the cache or any DOM. `query` empty matches
  // everything (callers decide whether/how to cap an unfiltered list).
  function filterDictEntries(entries, query) {
    const q = query.trim().toLowerCase();
    if (q === "") return entries;
    return entries.filter(
      (e) => e.lexeme.toLowerCase().includes(q) || e.gloss_en.toLowerCase().includes(q),
    );
  }

  window.OqDictSource = { DICT_ATTRIBUTION, loadDictEntries, filterDictEntries };
})();
