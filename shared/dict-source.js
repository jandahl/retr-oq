// Shared oq dictionary-data plumbing, reusable by any retr-oq theme that
// wants a lexeme/gloss list (dos/DICT.EXE today; mac1984 or a future theme
// tomorrow) -- no theme-specific DOM or rendering here, just fetch/cache/
// filter, so each theme's own app.js stays free to render results however
// fits its chrome (a DOS table, a Mac window-pane, whatever's next).
//
// Public entry: loadDictEntries() — Chicago (CC-BY-SA 4.0) primary with
// katersat (GPL-3.0-or-later) enrichment when shared/katersat-source.js +
// shared/dict-merge.js are loaded (Option C, project-wide for every OQ!
// theme). Katersat failure → Chicago-only. Runtime HTTP only; we refuse
// to *vendor* GPL katersat JSON into this MIT repo. See shared/SOURCES.md
// and jandahl/oq docs/SOURCES.md §3 (authoritative over the mermaid slip).
//
// loadChicagoOnly() is the raw Chicago fetch for tests / merge internals.
//
// The fetch/cache shape below is deliberately ported from jandahl/oq's own
// docs/upstream-sources.js + docs/dict-data.js (fetchFirstAvailable() and
// loadFullSource()'s in-flight-call dedup) rather than invented fresh.
//
// Classic script → window.OqDictSource. Load order in themes:
//   dict-source.js → katersat-source.js → dict-merge.js → … → app.js
(() => {
  "use strict";

  const DICT_SOURCE_URLS = ["https://jandahl.github.io/Oqaasileriffik-dicts/all_entries.json"];

  // CC-BY-SA 4.0 Chicago attribution (stable string for destructuring at
  // init). After a merged load, prefer formatDictAttribution() /
  // applyDictAttribution() so the GPL katersat line appears too.
  const DICT_ATTRIBUTION =
    "Oqaasileriffik (Greenlandic Language Secretariat), 2018 Chicago Kalaallisut–English Dictionary, CC-BY-SA 4.0";

  const KATERSAT_ATTRIBUTION_FALLBACK =
    "Oqaasileriffik / Greenland Language Secretariat — katersat lexicon (GPL-3.0-or-later)";

  /** @type {{ chicago: string, katersat?: string } | null} */
  let lastAttributions = null;
  let lastKatersatLoaded = false;

  /**
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

  let chicagoLoaded = null;
  let chicagoLoading = null;

  /**
   * Raw Chicago-only fetch/cache. Used by the merge layer and tests.
   * Keeps rows with a lexeme even when gloss_en is empty so katersat can
   * backfill. @returns {Promise<Array<{lexeme: string, gloss_en: string}>>}
   */
  function loadChicagoOnly() {
    if (chicagoLoaded) return Promise.resolve(chicagoLoaded);
    if (chicagoLoading) return chicagoLoading;
    const validateShape = (data) => Array.isArray(data?.dictionary_entries);
    chicagoLoading = fetchFirstAvailable(DICT_SOURCE_URLS, { validateShape })
      .then((data) => {
        chicagoLoaded = data.dictionary_entries
          .filter((e) => e && e.lexeme)
          .map((e) => ({
            ...e,
            lexeme: String(e.lexeme),
            gloss_en: e.gloss_en != null ? String(e.gloss_en) : "",
          }));
        return chicagoLoaded;
      })
      .finally(() => {
        chicagoLoading = null;
      });
    return chicagoLoading;
  }

  /**
   * Combined attribution text for UI (Chicago always; katersat when loaded).
   * @param {{ chicago?: string, katersat?: string } | null} [attrs]
   */
  function formatDictAttribution(attrs) {
    const a = attrs || lastAttributions || { chicago: DICT_ATTRIBUTION };
    const parts = [];
    if (a.chicago) parts.push(a.chicago);
    else parts.push(DICT_ATTRIBUTION);
    if (a.katersat) parts.push(a.katersat);
    return parts.join(" · ");
  }

  /**
   * Update common attribution nodes every theme already uses, so callers
   * that snapshot DICT_ATTRIBUTION at init still get the GPL line after
   * load without per-theme edits.
   * @param {{ chicago?: string, katersat?: string } | null} [attrs]
   */
  function applyDictAttribution(attrs) {
    const text = formatDictAttribution(attrs);
    for (const id of ["oq-attribution", "dict-attribution"]) {
      const el = typeof document !== "undefined" ? document.getElementById(id) : null;
      if (el) el.textContent = text;
    }
    return text;
  }

  let mergedLoaded = null;
  let mergedLoading = null;

  /**
   * Project-wide public entry for every theme's OQ! list. Goes through
   * OqDictMerge when katersat-source + dict-merge are on the page; otherwise
   * Chicago-only. Always refreshes #oq-attribution / #dict-attribution.
   * @returns {Promise<Array<{lexeme: string, gloss_en: string, source?: string, sources?: string[]}>>}
   */
  function loadDictEntries() {
    if (mergedLoaded) {
      applyDictAttribution(lastAttributions);
      return Promise.resolve(mergedLoaded);
    }
    if (mergedLoading) return mergedLoading;

    const merge = typeof window !== "undefined" ? window.OqDictMerge : null;
    if (merge && typeof merge.loadMergedDictEntries === "function") {
      mergedLoading = merge
        .loadMergedDictEntries()
        .then((result) => {
          lastAttributions = result.attributions || { chicago: DICT_ATTRIBUTION };
          lastKatersatLoaded = !!result.katersatLoaded;
          if (lastKatersatLoaded && !lastAttributions.katersat) {
            const kat = window.OqKatersatSource;
            lastAttributions.katersat =
              (kat && kat.KATERSAT_ATTRIBUTION) || KATERSAT_ATTRIBUTION_FALLBACK;
          }
          applyDictAttribution(lastAttributions);
          mergedLoaded = result.entries;
          return mergedLoaded;
        })
        .finally(() => {
          mergedLoading = null;
        });
      return mergedLoading;
    }

    // Merge scripts not loaded — Chicago-only fallback.
    mergedLoading = loadChicagoOnly()
      .then((entries) => {
        lastAttributions = { chicago: DICT_ATTRIBUTION };
        lastKatersatLoaded = false;
        applyDictAttribution(lastAttributions);
        mergedLoaded = entries.map((e) => ({
          ...e,
          source: "chicago",
          sources: ["chicago"],
        }));
        return mergedLoaded;
      })
      .finally(() => {
        mergedLoading = null;
      });
    return mergedLoading;
  }

  function filterDictEntries(entries, query) {
    const q = String(query || "").trim().toLowerCase();
    if (q === "") return entries;
    return entries.filter(
      (e) =>
        String(e.lexeme || "")
          .toLowerCase()
          .includes(q) ||
        String(e.gloss_en || "")
          .toLowerCase()
          .includes(q),
    );
  }

  function getLastAttributions() {
    return lastAttributions ? { ...lastAttributions } : { chicago: DICT_ATTRIBUTION };
  }

  function wasKatersatLoaded() {
    return lastKatersatLoaded;
  }

  /** Test helper — clears Chicago + merged caches. */
  function resetDictState() {
    chicagoLoaded = null;
    chicagoLoading = null;
    mergedLoaded = null;
    mergedLoading = null;
    lastAttributions = null;
    lastKatersatLoaded = false;
    if (window.OqDictMerge && typeof window.OqDictMerge.resetMergeState === "function") {
      window.OqDictMerge.resetMergeState();
    }
    if (window.OqKatersatSource && typeof window.OqKatersatSource.resetKatersatState === "function") {
      window.OqKatersatSource.resetKatersatState();
    }
  }

  window.OqDictSource = {
    DICT_ATTRIBUTION,
    loadDictEntries,
    loadChicagoOnly,
    filterDictEntries,
    formatDictAttribution,
    applyDictAttribution,
    getLastAttributions,
    wasKatersatLoaded,
    resetDictState,
  };
})();
