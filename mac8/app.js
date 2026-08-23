(() => {
  "use strict";

  // Mac-lineage window/menu/drag logic, adapted in spirit from
  // mac1984/app.js's own makeDraggable/makeResizable/focus/menu-bar
  // functions (see that file's own comments) -- genuinely new code, not a
  // shared module, since no Mac-lineage equivalent of
  // shared/redmond/window-manager.js exists and this task doesn't create
  // one (CLAUDE.md's mac1984/ section: do not touch or share code with
  // mac1984/'s own bespoke drag/window logic).
  //
  // Classic scripts sharing state via window.<Namespace> globals, same
  // convention as every other theme (see CLAUDE.md) -- this file reads
  // window.OqDictSource, window.OqHyphenation, window.OqRouter, and
  // window.OqDecon, all classic scripts that must load before this one
  // (see index.html's own script-order comment).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  function makeDraggable(handle, target) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest(".control-box, button, a, input, select, textarea")) return;
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
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      target.style.left = `${origX + dx}px`;
      target.style.top = `${origY + dy}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    function onLostPointerCapture() {
      activePointerId = null;
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", onLostPointerCapture);
  }

  // Real Mac OS 8.1 windows resize from a single bottom-right growbox only
  // -- unlike win98/xp/win7's own omnidirectional edge/corner resize
  // handles (a later Windows convention), the classic Mac Finder never
  // offered edge-drag resizing at all, only the one striped corner box.
  function makeResizable(handle, target, minWidth, minHeight) {
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
      event.stopPropagation(); // don't also trigger the window's own focus-on-pointerdown
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      target.style.height = `${Math.max(minHeight, startH + dy)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }

    function onLostPointerCapture() {
      activePointerId = null;
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    handle.addEventListener("lostpointercapture", onLostPointerCapture);
  }

  const desktop = document.getElementById("desktop");
  const windows = Array.from(document.querySelectorAll(".mac8-window:not(.mac8-dialog)"));
  let zTop = 10;

  // Swaps .mac8-title-bar's own "inactive" class, which is what actually
  // draws (or doesn't) the active-window chrome and hides/shows the close
  // and zoom boxes -- the whole activation mechanism, not a layer on top
  // of it, same idea as mac1984/app.js's own focus().
  function focus(win) {
    const bar = win.querySelector(".mac8-title-bar");
    if (!bar.classList.contains("inactive")) return; // already active
    for (const w of windows) {
      const b = w.querySelector(".mac8-title-bar");
      if (w === win) b.classList.remove("inactive");
      else b.classList.add("inactive");
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  // Router wiring only cares about OQ! and DECON's open/closed state --
  // every other window's open/closed state is plain UI state, not URL
  // state, same split win7/app.js makes for its own windows.
  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");

  function openWindow(win) {
    win.classList.remove("closed");
    focus(win);
  }

  function closeWindowEl(win) {
    const bar = win.querySelector(".mac8-title-bar");
    const wasActive = !bar.classList.contains("inactive");
    win.classList.add("closed");
    if (wasActive) {
      const next = windows.find((w) => w !== win && !w.classList.contains("closed"));
      if (next) focus(next);
    }
  }

  for (const win of windows) {
    const id = win.id;
    const titlebar = document.getElementById(`${id}-titlebar`);
    const closeBtn = document.getElementById(`${id}-close`);
    const zoomBtn = document.getElementById(`${id}-zoom`);
    const growbox = document.getElementById(`${id}-growbox`);

    makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));

    if (growbox) makeResizable(growbox, win, 224, 128); // matches .mac8-window's min-width/min-height

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (win === winOq || win === winDecon) {
          // Routed windows close via the URL, same single-source-of-truth
          // rule every other theme's router wiring follows (see
          // CLAUDE.md's dos/ section) -- never call closeWindowEl()
          // directly for these two.
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
          return;
        }
        closeWindowEl(win);
      });
    }

    // Zoom box: toggles between the window's current (dragged/resized)
    // rect and a rect filling the desktop -- the real Mac OS 8.1 zoom
    // box's behavior, restoring the exact prior rect on a second click
    // rather than a fixed "maximized" size.
    if (zoomBtn) {
      let savedRect = null;
      zoomBtn.addEventListener("click", () => {
        focus(win);
        if (savedRect) {
          win.style.top = savedRect.top;
          win.style.left = savedRect.left;
          win.style.width = savedRect.width;
          win.style.height = savedRect.height;
          savedRect = null;
        } else {
          savedRect = {
            top: win.style.top,
            left: win.style.left,
            width: win.style.width,
            height: win.style.height,
          };
          const desktopRect = desktop.getBoundingClientRect();
          win.style.top = "0px";
          win.style.left = "0px";
          win.style.width = `${desktopRect.width}px`;
          win.style.height = `${desktopRect.height}px`;
        }
      });
    }
  }

  // Desktop icons open (and re-open) their window on a single click.
  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      const target = document.getElementById(icon.dataset.open);
      if (!target) return;
      if (target === winOq) {
        window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
        return;
      }
      if (target === winDecon) {
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
        return;
      }
      openWindow(target);
    });
  }

  // Apple-menu "About This Macintosh..." also opens the About window.
  for (const item of document.querySelectorAll('[role="menu"] [data-open]')) {
    const link = item.querySelector("a");
    if (link) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(item.dataset.open);
        if (target) openWindow(target);
      });
    }
  }

  // ---------- Menu bar ----------
  // Same JS-owned open/close state as mac1984/app.js's own menu bar (see
  // its comment): the framework here (classic.css) supplies no menu-bar
  // component at all, so this whole block -- including the dropdown
  // visibility rule in style.css -- is this theme's own, not adapted from
  // a vendored default.
  const menuBar = document.getElementById("menu-bar");
  const menuItems = Array.from(
    menuBar.querySelectorAll(':scope > [role="menu-item"][aria-haspopup="true"]'),
  );
  let openMenuItem = null;

  function closeMenu() {
    if (!openMenuItem) return;
    openMenuItem.classList.remove("menu-open");
    openMenuItem.setAttribute("aria-expanded", "false");
    openMenuItem.blur();
    openMenuItem = null;
  }

  function openMenu(item) {
    if (openMenuItem === item) return;
    closeMenu();
    item.classList.add("menu-open");
    item.setAttribute("aria-expanded", "true");
    openMenuItem = item;
  }

  for (const item of menuItems) {
    item.setAttribute("aria-expanded", "false");
    item.addEventListener("click", (event) => {
      if (event.target.closest('[role="menu"]')) return; // handled by the link's own listener
      if (openMenuItem === item) closeMenu();
      else openMenu(item);
    });
    // Real Mac menu bars open whatever you're pointing at once a menu is
    // already open, so dragging across File/Edit/View works without
    // re-clicking each one.
    item.addEventListener("pointerenter", () => {
      if (openMenuItem && openMenuItem !== item) openMenu(item);
    });
    for (const link of item.querySelectorAll('[role="menu"] a')) {
      if (!link.closest("[data-open]")) {
        link.addEventListener("click", (event) => {
          event.preventDefault(); // every other menu command here is a placeholder ("#")
          closeMenu();
        });
      } else {
        link.addEventListener("click", () => closeMenu());
      }
    }
  }

  document.addEventListener("pointerdown", (event) => {
    if (openMenuItem && !menuBar.contains(event.target)) closeMenu();
  });

  // ---------- Shut Down ----------
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.getElementById("menu-shutdown").querySelector("a").addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    // Sends the visitor back to the theme picker, not just closing the
    // dialog -- a relative "../" so this keeps working when served from a
    // fork or a local http.server, same as every other theme's own Shut
    // Down/Turn Off Computer.
    window.location.href = "../";
  });

  // ---------- OQ! (Kalaallisut dictionary lookup) ----------
  // Same fetch/cache/filter/hyphenate pipeline as every other theme's own
  // OQ!, reused via shared/dict-source.js and shared/hyphenation.js.
  const OQ_DEFAULT_ROWS = 50;
  const OQ_MAX_FILTERED_ROWS = 200;

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqTbody = document.getElementById("oq-tbody");
  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

  let oqEntries = null;
  let oqLoadStarted = false;

  let oqSelectedRow = null;
  oqTbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    if (oqSelectedRow) oqSelectedRow.classList.remove("highlighted");
    row.classList.add("highlighted");
    oqSelectedRow = row;
  });

  function renderOqRows(rows) {
    oqTbody.textContent = "";
    oqSelectedRow = null;
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      lexemeCell.textContent = syllabify(entry.lexeme);
      const glossCell = document.createElement("td");
      glossCell.textContent = entry.gloss_en;
      row.append(lexemeCell, glossCell);
      oqTbody.appendChild(row);
    }
  }

  function renderOqResults() {
    if (oqEntries === null) return;

    const query = oqFilter.value.trim();
    if (query === "") {
      renderOqRows(oqEntries.slice(0, OQ_DEFAULT_ROWS));
      oqStatus.textContent = `${oqEntries.length.toLocaleString()} entries loaded -- showing first ${OQ_DEFAULT_ROWS}, type to filter.`;
      return;
    }

    const matches = filterDictEntries(oqEntries, query);
    renderOqRows(matches.slice(0, OQ_MAX_FILTERED_ROWS));
    oqStatus.textContent =
      matches.length === 0
        ? "No matches."
        : matches.length > OQ_MAX_FILTERED_ROWS
          ? `Showing first ${OQ_MAX_FILTERED_ROWS} of ${matches.length.toLocaleString()} matches.`
          : `${matches.length.toLocaleString()} match${matches.length === 1 ? "" : "es"}.`;
  }

  async function startOqLoad() {
    if (oqLoadStarted) return;
    oqLoadStarted = true;
    oqStatus.textContent = "Loading dictionary...";
    try {
      oqEntries = await loadDictEntries();
    } catch (err) {
      oqStatus.textContent = `Could not load dictionary (${err.message}). Close and reopen OQ! to retry.`;
      oqLoadStarted = false;
      return;
    }
    renderOqResults();
  }

  oqFilter.addEventListener("input", () => {
    renderOqResults();
    window.OqRouter.navigate({ filter: oqFilter.value || null }, { replace: true });
  });

  // ---------- DECON (word deconstruction) ----------
  // shared/decon-app.js owns the search/abort/order-persistence core --
  // rendering here is this theme's own sunken-panel-style markup.
  const deconWord = document.getElementById("decon-word");
  const deconRootFirst = document.getElementById("decon-root-first");
  const deconStatus = document.getElementById("decon-status");
  const deconResults = document.getElementById("decon-results");

  function renderDeconResults({ matches, dictMatch }) {
    deconResults.textContent = "";
    for (const match of matches) {
      const card = document.createElement("div");
      card.className = "decon-card";

      const header = document.createElement("div");
      const tag = document.createElement("span");
      tag.className = match.approximate ? "decon-tag decon-tag--approximate" : "decon-tag";
      tag.textContent = match.approximate ? "~ approximate" : "exact rebuild";
      const word = document.createElement("span");
      word.className = "decon-word";
      word.textContent = ` ${match.word}`;
      header.append(tag, word);
      card.appendChild(header);

      if (match.meaning) {
        const meaning = document.createElement("div");
        meaning.className = "decon-meaning";
        meaning.textContent = match.meaning;
        card.appendChild(meaning);
      }

      const breakdown = document.createElement("div");
      breakdown.className = "decon-breakdown";
      const rows = deconRootFirst.checked ? match.breakdown : [...match.breakdown].reverse();
      for (const { marker, text, changedRanges, gloss } of rows) {
        const row = document.createElement("div");
        let cursor = 0;
        row.appendChild(document.createTextNode(marker));
        for (const { start, end } of changedRanges) {
          if (start > cursor) row.appendChild(document.createTextNode(text.slice(cursor, start)));
          const changed = document.createElement("span");
          changed.className = "decon-truncated";
          changed.textContent = text.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
        row.appendChild(document.createTextNode(` - ${gloss}`));
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);

      deconResults.appendChild(card);
    }

    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      dictNote.textContent = `Found in the dictionary: ${dictMatch.expected} -- ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;
  deconRootFirst.checked = getStoredRootFirst();

  const deconController = createController({
    isRootFirst: () => deconRootFirst.checked,
    onStatus: (text) => { deconStatus.textContent = text; },
    onRender: (analysis) => renderDeconResults(analysis),
    onClear: () => { deconResults.textContent = ""; },
  });

  deconRootFirst.addEventListener("change", () => {
    setStoredRootFirst(deconRootFirst.checked);
    deconController.reRenderLast();
    window.OqRouter.navigate({ order: deconRootFirst.checked ? null : "final" }, { replace: true });
  });

  deconWord.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
    deconController.search(deconWord.value);
  });

  // ---------- Router wiring: OQ! and DECON's shared open/close/state ----------
  // Mirrors win7/app.js's identical onChange callback (see its own
  // comment) -- .closed/openWindow/focus stand in for that file's
  // minimize/forceOpenWindow/closeWindow since this theme has no taskbar
  // to minimize to.
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "oq") {
      if (winOq.classList.contains("closed")) openWindow(winOq);
      else focus(winOq);
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
      startOqLoad();
    } else if (screen === "decon") {
      if (winDecon.classList.contains("closed")) openWindow(winDecon);
      else focus(winDecon);
      const orderParam = params.get("order");
      const rootFirst = orderParam ? orderParam !== "final" : getStoredRootFirst();
      if (deconRootFirst.checked !== rootFirst) {
        deconRootFirst.checked = rootFirst;
        deconController.reRenderLast();
      }
      const word = params.get("word") || "";
      if (deconWord.value !== word) {
        deconWord.value = word;
        deconController.search(word);
      }
    } else {
      if (!winOq.classList.contains("closed")) closeWindowEl(winOq);
      if (!winDecon.classList.contains("closed")) closeWindowEl(winDecon);
    }
  });
})();
