// Tiny, theme-agnostic URL router -- classic script, not type="module",
// matching today's convention across this repo's theme files (see
// CLAUDE.md; not a file:// requirement -- this repo targets http(s)
// hosting).
//
// Deliberately query-string based, not real path segments like jandahl/oq's
// docs/router.js (which this is modeled on): these are static files served
// from GitHub Pages with no server-side rewrite rule behind them --
// "dos/dict/" resolving to anything meaningful needs a server that oq has
// (a real app host) and this repo doesn't (plain static hosting). A query
// string needs no such rule, so "share a link that opens to the same
// state" always works.
//
// Each theme's app.js owns what its own params mean (dos/app.js uses
// "screen"/"filter" for DICT.EXE's open/closed state and filter text) --
// this file only owns reading/writing the query string and telling
// listeners when it changed, the same generic job router.js does in oq
// before any view-specific logic layers on top.

(() => {
  "use strict";

  function getParams() {
    return new URLSearchParams(location.search);
  }

  function navigate(updates, options = {}) {
    const params = getParams();
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    const url = location.pathname + (query ? `?${query}` : "") + location.hash;
    const method = options.replace ? "replaceState" : "pushState";
    try {
      history[method](null, "", url);
    } catch {
    }
    window.dispatchEvent(new CustomEvent("oq-route-change", { detail: { params } }));
  }

  function onChange(callback) {
    callback(getParams());
    window.addEventListener("popstate", () => callback(getParams()));
    window.addEventListener("oq-route-change", (event) => callback(event.detail.params));
  }

  window.OqRouter = { getParams, navigate, onChange };

  if (/\/(win31|win98|xp|win7|kde|mac8|mac1984|amiga|next|dos|c64)(\/|$)/.test(location.pathname)) {
    const s = document.createElement("script");
    const src = document.currentScript && document.currentScript.src;
    s.src = src
      ? src.replace(/router\.js.*$/, "redmond/screensaver.js?v=18")
      : "../shared/redmond/screensaver.js?v=18";
    document.head.appendChild(s);
  }
})();
