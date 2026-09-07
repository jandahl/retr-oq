(() => {
  "use strict";
  let z = 10;
  const desktop = document.getElementById("desktop");
  function focus(win) { if (!win) return; z += 1; win.style.zIndex = z; for (const other of desktop.querySelectorAll(".os2-window")) other.classList.toggle("active", other === win); }
  function open(id) { const win = document.getElementById(id); if (!win) return; win.hidden = false; focus(win); }
  function close(win) { if (win) win.hidden = true; }
  desktop.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open]");
    if (opener) open(opener.dataset.open);
    const win = event.target.closest(".os2-window");
    if (win) focus(win);
    if (event.target.closest(".minimize, .close-window")) close(win);
    const menuButton = event.target.closest("[data-menu]");
    if (menuButton) {
      const menu = document.getElementById(menuButton.dataset.menu);
      const wasHidden = !menu || menu.hidden;
      for (const other of desktop.querySelectorAll(".os2-dropdown")) other.hidden = other !== menu;
      if (menu) menu.hidden = !wasHidden;
    }
    if (event.target.closest("[data-close-window]")) close(event.target.closest(".os2-window"));
  });
  for (const win of desktop.querySelectorAll(".os2-window")) {
    const bar = win.querySelector(".os2-titlebar");
    let drag = null;
    bar.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button") || event.target.closest("span")) return;
      focus(win); drag = { x: event.clientX - win.offsetLeft, y: event.clientY - win.offsetTop };
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => { if (drag) { win.style.left = `${Math.max(0, event.clientX - drag.x)}px`; win.style.top = `${Math.max(0, event.clientY - drag.y)}px`; } });
    bar.addEventListener("pointerup", () => { drag = null; });
  }
})();
