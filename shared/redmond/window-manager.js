(() => {
  "use strict";

  // Plain classic script, matching this repo's convention (see CLAUDE.md):
  // exposes window.OqRedmond rather than exporting, so it loads before any
  // theme's own app.js the same way shared/dict-source.js and
  // shared/hyphenation.js already do.
  //
  // "Redmond" names the window-chrome family this belongs to, not a single
  // theme: 98.css and xp.css (same author lineage) share the same DOM
  // conventions for a window (.title-bar, .win-minimize/.win-maximize/
  // .win-close, a resize-handle-per-edge growbox, a taskbar button per
  // open window, a Start menu) even though Luna's visual style is a world
  // apart from Win98's. What's genuinely reusable across that family is
  // this behavior layer -- drag, resize, focus/z-order, minimize/maximize/
  // close, taskbar buttons, desktop icon selection, the Start menu -- not
  // a real theming engine (XP's own msstyles engine is native-app-level;
  // no CSS framework replicates it, xp.css just ships Luna as static CSS
  // the same way 98.css ships Win98). Extracted out of win98/app.js the
  // first time a second consumer of it was actually on the table, not
  // preemptively -- see that file's own comment on what's still
  // theme-specific (OQ!, Display Properties/Hot Dog Stand, the taskbar
  // clock, the Shut Down dialog).
  //
  // mac1984/ deliberately does NOT use this: its own drag/resize is
  // genuinely different (smooth pixel dragging is the point, there's no
  // taskbar or Start menu, a single top-of-screen menu bar replaces
  // per-window title-bar controls) -- forcing it through this module would
  // fight the abstraction, not share it.
  window.OqRedmond = window.OqRedmond || {};

  // ---------- Window manager (drag/resize/focus/minimize/maximize/close/taskbar) ----------
  //
  // `windows`: the .window elements to manage (already queried by the
  // caller -- this module doesn't own the selector, since a future theme
  // might scope it differently).
  // `desktop`: the positioning container windows drag/resize within, and
  // whose own box is what clampToViewport measures against.
  // `taskbarWindows`: where per-window taskbar buttons get appended.
  // `resizeHandleSelector`: class name of each window's 8 resize-handle
  // elements (data-dir on each says which edge(s) it moves).
  // `minWidth`/`minHeight`: floor for both the viewport clamp and resize.
  // `onOpen(win)`: optional hook run every time a window actually opens
  // (desktop icon, Start menu, taskbar restore all funnel through the one
  // openWindow() below) -- this is where a theme hooks its own
  // lazy-loaded content, e.g. win98/app.js's OQ! dictionary fetch.
  //
  // Returns the functions a theme's own UI (desktop icons, Start menu
  // items, taskbar buttons it builds itself) needs to trigger against
  // this window set.
  function initWindowManager({ desktop, taskbarWindows, windows, resizeHandleSelector, minWidth, minHeight, onOpen }) {
    let zTop = 10;

    // The markup's starting top/left/width/height (each theme's own inline
    // styles) are sized for a desktop viewport and overflow outright on a
    // phone-width screen -- same class of bug dos/app.js's own viewport
    // clamp exists to fix, just pixel-based here instead of character-grid
    // based. Without this a window's own title-bar buttons (close/
    // minimize/maximize) can end up entirely off-screen with no way to
    // reach them, since dragging only works from a titlebar that's at
    // least partly visible and tappable. Clamped against `desktop`'s own
    // box, not window.innerWidth/innerHeight -- a theme's own .desktop
    // rule already excludes its fixed taskbar's height, so clamping
    // against it keeps a window's bottom edge above the taskbar too.
    function clampToViewport(win) {
      if (win.classList.contains("maximized")) return; // fills the viewport by its own CSS rule, nothing to clamp
      const deskRect = desktop.getBoundingClientRect();
      const rect = win.getBoundingClientRect();

      const width = Math.min(rect.width, Math.max(minWidth, deskRect.width));
      const height = Math.min(rect.height, Math.max(minHeight, deskRect.height));
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
      // closeWindow) -- reopening it, from a desktop icon or the Start
      // menu, needs to rebuild one before it can be focused/highlighted
      // there.
      if (!state.get(win).taskbarButton) taskbarButtonFor(win);
      win.classList.remove("minimized");
      focus(win);
      if (onOpen) onOpen(win);
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
      // Real Windows behavior: closing a window removes it from the
      // taskbar entirely, not just minimizes it -- the taskbar only ever
      // shows currently-running windows. Reusing .minimized for "hidden"
      // is still fine visually, but the taskbar button itself has to go
      // too; openWindow() rebuilds a fresh one on next launch.
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

    // One resize implementation shared by all 8 handles -- `dir` (n/s/e/w
    // and the 4 corners) says which edges move. Unlike mac1984's/dos's
    // growbox (bottom-right only), a north/west drag has to move top/left
    // *and* shrink width/height in the same gesture, not just grow from a
    // fixed top-left corner.
    function makeResizable(handle, target, dir, minW, minH) {
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
          target.style.width = `${Math.max(minW, startW + dx)}px`;
        }
        if (dir.includes("s")) {
          target.style.height = `${Math.max(minH, startH + dy)}px`;
        }
        if (dir.includes("w")) {
          const newW = Math.max(minW, startW - dx);
          target.style.width = `${newW}px`;
          target.style.left = `${startLeft + (startW - newW)}px`;
        }
        if (dir.includes("n")) {
          const newH = Math.max(minH, startH - dy);
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
      // Same icon art as this window's own desktop icon (a theme's own
      // markup names a shared .icon-<name> class in its style.css,
      // rendered as a real SVG background rather than an emoji glyph),
      // left of the title -- a real Windows taskbar button always carries
      // the app's own small icon inside the same rectangle as its title,
      // not just plain text.
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
      // No taskbarButtonFor(win) here -- every window starts closed (see
      // the "start closed" block below), and a closed window has no
      // taskbar button at all, same as one closed via its own close
      // button. One is built on demand by openWindow() the first time
      // each window is actually opened.

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

      for (const handle of win.querySelectorAll(resizeHandleSelector)) {
        makeResizable(handle, win, handle.dataset.dir, minWidth, minHeight);
      }
    }

    for (const win of windows) clampToViewport(win);

    // Every window needs its own explicit z-index from the start, not
    // just whichever one ends up focused -- a window left at the default
    // z-index:auto paints at the same stacking level as ordinary in-flow
    // content, which is BELOW a theme's own .desktop-icons z-index (see
    // its style.css). Without this, any window that had never yet been
    // clicked/focused would render behind the desktop icons -- an
    // impossible state on a real desktop, where icons always sit under
    // every window. Stacked in DOM order here, then focus() below both
    // raises the last one in front of that stack and gets its taskbar
    // button highlighted.
    for (const win of windows) {
      zTop += 1;
      win.style.zIndex = String(zTop);
    }

    // Real Windows boots to a bare desktop -- no windows open, an empty
    // taskbar apart from Start/clock. Marking every window .minimized here
    // (after clampToViewport() above, which needs each window's real
    // pre-hide layout to measure against -- getBoundingClientRect() on a
    // display:none element returns an all-zero rect) hides them the same
    // way closing one does, with no taskbar button (none was built
    // above), consistent with the closed state closeWindow()/openWindow()
    // already handle. No window is auto-focused either -- there's nothing
    // to focus until the visitor opens one themselves.
    for (const win of windows) win.classList.add("minimized");

    // Re-clamp on viewport changes -- a phone rotated from portrait to
    // landscape (or back) can otherwise leave a window that fit a moment
    // ago suddenly overflowing again, same reasoning as the initial clamp
    // above.
    window.addEventListener("resize", () => {
      for (const win of windows) clampToViewport(win);
    });

    return { openWindow, closeWindow, toggleMinimize, toggleMaximize, focus, isTopmost, clampToViewport, state };
  }

  window.OqRedmond.initWindowManager = initWindowManager;

  // ---------- Desktop icon selection/open ----------
  //
  // Single-select-on-click always (matching the rest of a real desktop's
  // selection feel -- click elsewhere on the desktop clears it), but
  // *opening* forks on pointer type. A real Windows desktop opens an icon
  // on double-click; a touchscreen has no reliable double-tap (and no
  // hover to preview "selected" first), so touch opens on a single tap
  // instead. (pointer: coarse) is evaluated once at load, same reasoning
  // as a theme's own resize-handle touch-target sizing -- true for
  // touchscreens, false for a mouse/trackpad including a touch-capable
  // laptop with a mouse attached.
  //
  // `iconSelector` should already scope to icons carrying data-open (the
  // id of the window to launch).
  function initDesktopIcons({ desktop, iconSelector, openWindow }) {
    const opensOnSingleClick = window.matchMedia("(pointer: coarse)").matches;
    let selectedIcon = null;
    for (const icon of desktop.querySelectorAll(iconSelector)) {
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
  }

  window.OqRedmond.initDesktopIcons = initDesktopIcons;

  // ---------- Start menu ----------
  //
  // Open/close plus the three ways a real Start menu closes itself: an
  // outside click, Escape, and clicking any item that opens something
  // (data-open items only -- a theme's own non-launching items, like Shut
  // Down, handle their own close timing since opening a dialog afterward
  // needs the menu gone first, not simultaneously).
  function initStartMenu({ startButton, startMenu }) {
    function close() {
      startMenu.hidden = true;
      startButton.setAttribute("aria-expanded", "false");
    }
    function open() {
      startMenu.hidden = false;
      startButton.setAttribute("aria-expanded", "true");
    }
    startButton.addEventListener("click", () => {
      if (startMenu.hidden) open();
      else close();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!startMenu.hidden && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
        close();
      }
    });
    for (const item of startMenu.querySelectorAll(".start-menu-item[data-open]")) {
      item.addEventListener("click", close);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !startMenu.hidden) close();
    });
    return { open, close };
  }

  window.OqRedmond.initStartMenu = initStartMenu;
})();
