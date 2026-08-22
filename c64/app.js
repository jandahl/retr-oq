(() => {
  "use strict";

  // Plain classic script sharing state via window.<Namespace> globals, same
  // convention as dos/app.js -- see that file's own comment and CLAUDE.md.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const dirScreen = document.getElementById("c64-dir");
  const dictApp = document.getElementById("dict-app");
  const dictFilter = document.getElementById("dict-filter");
  const dictStatus = document.getElementById("dict-status");
  const dictTbody = document.getElementById("dict-tbody");
  const loadingScreen = document.getElementById("c64-loading");

  document.getElementById("dict-attribution").textContent = petsciiSafe(DICT_ATTRIBUTION);

  const DEFAULT_ROWS = 50; // shown before any filtering -- a browsable sample, not a blank table
  const MAX_FILTERED_ROWS = 200; // same ceiling as dos/app.js, same reasoning: 17,000+ entries, never render a full match set

  let dictEntries = null; // null until a load succeeds

  // The real C64 character set (PETSCII) has no en dash, em dash, or
  // ellipsis -- the upstream dictionary data has all three (see
  // shared/dict-source.js's DICT_ATTRIBUTION). Applied here, not upstream,
  // so dos/mac1984 keep the real Unicode punctuation; only c64/ needs the
  // period-accurate downgrade.
  function petsciiSafe(text) {
    return text.replace(/–/g, "-").replace(/—/g, "--").replace(/…/g, "...");
  }

  function renderRows(rows) {
    dictTbody.textContent = "";
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      // syllabify() -- same reasoning as dos/app.js's identical call: real
      // Kalaallisut syllable boundaries, not wherever overflow-wrap:anywhere
      // happens to break.
      lexemeCell.textContent = petsciiSafe(syllabify(entry.lexeme));
      const glossCell = document.createElement("td");
      glossCell.textContent = petsciiSafe(entry.gloss_en);
      row.append(lexemeCell, glossCell);
      dictTbody.appendChild(row);
    }
  }

  function renderResults() {
    if (dictEntries === null) return; // still loading or failed -- dictStatus already says so

    const query = dictFilter.value.trim();
    if (query === "") {
      renderRows(dictEntries.slice(0, DEFAULT_ROWS));
      dictStatus.textContent = `${dictEntries.length.toLocaleString()} ENTRIES LOADED -- SHOWING FIRST ${DEFAULT_ROWS}, TYPE TO FILTER.`;
      return;
    }

    const matches = filterDictEntries(dictEntries, query);
    renderRows(matches.slice(0, MAX_FILTERED_ROWS));
    dictStatus.textContent =
      matches.length === 0
        ? "NO MATCHES."
        : matches.length > MAX_FILTERED_ROWS
          ? `SHOWING FIRST ${MAX_FILTERED_ROWS} OF ${matches.length.toLocaleString()} MATCHES.`
          : `${matches.length.toLocaleString()} MATCH${matches.length === 1 ? "" : "ES"}.`;
  }

  async function launchDict(initialFilter = "") {
    loadingScreen.hidden = true;
    dirScreen.hidden = true;
    dictApp.hidden = false;
    dictFilter.value = initialFilter;
    dictTbody.textContent = "";

    if (dictEntries === null) {
      dictStatus.textContent = "SEARCHING FOR DICT DAT";
      try {
        dictEntries = await loadDictEntries();
      } catch (err) {
        dictStatus.textContent = `?LOAD ERROR (${err.message}). EXIT AND RELAUNCH TO RETRY.`;
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

  // window.OqRouter (shared/router.js) owns "which screen is open", same
  // reasoning as dos/app.js's identical block -- every user-facing trigger
  // (click, Esc, the LOAD/RUN command line) goes through navigate() instead
  // of calling launchDict()/exitDict() directly.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "dict") {
      if (dictApp.hidden) {
        launchDict(params.get("filter") || "");
      } else if (dictFilter.value !== (params.get("filter") || "")) {
        dictFilter.value = params.get("filter") || "";
        renderResults();
      }
    } else if (!dictApp.hidden) {
      exitDict();
    }
  });

  document.getElementById("dict-exit").addEventListener("click", () => {
    window.OqRouter.navigate({ screen: null, filter: null });
  });
  dictFilter.addEventListener("input", () => {
    renderResults();
    window.OqRouter.navigate({ filter: dictFilter.value || null }, { replace: true });
  });
  document.addEventListener("keydown", (event) => {
    // RUN/STOP is the real C64 key for "abort whatever's running" -- Esc is
    // the closest a modern keyboard has, same substitution dos/app.js makes
    // for its own Esc=Exit footer.
    if (event.key === "Escape" && !dictApp.hidden) {
      window.OqRouter.navigate({ screen: null, filter: null });
    }
  });

  // The RUN loading-screen flicker (issue #27 piece 2): a real LOAD/RUN
  // blanked the screen and cycled the border through the VIC-II palette
  // while the drive worked (style.css's .c64-palette-cycle does the actual
  // color stepping) -- this just times how long that blank screen shows
  // before the loaded program takes over.
  const LOAD_FLICKER_MS = 1400;
  function flickerThenRun(after) {
    return new Promise((resolve) => {
      loadingScreen.hidden = false;
      loadingScreen.classList.add("c64-palette-cycle");
      setTimeout(() => {
        loadingScreen.classList.remove("c64-palette-cycle");
        loadingScreen.hidden = true;
        after();
        resolve();
      }, LOAD_FLICKER_MS);
    });
  }

  // Command line: real BASIC/KERNAL two-step idiom -- LOAD"NAME",8[,1] to
  // read a program off "disk", RUN to actually start whatever was last
  // loaded. Neither command takes effect alone: LOAD only ever reports
  // success, RUN with nothing loaded is the real ?SYNTAX ERROR a bare RUN
  // gave when BASIC's own program buffer was empty.
  //
  // Built as DOM nodes, not a plain template-literal string, so a LIST
  // reprint stays clickable -- see the delegated #c64-output click listener
  // below, same as the initial listing markup in index.html.
  function printDirListing() {
    printLine('0 "OQ DISK       " 09 2A');
    const dictLine = document.createElement("div");
    const dictLink = document.createElement("button");
    dictLink.type = "button";
    dictLink.className = "c64-link";
    dictLink.dataset.load = "DICT";
    dictLink.textContent = '1   "DICT"';
    dictLine.append(dictLink, document.createTextNode("            PRG"));
    c64Output.appendChild(document.createTextNode("\n"));
    c64Output.appendChild(dictLine);
    printLine('1   "DICT DAT"             SEQ');
    printLine('1   "BUILD"                PRG');
    printLine('2   "RUN"                  PRG');
    printLine("664 BLOCKS FREE.");
  }

  let loadedProgram = null; // null until a LOAD succeeds -- what a bare RUN would start

  const c64Output = document.getElementById("c64-output");
  const c64Cmd = document.getElementById("c64-cmd");

  function printLine(text) {
    c64Output.appendChild(document.createTextNode(`\n${text}`));
    dirScreen.scrollTop = dirScreen.scrollHeight;
  }

  // Clicking "1 DICT" in the directory (the initial listing in index.html,
  // or a LIST reprint from printDirListing() above) is the mouse
  // equivalent of typing LOAD"DICT",8,1 then RUN -- same idea as
  // dos/index.html's clickable filename, but the C64 idiom is genuinely two
  // commands, not one, so the click plays the same flicker the command line
  // does rather than jumping straight to the app. Delegated on #c64-output
  // (rather than bound to a single fixed id) so it keeps working no matter
  // how many times the listing has been reprinted.
  c64Output.addEventListener("click", (event) => {
    const link = event.target.closest(".c64-link[data-load]");
    if (!link) return;
    const name = link.dataset.load;
    printLine(`LOAD"${name}",8,1`);
    printLine(`SEARCHING FOR ${name}`);
    printLine("LOADING");
    printLine("READY.");
    // loadedProgram set here (not just implied by the transcript above) so
    // a bare RUN typed afterward -- the natural next move after watching
    // a program load and launch this way -- relaunches it instead of
    // hitting the real ?SYNTAX ERROR an empty program buffer gives.
    loadedProgram = name;
    runProgram(loadedProgram);
  });

  function runProgram(name) {
    if (name === "DICT") {
      printLine("RUN");
      flickerThenRun(() => window.OqRouter.navigate({ screen: "dict", filter: null }));
    } else if (name === "BUILD") {
      printLine("BUILD: NOT YET IMPLEMENTED");
    } else {
      printLine("?FILE NOT FOUND ERROR");
    }
  }

  function runCommand(line) {
    const trimmed = line.trim();
    if (trimmed === "") return;
    const upper = trimmed.toUpperCase(); // real BASIC auto-uppercased typed input outside quotes; simplest to just uppercase the whole line, same idea as dos/app.js's cmd.toUpperCase()

    // LOAD"$",8 is the real way to read the directory into BASIC's own
    // variable buffer (LIST then prints it back) -- checked before the
    // general LOAD match below so it can't be treated as an unknown
    // program name and wrongly clear loadedProgram.
    if (upper === 'LOAD"$",8' || upper === "LIST") {
      printLine("SEARCHING FOR $");
      printLine("LOADING");
      printLine("READY.");
      printLine("LIST");
      printLine("");
      printDirListing();
      return;
    }

    const loadMatch = upper.match(/^LOAD\s*"([^"]*)"\s*,\s*8(?:\s*,\s*1)?$/);
    if (loadMatch) {
      const name = loadMatch[1];
      printLine(`SEARCHING FOR ${name}`);
      if (name === "DICT" || name === "BUILD") {
        loadedProgram = name;
        printLine("LOADING");
        printLine("READY.");
      } else {
        printLine("?FILE NOT FOUND ERROR");
        loadedProgram = null;
      }
      return;
    }

    if (upper === "RUN") {
      if (loadedProgram) {
        runProgram(loadedProgram);
      } else {
        printLine("?SYNTAX ERROR");
      }
      return;
    }

    printLine("?SYNTAX ERROR");
  }

  // Real BASIC had no lowercase mode by default -- typed input showed
  // uppercase as it was typed, not just after Enter uppercased it for
  // matching (runCommand() already does that separately). Forced here
  // rather than left to CSS text-transform so the *echoed* history line
  // below also reads uppercase, not just the live input box.
  function forceUppercase(input) {
    input.addEventListener("input", () => {
      const { selectionStart, selectionEnd } = input;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(selectionStart, selectionEnd);
    });
  }
  forceUppercase(c64Cmd);
  // dict-filter's own uppercase look comes from style.css's
  // text-transform:uppercase instead of this same JS trick -- it doesn't
  // need an uppercased *value* the way the command echo below does
  // (filterDictEntries() already matches case-insensitively), and forcing
  // the value here would race the existing "input" listener below that
  // reads dictFilter.value into the shareable URL.

  c64Cmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    printLine(c64Cmd.value);
    runCommand(c64Cmd.value);
    c64Cmd.value = "";
  });

  document.getElementById("c64-dir").addEventListener("click", () => c64Cmd.focus());
  c64Cmd.focus();

  // Same stepped, non-momentum wheel scroll as dos/app.js's
  // stepScrollOnWheel -- text mode scrolled a whole row at a time, never a
  // smooth trackpad glide. See that file's own comment for the full
  // reasoning; reapplied here rather than reinvented.
  //
  // Measured per-element from ITS OWN computed line-height, unlike
  // dos/app.js's single body-wide measurement -- dos/'s vendored framework
  // sets a real line-height on body itself, but c64/style.css doesn't (only
  // .c64-screen/.c64-app set one, and .c64-app-results doesn't even inherit
  // .c64-screen's), so reading body's here would resolve to "normal" (NaN
  // once parsed) and silently always fall back to one hardcoded literal,
  // wrong for any element whose real row height differs from it.
  function rowHeight(el) {
    return parseFloat(getComputedStyle(el).lineHeight) || 20;
  }
  function stepScrollOnWheel(el) {
    const step = rowHeight(el);
    el.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey || event.metaKey) return;
        if (event.deltaY === 0) return;
        event.preventDefault();
        el.scrollTop += event.deltaY > 0 ? step : -step;
      },
      { passive: false },
    );
  }
  stepScrollOnWheel(dirScreen);
  document.querySelectorAll(".c64-app-results").forEach(stepScrollOnWheel);

  // Mobile on-screen-keyboard viewport tracking -- identical reasoning and
  // implementation to dos/app.js's syncAppHeight; see that file's own
  // comment for the full explanation of why both --app-height and
  // --app-top are needed, not just one.
  function syncAppHeight() {
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
    document.documentElement.style.setProperty("--app-top", `${vv.offsetTop}px`);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppHeight);
    window.visualViewport.addEventListener("scroll", syncAppHeight);
  }
  syncAppHeight();
})();
