(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const TEXT = "Windows 3.1";
  let w = 0;
  let h = 0;
  let x = 0;
  let y = 0;
  let bounce = 0;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    x = w + 40;
    y = h * 0.5;
  }

  let t0 = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const size = Math.max(28, Math.min(w, h) * 0.09);
    ctx.font = "bold " + size + "px \"MS Sans Serif\", Tahoma, sans-serif";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(TEXT).width;

    bounce += dt;
    y += Math.sin(bounce * 1.6) * 18 * dt * 8;
    if (y < size) y = size;
    if (y > h - size) y = h - size;

    x -= Math.max(90, w * 0.12) * dt;
    if (x < -tw - 40) {
      x = w + 40;
      y = 40 + Math.random() * (h - 80);
    }

    ctx.fillStyle = "#00ffff";
    ctx.fillText(TEXT, x, y);
    ctx.fillStyle = "#ffff00";
    ctx.fillText(TEXT, x + 2, y + 2);
    ctx.fillStyle = "#000080";
    ctx.fillRect(x - 4, y + size * 0.42, tw + 8, 4);

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
