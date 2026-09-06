(() => {
  "use strict";
  let z = 10;
  const desktop = document.getElementById("desktop");
  function focus(win) { z += 1; win.style.zIndex = z; }
  function open(id) { const win = document.getElementById(id); if (!win) return; win.hidden = false; focus(win); }
  desktop.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open]");
    if (opener) open(opener.dataset.open);
    const win = event.target.closest(".os2-window");
    if (win) focus(win);
    if (event.target.closest(".minimize")) win.hidden = true;
  });
  for (const win of desktop.querySelectorAll(".os2-window")) {
    const bar = win.querySelector(".os2-titlebar");
    let drag = null;
    bar.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      focus(win); drag = { x: event.clientX - win.offsetLeft, y: event.clientY - win.offsetTop };
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => { if (drag) { win.style.left = `${Math.max(0, event.clientX - drag.x)}px`; win.style.top = `${Math.max(0, event.clientY - drag.y)}px`; } });
    bar.addEventListener("pointerup", () => { drag = null; });
  }
  open("system-window");
})();
