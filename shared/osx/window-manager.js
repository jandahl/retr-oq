(() => {
  "use strict";

  // OS X family window manager — shared by aqua/ and future Tiger /
  // Leopard skins. Classic scripts expose window.OqOsx (same convention
  // as window.OqRedmond). Not for mac1984/mac8 (no Dock, growbox-only
  // Platinum / System 1 semantics — see CLAUDE.md).
  //
  // Extracted so theme dirs stay mostly skin (CSS, art, period chrome
  // differences) + thin adapters. Behavior that belongs here: drag,
  // resize, focus/z-order, open/close/minimize/zoom, viewport clamp,
  // router hooks for OQ!/DECON.

  window.OqOsx = window.OqOsx || {};

  function getZoomFactor() {
    return parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  }

  window.OqOsx.getZoomFactor = getZoomFactor;

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.desktop
   * @param {HTMLElement[]} opts.windows
   * @param {number} [opts.minWidth=240]
   * @param {number} [opts.minHeight=140]
   * @param {string} [opts.inactiveClass="inactive"]
   * @param {string} [opts.closedClass="closed"]
   * @param {string} [opts.minimizedClass="minimized"]
   * @param {string} [opts.growboxSelector=".osx-growbox"]
   * @param {string} [opts.resizeHandleSelector=".osx-resize"]
   * @param {"growbox"|"edges"|"both"|"none"} [opts.resizeMode="growbox"]
   * @param {(win: HTMLElement) => boolean} [opts.routeOpen]
   * @param {(win: HTMLElement) => void} [opts.routeClose]
   * @param {(win: HTMLElement) => void} [opts.onOpen]
   * @param {(win: HTMLElement) => void} [opts.onClose]
   * @param {(win: HTMLElement) => void} [opts.onMinimize]
   * @param {(win: HTMLElement, finish: () => void) => void} [opts.onMinimizeAnimating]
   * @param {(win: HTMLElement) => void} [opts.onRestore]
   * @param {object} [opts.animation]
   */
  function initWindowManager({
    desktop,
    windows,
    minWidth = 240,
    minHeight = 140,
    inactiveClass = "inactive",
    closedClass = "closed",
    minimizedClass = "minimized",
    growboxSelector = ".osx-growbox",
    resizeHandleSelector = ".osx-resize",
    resizeMode = "growbox",
    routeOpen,
    routeClose,
    onOpen,
    onClose,
    onMinimize,
    onMinimizeAnimating,
    onRestore,
    animation,
  }) {
    let zTop = 10;
    const list = Array.from(windows);
    const state = new Map();
    const anim = Object.assign(
      {
        geometryMs: 180,
        geometryEasing: "cubic-bezier(0.34, 1.3, 0.64, 1)",
      },
      animation,
    );

    desktop.addEventListener("contextmenu", (event) => {
      if (event.target === desktop) event.preventDefault();
    });

    function withGeometryTransition(win, mutate) {
      if (reduceMotion()) {
        mutate();
        return;
      }
      win.style.transition =
        `top ${anim.geometryMs}ms ${anim.geometryEasing}, left ${anim.geometryMs}ms ${anim.geometryEasing}, ` +
        `width ${anim.geometryMs}ms ${anim.geometryEasing}, height ${anim.geometryMs}ms ${anim.geometryEasing}`;
      void win.offsetWidth;
      mutate();
      let done = false;
      function finish() {
        if (done) return;
        done = true;
        win.style.transition = "";
        win.removeEventListener("transitionend", onEnd);
      }
      function onEnd(event) {
        if (event.target === win) finish();
      }
      win.addEventListener("transitionend", onEnd);
      setTimeout(finish, anim.geometryMs + 80);
    }

    function clampToViewport(win) {
      if (win.classList.contains("zoomed")) return;
      const zoom = getZoomFactor();
      const deskRect = desktop.getBoundingClientRect();
      const rect = win.getBoundingClientRect();
      const width = Math.min(rect.width / zoom, Math.max(minWidth, deskRect.width / zoom));
      const height = Math.min(rect.height / zoom, Math.max(minHeight, deskRect.height / zoom));
      if (Math.abs(width - rect.width / zoom) > 0.5) win.style.width = `${width}px`;
      if (Math.abs(height - rect.height / zoom) > 0.5) win.style.height = `${height}px`;
      const maxLeft = Math.max(0, deskRect.width / zoom - width);
      const maxTop = Math.max(0, deskRect.height / zoom - height);
      const left = Math.min(Math.max(0, (rect.left - deskRect.left) / zoom), maxLeft);
      const top = Math.min(Math.max(0, (rect.top - deskRect.top) / zoom), maxTop);
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
    }

    function focus(win) {
      if (win.classList.contains(closedClass) || win.classList.contains(minimizedClass)) return;
      for (const w of list) {
        if (w === win) w.classList.remove(inactiveClass);
        else w.classList.add(inactiveClass);
      }
      zTop += 1;
      win.style.zIndex = String(zTop);
    }

    function forceOpenWindow(win) {
      const wasMinimized = win.classList.contains(minimizedClass);
      win.classList.remove(closedClass);
      win.classList.remove(minimizedClass);
      focus(win);
      if (wasMinimized && onRestore) onRestore(win);
      if (onOpen) onOpen(win);
    }

    function openWindow(win) {
      if (routeOpen && routeOpen(win)) return;
      forceOpenWindow(win);
    }

    function closeWindow(win) {
      const wasActive = !win.classList.contains(inactiveClass);
      win.classList.add(closedClass);
      win.classList.remove(minimizedClass);
      win.classList.remove("zoomed");
      const s = state.get(win);
      if (s) s.preZoomRect = null;
      if (wasActive) {
        const next = list.find(
          (w) => w !== win && !w.classList.contains(closedClass) && !w.classList.contains(minimizedClass),
        );
        if (next) focus(next);
        else win.classList.add(inactiveClass);
      }
      if (onClose) onClose(win);
    }

    function minimizeWindow(win) {
      if (win.classList.contains(closedClass) || win.classList.contains(minimizedClass)) return;
      if (win.dataset.osxMinimizing === "1") return;

      const finishMinimize = () => {
        win.classList.add(minimizedClass);
        win.classList.add(inactiveClass);
        delete win.dataset.osxMinimizing;
        // Clear any theme animation leftovers so restore starts clean.
        win.style.transition = "";
        win.style.transform = "";
        win.style.opacity = "";
        win.style.transformOrigin = "";
        win.style.pointerEvents = "";
        if (onMinimize) onMinimize(win);
      };

      // Mark inactive + focus next immediately so the shell stays responsive
      // while a theme genie (or similar) animates.
      win.classList.add(inactiveClass);
      const next = list.find(
        (w) => w !== win && !w.classList.contains(closedClass) && !w.classList.contains(minimizedClass),
      );
      if (next) focus(next);

      if (typeof onMinimizeAnimating === "function") {
        win.dataset.osxMinimizing = "1";
        onMinimizeAnimating(win, finishMinimize);
      } else {
        finishMinimize();
      }
    }

    function restoreWindow(win) {
      if (!win.classList.contains(minimizedClass) && !win.classList.contains(closedClass)) {
        focus(win);
        return;
      }
      forceOpenWindow(win);
    }

    function toggleZoom(win) {
      const s = state.get(win);
      focus(win);
      if (win.classList.contains("zoomed") && s.preZoomRect) {
        const target = s.preZoomRect;
        s.preZoomRect = null;
        withGeometryTransition(win, () => {
          win.classList.remove("zoomed");
          win.style.top = target.top;
          win.style.left = target.left;
          win.style.width = target.width;
          win.style.height = target.height;
        });
        return;
      }
      s.preZoomRect = {
        top: win.style.top,
        left: win.style.left,
        width: win.style.width,
        height: win.style.height,
      };
      const zoom = getZoomFactor();
      const desktopRect = desktop.getBoundingClientRect();
      withGeometryTransition(win, () => {
        win.classList.add("zoomed");
        win.style.top = "0px";
        win.style.left = "0px";
        win.style.width = `${desktopRect.width / zoom}px`;
        win.style.height = `${desktopRect.height / zoom}px`;
      });
    }

    function makeDraggable(handle, target) {
      let activePointerId = null;
      let startX = 0;
      let startY = 0;
      let origX = 0;
      let origY = 0;

      function onPointerDown(event) {
        if (event.button !== 0) return;
        if (activePointerId !== null) return;
        if (target.classList.contains("zoomed")) return;
        if (event.target.closest(".osx-traffic, button, a, input, select, textarea")) return;
        activePointerId = event.pointerId;
        const zoom = getZoomFactor();
        const rect = target.getBoundingClientRect();
        const parentRect = target.offsetParent.getBoundingClientRect();
        origX = (rect.left - parentRect.left) / zoom;
        origY = (rect.top - parentRect.top) / zoom;
        startX = event.clientX;
        startY = event.clientY;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
      }

      function onPointerMove(event) {
        if (event.pointerId !== activePointerId) return;
        const zoom = getZoomFactor();
        const dx = (event.clientX - startX) / zoom;
        const dy = (event.clientY - startY) / zoom;
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
      handle.addEventListener("lostpointercapture", () => {
        activePointerId = null;
      });
    }

    function makeGrowbox(handle, target) {
      let activePointerId = null;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;

      function onPointerDown(event) {
        if (event.button !== 0) return;
        if (activePointerId !== null) return;
        if (target.classList.contains("zoomed")) return;
        activePointerId = event.pointerId;
        const zoom = getZoomFactor();
        const rect = target.getBoundingClientRect();
        startW = rect.width / zoom;
        startH = rect.height / zoom;
        startX = event.clientX;
        startY = event.clientY;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      }

      function onPointerMove(event) {
        if (event.pointerId !== activePointerId) return;
        const zoom = getZoomFactor();
        const dx = (event.clientX - startX) / zoom;
        const dy = (event.clientY - startY) / zoom;
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
      handle.addEventListener("lostpointercapture", () => {
        activePointerId = null;
      });
    }

    function makeEdgeResize(handle, target, dir) {
      let activePointerId = null;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;
      let startTop = 0;
      let startLeft = 0;

      function onPointerDown(event) {
        if (event.button !== 0) return;
        if (activePointerId !== null) return;
        if (target.classList.contains("zoomed")) return;
        activePointerId = event.pointerId;
        const zoom = getZoomFactor();
        const rect = target.getBoundingClientRect();
        const parentRect = target.offsetParent.getBoundingClientRect();
        startW = rect.width / zoom;
        startH = rect.height / zoom;
        startTop = (rect.top - parentRect.top) / zoom;
        startLeft = (rect.left - parentRect.left) / zoom;
        startX = event.clientX;
        startY = event.clientY;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      }

      function onPointerMove(event) {
        if (event.pointerId !== activePointerId) return;
        const zoom = getZoomFactor();
        const dx = (event.clientX - startX) / zoom;
        const dy = (event.clientY - startY) / zoom;
        if (dir.includes("e")) target.style.width = `${Math.max(minWidth, startW + dx)}px`;
        if (dir.includes("s")) target.style.height = `${Math.max(minHeight, startH + dy)}px`;
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
      handle.addEventListener("lostpointercapture", () => {
        activePointerId = null;
      });
    }

    for (const win of list) {
      state.set(win, { preZoomRect: null });
      win.classList.add(inactiveClass);

      const titlebar = win.querySelector(".osx-titlebar");
      if (titlebar) makeDraggable(titlebar, win);
      win.addEventListener("pointerdown", () => focus(win));

      const closeBtn = win.querySelector(".osx-btn-close");
      const minBtn = win.querySelector(".osx-btn-minimize");
      const zoomBtn = win.querySelector(".osx-btn-zoom");

      if (closeBtn) {
        closeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          if (routeClose) {
            // Router-owned windows: navigate away; theme's onChange closes.
            // Still close non-routed ones directly.
            const routed = routeClose(win);
            if (routed) return;
          }
          closeWindow(win);
        });
      }
      if (minBtn) {
        minBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          minimizeWindow(win);
        });
      }
      if (zoomBtn) {
        zoomBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleZoom(win);
        });
      }
      if (titlebar) {
        titlebar.addEventListener("dblclick", (event) => {
          if (event.target.closest(".osx-traffic, button")) return;
          toggleZoom(win);
        });
      }

      if (resizeMode === "growbox" || resizeMode === "both") {
        const grow = win.querySelector(growboxSelector);
        if (grow) makeGrowbox(grow, win);
      }
      if (resizeMode === "edges" || resizeMode === "both") {
        for (const handle of win.querySelectorAll(resizeHandleSelector)) {
          makeEdgeResize(handle, win, handle.dataset.dir || "se");
        }
      }

      zTop += 1;
      win.style.zIndex = String(zTop);
    }

    for (const win of list) clampToViewport(win);
    window.addEventListener("resize", () => {
      for (const win of list) clampToViewport(win);
    });

    return {
      openWindow,
      forceOpenWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      toggleZoom,
      focus,
      clampToViewport,
      state,
      windows: list,
    };
  }

  window.OqOsx.initWindowManager = initWindowManager;

  /**
   * Menu-bar clock helper (24h when browser preference unknown).
   * @param {{ el: HTMLElement, intervalMs?: number }} opts
   */
  function initMenuClock({ el, intervalMs = 1000 }) {
    if (!el) return { update() {}, stop() {} };
    let use24Hour = true;
    try {
      const resolved = Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions();
      if (typeof resolved.hour12 === "boolean") use24Hour = !resolved.hour12;
    } catch {
      /* keep default */
    }
    function update() {
      const now = new Date();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      if (use24Hour) {
        el.textContent = `${String(now.getHours()).padStart(2, "0")}:${minutes}`;
        return;
      }
      let hours = now.getHours();
      const suffix = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      if (hours === 0) hours = 12;
      el.textContent = `${hours}:${minutes} ${suffix}`;
    }
    update();
    const id = setInterval(update, intervalMs);
    return {
      update,
      stop() {
        clearInterval(id);
      },
    };
  }

  window.OqOsx.initMenuClock = initMenuClock;
})();
