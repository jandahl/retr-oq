(() => {
  "use strict";

  // Thin Aqua adapter over shared/osx/. Theme-specific: boot chime,
  // OQ!/DECON rendering, shutdown dialog, icon selection, lamp minimize.
  // Window chrome / menu bar / Dock behavior come from OqOsx.*.

  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  // ---------- Boot ----------
  // Passive auto-boot like mac1984 (no power button). Optional chime on
  // first pointer/key unlocks AudioContext under autoplay policy.
  const bootScreen = document.getElementById("boot-screen");
  const bootSequence = document.getElementById("boot-sequence");

  function playStartup() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      // Soft two-tone nod to early Aqua startup — original, not a sample.
      const notes = [
        { freq: 392.0, start: 0, dur: 0.35 },
        { freq: 523.25, start: 0.22, dur: 0.55 },
        { freq: 659.25, start: 0.4, dur: 0.7 },
      ];
      for (const { freq, start, dur } of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      }
    } catch {
      /* Web Audio blocked — boot silently */
    }
  }

  if (bootScreen && bootSequence) {
    setTimeout(() => bootScreen.classList.add("is-done"), 1200);
    const unlockChime = () => {
      playStartup();
      window.removeEventListener("pointerdown", unlockChime, true);
      window.removeEventListener("keydown", unlockChime, true);
    };
    window.addEventListener("pointerdown", unlockChime, { once: true, capture: true });
    window.addEventListener("keydown", unlockChime, { once: true, capture: true });
  }

  // ---------- Shell ----------
  const desktop = document.getElementById("desktop");
  const windows = Array.from(document.querySelectorAll(".osx-window:not(.osx-dialog)"));
  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");

  let dockApi;
  let closingDictPair = false;

  function syncDockRunning() {
    // Running = not closed (minimized windows still show a Dock indicator).
    for (const win of windows) {
      dockApi.setRunning(win.id, !win.classList.contains("closed"));
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clearDictRouter() {
    window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
  }

  function closeDictPairWindows() {
    if (closingDictPair) return;
    closingDictPair = true;
    try {
      if (!winOq.classList.contains("closed")) wm.closeWindow(winOq);
      if (!winDecon.classList.contains("closed")) wm.closeWindow(winDecon);
    } finally {
      closingDictPair = false;
    }
  }

  // KDE Compiz-style lamp suck (cssLamp): transform-origin toward Dock
  // target, scale(0.04) + opacity 0. Zoom-safe — origin is %-based.
  const LAMP_MS = 480;

  function animateLampMinimize(win, finish) {
    if (prefersReducedMotion() || !dockApi) {
      finish();
      return;
    }
    const dockItem = dockApi.itemFor(win.id);
    if (!dockItem) {
      finish();
      return;
    }

    const winRect = win.getBoundingClientRect();
    const dockRect = dockItem.getBoundingClientRect();
    const tx = dockRect.left + dockRect.width / 2;
    const ty = dockRect.top + dockRect.height / 2;
    const ox = winRect.width ? ((tx - winRect.left) / winRect.width) * 100 : 50;
    const oy = winRect.height ? ((ty - winRect.top) / winRect.height) * 100 : 100;

    win.style.zIndex = String(9000);
    win.style.pointerEvents = "none";
    win.style.transition = "none";
    win.style.transform = "";
    win.style.opacity = "1";
    win.style.transformOrigin = `${ox}% ${oy}%`;
    win.classList.add("aqua-lamping");
    void win.offsetWidth;
    win.style.transition =
      `transform ${LAMP_MS}ms cubic-bezier(0.5, 0, 1, 0.3), ` +
      `opacity ${Math.round(LAMP_MS * 0.9)}ms ease-in`;
    win.style.transform = "scale(0.04)";
    win.style.opacity = "0";

    let done = false;
    function complete() {
      if (done) return;
      done = true;
      win.removeEventListener("transitionend", onEnd);
      win.classList.remove("aqua-lamping");
      finish();
    }
    function onEnd(event) {
      if (event.target === win && (event.propertyName === "transform" || event.propertyName === "opacity")) {
        complete();
      }
    }
    win.addEventListener("transitionend", onEnd);
    setTimeout(complete, LAMP_MS + 80);
  }

  const wm = window.OqOsx.initWindowManager({
    desktop,
    windows,
    minWidth: 240,
    minHeight: 140,
    resizeMode: "growbox",
    routeOpen(win) {
      if (win === winOq) {
        window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
        return true;
      }
      if (win === winDecon) {
        window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
        return true;
      }
      return false;
    },
    routeClose(win) {
      // Closing either dictionary app clears the router; onChange closes both.
      if (win === winOq || win === winDecon) {
        clearDictRouter();
        return true;
      }
      return false;
    },
    onOpen() {
      syncDockRunning();
    },
    onClose(win) {
      syncDockRunning();
      // Linked pair: if one dict window closed outside the router path,
      // clear router / close the other so both stay in sync.
      if (closingDictPair) return;
      if (win === winOq || win === winDecon) {
        const other = win === winOq ? winDecon : winOq;
        if (!other.classList.contains("closed")) {
          const screen = window.OqRouter.getParams().get("screen");
          if (screen === "oq" || screen === "decon") clearDictRouter();
          else closeDictPairWindows();
        }
      }
    },
    onMinimize() {
      syncDockRunning();
    },
    onMinimizeAnimating(win, finish) {
      animateLampMinimize(win, finish);
    },
    onRestore() {
      syncDockRunning();
    },
  });

  window.OqOsx.initMenuBar({ menuBar: document.getElementById("menu-bar") });

  // Early OS X menu clock often showed weekday + time (e.g. "Tue 7:14 PM").
  // Override shared initMenuClock (HH:MM only) in this theme only.
  (function initAquaMenuClock() {
    const el = document.getElementById("menu-clock");
    if (!el) return;
    function update() {
      const now = new Date();
      try {
        el.textContent = now.toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, "0");
        const suffix = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) h = 12;
        el.textContent = `${days[now.getDay()]} ${h}:${m} ${suffix}`;
      }
    }
    update();
    setInterval(update, 1000);
  })();

  dockApi = window.OqOsx.initDock({
    dock: document.getElementById("dock"),
    onLaunch(id) {
      const target = document.getElementById(id);
      if (!target) return;
      if (target.classList.contains("minimized")) {
        wm.restoreWindow(target);
        syncDockRunning();
        return;
      }
      if (!target.classList.contains("closed")) {
        wm.focus(target);
        return;
      }
      wm.openWindow(target);
      syncDockRunning();
    },
  });

  // Classic Aqua continuous Dock magnification (theme-side; shared/osx
  // only handles launch + running/bounce). Cosine falloff by pointer
  // distance; reduced-motion falls back to a mild single-icon lift.
  // Under CSS zoom, lift is divided by OqOsx.getZoomFactor (CLAUDE.md).
  (function initDockMagnification() {
    const dock = document.getElementById("dock");
    if (!dock || !dockApi) return;
    const items = dockApi.items;
    const MAX_SCALE = 1.55;
    const RANGE = 80; // post-zoom px (clientX / getBoundingClientRect agree)
    const LIFT = 14;

    function resetMagnify() {
      for (const el of items) {
        if (el.classList.contains("is-bouncing")) continue;
        el.style.transform = "";
        el.style.zIndex = "";
      }
      dock.classList.remove("is-magnifying");
    }

    function applyMagnify(clientX) {
      if (prefersReducedMotion()) return;
      const zoom = window.OqOsx.getZoomFactor ? window.OqOsx.getZoomFactor() : 1;
      dock.classList.add("is-magnifying");
      let best = null;
      let bestScale = 1;
      for (const el of items) {
        if (el.classList.contains("is-bouncing")) continue;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - cx);
        const t = Math.max(0, 1 - dist / RANGE);
        const scale = 1 + (MAX_SCALE - 1) * (0.5 - 0.5 * Math.cos(Math.PI * t));
        const lift = (LIFT * (scale - 1) / (MAX_SCALE - 1)) / zoom;
        el.style.transform = `translateY(${-lift}px) scale(${scale})`;
        el.style.zIndex = String(Math.round(scale * 100));
        if (scale > bestScale) {
          bestScale = scale;
          best = el;
        }
      }
      if (best) best.style.zIndex = "200";
    }

    dock.addEventListener("pointermove", (event) => {
      if (prefersReducedMotion()) return;
      applyMagnify(event.clientX);
    });
    dock.addEventListener("pointerleave", resetMagnify);
    dock.addEventListener("pointercancel", resetMagnify);
  })();

  function openFromChrome(id) {
    const target = document.getElementById(id);
    if (!target) return;
    if (target.classList.contains("minimized")) wm.restoreWindow(target);
    else wm.openWindow(target);
    syncDockRunning();
  }

  // Desktop icons: classic Mac/Aqua — single-click selects (blue label),
  // double-click opens. Coarse pointer / touch keeps single-click open.
  const opensOnSingleClick = window.matchMedia("(pointer: coarse)").matches;
  let selectedIcon = null;
  function selectDesktopIcon(icon) {
    if (selectedIcon) selectedIcon.classList.remove("selected");
    icon.classList.add("selected");
    selectedIcon = icon;
  }
  function clearDesktopSelection() {
    if (!selectedIcon) return;
    selectedIcon.classList.remove("selected");
    selectedIcon = null;
  }
  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      selectDesktopIcon(icon);
      if (opensOnSingleClick) openFromChrome(icon.dataset.open);
    });
    if (!opensOnSingleClick) {
      icon.addEventListener("dblclick", () => {
        selectDesktopIcon(icon);
        openFromChrome(icon.dataset.open);
      });
    }
  }
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".desktop-icon")) return;
    if (event.target === desktop || event.target.classList.contains("desktop-icons")) {
      clearDesktopSelection();
    }
  });

  // Finder icon-view / list-view items (Macintosh HD)
  for (const item of document.querySelectorAll(".finder-item[data-open], .finder-list-row[data-open]")) {
    item.addEventListener("click", () => {
      openFromChrome(item.dataset.open);
    });
  }

  // Finder toolbar view toggles (icon vs simple list)
  const winHome = document.getElementById("win-home");
  if (winHome) {
    const iconView = winHome.querySelector(".finder-icon-view");
    const listView = winHome.querySelector(".finder-list-view");
    const viewBtns = winHome.querySelectorAll("[data-finder-view]");
    for (const btn of viewBtns) {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.finderView;
        const icons = mode === "icons";
        if (iconView) iconView.hidden = !icons;
        if (listView) listView.hidden = icons;
        for (const b of viewBtns) {
          const on = b.dataset.finderView === mode;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        }
      });
    }
  }

  // Menu items with data-open
  for (const item of document.querySelectorAll('#menu-bar [data-open]')) {
    const link = item.querySelector("a");
    if (!link) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openFromChrome(item.dataset.open);
    });
  }

  // Placeholder menu links
  for (const link of document.querySelectorAll('#menu-bar [role="menu"] a')) {
    if (link.closest("[data-open], #menu-shutdown")) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  // Shut Down
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.querySelector("#menu-shutdown a").addEventListener("click", (event) => {
    event.preventDefault();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-cancel").addEventListener("click", () => {
    shutdownOverlay.hidden = true;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    window.location.href = "../";
  });

  // ---------- OQ! ----------
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
      oqStatus.textContent = `${oqEntries.length.toLocaleString()} entries loaded — showing first ${OQ_DEFAULT_ROWS}, type to filter.`;
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
    oqStatus.textContent = "Loading dictionary…";
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

  // ---------- DECON ----------
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
          changed.className = "decon-changed";
          changed.textContent = text.slice(start, end);
          row.appendChild(changed);
          cursor = end;
        }
        if (cursor < text.length) row.appendChild(document.createTextNode(text.slice(cursor)));
        row.appendChild(document.createTextNode(` — ${gloss}`));
        breakdown.appendChild(row);
      }
      card.appendChild(breakdown);
      deconResults.appendChild(card);
    }
    if (dictMatch) {
      const dictNote = document.createElement("p");
      dictNote.className = "decon-dict-match";
      dictNote.textContent = `Found in the dictionary: ${dictMatch.expected} — ${dictMatch.gloss_en}`;
      deconResults.appendChild(dictNote);
    }
  }

  const { getStoredRootFirst, setStoredRootFirst, createController } = window.OqDecon;
  deconRootFirst.checked = getStoredRootFirst();
  const deconController = createController({
    isRootFirst: () => deconRootFirst.checked,
    onStatus: (text) => {
      deconStatus.textContent = text;
    },
    onRender: (analysis) => renderDeconResults(analysis),
    onClear: () => {
      deconResults.textContent = "";
    },
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

  // ---------- Router ----------
  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "oq") {
      if (winOq.classList.contains("closed") || winOq.classList.contains("minimized")) {
        wm.forceOpenWindow(winOq);
      } else {
        wm.focus(winOq);
      }
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
      startOqLoad();
      syncDockRunning();
    } else if (screen === "decon") {
      if (winDecon.classList.contains("closed") || winDecon.classList.contains("minimized")) {
        wm.forceOpenWindow(winDecon);
      } else {
        wm.focus(winDecon);
      }
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
      syncDockRunning();
    } else {
      // screen: null — close both dictionary apps (linked pair).
      closeDictPairWindows();
      syncDockRunning();
    }
  });

  syncDockRunning();
})();
