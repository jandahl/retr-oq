(() => {
  "use strict";

  // Measures the actual rendered size of one character cell in the DOS
  // font, so dragging/resizing can snap to real character-grid steps
  // instead of hardcoding pixel values that would drift if the font or
  // font-size ever changes.
  function measureCell() {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "pre";
    probe.textContent = "0".repeat(20);
    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    const w = rect.width / 20;
    const h = probe.getBoundingClientRect().height || parseFloat(getComputedStyle(probe).lineHeight);
    document.body.removeChild(probe);
    return { w, h };
  }

  function snap(value, step) {
    return Math.round(value / step) * step;
  }

  function makeDraggable(handle, target, cell) {
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
      const dx = snap(event.clientX - startX, cell.w);
      const dy = snap(event.clientY - startY, cell.h);
      target.style.left = `${origX + dx}px`;
      target.style.top = `${origY + dy}px`;
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

  function makeResizable(handle, target, cell, minWidth, minHeight) {
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
      event.stopPropagation();
    }

    function onPointerMove(event) {
      if (event.pointerId !== activePointerId) return;
      const dx = snap(event.clientX - startX, cell.w);
      const dy = snap(event.clientY - startY, cell.h);
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
    handle.addEventListener("lostpointercapture", () => { activePointerId = null; });
  }

  // Measuring the cell before the vendored DOS font (@font-face, loaded
  // async) is actually ready would silently measure whatever fallback
  // font the stack lands on instead -- wrong, and different every load
  // depending on font-load timing. document.fonts.ready guarantees the
  // real font is active before anything gets measured or snapped.
  document.fonts.ready.then(() => {
    const cell = measureCell();
    const windows = Array.from(document.querySelectorAll(".dos-window"));
    let zTop = 10;

    // Snap each window's starting position/size to the grid too, so windows
    // begin life aligned the same way dragging/resizing keeps them aligned.
    // Also clamp to whatever actually fits the viewport -- the markup's
    // widths (e.g. 26em/28em) are fine on desktop but overflow a phone-width
    // viewport outright, pushing the growbox and part of the title off
    // screen with no way to reach either. Clamped size still snaps to the
    // grid, just against a smaller ceiling. document.documentElement's
    // clientWidth/clientHeight, not window.innerWidth/innerHeight -- the
    // latter measured ~520 in mobile-emulation testing here even though the
    // visual viewport was actually 375, an emulation quirk that would have
    // silently defeated this clamp entirely.
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    for (const win of windows) {
      const rect = win.getBoundingClientRect();
      const maxWidth = Math.max(cell.w * 20, viewportWidth - rect.left - cell.w);
      const maxHeight = Math.max(cell.h * 6, viewportHeight - rect.top - cell.h);
      win.style.width = `${snap(Math.min(rect.width, maxWidth), cell.w)}px`;
      win.style.height = `${snap(Math.min(rect.height, maxHeight), cell.h)}px`;
    }

    function focus(win) {
      if (win.classList.contains("active")) return;
      for (const w of windows) w.classList.toggle("active", w === win);
      zTop += 1;
      win.style.zIndex = String(zTop);
    }

    for (const win of windows) {
      const header = win.querySelector(".card-header");
      const closeBtn = win.querySelector(".close");

      makeDraggable(header, win, cell);
      win.addEventListener("pointerdown", () => focus(win));

      const growbox = win.querySelector(".dos-growbox");
      if (growbox) makeResizable(growbox, win, cell, cell.w * 20, cell.h * 6);

      if (closeBtn) {
        closeBtn.addEventListener("click", () => win.classList.add("closed"));
      }
    }

    if (windows.length) focus(windows[windows.length - 1]);
  });

  // DICT.EXE: a full-screen takeover of the dir listing, not a window --
  // see the comment at the top of style.css for why. No font/cell
  // measurement needed here, so this doesn't wait on document.fonts.ready
  // like the window machinery above does.
  const dirScreen = document.getElementById("dos-dir");
  const dictApp = document.getElementById("dict-app");
  const dictFilter = document.getElementById("dict-filter");
  const dictRows = Array.from(document.querySelectorAll("#dict-table tbody tr"));

  function launchDict() {
    dirScreen.hidden = true;
    dictApp.hidden = false;
    dictFilter.value = "";
    for (const row of dictRows) row.hidden = false;
    dictFilter.focus();
  }

  function exitDict() {
    dictApp.hidden = true;
    dirScreen.hidden = false;
  }

  document.getElementById("launch-dict").addEventListener("click", launchDict);
  document.getElementById("dict-exit").addEventListener("click", exitDict);

  dictFilter.addEventListener("input", () => {
    const query = dictFilter.value.trim().toLowerCase();
    for (const row of dictRows) {
      const text = row.textContent.toLowerCase();
      row.hidden = query !== "" && !text.includes(query);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dictApp.hidden) exitDict();
  });
})();
