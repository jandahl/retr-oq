(() => {
  "use strict";

  function makeDraggable(handle, target) {
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

  // Same pointer-capture shape as makeDraggable, but resizes instead of moves.
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

  // Real Mac OS never showed a browser's own right-click menu over the
  // desktop -- suppress it, but let it through inside a window's own
  // scrollable content (the framework has no bare "desktop" element here).
  document.body.addEventListener("contextmenu", (event) => {
    if (!event.target.closest(".window-pane")) event.preventDefault();
  });

  const reopenBtn = document.getElementById("reopen");
  const windows = Array.from(document.querySelectorAll(".desktop-window"));
  let zTop = 10;

  // Swaps .title-bar/.inactive-title-bar, which is what actually draws
  // (or doesn't) the active-window chrome -- this is the whole activation
  // mechanism, not a layer on top of it.
  function focus(win) {
    const bar = win.querySelector(".title-bar, .inactive-title-bar");
    if (bar.classList.contains("title-bar")) return; // already active
    for (const w of windows) {
      const b = w.querySelector(".title-bar, .inactive-title-bar");
      if (w === win) {
        b.classList.remove("inactive-title-bar");
        b.classList.add("title-bar");
      } else if (b.classList.contains("title-bar")) {
        b.classList.remove("title-bar");
        b.classList.add("inactive-title-bar");
      }
    }
    zTop += 1;
    win.style.zIndex = String(zTop);
  }

  for (const win of windows) {
    const id = win.id;
    const titlebar = document.getElementById(`${id}-titlebar`);
    const closeBtn = document.getElementById(`${id}-close`);

    makeDraggable(titlebar, win);
    win.addEventListener("pointerdown", () => focus(win));

    const growbox = win.querySelector(".growbox");
    if (growbox) makeResizable(growbox, win, 224, 128); // matches .desktop-window's min-width/min-height

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const wasActive = titlebar.classList.contains("title-bar");
        win.classList.add("closed");
        reopenBtn.classList.add("visible");
        reopenBtn.dataset.target = id;
        if (wasActive) {
          const next = windows.find((w) => w !== win && !w.classList.contains("closed"));
          if (next) focus(next);
        }
      });
    }
  }

  reopenBtn.addEventListener("click", () => {
    const target = document.getElementById(reopenBtn.dataset.target || "win1");
    target.classList.remove("closed");
    reopenBtn.classList.remove("visible");
    focus(target);
  });

  document.getElementById("win2-icon").addEventListener("click", () => {
    const win2 = document.getElementById("win2");
    win2.classList.remove("closed");
    focus(win2);
  });

  // Menu bar: takes over open/closed state entirely in JS (see .menu-open
  // in style.css) instead of the framework's flicker-prone :focus CSS.
  const menuBar = document.querySelector(".desktop-menu-bar");
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
      if (event.target.closest('[role="menu"]')) return; // handled by the link's own listener below
      if (openMenuItem === item) closeMenu();
      else openMenu(item);
    });
    // Real Mac menu bars open whatever you're pointing at once a menu is
    // already open, so you can drag across File/Edit/View without re-clicking.
    item.addEventListener("pointerenter", () => {
      if (openMenuItem && openMenuItem !== item) openMenu(item);
    });
    for (const link of item.querySelectorAll('[role="menu"] a')) {
      if (link.id === "mac1984-shutdown") {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          closeMenu();
          // Every other theme's own Shut Down/Turn Off Computer sends the
          // visitor back to the hub -- relative "../" keeps working from a
          // fork or a local http.server too.
          window.location.href = "../";
        });
        continue;
      }
      link.addEventListener("click", (event) => {
        event.preventDefault(); // every other menu command here is a placeholder ("#")
        closeMenu();
      });
    }
  }

  document.addEventListener("pointerdown", (event) => {
    if (openMenuItem && !menuBar.contains(event.target)) closeMenu();
  });

  // Boot screen: gated behind a real click so the AudioContext is created
  // synchronously inside a user gesture, satisfying autoplay policies.
  const bootScreen = document.getElementById("boot-screen");
  const powerBtn = document.getElementById("power-btn");
  const bootSequence = document.getElementById("boot-sequence");

  function playBeep() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square"; // the real 128K Mac's startup beep, not the later multi-note chimes
      osc.frequency.value = 500;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Web Audio unavailable/blocked -- boot proceeds silently
    }
  }

  powerBtn.addEventListener(
    "click",
    () => {
      playBeep();
      powerBtn.hidden = true;
      bootSequence.hidden = false;
      bootSequence.classList.add("visible");
      setTimeout(() => {
        bootScreen.classList.add("hidden");
      }, 1400);
    },
    { once: true },
  );
})();
