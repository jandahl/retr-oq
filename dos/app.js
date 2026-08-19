(() => {
  "use strict";

  // Plain classic script, not type="module" -- these theme pages are meant
  // to be opened straight off disk (README: "Open mac1984/index.html
  // directly, no build step"), and file:// always fails a module's
  // CORS-restricted fetch. shared/dict-source.js is a classic script too,
  // loaded before this one in index.html, exposing window.OqDictSource.
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

  // Not addEventListener("click", launchDict) directly -- that would pass
  // the click's PointerEvent as launchDict's initialFilter argument.
  document.getElementById("launch-dict").addEventListener("click", () => launchDict());
  document.getElementById("dict-exit").addEventListener("click", exitDict);
  dictFilter.addEventListener("input", renderResults);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dictApp.hidden) exitDict();
  });

  // Command line: DOS programs took switches ("/?", "/F:word"), not clicks
  // -- the DICT.EXE filename above is still clickable (equivalent to typing
  // "DICT" with no switches), but this is the only way to pass one.
  const DICT_HELP = `DICT.EXE [/F:word] [/?]

  /F:word   Launch straight into results filtered to "word"
  /?        Display this help`;

  const dosOutput = document.getElementById("dos-output");
  const dosCmd = document.getElementById("dos-cmd");

  function printLine(text) {
    dosOutput.appendChild(document.createTextNode(`\n${text}`));
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
        launchDict(filterArg.slice(3));
      } else if (args.length > 0) {
        printLine(`Invalid switch - ${args[0]}`);
      } else {
        launchDict();
      }
    } else if (cmd === "BUILD" || cmd === "BUILD.EXE" || cmd === "DECON" || cmd === "DECON.EXE") {
      printLine(`${cmd.replace(/\.EXE$/, "")}.EXE: not yet implemented`);
    } else {
      printLine("Bad command or file name");
    }
  }

  dosCmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    printLine(`B:\\OQ>${dosCmd.value}`);
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
        event.preventDefault();
        el.scrollTop += event.deltaY > 0 ? ROW_HEIGHT : -ROW_HEIGHT;
      },
      { passive: false },
    );
  }
  stepScrollOnWheel(dirScreen);
  stepScrollOnWheel(document.querySelector(".dos-app-results"));
})();
