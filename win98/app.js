(() => {
  "use strict";

  // Plain classic script, matching today's convention across this repo's
  // theme files (see CLAUDE.md) -- shares state with shared/dict-source.js
  // and shared/hyphenation.js via window.<Namespace> globals rather than
  // imports, so index.html has to load both before this file (see its own
  // comment on load order).
  const { loadDictEntries, filterDictEntries, DICT_ATTRIBUTION } = window.OqDictSource;
  const { syllabify } = window.OqHyphenation;

  const desktop = document.getElementById("desktop");
  const taskbarWindows = document.getElementById("taskbar-windows");
  const windows = Array.from(document.querySelectorAll(".win98-window"));
  let zTop = 10;

  const MIN_WIN_WIDTH = 200;
  const MIN_WIN_HEIGHT = 120;

  // The markup's starting top/left/width/height (index.html's inline
  // styles) are sized for a desktop viewport and overflow outright on a
  // phone-width screen -- same class of bug dos/app.js's own viewport
  // clamp exists to fix, just pixel-based here instead of character-grid
  // based. Without this a window's own title-bar buttons (close/minimize/
  // maximize) can end up entirely off-screen with no way to reach them,
  // since dragging only works from a titlebar that's at least partly
  // visible and tappable. Clamped against `desktop`'s own box, not
  // window.innerWidth/innerHeight -- .desktop already excludes the fixed
  // taskbar's height (see style.css's `bottom: 32px`), so clamping
  // against it keeps a window's bottom edge above the taskbar too.
  function clampToViewport(win) {
    if (win.classList.contains("maximized")) return; // fills the viewport by its own CSS rule, nothing to clamp
    const deskRect = desktop.getBoundingClientRect();
    const rect = win.getBoundingClientRect();

    const width = Math.min(rect.width, Math.max(MIN_WIN_WIDTH, deskRect.width));
    const height = Math.min(rect.height, Math.max(MIN_WIN_HEIGHT, deskRect.height));
    if (width !== rect.width) win.style.width = `${width}px`;
    if (height !== rect.height) win.style.height = `${height}px`;

    const maxLeft = Math.max(0, deskRect.width - width);
    const maxTop = Math.max(0, deskRect.height - height);
    const left = Math.min(Math.max(0, rect.left - deskRect.left), maxLeft);
    const top = Math.min(Math.max(0, rect.top - deskRect.top), maxTop);
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  }

  // Per-window state, keyed by element -- the pre-maximize rect so
  // "restore" can put a window back exactly where it was, and this
  // window's own taskbar button.
  const state = new Map();

  function focus(win) {
    if (win.classList.contains("minimized")) win.classList.remove("minimized");
    zTop += 1;
    win.style.zIndex = String(zTop);
    for (const w of windows) {
      const s = state.get(w);
      // A closed window has no taskbar button at all (see closeWindow) --
      // skip it rather than toggling .active on a null element.
      if (s && s.taskbarButton) s.taskbarButton.classList.toggle("active", w === win);
    }
  }

  function isTopmost(win) {
    return win.style.zIndex === String(zTop);
  }

  function openWindow(win) {
    // Closing removes this window's taskbar button entirely (see
    // closeWindow) -- reopening it, from a desktop icon or the Start menu,
    // needs to rebuild one before it can be focused/highlighted there.
    if (!state.get(win).taskbarButton) taskbarButtonFor(win);
    win.classList.remove("minimized");
    focus(win);
    // OQ! lazy-loads the dictionary on first open rather than at page
    // load, same idea as dos/'s DICT.EXE -- every trigger that can open a
    // window (desktop icon, Start menu, taskbar restore) already funnels
    // through this one function, so hooking it here covers all of them
    // without each trigger needing its own OQ!-specific special case.
    if (win.id === "win-oq") startOqLoad();
  }

  function toggleMinimize(win) {
    const willMinimize = !win.classList.contains("minimized");
    win.classList.toggle("minimized");
    if (willMinimize) {
      state.get(win).taskbarButton.classList.remove("active");
    } else {
      focus(win);
    }
  }

  function toggleMaximize(win) {
    const s = state.get(win);
    if (win.classList.contains("maximized")) {
      win.classList.remove("maximized");
      if (s.preMaximizeRect) {
        win.style.top = s.preMaximizeRect.top;
        win.style.left = s.preMaximizeRect.left;
        win.style.width = s.preMaximizeRect.width;
        win.style.height = s.preMaximizeRect.height;
      }
    } else {
      s.preMaximizeRect = {
        top: win.style.top,
        left: win.style.left,
        width: win.style.width,
        height: win.style.height,
      };
      win.classList.add("maximized");
    }
    focus(win);
  }

  function closeWindow(win) {
    // Real Win98 behavior: closing a window removes it from the taskbar
    // entirely, not just minimizes it -- the taskbar only ever shows
    // currently-running windows. Reusing .minimized for "hidden" is still
    // fine visually (there's no real content to lose here, see
    // index.html's own scope note), but the taskbar button itself has to
    // go too; openWindow() rebuilds a fresh one on next launch.
    const s = state.get(win);
    win.classList.add("minimized");
    win.classList.remove("maximized");
    s.taskbarButton.remove();
    s.taskbarButton = null;
  }

  // Drag/resize both use pointer capture the same way mac1984/app.js and
  // dos/app.js's makeDraggable/makeResizable do -- pixel-level movement
  // (not dos/'s character-grid snapping), since a GUI desktop, unlike a
  // text-mode one, never had in-between positions to avoid.
  function makeDraggable(handle, target) {
    let activePointerId = null;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (target.classList.contains("maximized")) return;
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
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      target.style.left = `${Math.max(0, origX + dx)}px`;
      target.style.top = `${Math.max(0, origY + dy)}px`;
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

  // One resize implementation shared by all 8 handles -- `dir` (n/s/e/w and
  // the 4 corners) says which edges move. Unlike mac1984's/dos's growbox
  // (bottom-right only), a north/west drag has to move top/left *and*
  // shrink width/height in the same gesture, not just grow from a fixed
  // top-left corner.
  function makeResizable(handle, target, dir, minWidth, minHeight) {
    let activePointerId = null;
    let startX = 0, startY = 0, startW = 0, startH = 0, startTop = 0, startLeft = 0;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      if (activePointerId !== null) return;
      if (target.classList.contains("maximized")) return;
      activePointerId = event.pointerId;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      startTop = rect.top - parentRect.top;
      startLeft = rect.left - parentRect.left;
      startX = event.clientX;
      startY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (dir.includes("e")) {
        target.style.width = `${Math.max(minWidth, startW + dx)}px`;
      }
      if (dir.includes("s")) {
        target.style.height = `${Math.max(minHeight, startH + dy)}px`;
      }
      if (dir.includes("w")) {
        const newW = Math.max(minWidth, startW - dx);
        target.style.width = `${newW}px`;
        target.style.left = `${startLeft + (startW - newW)}px`;
      }
      if (dir.includes("n")) {
        const newH = Math.max(minHeight, startH - dy);
        target.style.height = `${newH}px`;
        target.style.top = `${startTop + (startH - newH)}px`;
      }
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

  function taskbarButtonFor(win) {
    const s = state.get(win);
    const label = win.querySelector(".title-bar-text").textContent;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "taskbar-window-button";
    // Same icon art as this window's own desktop icon (win98/index.html's
    // data-icon names a shared .icon-<name> class defined in style.css,
    // rendered as a real SVG background rather than an emoji glyph -- see
    // that file's own comment on why), left of the title -- a real Win98
    // taskbar button always carries the app's own small icon inside the
    // same rectangle as its title, not just plain text.
    const icon = win.dataset.icon;
    if (icon) {
      const iconEl = document.createElement("span");
      iconEl.className = `taskbar-window-icon icon-${icon}`;
      iconEl.setAttribute("aria-hidden", "true");
      btn.appendChild(iconEl);
    }
    const labelEl = document.createElement("span");
    labelEl.className = "taskbar-window-label";
    labelEl.textContent = label;
    btn.appendChild(labelEl);
    btn.addEventListener("click", () => {
      if (win.classList.contains("minimized")) {
        openWindow(win);
      } else if (isTopmost(win)) {
        toggleMinimize(win);
      } else {
        focus(win);
      }
    });
    taskbarWindows.appendChild(btn);
    s.taskbarButton = btn;
    return btn;
  }

  for (const win of windows) {
    state.set(win, { preMaximizeRect: null, taskbarButton: null });
    // No taskbarButtonFor(win) here -- every window starts closed (see the
    // "start closed" block below), and a closed window has no taskbar
    // button at all, same as one closed via its own close button. One is
    // built on demand by openWindow() the first time each window is
    // actually opened.

    const titlebar = win.querySelector(".title-bar");
    makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));

    win.querySelector(".win-minimize").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMinimize(win);
    });
    win.querySelector(".win-maximize").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMaximize(win);
    });
    win.querySelector(".win-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeWindow(win);
    });
    titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      toggleMaximize(win);
    });

    for (const handle of win.querySelectorAll(".win98-resize-handle")) {
      makeResizable(handle, win, handle.dataset.dir, MIN_WIN_WIDTH, MIN_WIN_HEIGHT);
    }
  }

  for (const win of windows) clampToViewport(win);

  // Every window needs its own explicit z-index from the start, not just
  // whichever one ends up focused -- a window left at the default
  // z-index:auto paints at the same stacking level as ordinary in-flow
  // content, which is BELOW .desktop-icons' own explicit z-index: 1 (see
  // style.css). Without this, any window that had never yet been clicked/
  // focused would render behind the desktop icons -- an impossible state
  // on a real desktop, where icons always sit under every window. Stacked
  // in DOM order here, then focus() below both raises the last one
  // in front of that stack and gets its taskbar button highlighted.
  for (const win of windows) {
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  // Real Windows 98 boots to a bare desktop -- no windows open, an empty
  // taskbar apart from Start/clock. Marking every window .minimized here
  // (after clampToViewport() above, which needs each window's real
  // pre-hide layout to measure against -- getBoundingClientRect() on a
  // display:none element returns an all-zero rect) hides them the same
  // way closing one does, with no taskbar button (none was built above),
  // consistent with the closed state closeWindow()/openWindow() already
  // handle. No window is auto-focused either -- there's nothing to focus
  // until the visitor opens one themselves.
  for (const win of windows) win.classList.add("minimized");

  // Re-clamp on viewport changes -- a phone rotated from portrait to
  // landscape (or back) can otherwise leave a window that fit a moment
  // ago suddenly overflowing again, same reasoning as the initial clamp
  // above.
  window.addEventListener("resize", () => {
    for (const win of windows) clampToViewport(win);
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

  // Desktop icons: single-select-on-click always (matching the rest of a
  // real desktop's selection feel -- click elsewhere on the desktop clears
  // it), but *opening* forks on pointer type. A real Windows desktop opens
  // an icon on double-click; a touchscreen has no reliable double-tap
  // (and no hover to preview "selected" first), so touch keeps the
  // single-tap-opens behavior this theme shipped with initially.
  // (pointer: coarse) is evaluated once at load, same reasoning as the
  // resize-handle touch-target sizing in style.css -- true for
  // touchscreens, false for a mouse/trackpad including a touch-capable
  // laptop with a mouse attached.
  const opensOnSingleClick = window.matchMedia("(pointer: coarse)").matches;
  let selectedIcon = null;
  for (const icon of document.querySelectorAll(".desktop-icon[data-open]")) {
    icon.addEventListener("click", () => {
      if (selectedIcon) selectedIcon.classList.remove("selected");
      icon.classList.add("selected");
      selectedIcon = icon;
      if (opensOnSingleClick) {
        const target = document.getElementById(icon.dataset.open);
        if (target) openWindow(target);
      }
    });
    if (!opensOnSingleClick) {
      icon.addEventListener("dblclick", () => {
        const target = document.getElementById(icon.dataset.open);
        if (target) openWindow(target);
      });
    }
  }
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target === desktop && selectedIcon) {
      selectedIcon.classList.remove("selected");
      selectedIcon = null;
    }
  });

  // ---------- Start menu ----------
  const startButton = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");

  function closeStartMenu() {
    startMenu.hidden = true;
    startButton.setAttribute("aria-expanded", "false");
  }
  function openStartMenu() {
    startMenu.hidden = false;
    startButton.setAttribute("aria-expanded", "true");
  }
  startButton.addEventListener("click", () => {
    if (startMenu.hidden) openStartMenu();
    else closeStartMenu();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!startMenu.hidden && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
      closeStartMenu();
    }
  });
  for (const item of startMenu.querySelectorAll(".start-menu-item[data-open]")) {
    item.addEventListener("click", closeStartMenu);
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !startMenu.hidden) closeStartMenu();
  });

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
