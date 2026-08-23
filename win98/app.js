(() => {
  "use strict";

  // Plain classic script, matching today's convention across this repo's
  // theme files (see CLAUDE.md) -- shares state with shared/dict-source.js,
  // shared/hyphenation.js, and shared/redmond/window-manager.js via
  // window.<Namespace> globals rather than imports, so index.html has to
  // load all three before this file (see its own comment on load order).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const desktop = document.getElementById("desktop");
  const taskbarWindows = document.getElementById("taskbar-windows");
  const windows = Array.from(document.querySelectorAll(".win98-window"));

  const MIN_WIN_WIDTH = 200;
  const MIN_WIN_HEIGHT = 120;

  // Drag/resize/focus/minimize/maximize/close/taskbar-buttons/viewport-
  // clamp -- none of that is actually Win98-specific, it's the Windows-
  // lineage window-chrome behavior shared/redmond/window-manager.js
  // extracts for reuse by a future Windows theme (XP, etc). What's
  // genuinely win98-specific stays below: OQ!'s own lazy dictionary load
  // (wired in as onOpen, since every window-opening trigger already
  // funnels through the shared module's one openWindow()), the Hot Dog
  // Stand/Display Properties scheme, the Shut Down dialog, and the
  // taskbar clock.
  const { openWindow } = window.OqRedmond.initWindowManager({
    desktop,
    taskbarWindows,
    windows,
    resizeHandleSelector: ".win98-resize-handle",
    minWidth: MIN_WIN_WIDTH,
    minHeight: MIN_WIN_HEIGHT,
    onOpen(win) {
      if (win.id === "win-oq") startOqLoad();
    },
  });

  // Start-menu items open their window on a single click -- a menu-item
  // convention, same as any real Windows Start menu, regardless of
  // pointer type.
  for (const el of document.querySelectorAll(".start-menu-item[data-open]")) {
    el.addEventListener("click", () => {
      const target = document.getElementById(el.dataset.open);
      if (target) openWindow(target);
    });
  }

  window.OqRedmond.initDesktopIcons({
    desktop,
    iconSelector: ".desktop-icon[data-open]",
    openWindow,
  });

  // ---------- Start menu ----------
  const startButton = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");
  const { close: closeStartMenu } = window.OqRedmond.initStartMenu({ startButton, startMenu });

  // ---------- Shut Down dialog ----------
  const shutdownOverlay = document.getElementById("shutdown-overlay");
  document.getElementById("start-menu-shutdown").addEventListener("click", () => {
    closeStartMenu();
    shutdownOverlay.hidden = false;
  });
  document.getElementById("shutdown-ok").addEventListener("click", () => {
    // "Shut down" sends the visitor back to the theme picker, not just
    // closing the dialog -- a relative "../" (not the absolute GitHub
    // Pages URL) so this keeps working when served from a fork or a local
    // http.server, same as every other cross-file reference in this repo.
    window.location.href = "../";
  });

  // ---------- Desktop right-click menu + Display Properties ----------
  // Real Windows 98: right-clicking the bare desktop opens a context menu
  // whose "Properties" item is the *only* path to the color-scheme
  // picker -- there's no icon, no Start-menu entry, nothing else pointing
  // at it. Same here on purpose: this is the one deliberately hidden
  // feature in this theme.
  const desktopContextMenu = document.getElementById("desktop-context-menu");

  function closeDesktopContextMenu() {
    desktopContextMenu.hidden = true;
  }

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target !== desktop) return; // not over an icon -- real Windows gives icons their own (unbuilt) context menu instead
    event.preventDefault();
    // Clamp so the menu never opens partly off-screen -- desktop.getBoundingClientRect()
    // excludes the taskbar already (see style.css's `bottom: 32px`), same
    // reasoning clampToViewport() above uses.
    const deskRect = desktop.getBoundingClientRect();
    const menuWidth = 180; // matches .start-menu's own min-width
    const menuHeight = 60; // one real item tall
    const left = Math.min(event.clientX, deskRect.right - menuWidth);
    const top = Math.min(event.clientY, deskRect.bottom - menuHeight);
    desktopContextMenu.style.left = `${left}px`;
    desktopContextMenu.style.top = `${top}px`;
    desktopContextMenu.style.bottom = "auto";
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

  const displayPropsOverlay = document.getElementById("display-props-overlay");
  const schemeSelect = document.getElementById("scheme-select");
  const SCHEME_STORAGE_KEY = "retr-oq:win98-scheme";
  let schemeBeforeDialog = "standard"; // for Cancel to revert to

  function getStoredScheme() {
    try {
      return localStorage.getItem(SCHEME_STORAGE_KEY) || "standard";
    } catch {
      return "standard"; // localStorage can throw in a sandboxed iframe -- fall back to the default rather than crash
    }
  }

  function applyScheme(scheme) {
    document.body.classList.toggle("hotdog-stand", scheme === "hotdog");
    try {
      localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
    } catch {
      // sandboxed iframe or storage disabled -- the scheme still applies for this visit, just doesn't persist
    }
  }

  // Applied on load too, not just from the dialog -- a returning visitor
  // who already found Hot Dog Stand should get it back immediately, the
  // same way a real OS remembers your chosen scheme across reboots.
  applyScheme(getStoredScheme());

  function openDisplayProperties() {
    schemeBeforeDialog = getStoredScheme();
    schemeSelect.value = schemeBeforeDialog;
    displayPropsOverlay.hidden = false;
  }

  // Two triggers reach the same dialog: the desktop's right-click
  // Properties item (mouse-only -- there's no real right-click gesture on
  // touch), and Display in the Settings window below (works identically
  // on touch and mouse alike, since it's a normal click target inside a
  // normal window, not a context-menu gesture).
  document.getElementById("desktop-context-properties").addEventListener("click", () => {
    closeDesktopContextMenu();
    openDisplayProperties();
  });
  document.getElementById("settings-display-icon").addEventListener("click", openDisplayProperties);
  document.getElementById("display-props-apply").addEventListener("click", () => {
    applyScheme(schemeSelect.value);
  });
  document.getElementById("display-props-ok").addEventListener("click", () => {
    applyScheme(schemeSelect.value);
    displayPropsOverlay.hidden = true;
  });
  document.getElementById("display-props-cancel").addEventListener("click", () => {
    applyScheme(schemeBeforeDialog); // undo any Apply already clicked, same as a real Cancel button
    displayPropsOverlay.hidden = true;
  });

  // ---------- Taskbar clock ----------
  // Real-time updating text, not a static screenshot-style clock (issue
  // #29 calls this out explicitly as a period-accurate touch 98.css
  // doesn't give you out of the box).
  const clockEl = document.getElementById("taskbar-clock");
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const suffix = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    clockEl.textContent = `${hours}:${minutes} ${suffix}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- OQ! (Kalaallisut dictionary lookup) ----------
  // Same fetch/cache/filter/hyphenate pipeline as dos/'s DICT.EXE, reused
  // via shared/dict-source.js and shared/hyphenation.js rather than
  // reimplemented -- only the rendering below is win98-flavored (a plain
  // scrollable table in a window instead of a full-screen text-mode
  // takeover).
  const OQ_DEFAULT_ROWS = 50; // shown before any filtering -- a browsable sample, not a blank table
  const OQ_MAX_FILTERED_ROWS = 200; // 17,000+ entries -- never render a full match set into the DOM

  const oqFilter = document.getElementById("oq-filter");
  const oqStatus = document.getElementById("oq-status");
  const oqTbody = document.getElementById("oq-tbody");
  document.getElementById("oq-attribution").textContent = DICT_ATTRIBUTION;

  let oqEntries = null; // null until a load succeeds
  let oqLoadStarted = false; // guards against re-fetching every time the window is reopened

  // Clicking/tapping a row selects it with the theme's own selection
  // color -- 98.css's real `table.interactive > tbody > tr.highlighted`
  // rule (navy background, white text), the same convention any other
  // 98.css table already uses, not a one-off style invented for this
  // table. Event delegation on the tbody itself, not a per-row listener,
  // since renderOqRows() below rebuilds every row from scratch on each
  // keystroke -- a per-row listener would need re-attaching every time,
  // this doesn't.
  let oqSelectedRow = null;
  oqTbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    if (oqSelectedRow) oqSelectedRow.classList.remove("highlighted");
    row.classList.add("highlighted");
    oqSelectedRow = row;
  });

  function renderOqRows(rows) {
    oqTbody.textContent = ""; // also drops whatever row was .highlighted -- nothing left to track
    oqSelectedRow = null;
    for (const entry of rows) {
      const row = document.createElement("tr");
      const lexemeCell = document.createElement("td");
      // syllabify() inserts soft hyphens at real Kalaallisut syllable
      // boundaries -- see dos/app.js's own comment on why this matters
      // more than generic overflow-wrap for this specific language.
      lexemeCell.textContent = syllabify(entry.lexeme);
      const glossCell = document.createElement("td");
      glossCell.textContent = entry.gloss_en;
      row.append(lexemeCell, glossCell);
      oqTbody.appendChild(row);
    }
  }

  function renderOqResults() {
    if (oqEntries === null) return; // still loading or failed -- oqStatus already says so

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
      oqLoadStarted = false; // let a retry actually re-fetch instead of silently no-op'ing forever
      return;
    }
    renderOqResults();
  }

  oqFilter.addEventListener("input", renderOqResults);
})();
