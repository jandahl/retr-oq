(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // Period Marquee: Times New Roman, fuchsia on black. Copy is oq!.
  const TEXT = "oq!";
  const FACE = "#ff00ff";
  let w = 0;
  let h = 0;
  let x = 0;
  let y = 0;

  function viewSize() {
    const vv = window.visualViewport;
    return {
      w: Math.max(1, Math.floor((vv && vv.width) || window.innerWidth || 320)),
      h: Math.max(1, Math.floor((vv && vv.height) || window.innerHeight || 200)),
    };
  }

  function fontSize() {
    return Math.max(48, Math.min(w, h) * 0.18);
  }

  function randomY(size) {
    const pad = size;
    return pad + Math.random() * Math.max(1, h - pad * 2);
  }

  function resize() {
    const s = viewSize();
    w = canvas.width = s.w;
    h = canvas.height = s.h;
    x = w + 40;
    y = h * 0.5;
  }

  let t0 = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const size = fontSize();
    ctx.font = "bold " + size + 'px "Times New Roman", Times, Georgia, serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const tw = ctx.measureText(TEXT).width;

    x -= Math.max(110, w * 0.14) * dt;
    if (x < -tw - 40) {
      x = w + 40;
      y = randomY(size);
    }

    ctx.fillStyle = FACE;
    ctx.fillText(TEXT, x, y);

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  resize();
  requestAnimationFrame(frame);
})();
