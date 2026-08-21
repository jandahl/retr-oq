(() => {
  "use strict";

  // Plain classic script, matching today's convention across this repo's
  // theme files (see CLAUDE.md) -- no window.<Namespace> dependency needed
  // yet since this theme hosts no functional app inside a window (see
  // index.html's own comment on that deliberate scope choice).

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
      if (s) s.taskbarButton.classList.toggle("active", w === win);
    }
  }

  function isTopmost(win) {
    return win.style.zIndex === String(zTop);
  }

  function openWindow(win) {
    win.classList.remove("minimized");
    focus(win);
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
    const s = state.get(win);
    win.classList.add("minimized"); // no real content to lose here, so "close" just parks it -- see index.html's own scope note
    win.classList.remove("maximized");
    s.taskbarButton.remove();
    s.taskbarButton = null;
    taskbarButtonFor(win); // rebuild a fresh, unpressed button so reopening from the desktop icon still has one to click
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
    // Same glyph as this window's own desktop icon (win98/index.html's
    // data-icon), left of the title -- a real Win98 taskbar button always
    // carries the app's own small icon inside the same rectangle as its
    // title, not just plain text.
    const icon = win.dataset.icon;
    if (icon) {
      const iconEl = document.createElement("span");
      iconEl.className = "taskbar-window-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = icon;
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
    taskbarButtonFor(win);

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
  if (windows.length) focus(windows[0]);

  // Re-clamp on viewport changes -- a phone rotated from portrait to
  // landscape (or back) can otherwise leave a window that fit a moment
  // ago suddenly overflowing again, same reasoning as the initial clamp
  // above.
  window.addEventListener("resize", () => {
    for (const win of windows) clampToViewport(win);
  });

  // Desktop icons and Start-menu items both open the same window by
  // #id, via a shared data-open attribute -- one lookup, two triggers.
  function bindOpenTriggers(selector) {
    for (const el of document.querySelectorAll(selector)) {
      el.addEventListener("click", () => {
        const target = document.getElementById(el.dataset.open);
        if (target) openWindow(target);
      });
    }
  }
  bindOpenTriggers(".desktop-icon[data-open]");
  bindOpenTriggers(".start-menu-item[data-open]");

  // Desktop icon single-select-on-click, matching the rest of a real
  // desktop's selection feel (click elsewhere on the desktop clears it).
  let selectedIcon = null;
  for (const icon of document.querySelectorAll(".desktop-icon")) {
    icon.addEventListener("click", () => {
      if (selectedIcon) selectedIcon.classList.remove("selected");
      icon.classList.add("selected");
      selectedIcon = icon;
    });
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
    shutdownOverlay.hidden = true;
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
})();
