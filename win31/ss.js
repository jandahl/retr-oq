// Flying Windows launcher for Program Manager > Accessories.
(function () {
  if (!window.OqScreensaver) return;
  const ss = window.OqScreensaver.attach({
    src: "../vendor/screensavers/flying-windows/index.html",
    idleMs: 45000,
  });
  const accSs = document.getElementById("acc-ss");
  if (!accSs) return;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const launch = () => ss.start();
  accSs.addEventListener("click", () => {
    if (coarse) launch();
  });
  if (!coarse) accSs.addEventListener("dblclick", launch);
})();
