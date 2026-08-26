(() => {
  "use strict";

  // KDE 3.5 / Compiz Fusion theme. Own window manager (not Redmond, not
  // Mac-lineage): Plastik title-bar drag, 8-edge resize, Kicker tasks,
  // Compiz effects via window.OqCompiz. Router owns OQ!/DECON.

  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;
  const Compiz = window.OqCompiz;

  const desktop = document.getElementById("desktop");
  const tasksEl = document.getElementById("tasks");
  const windows = Array.from(document.querySelectorAll(".kde-window:not(.dialog)"));
  const MIN_W = 220;
  const MIN_H = 140;
  let zTop = 10;

  const ICONS = {
    oq: "art/icon-oq.png",
    decon: "art/icon-decon.png",
    home: "art/icon-home.png",
    konsole: "art/icon-konsole.png",
    kmenu: "art/icon-kmenu.png",
    trash: "art/icon-trash.png",
  };

  const state = new Map();
  for (const win of windows) {
    state.set(win, { taskBtn: null, preMax: null });
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  function isClosed(win) {
    return win.classList.contains("closed") || win.classList.contains("minimized");
  }

  function focus(win) {
    if (isClosed(win)) return;
    zTop += 1;
    win.style.zIndex = String(zTop);
    for (const w of windows) {
      w.classList.toggle("inactive", w !== win && !isClosed(w));
      const s = state.get(w);
      if (s.taskBtn) s.taskBtn.classList.toggle("active", w === win);
    }
  }

  function taskBtnFor(win) {
    const s = state.get(win);
    if (s.taskBtn) return s.taskBtn;
    const label = win.querySelector(".title-bar-text").textContent;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-btn";
    const icon = win.dataset.icon;
    if (icon && ICONS[icon]) {
      const img = document.createElement("img");
      img.src = ICONS[icon];
      img.alt = "";
      btn.appendChild(img);
    }
    const span = document.createElement("span");
    span.textContent = label;
    btn.appendChild(span);
    btn.addEventListener("click", () => {
      if (win.classList.contains("minimized")) openWindow(win);
      else if (win.style.zIndex === String(zTop)) toggleMin(win);
      else focus(win);
    });
    tasksEl.appendChild(btn);
    s.taskBtn = btn;
    return btn;
  }

  function forceOpen(win) {
    win.classList.remove("closed", "minimized");
    taskBtnFor(win);
    focus(win);
    clamp(win);
    if (win.id === "win-oq") startOqLoad();
  }

  function openWindow(win) {
    if (win.id === "win-oq") {
      window.OqRouter.navigate({ screen: "oq", filter: oqFilter.value || null });
      return;
    }
    if (win.id === "win-decon") {
      window.OqRouter.navigate({ screen: "decon", word: deconWord.value || null });
      return;
    }
    forceOpen(win);
  }

  async function closeWindow(win) {
    if (isClosed(win)) return;
    if (!Compiz.reduceMotion()) {
      try { await Compiz.burn(win); } catch { /* snapshot can fail; still close */ }
    }
    win.classList.add("closed");
    win.classList.remove("maximized", "minimized");
    const s = state.get(win);
    if (s.taskBtn) {
      s.taskBtn.remove();
      s.taskBtn = null;
    }
    if (win.id === "win-oq" || win.id === "win-decon") {
      window.OqRouter.navigate({ screen: null, filter: null, word: null });
    }
  }

  async function toggleMin(win) {
    if (win.classList.contains("minimized")) {
      forceOpen(win);
      return;
    }
    const s = state.get(win);
    const btn = s.taskBtn;
    if (!Compiz.reduceMotion() && btn) {
      try { await Compiz.lamp(win, btn.getBoundingClientRect()); } catch { /* still minimize */ }
    }
    win.classList.add("minimized");
    win.classList.remove("maximized");
    if (btn) btn.classList.remove("active");
  }

  function toggleMax(win) {
    const s = state.get(win);
    if (win.classList.contains("maximized")) {
      win.classList.remove("maximized");
      if (s.preMax) {
        win.style.top = s.preMax.top;
        win.style.left = s.preMax.left;
        win.style.width = s.preMax.width;
        win.style.height = s.preMax.height;
      }
    } else {
      s.preMax = {
        top: win.style.top,
        left: win.style.left,
        width: win.style.width,
        height: win.style.height,
      };
      win.classList.add("maximized");
    }
    focus(win);
  }

  function clamp(win) {
    if (win.classList.contains("maximized")) return;
    const desk = desktop.getBoundingClientRect();
    const rect = win.getBoundingClientRect();
    const width = Math.min(rect.width, Math.max(MIN_W, desk.width));
    const height = Math.min(rect.height, Math.max(MIN_H, desk.height));
    if (width !== rect.width) win.style.width = `${width}px`;
    if (height !== rect.height) win.style.height = `${height}px`;
    const maxLeft = Math.max(0, desk.width - width);
    const maxTop = Math.max(0, desk.height - height);
    const left = Math.min(Math.max(0, rect.left - desk.left), maxLeft);
    const top = Math.min(Math.max(0, rect.top - desk.top), maxTop);
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  function makeDraggable(handle, target) {
    let pid = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    let grabStarted = false;

    async function onDown(event) {
      if (event.button !== 0) return;
      if (pid !== null) return;
      if (target.classList.contains("maximized")) return;
      if (event.target.closest("button, a, input, select, textarea")) return;
      pid = event.pointerId;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      focus(target);
      grabStarted = false;
      if (!Compiz.reduceMotion()) {
        grabStarted = true;
        const ok = await Compiz.grab(target, event.clientX, event.clientY);
        if (!ok) grabStarted = false;
      }
      if (!grabStarted && pid !== null) {
        const rect = target.getBoundingClientRect();
        const parent = target.offsetParent.getBoundingClientRect();
        origX = rect.left - parent.left;
        origY = rect.top - parent.top;
        startX = event.clientX;
        startY = event.clientY;
        target.classList.remove("compiz-captured");
      }
    }
    function onMove(event) {
      if (event.pointerId !== pid) return;
      if (grabStarted) Compiz.move(event.clientX, event.clientY);
      else {
        target.style.left = `${Math.max(0, origX + (event.clientX - startX))}px`;
        target.style.top = `${Math.max(0, origY + (event.clientY - startY))}px`;
      }
    }
    async function onUp(event) {
      if (event.pointerId !== pid) return;
      pid = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (grabStarted) {
        const pos = await Compiz.release();
        grabStarted = false;
        if (pos && target.offsetParent) {
          const parent = target.offsetParent.getBoundingClientRect();
          target.style.left = `${Math.max(0, pos.x - parent.left)}px`;
          target.style.top = `${Math.max(0, pos.y - parent.top)}px`;
        }
      }
    }
    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function makeResizable(handle, target, dir) {
    let pid = null;
    let startX = 0, startY = 0, startW = 0, startH = 0, startTop = 0, startLeft = 0;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pid !== null) return;
      if (target.classList.contains("maximized")) return;
      pid = event.pointerId;
      const rect = target.getBoundingClientRect();
      const parent = target.offsetParent.getBoundingClientRect();
      startW = rect.width; startH = rect.height;
      startTop = rect.top - parent.top; startLeft = rect.left - parent.left;
      startX = event.clientX; startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      focus(target);
    });
    handle.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pid) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (dir.includes("e")) target.style.width = `${Math.max(MIN_W, startW + dx)}px`;
      if (dir.includes("s")) target.style.height = `${Math.max(MIN_H, startH + dy)}px`;
      if (dir.includes("w")) {
        const newW = Math.max(MIN_W, startW - dx);
        target.style.width = `${newW}px`;
        target.style.left = `${startLeft + (startW - newW)}px`;
      }
      if (dir.includes("n")) {
        const newH = Math.max(MIN_H, startH - dy);
        target.style.height = `${newH}px`;
        target.style.top = `${startTop + (startH - newH)}px`;
      }
    });
    function end(event) {
      if (event.pointerId !== pid) return;
      pid = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  for (const win of windows) {
    const title = win.querySelector(".title-bar");
    makeDraggable(title, win);
    win.addEventListener("pointerdown", () => focus(win));
    win.querySelector(".win-minimize").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMin(win);
    });
    win.querySelector(".win-maximize").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMax(win);
    });
    win.querySelector(".win-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeWindow(win);
    });
    title.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      toggleMax(win);
    });
    for (const h of win.querySelectorAll(".kde-resize")) {
      makeResizable(h, win, h.dataset.dir);
    }
    clamp(win);
  }
  window.addEventListener("resize", () => {
    for (const w of windows) clamp(w);
  });

  // ---------- Desktop icons ----------
  const opensOnTap = window.matchMedia("(pointer: coarse)").matches;
  let selectedIcon = null;
  for (const icon of desktop.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      if (selectedIcon) selectedIcon.classList.remove("selected");
      icon.classList.add("selected");
      selectedIcon = icon;
      if (opensOnTap) {
        const t = document.getElementById(icon.dataset.open);
        if (t) openWindow(t);
      }
    });
    if (!opensOnTap) {
      icon.addEventListener("dblclick", () => {
        const t = document.getElementById(icon.dataset.open);
        if (t) openWindow(t);
      });
    }
  }
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target === desktop) {
      if (selectedIcon) {
        selectedIcon.classList.remove("selected");
        selectedIcon = null;
      }
      Compiz.ripple(event.clientX, event.clientY);
    }
  });

  for (const el of document.querySelectorAll("[data-open]")) {
    if (el.classList.contains("desktop-icon")) continue;
    el.addEventListener("click", () => {
      const t = document.getElementById(el.dataset.open);
      if (t) openWindow(t);
      closeKMenu();
    });
  }

  // ---------- Kicker / K menu / clock ----------
  const kMenuBtn = document.getElementById("k-menu-btn");
  const kMenu = document.getElementById("k-menu");
  function closeKMenu() {
    kMenu.hidden = true;
    kMenuBtn.setAttribute("aria-expanded", "false");
  }
  kMenuBtn.addEventListener("click", () => {
    const open = kMenu.hidden;
    kMenu.hidden = !open;
    kMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("pointerdown", (event) => {
    if (!kMenu.hidden && !kMenu.contains(event.target) && !kMenuBtn.contains(event.target)) {
      closeKMenu();
    }
  });

  const leaveOverlay = document.getElementById("leave-overlay");
  document.getElementById("menu-leave").addEventListener("click", () => {
    closeKMenu();
    leaveOverlay.hidden = false;
  });
  document.getElementById("leave-cancel").addEventListener("click", () => {
    leaveOverlay.hidden = true;
  });
  document.getElementById("leave-ok").addEventListener("click", () => {
    window.location.href = "../";
  });

  const clockEl = document.getElementById("kicker-clock");
  function tickClock() {
    const n = new Date();
    clockEl.textContent = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  tickClock();
  setInterval(tickClock, 1000);

  document.getElementById("pager-cube").addEventListener("click", () => {
    Compiz.spinCube(desktop);
  });

  // ---------- Konsole ----------
  const konsoleLog = document.getElementById("konsole-log");
  const konsoleCmd = document.getElementById("konsole-cmd");
  function kprint(text) {
    konsoleLog.textContent += (konsoleLog.textContent.endsWith("\n") || konsoleLog.textContent === "" ? "" : "\n") + text;
    konsoleLog.scrollTop = konsoleLog.scrollHeight;
  }
  const KONSOLE_HELP = `oq, decon, about, home, clear, rain, cube, help, exit
(and a few others not listed here)`;
  konsoleCmd.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const raw = konsoleCmd.value;
    const line = raw.trim();
    konsoleCmd.value = "";
    kprint(`user@retr-oq:~$ ${raw}`);
    const cmd = line.toLowerCase();
    if (cmd === "" || cmd === "help" || cmd === "man") {
      kprint(KONSOLE_HELP);
    } else if (cmd === "clear" || cmd === "cls") {
      konsoleLog.textContent = "";
    } else if (cmd === "oq" || cmd === "oq!") {
      openWindow(document.getElementById("win-oq"));
    } else if (cmd === "decon") {
      openWindow(document.getElementById("win-decon"));
    } else if (cmd === "about") {
      openWindow(document.getElementById("win-about"));
    } else if (cmd === "home") {
      openWindow(document.getElementById("win-home"));
    } else if (cmd === "exit" || cmd === "logout" || cmd === "leave") {
      leaveOverlay.hidden = false;
    } else if (cmd === "rain" || cmd === "weather") {
      Compiz.setRain(!Compiz.isRaining());
      kprint(Compiz.isRaining() ? "Compiz rain plugin: on" : "Compiz rain plugin: off");
    } else if (cmd === "cube") {
      Compiz.spinCube(desktop);
    } else if (cmd === "fire") {
      kprint("Close a window. That's the fire plugin.");
    } else if (cmd === "wobble") {
      kprint("Grab a title bar. That's the wobble plugin.");
    } else if (cmd === "beryl" || cmd === "compiz --replace" || cmd === "compiz") {
      // Undocumented, same idea as dos/DOOM and win98 Hot Dog Stand.
      Compiz.setRain(true);
      Compiz.spinCube(desktop);
      kprint("Beryl 0.2.0 — enabling every plugin at once. Hold on.");
    } else if (cmd === "sudo rm -rf /" || cmd === "rm -rf /") {
      kprint("I don't think so.");
    } else if (cmd === "whoami") {
      kprint("user");
    } else if (cmd === "uname" || cmd === "uname -a") {
      kprint("Linux retr-oq 2.6.18-compiz #1 i686 GNU/Linux");
    } else {
      kprint(`bash: ${line}: command not found`);
    }
  });

  // ---------- OQ! ----------
  const winOq = document.getElementById("win-oq");
  const winDecon = document.getElementById("win-decon");
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
      if (isClosed(winOq)) forceOpen(winOq);
      else focus(winOq);
      const filter = params.get("filter") || "";
      if (oqFilter.value !== filter) {
        oqFilter.value = filter;
        renderOqResults();
      }
    } else if (screen === "decon") {
      if (isClosed(winDecon)) forceOpen(winDecon);
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
      if (!isClosed(winOq) && winOq.classList.contains("closed") === false) {
        /* leave OQ/DECON as the user left them unless the URL dropped both */
      }
    }
  });
})();
