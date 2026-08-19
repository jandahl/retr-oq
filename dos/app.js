(() => {
  "use strict";

  // Plain classic script, not type="module" -- today's convention across
  // this repo's theme files, sharing state via window.<Namespace> globals
  // instead of imports (not a file:// requirement -- this repo targets
  // http(s) hosting, see CLAUDE.md). shared/dict-source.js is a classic
  // script too, loaded before this one in index.html, exposing
  // window.OqDictSource.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  // Measures the actual rendered size of one character cell in the DOS
  // font, so dragging/resizing can snap to real character-grid steps
  // instead of hardcoding pixel values that would drift if the font or
  // font-size ever changes.
  function measureCell() {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "pre";
    probe.textContent = "0".repeat(20);
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const w = rect.width / 20;
    const h = probe.getBoundingClientRect().height || parseFloat(getComputedStyle(probe).lineHeight);
    document.body.removeChild(probe);
    return { w, h };
  }

  function snap(value, step) {
    return Math.round(value / step) * step;
  }

  function makeDraggable(handle, target, cell) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest("button, a, input, select, textarea")) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = snap(event.clientX - startX, cell.w);
      const dy = snap(event.clientY - startY, cell.h);
      target.style.left = `${origX + dx}px`;
      target.style.top = `${origY + dy}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  function makeResizable(handle, target, cell, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = snap(event.clientX - startX, cell.w);
      const dy = snap(event.clientY - startY, cell.h);
      target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      target.style.height = `${Math.max(minHeight, startH + dy)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  // Measuring the cell before the vendored DOS font (@font-face, loaded
  // async) is actually ready would silently measure whatever fallback
  // font the stack lands on instead -- wrong, and different every load
  // depending on font-load timing. document.fonts.ready guarantees the
  // real font is active before anything gets measured or snapped.
  document.fonts.ready.then(() => {
    const cell = measureCell();
    const windows = Array.from(document.querySelectorAll(".dos-window"));
    let zTop = 10;

    // Snap each window's starting position/size to the grid too, so windows
    // begin life aligned the same way dragging/resizing keeps them aligned.
    // Also clamp to whatever actually fits the viewport -- the markup's
    // widths (e.g. 26em/28em) are fine on desktop but overflow a phone-width
    // viewport outright, pushing the growbox and part of the title off
    // screen with no way to reach either. Clamped size still snaps to the
    // grid, just against a smaller ceiling. document.documentElement's
    // clientWidth/clientHeight, not window.innerWidth/innerHeight -- the
    // latter measured ~520 in mobile-emulation testing here even though the
    // visual viewport was actually 375, an emulation quirk that would have
    // silently defeated this clamp entirely.
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    for (const win of windows) {
      const rect = win.getBoundingClientRect();
      const maxWidth = Math.max(cell.w * 20, viewportWidth - rect.left - cell.w);
      const maxHeight = Math.max(cell.h * 6, viewportHeight - rect.top - cell.h);
      win.style.width = `${snap(Math.min(rect.width, maxWidth), cell.w)}px`;
      win.style.height = `${snap(Math.min(rect.height, maxHeight), cell.h)}px`;
    }

    function focus(win) {
      if (win.classList.contains("active")) return;
      for (const w of windows) w.classList.toggle("active", w === win);
      zTop += 1;
      win.style.zIndex = String(zTop);
    }

    for (const win of windows) {
      const header = win.querySelector(".card-header");
      const closeBtn = win.querySelector(".close");

      makeDraggable(header, win, cell);
      win.addEventListener("pointerdown", () => focus(win));

      const growbox = win.querySelector(".dos-growbox");
      if (growbox) makeResizable(growbox, win, cell, cell.w * 20, cell.h * 6);

      if (closeBtn) {
        closeBtn.addEventListener("click", () => win.classList.add("closed"));
      }
    }

    if (windows.length) focus(windows[windows.length - 1]);
  });

  // DICT.EXE: a full-screen takeover of the dir listing, not a window --
  // see the comment at the top of style.css for why. No font/cell
  // measurement needed here, so this doesn't wait on document.fonts.ready
  // like the window machinery above does. Fetch/cache/filter logic lives
  // in shared/dict-source.js so any other theme can reuse it -- everything
  // here is just DOS-flavored rendering on top of that.
  const DEFAULT_ROWS = 50; // shown before any filtering -- a browsable sample, not a blank table
  const MAX_FILTERED_ROWS = 200; // 17,000+ entries -- never render a full match set into the DOM

  document.getElementById("dict-attribution").textContent = DICT_ATTRIBUTION;

  const dirScreen = document.getElementById("dos-dir");
  const dictApp = document.getElementById("dict-app");
  const dictFilter = document.getElementById("dict-filter");
  const dictStatus = document.getElementById("dict-status");
  const dictTbody = document.getElementById("dict-tbody");

  let dictEntries = null; // null until a load succeeds

  function renderRows(rows) {
    dictTbody.textContent = "";
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      // syllabify() inserts soft hyphens at real Kalaallisut syllable
      // boundaries (Oqaasileriffik's own rules) -- a long lexeme wraps at
      // a linguistically correct point this way instead of wherever
      // overflow-wrap:anywhere happens to run out of column width (see
      // style.css's #dict-table td rule, still in place as a fallback for
      // the rare segment that's still too wide even between two
      // syllables). Only the lexeme, not the English gloss -- these rules
      // are specific to Kalaallisut phonology, not applicable to English.
      lexemeCell.textContent = syllabify(entry.lexeme);
      const glossCell = document.createElement("td");
      glossCell.textContent = entry.gloss_en;
      row.append(lexemeCell, glossCell);
      dictTbody.appendChild(row);
    }
  }

  function renderResults() {
    if (dictEntries === null) return; // still loading or failed -- dictStatus already says so

    const query = dictFilter.value.trim();
    if (query === "") {
      renderRows(dictEntries.slice(0, DEFAULT_ROWS));
      dictStatus.textContent = `${dictEntries.length.toLocaleString()} entries loaded -- showing first ${DEFAULT_ROWS}, type to filter.`;
      return;
    }

    const matches = filterDictEntries(dictEntries, query);
    renderRows(matches.slice(0, MAX_FILTERED_ROWS));
    dictStatus.textContent =
      matches.length === 0
        ? "No matches."
        : matches.length > MAX_FILTERED_ROWS
          ? `Showing first ${MAX_FILTERED_ROWS} of ${matches.length.toLocaleString()} matches.`
          : `${matches.length.toLocaleString()} match${matches.length === 1 ? "" : "es"}.`;
  }

  // initialFilter: "DICT /F:word" at the command line (see the prompt
  // handling below) jumps straight to a filtered view instead of the
  // default browsable list -- the actual DOS way to pass a program an
  // argument, unlike clicking a filename, which never took arguments.
  async function launchDict(initialFilter = "") {
    dirScreen.hidden = true;
    dictApp.hidden = false;
    dictFilter.value = initialFilter;
    dictTbody.textContent = "";

    if (dictEntries === null) {
      dictStatus.textContent = "Loading DICT.DAT...";
      try {
        dictEntries = await loadDictEntries();
      } catch (err) {
        dictStatus.textContent = `Could not load DICT.DAT (${err.message}). Exit and relaunch to retry.`;
        dictFilter.focus();
        return;
      }
    }
    renderResults();
    dictFilter.focus();
  }

  function exitDict() {
    dictApp.hidden = true;
    dirScreen.hidden = false;
  }

  // DECON.EXE: the inverse of DICT.EXE -- given a whole surface word, finds
  // what built it (jandahl/oq's real analysis engine, consumed "properly"
  // via shared/oq-analysis.js's actual ES module import) instead of looking
  // up a single headword's meaning. Mutually exclusive with DICT.EXE, same
  // as DICT.EXE is with the dir screen -- DOS was single-tasking, only one
  // program owns the whole screen at a time (see the HTML comment on
  // #decon-app).
  const deconApp = document.getElementById("decon-app");
  const deconWord = document.getElementById("decon-word");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");
  const deconRootFirst = document.getElementById("decon-root-first");

  // Persisted across sessions (a real setting, like oq's own "Reverse
  // morpheme order" toggle), independent of the router state below -- the
  // router param is what makes a shared link reproduce the exact order the
  // sender saw; localStorage is what a plain revisit (no explicit order in
  // the URL) falls back to. Router wins when both are present, same
  // precedent as everything else DECON.EXE's URL already owns.
  const ROOT_FIRST_STORAGE_KEY = "retr-oq:decon-root-first";
  function getStoredRootFirst() {
    const stored = localStorage.getItem(ROOT_FIRST_STORAGE_KEY);
    return stored === null ? true : stored === "1";
  }
  function setStoredRootFirst(value) {
    localStorage.setItem(ROOT_FIRST_STORAGE_KEY, value ? "1" : "0");
  }
  // Read once at load, synchronously -- window.OqRouter (a classic script)
  // is already loaded by this point, unlike window.OqAnalysis.
  {
    const initialOrder = window.OqRouter.getParams().get("order");
    deconRootFirst.checked = initialOrder ? initialOrder !== "final" : getStoredRootFirst();
  }

  // window.OqAnalysis is set by shared/oq-analysis.js, a type="module"
  // script -- deferred by the platform until after this classic script's
  // own top-level code has already run, so it can be missing at the exact
  // moment a deep link (?screen=decon&word=...) fires OqRouter's onChange
  // immediately on registration below. oq-analysis.js dispatches
  // "oq-analysis-ready" on window right after setting the global, so this
  // just waits for whichever already happened.
  function waitForOqAnalysis() {
    if (window.OqAnalysis) return Promise.resolve(window.OqAnalysis);
    return new Promise((resolve) => {
      window.addEventListener("oq-analysis-ready", () => resolve(window.OqAnalysis), { once: true });
    });
  }

  // Cached so toggling "Root first" can re-render the existing results in
  // the new order without re-running the search itself.
  let lastAnalysis = null;

  function renderDeconResults({ matches, dictMatch }) {
    deconResults.textContent = "";
    for (const match of matches) {
      const card = document.createElement("div");
      card.className = "decon-card";

      const header = document.createElement("div");
      const tag = document.createElement("span");
      tag.className = match.approximate ? "decon-tag decon-tag--approximate" : "decon-tag";
      tag.textContent = match.approximate ? "[~ APPROXIMATE]" : "[EXACT REBUILD]";
      const word = document.createElement("span");
      word.className = "decon-word";
      word.textContent = ` ${match.word}`;
      header.append(tag, word);
      card.appendChild(header);

      // match.meaning is already the whole word's own composed sense
      // (shared/oq-analysis.js's own comment explains the walk-backward
      // that picks it) -- promoted here as a headline, same as oq's own
      // Deconstruct view does.
      if (match.meaning) {
        const meaning = document.createElement("div");
        meaning.className = "decon-meaning";
        meaning.textContent = match.meaning;
        card.appendChild(meaning);
      }

      const breakdown = document.createElement("div");
      breakdown.className = "decon-breakdown";
      const rows = deconRootFirst.checked ? match.breakdown : [...match.breakdown].reverse();
      for (const { marker, text, gloss } of rows) {
        const row = document.createElement("div");
        row.textContent = `${marker}${text} — ${gloss}`;
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);

      deconResults.appendChild(card);
    }

    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      // dictMatch is oq's own NormalizedEntry shape (findExactDictMatch,
      // via oq's DICT_SOURCES) -- its headword field is "expected", not
      // "lexeme" like shared/dict-source.js's raw-JSON entries used by
      // DICT.EXE elsewhere in this file. Different data path, different
      // field name; don't conflate the two.
      dictNote.textContent = `Found in the dictionary: ${dictMatch.expected} -- ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

  deconRootFirst.addEventListener("change", () => {
    setStoredRootFirst(deconRootFirst.checked);
    if (lastAnalysis) renderDeconResults(lastAnalysis); // re-render existing results in the new order, no new search
    // replace: true -- same reasoning as dictFilter's own navigate() call:
    // an in-place display refinement, not a new "screen" to visit via
    // back/forward. null (omit from the URL) for the default (root first),
    // so a plain, un-toggled link stays exactly as short as it is today.
    window.OqRouter.navigate({ order: deconRootFirst.checked ? null : "final" }, { replace: true });
  });

  // Cancels a still-running search when a newer one supersedes it -- an
  // unparseable word can take real seconds against the full grammarian set
  // (shared/oq-analysis.js's own comment), so without this every keystroke
  // would pile up abandoned searches finishing out of order.
  let deconSearchAbort = null;

  async function searchDecon(word) {
    if (deconSearchAbort) deconSearchAbort.abort();
    const trimmed = word.trim();
    deconResults.textContent = "";
    lastAnalysis = null;
    if (trimmed === "") {
      deconStatus.textContent = "Type a word, press Enter.";
      return;
    }
    deconSearchAbort = new AbortController();
    const { signal } = deconSearchAbort;
    deconStatus.textContent = "Analyzing...";
    try {
      const analysis = await waitForOqAnalysis();
      const result = await analysis.analyzeWord(trimmed, { signal });
      if (signal.aborted) return; // a newer search already took over
      lastAnalysis = result;
      renderDeconResults(result);
      const found = result.matches.length || result.dictMatch;
      deconStatus.textContent = found
        ? `${result.evalCount.toLocaleString()} combinations tried in ${Math.round(result.elapsedMs)}ms.`
        : `No parse found (${result.evalCount.toLocaleString()} combinations tried in ${Math.round(result.elapsedMs)}ms).`;
    } catch (err) {
      if (err.name === "AbortError") return; // superseded, not a real failure
      deconStatus.textContent = `Could not analyze (${err.message}).`;
    }
  }

  async function launchDecon(initialWord = "") {
    // Abort unconditionally, not just when searchDecon() below runs (which
    // it only does for a non-empty initialWord) -- otherwise reopening
    // DECON.EXE with no word after leaving a previous search in flight
    // (e.g. Esc pressed before a slow analysis resolved) leaves that old
    // AbortController's signal never aborted. It would later resolve,
    // pass its own `if (signal.aborted) return`, and silently overwrite
    // this fresh, just-reset UI with a stale, unrelated result.
    if (deconSearchAbort) deconSearchAbort.abort();
    dirScreen.hidden = true;
    dictApp.hidden = true;
    deconApp.hidden = false;
    deconWord.value = initialWord;
    deconResults.textContent = "";
    lastAnalysis = null;
    deconStatus.textContent = "Type a word, press Enter.";
    deconWord.focus();
    if (initialWord.trim()) await searchDecon(initialWord);
  }

  function exitDecon() {
    if (deconSearchAbort) deconSearchAbort.abort(); // same reasoning as launchDecon above
    deconApp.hidden = true;
    dirScreen.hidden = false;
  }

  // window.OqRouter (shared/router.js) is the single source of truth for
  // "which screen is open" -- launchDict()/exitDict()/launchDecon()/
  // exitDecon() above stay plain UI functions with no URL knowledge of
  // their own; every user-facing trigger (click, Esc, the DICT/DECON
  // commands below) goes through navigate() instead of calling them
  // directly, and this one onChange callback is what actually calls them.
  // That makes a shared link (?screen=dict&filter=word or
  // ?screen=decon&word=...) and the back/forward buttons drive exactly the
  // same code path a click does, instead of being a separate boot-time
  // special case that can drift out of sync with it. One listener for both
  // apps, not two independent ones, so "switch straight from DICT.EXE to
  // DECON.EXE" can't leave both visible at once.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "dict") {
      deconApp.hidden = true;
      if (dictApp.hidden) {
        launchDict(params.get("filter") || "");
      } else if (dictFilter.value !== (params.get("filter") || "")) {
        // Only reached via back/forward, not by this page's own typing --
        // the input handler below updates the URL from dictFilter.value,
        // so it can never disagree with what it just set.
        dictFilter.value = params.get("filter") || "";
        renderResults();
      }
    } else if (screen === "decon") {
      dictApp.hidden = true;
      const orderParam = params.get("order");
      const rootFirst = orderParam ? orderParam !== "final" : getStoredRootFirst();
      // Only reached via back/forward or a pasted link -- the checkbox's
      // own "change" handler already updated both the router and the
      // display itself, so it can never disagree with what it just set.
      if (deconRootFirst.checked !== rootFirst) {
        deconRootFirst.checked = rootFirst;
        if (lastAnalysis) renderDeconResults(lastAnalysis);
      }
      if (deconApp.hidden) {
        launchDecon(params.get("word") || "");
      } else if (deconWord.value !== (params.get("word") || "")) {
        // Only reached via back/forward, same reasoning as dictFilter above.
        deconWord.value = params.get("word") || "";
        searchDecon(deconWord.value);
      }
    } else {
      if (!dictApp.hidden) exitDict();
      if (!deconApp.hidden) exitDecon();
    }
  });

  // Not addEventListener("click", () => navigate(...)) directly -- that
  // would pass the click's PointerEvent through, same trap as launchDict
  // used to have before the router owned this.
  document.getElementById("launch-dict").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: "dict", filter: null });
  });
  document.getElementById("dict-exit").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: null, filter: null });
  });
  dictFilter.addEventListener("input", () => {
    renderResults();
    // replace: true -- every keystroke reshaping the same search shouldn't
    // each get their own back-button stop, only the act of opening DICT.EXE
    // and its final filter state should.
    window.OqRouter.navigate({ filter: dictFilter.value || null }, { replace: true });
  });

  document.getElementById("launch-decon").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: "decon", word: null });
  });
  document.getElementById("decon-exit").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: null, word: null });
  });
  // Enter, not "input" like dictFilter -- deconstructing a word runs a real
  // (occasionally seconds-long) search, unlike dictFilter's instant local
  // filter, so re-running it on every keystroke would be wasteful and would
  // make the AbortController churn constantly.
  deconWord.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    searchDecon(deconWord.value);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (!dictApp.hidden || !deconApp.hidden)) {
      window.OqRouter.navigate({ screen: null, filter: null, word: null });
    }
  });

  // Command line: DOS programs took switches ("/?", "/F:word"), not clicks
  // -- the DICT.EXE filename above is still clickable (equivalent to typing
  // "DICT" with no switches), but this is the only way to pass one.
  const DICT_HELP = `DICT.EXE [/F:word] [/?]

  /F:word   Launch straight into results filtered to "word"
  /?        Display this help`;

  const DECON_HELP = `DECON.EXE [/W:word] [/?]

  /W:word   Launch straight into a deconstruction of "word"
  /?        Display this help`;

  // DIR reprints the same listing the screen opened with -- a real DOS DIR
  // is idempotent, running it again just redraws the same directory. Keep
  // this in sync with #dos-output's own initial markup in index.html --
  // they drifted once already (DICT.DAT/DECON.DAT were added there without
  // this constant following, so DIR printed a stale 3-file listing).
  const DIR_LISTING = ` Volume in drive A is OQ
 Directory of A:\\OQ

DICT     EXE        41,472  03-14-89   2:15p
DICT     DAT       892,928  03-14-89   2:15p
BUILD    EXE        38,912  03-14-89   2:15p
DECON    EXE        35,328  03-14-89   2:15p
DECON    DAT        77,824  03-14-89   2:15p
        5 File(s)    1,086,464 bytes
                       487,424 bytes free`;

  // The real MS-DOS command was VER (built into COMMAND.COM, not a
  // standalone .EXE) -- VERSION.EXE was never a thing.
  const VER_TEXT = "MS-DOS Version 5.00";

  // FORMAT's classic scary confirmation prompt, kept harmless on purpose --
  // there's no actual drive here to format, so it always "cancels" instead
  // of pretending to do anything destructive.
  const FORMAT_WARNING = `WARNING, ALL DATA ON NON-REMOVABLE DISK
DRIVE A: WILL BE LOST!
Proceed with Format (Y/N)?N
Format terminated`;

  // DOOM.EXE isn't in the DIR listing above (BUILD.EXE/DECON.EXE are the
  // only "real" programs the directory admits to) -- typing it anyway is
  // the whole joke, same as it always was on a real DOS box. It needed
  // DOS/4GW's 32-bit protected-mode extender to run at all, which refused
  // outright on anything below a 386.
  const DOOM_ERROR = `DOS/4GW Protected Mode Run-time  Version 1.97
Copyright (c) Rational Systems, Inc. 1990-1993

DOS/4GW fatal error (15): protected mode available only with 386 or 486`;

  const dosOutput = document.getElementById("dos-output");
  const dosCmd = document.getElementById("dos-cmd");

  function printLine(text) {
    dosOutput.appendChild(document.createTextNode(`\n${text}`));
    // Without this, the always-focused prompt input can end up below the
    // visible viewport after a few commands (or one that prints several
    // lines, like DICT /?) -- the user keeps typing into a field they can
    // no longer see.
    dirScreen.scrollTop = dirScreen.scrollHeight;
  }

  // CLS: wipes the scrollback, not just what's currently visible -- a real
  // CLS cleared the whole screen buffer, not just the portion on screen.
  function clearScreen() {
    dosOutput.textContent = "";
    dirScreen.scrollTop = 0;
  }

  function runCommand(line) {
    const trimmed = line.trim();
    if (trimmed === "") return;
    const [rawCmd, ...args] = trimmed.split(/\s+/);
    const cmd = rawCmd.toUpperCase();

    if (cmd === "DICT" || cmd === "DICT.EXE") {
      const helpFlag = args.some((a) => a === "/?");
      const filterArg = args.find((a) => /^\/F:/i.test(a));
      if (helpFlag) {
        printLine(DICT_HELP);
      } else if (filterArg) {
        window.OqRouter.navigate({ screen: "dict", filter: filterArg.slice(3) || null });
      } else if (args.length > 0) {
        printLine(`Invalid switch - ${args[0]}`);
      } else {
        window.OqRouter.navigate({ screen: "dict", filter: null });
      }
    } else if (cmd === "DECON" || cmd === "DECON.EXE") {
      const helpFlag = args.some((a) => a === "/?");
      const wordArg = args.find((a) => /^\/W:/i.test(a));
      if (helpFlag) {
        printLine(DECON_HELP);
      } else if (wordArg) {
        window.OqRouter.navigate({ screen: "decon", word: wordArg.slice(3) || null });
      } else if (args.length > 0) {
        printLine(`Invalid switch - ${args[0]}`);
      } else {
        window.OqRouter.navigate({ screen: "decon", word: null });
      }
    } else if (cmd === "BUILD" || cmd === "BUILD.EXE") {
      printLine(`${cmd.replace(/\.EXE$/, "")}.EXE: not yet implemented`);
    } else if (cmd === "DIR" || cmd === "DIR.EXE") {
      printLine(DIR_LISTING);
    } else if (cmd === "CLS" || cmd === "CLS.EXE") {
      clearScreen();
    } else if (cmd === "VER" || cmd === "VER.EXE") {
      printLine(VER_TEXT);
    } else if (cmd === "DOSKEY" || cmd === "DOSKEY.EXE") {
      printLine("DOSKEY installed.");
    } else if (cmd === "FORMAT" || cmd === "FORMAT.EXE") {
      printLine(FORMAT_WARNING);
    } else if (cmd === "DOOM" || cmd === "DOOM.EXE") {
      printLine(DOOM_ERROR);
    } else {
      printLine("Bad command or file name");
    }
  }

  dosCmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    printLine(`A:\\OQ>${dosCmd.value}`);
    runCommand(dosCmd.value);
    dosCmd.value = "";
  });

  document.getElementById("dos-dir").addEventListener("click", () => dosCmd.focus());
  dosCmd.focus();

  // Text mode scrolled a whole character row at a time, an instant jump --
  // never the smooth, eased-momentum scrolling a modern trackpad/mouse
  // wheel produces by default. Intercepting wheel input and stepping
  // scrollTop by exactly one row (no CSS transition, no browser-native
  // easing) is the only way to actually get that back; overscroll-behavior
  // (used elsewhere in this file) only stops scroll chaining, it doesn't
  // touch how a single container's own scroll feels. Deliberately wheel
  // only, not touch -- hijacking touchmove to force the same stepped feel
  // would fight native mobile scrolling far more than it's worth here.
  const ROW_HEIGHT = parseFloat(getComputedStyle(document.body).lineHeight) || 14;
  function stepScrollOnWheel(el) {
    el.addEventListener(
      "wheel",
      (event) => {
        // Ctrl/Cmd+wheel is the browser's native page-zoom gesture -- let
        // it through untouched instead of hijacking it into a scroll.
        if (event.ctrlKey || event.metaKey) return;
        // deltaY === 0 means a purely horizontal gesture (Shift+wheel, a
        // two-finger horizontal trackpad swipe) -- there's nothing here to
        // step vertically for, and `deltaY > 0 ? … : …` would otherwise
        // treat exactly-0 as "scroll up" and move the container on a
        // gesture the user never made vertically.
        if (event.deltaY === 0) return;
        event.preventDefault();
        el.scrollTop += event.deltaY > 0 ? ROW_HEIGHT : -ROW_HEIGHT;
      },
      { passive: false },
    );
  }
  stepScrollOnWheel(dirScreen);
  // querySelectorAll, not querySelector -- .dos-app-results is shared by
  // both DICT.EXE's and DECON.EXE's results panes now, and querySelector
  // would only ever find the first (DICT.EXE's), silently leaving
  // DECON.EXE's results on native smooth/momentum wheel scrolling instead
  // of this theme's character-grid stepping.
  document.querySelectorAll(".dos-app-results").forEach(stepScrollOnWheel);

  // Mobile on-screen keyboards shrink the *visual* viewport but not the
  // *layout* viewport -- 100vh/inset:0 stay pinned to the full layout size,
  // so a fixed-height full-screen container like .dos-dir/.dos-app doesn't
  // shrink when the keyboard opens, and its bottom (here, the prompt line
  // being typed into) ends up hidden underneath the keyboard. window.
  // visualViewport reports the actual visible height; syncing that into a
  // CSS custom property lets both containers track it instead of the
  // layout viewport. Falls back to the static 100vh in style.css only
  // before this first runs, or on browsers without visualViewport support.
  //
  // Always applied, unconditionally -- an earlier version only synced past
  // a keyboard-sized threshold and cleared the property below it, falling
  // back to plain 100vh for "no keyboard." That was wrong on its own
  // terms: 100vh is the LAYOUT viewport's height, which on mobile routinely
  // overcounts the true visible area (browser chrome -- address bar, tab
  // strip -- covers part of it even with no keyboard up), and now that
  // html/body are position:fixed with no scroll fallback of their own (see
  // that rule's own comment), there's no way to reach whatever 100vh
  // overcounted by -- which is exactly what made the footer disappear with
  // the keyboard NOT present at all. visualViewport.height is already the
  // true visible height regardless of *why* it's short of the layout
  // viewport (keyboard, browser chrome, or both), so there's no threshold
  // to get right here -- just always use it.
  function syncAppHeight() {
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
    // Mobile Safari also scrolls the visual viewport down within the
    // (unchanged) layout viewport to keep a focused input in view --
    // position:fixed follows the layout viewport, not the visual one, so
    // without this offset the box's top ends up above the actually-visible
    // area (forcing an internal scroll to reach content that never moved)
    // and its bottom falls short of the real visible bottom by the same
    // amount (a gap above the keyboard). See .dos-dir's own comment in
    // style.css for the full picture. offsetTop is 0 at rest, so this is
    // a no-op outside of that scroll.
    document.documentElement.style.setProperty("--app-top", `${vv.offsetTop}px`);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppHeight);
    window.visualViewport.addEventListener("scroll", syncAppHeight);
  }
  syncAppHeight();
})();
