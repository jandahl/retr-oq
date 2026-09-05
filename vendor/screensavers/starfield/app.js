(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  const COUNT = 180;
  const stars = [];

  function spawn(star, far) {
    star.x = (Math.random() * 2 - 1) * 0.9;
    star.y = (Math.random() * 2 - 1) * 0.9;
    star.z = far ? Math.random() * 1 + 0.4 : 0.05 + Math.random() * 0.2;
    star.speed = 0.18 + Math.random() * 0.28;
  }

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    while (stars.length < COUNT) {
      const s = {};
      spawn(s, true);
      stars.push(s);
    }
  }

  let t0 = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = Math.min(w, h) * 0.55;
    stars.forEach(function (s) {
      const ox = cx + (s.x / s.z) * scale;
      const oy = cy + (s.y / s.z) * scale;
      s.z -= s.speed * dt;
      if (s.z <= 0.02) spawn(s, false);
      const nx = cx + (s.x / s.z) * scale;
      const ny = cy + (s.y / s.z) * scale;
      const near = 1 - Math.min(1, s.z);
      const size = 1 + near * 2.4;
      ctx.strokeStyle = "rgba(255,255,255," + (0.35 + near * 0.65) + ")";
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(nx - size * 0.4, ny - size * 0.4, size, size);
    });
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
