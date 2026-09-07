(() => {
  "use strict";
  let z = 10;
  const desktop = document.getElementById("desktop");
  const windowList = document.getElementById("window-list");
  const bootManager = document.getElementById("boot-manager");
  const bootCount = document.getElementById("boot-count");
  const bootChoiceSelect = document.getElementById("boot-choice");
  let bootChoice = "warp";
  let countdown = 5;
  function finishBoot() {
    window.clearInterval(bootTimer);
    bootManager.hidden = true;
    if (bootChoice === "win") open("win-os2-window");
  }
  function selectBoot(choice) {
    bootChoice = choice;
    bootChoiceSelect.value = choice;
    countdown = 5;
    bootCount.textContent = String(countdown);
  }
  const bootTimer = window.setInterval(() => {
    countdown -= 1;
    bootCount.textContent = String(countdown);
    if (countdown <= 0) finishBoot();
  }, 1000);
  if (new URLSearchParams(location.search).has("noboot")) finishBoot();
  bootChoiceSelect.addEventListener("change", () => selectBoot(bootChoiceSelect.value));
  bootManager.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); selectBoot(bootChoice === "warp" ? "win" : "warp"); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); finishBoot(); }
  });
  if (!bootManager.hidden) {
    bootManager.tabIndex = 0;
    bootManager.focus();
  }
  function focus(win) { if (!win) return; z += 1; win.style.zIndex = z; for (const other of desktop.querySelectorAll(".os2-window")) other.classList.toggle("active", other === win); }
  function open(id) { const win = document.getElementById(id); if (!win) return; win.hidden = false; focus(win); }
  function close(win) { if (win) win.hidden = true; }
  function renderWindowList() {
    windowList.textContent = "";
    for (const win of desktop.querySelectorAll(".os2-window")) {
      if (win.hidden) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = win.querySelector(".os2-titlebar span")?.textContent || "Window";
      button.addEventListener("click", () => { win.hidden = false; focus(win); });
      windowList.append(button);
    }
  }
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
    renderWindowList();
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
  renderWindowList();
})();
