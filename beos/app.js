(() => {
  "use strict";

  // BeOS R5 Tracker/Deskbar window logic — genuinely new code, not a
  // shared module. Yellow-tab chrome, hide-on-double-click, Deskbar in
  // the upper right. Not Redmond, not Mac-lineage (CLAUDE.md). Classic
  // scripts sharing state via window.<Namespace> globals.
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const bootScreen = document.getElementById("boot-screen");
  function finishBoot() {
    if (bootScreen.classList.contains("is-done")) return;
    bootScreen.classList.add("is-done");
  }
  bootScreen.addEventListener("click", finishBoot);
  const skipBoot = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.setTimeout(finishBoot, skipBoot ? 0 : 1400);

  const DRAG_SLOP = 4;

  function makeTabDrag(handle, target) {
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;
    let origTab = 0;
    let dragging = false;
    let tabSlide = false;
    let lastClickAt = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (event.target.closest(".be-close, .be-zoom, button, a, input, select, textarea")) return;
      activePointerId = event.pointerId;
      dragging = false;
      tabSlide = event.shiftKey;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;
      origTab = parseFloat(handle.style.getPropertyValue("--be-tab-x")) || 0;
      startX = event.clientX;
      startY = event.clientY;
      try { handle.setPointerCapture(event.pointerId); } catch { /* capture optional */ }
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        dragging = true;
      }
      if (tabSlide) {
        const max = Math.max(0, target.clientWidth - handle.offsetWidth - 16);
        const next = Math.max(0, Math.min(max, origTab + dx));
        handle.style.setProperty("--be-tab-x", `${next}px`);
        return;
      }
      target.style.left = `${origX + dx}px`;
      target.style.top = `${origY + dy}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      const wasDrag = dragging;
      activePointerId = null;
      dragging = false;
      if (handle.hasPointerCapture?.(event.pointerId)) {
        try { handle.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      }
      if (wasDrag) return;
      const now = Date.now();
      if (now - lastClickAt < 400) {
        lastClickAt = 0;
        hideWindow(target);
      } else {
        lastClickAt = now;
      }
    }

    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }

  function makeResize(handle, target, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let dragging = false;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      dragging = false;
      const rect = target.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startX = event.clientX;
      startY = event.clientY;
      try { handle.setPointerCapture(event.pointerId); } catch { /* capture optional */ }
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
        dragging = true;
      }
      target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      target.style.height = `${Math.max(minHeight, startH + dy)}px`;
    }

    function onPointerEnd(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      dragging = false;
      if (handle.hasPointerCapture?.(event.pointerId)) {
        try { handle.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
      }
    }

    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }

  const desktop = document.getElementById("desktop");
  const windows = Array.from(document.querySelectorAll(".be-window:not(.be-panel-window)"));
  let zTop = 10;
  const zooms = new Map();

  const desktopContextMenu = document.getElementById("desktop-context-menu");
  const desktopIcons = document.querySelector(".desktop-icons");
  const showIconsCheck = document.getElementById("desktop-context-showicons-check");
  const ICONS_HIDDEN_KEY = "retr-oq:beos-desktop-icons";

  function getIconsHidden() {
    try {
      return localStorage.getItem(ICONS_HIDDEN_KEY) === "hidden";
    } catch {
      return false;
    }
  }

  function setIconsHidden(hidden) {
    if (desktopIcons) desktopIcons.classList.toggle("is-hidden", hidden);
    if (showIconsCheck) showIconsCheck.classList.toggle("is-checked", !hidden);
    try {
      localStorage.setItem(ICONS_HIDDEN_KEY, hidden ? "hidden" : "shown");
    } catch { /* sandboxed iframe */ }
  }

  setIconsHidden(getIconsHidden());

  function closeDesktopContextMenu() {
    desktopContextMenu.hidden = true;
  }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop) return;
    event.preventDefault();
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 168;
    const menuHeight = 72;
    const left = Math.min(event.clientX, deskRect.right - menuWidth);
    const top = Math.min(event.clientY, deskRect.bottom - menuHeight);
    desktopContextMenu.style.left = `${left}px`;
    desktopContextMenu.style.top = `${top}px`;
    desktopContextMenu.hidden = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!desktopContextMenu.hidden && !desktopContextMenu.contains(event.target)) {
      closeDesktopContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !desktopContextMenu.hidden) closeDesktopContextMenu();
  });
  document.getElementById("desktop-context-cleanup").addEventListener("click", () => {
    for (const icon of document.querySelectorAll(".desktop-icon.is-selected")) {
      icon.classList.remove("is-selected");
    }
    closeDesktopContextMenu();
  });
  document.getElementById("desktop-context-showicons").addEventListener("click", () => {
    setIconsHidden(!getIconsHidden());
    closeDesktopContextMenu();
  });

  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");
  const deskApps = document.getElementById("desk-apps");
  const ICONS = {
    "win-oq": "art/icon-oq.svg",
    "win-decon": "art/icon-decon.svg",
    "win-tracker": "art/icon-home.svg",
    "win-about": "art/icon-disk.svg",
    "win-term": "art/icon-term.svg",
  };

  function isOpen(win) {
    return !win.classList.contains("closed") && !win.classList.contains("is-hidden");
  }

  function refreshDeskbar() {
    deskApps.textContent = "";
    for (const win of windows) {
      if (win.classList.contains("closed")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "be-deskbar-item";
      if (win.classList.contains("is-hidden")) btn.classList.add("is-hidden-app");
      if (!win.classList.contains("inactive") && isOpen(win)) btn.classList.add("is-front");
      const img = document.createElement("img");
      img.alt = "";
      img.width = 16;
      img.height = 16;
      img.src = ICONS[win.id] || "art/icon-disk.svg";
      const label = document.createElement("span");
      label.textContent = win.querySelector(".be-title")?.textContent || "Window";
      btn.append(img, label);
      btn.addEventListener("click", () => {
        if (win === winOq) {
          window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
          return;
        }
        if (win === winDecon) {
          window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
          return;
        }
        openWindow(win);
      });
      deskApps.appendChild(btn);
    }
  }

  function focus(win) {
    if (!win.classList.contains("inactive") && isOpen(win)) {
      if (Number(win.style.zIndex) >= zTop) {
        refreshDeskbar();
        return;
      }
    }
    for (const w of windows) {
      if (w === win) w.classList.remove("inactive");
      else w.classList.add("inactive");
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
    refreshDeskbar();
  }

  function openWindow(win) {
    win.classList.remove("closed");
    win.classList.remove("is-hidden");
    focus(win);
  }

  function closeWindowEl(win) {
    const wasActive = !win.classList.contains("inactive");
    win.classList.add("closed");
    win.classList.remove("is-hidden");
    zooms.delete(win);
    if (wasActive) {
      const next = windows.find((w) => w !== win && isOpen(w));
      if (next) focus(next);
      else win.classList.add("inactive");
    }
    refreshDeskbar();
  }

  function hideWindow(win) {
    if (win.classList.contains("closed")) return;
    win.classList.add("is-hidden");
    const next = windows.find((w) => w !== win && isOpen(w));
    if (next) focus(next);
    else win.classList.add("inactive");
    refreshDeskbar();
  }

  function zoomWindow(win) {
    const prev = zooms.get(win);
    if (prev) {
      win.style.left = prev.left;
      win.style.top = prev.top;
      win.style.width = prev.width;
      win.style.height = prev.height;
      zooms.delete(win);
      return;
    }
    zooms.set(win, {
      left: win.style.left,
      top: win.style.top,
      width: win.style.width,
      height: win.style.height,
    });
    const desk = desktop.getBoundingClientRect();
    win.style.left = "8px";
    win.style.top = "8px";
    win.style.width = `${Math.max(280, desk.width - 16)}px`;
    win.style.height = `${Math.max(180, desk.height - 16)}px`;
  }

  for (const win of windows) {
    const id = win.id;
    const tab = document.getElementById(`${id}-tab`);
    const closeBtn = document.getElementById(`${id}-close`);
    const zoomBtn = document.getElementById(`${id}-zoom`);
    const resize = document.getElementById(`${id}-resize`);

    win.classList.add("inactive");
    if (tab) makeTabDrag(tab, win);
    win.addEventListener("pointerdown", () => focus(win));
    if (resize) makeResize(resize, win, 240, 140);

    if (closeBtn) {
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (win === winOq || win === winDecon) {
          window.OqRouter.navigate({ screen: null, filter: null, word: null, order: null });
          return;
        }
        closeWindowEl(win);
      });
    }

    if (zoomBtn) {
      zoomBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        zoomWindow(win);
      });
    }
  }

  if (window.innerWidth < 640) {
    for (const win of windows) {
      win.style.left = "8px";
      win.style.top = "96px";
      win.style.width = `${Math.max(240, window.innerWidth - 16)}px`;
      win.style.height = `${Math.min(window.innerHeight - 120, 420)}px`;
    }
  }

  function openFromTarget(id) {
    const target = document.getElementById(id);
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
  }

  for (const icon of document.querySelectorAll(".desktop-icon[data-open], .tracker-row[data-open], .be-menu-item[data-open], .be-context-item[data-open]")) {
    icon.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".desktop-icon")) {
        other.classList.toggle("is-selected", other === icon);
      }
      closeBeMenu();
      closeDesktopContextMenu();
      openFromTarget(icon.dataset.open);
    });
  }

  const beMenuBtn = document.getElementById("be-menu-btn");
  const beMenu = document.getElementById("be-menu");
  function closeBeMenu() {
    beMenu.hidden = true;
    beMenuBtn.setAttribute("aria-expanded", "false");
  }
  function openBeMenu() {
    beMenu.hidden = false;
    beMenuBtn.setAttribute("aria-expanded", "true");
  }
  beMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (beMenu.hidden) openBeMenu();
    else closeBeMenu();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!beMenu.hidden && !beMenu.contains(event.target) && event.target !== beMenuBtn && !beMenuBtn.contains(event.target)) {
      closeBeMenu();
    }
  });

  const quitOverlay = document.getElementById("quit-overlay");
  document.getElementById("menu-restart").addEventListener("click", () => {
    closeBeMenu();
    quitOverlay.hidden = false;
  });
  document.getElementById("quit-cancel").addEventListener("click", () => {
    quitOverlay.hidden = true;
  });
  document.getElementById("quit-ok").addEventListener("click", () => {
    // GitHub Pages: parent folder is the hub. App Builder preview mounts
    // this theme in an iframe under a React shell, so reboot in place.
    if (window.self !== window.top) {
      window.location.reload();
      return;
    }
    window.location.href = "../";
  });

  const legalOverlay = document.getElementById("legal-overlay");
  document.getElementById("menu-legal").addEventListener("click", () => {
    closeBeMenu();
    legalOverlay.hidden = false;
  });
  function hideLegal() { legalOverlay.hidden = true; }
  document.getElementById("legal-ok").addEventListener("click", hideLegal);
  document.getElementById("legal-close").addEventListener("click", hideLegal);

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
          changed.className = "decon-truncated";
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

  window.OqRouter.onChange((params) => {
    const screen = params.get("screen");
    if (screen === "oq") {
      if (!isOpen(winOq)) openWindow(winOq);
      else focus(winOq);
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
      startOqLoad();
    } else if (screen === "decon") {
      if (!isOpen(winDecon)) openWindow(winDecon);
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
      if (!winOq.classList.contains("closed") && !winOq.classList.contains("is-hidden")) closeWindowEl(winOq);
      if (!winDecon.classList.contains("closed") && !winDecon.classList.contains("is-hidden")) closeWindowEl(winDecon);
    }
  });

  // ---------- Clock + CPU replicant ----------
  const clockEl = document.getElementById("desk-clock");
  let use24Hour = true;
  try {
    const resolved = Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions();
    if (typeof resolved.hour12 === "boolean") use24Hour = !resolved.hour12;
  } catch { /* default 24h */ }
  function updateClock() {
    const now = new Date();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    if (use24Hour) {
      clockEl.textContent = `${String(now.getHours()).padStart(2, "0")}:${minutes}`;
      return;
    }
    let hours = now.getHours();
    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    clockEl.textContent = `${hours}:${minutes} ${suffix}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  const cpuBars = Array.from(document.querySelectorAll("#cpu-replicant i"));
  function tickCpu() {
    for (const bar of cpuBars) {
      const h = 20 + Math.round(Math.random() * 80);
      bar.style.height = `${h}%`;
    }
  }
  tickCpu();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (!reduceMotion) setInterval(tickCpu, 700);

  // ---------- Terminal ----------
  const consoleLog = document.getElementById("console-log");
  const consoleCmd = document.getElementById("console-cmd");
  const panic = document.getElementById("panic");

  function appendConsole(line) {
    consoleLog.textContent += `${line}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  consoleCmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const raw = consoleCmd.value.trim();
    const cmd = raw.toLowerCase();
    appendConsole(`~/ > ${raw}`);
    consoleCmd.value = "";
    if (cmd === "debugger" || cmd === "panic" || cmd === "kernel") {
      panic.hidden = false;
      return;
    }
    if (cmd === "clear" || cmd === "cls") {
      consoleLog.textContent = "";
      return;
    }
    if (cmd === "help") {
      appendConsole("Commands: help, clear, date, ls, whoami");
      return;
    }
    if (cmd === "date") {
      appendConsole(new Date().toString());
      return;
    }
    if (cmd === "whoami") {
      appendConsole("baron");
      return;
    }
    if (cmd === "ls") {
      appendConsole("OQ!  DECON  Terminal  about");
      return;
    }
    if (cmd === "hey") {
      appendConsole("hey: application/x-vnd.retr-oq.Tracker got B_PULSE");
      return;
    }
    if (cmd === "") return;
    appendConsole(`bash: ${raw}: command not found`);
  });

  panic.addEventListener("click", () => { panic.hidden = true; });

  // Tracker is the shell — a BeBox always has a Home window running.
  openWindow(document.getElementById("win-tracker"));
  refreshDeskbar();
})();
