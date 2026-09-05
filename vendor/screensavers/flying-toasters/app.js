(function () {
  "use strict";

  // Original gag geometry. Not Berkeley Systems art.
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  const toasters = [];
  const slices = [];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeToaster() {
    return {
      x: rand(0, w || 640),
      y: rand(40, (h || 400) - 40),
      z: rand(0.55, 1.2),
      speed: rand(55, 110),
      flap: rand(0, Math.PI * 2),
      toastIn: rand(2, 8),
    };
  }

  function viewSize() {
    const vv = window.visualViewport;
    return {
      w: Math.max(1, Math.floor((vv && vv.width) || window.innerWidth || 320)),
      h: Math.max(1, Math.floor((vv && vv.height) || window.innerHeight || 200)),
    };
  }

  function resize() {
    const s = viewSize();
    w = canvas.width = s.w;
    h = canvas.height = s.h;
    while (toasters.length < 9) toasters.push(makeToaster());
  }

  function drawToaster(t, now) {
    const s = 22 * t.z;
    const flap = Math.sin(now * 0.012 + t.flap) * 0.55;
    ctx.save();
    ctx.translate(t.x, t.y);

    ctx.fillStyle = "rgba(180,200,220,0.85)";
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.15);
    ctx.quadraticCurveTo(-s * 1.4, -s * 1.1 + flap * s, -s * 0.2, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.05);
    ctx.quadraticCurveTo(-s * 1.35, s * 1.05 - flap * s, -s * 0.15, s * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#c8c8d0";
    ctx.fillRect(-s * 0.85, -s * 0.45, s * 1.7, s * 0.95);
    ctx.fillStyle = "#9aa0a8";
    ctx.fillRect(-s * 0.85, s * 0.5, s * 1.7, s * 0.18);
    ctx.fillStyle = "#6a7078";
    ctx.fillRect(-s * 0.55, -s * 0.32, s * 0.42, s * 0.28);
    ctx.fillRect(s * 0.05, -s * 0.32, s * 0.42, s * 0.28);
    ctx.fillStyle = "#4a5058";
    ctx.fillRect(s * 0.72, -s * 0.08, s * 0.18, s * 0.16);
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(-s * 0.45, s * 0.72, s * 0.16, 0, Math.PI * 2);
    ctx.arc(s * 0.45, s * 0.72, s * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawSlice(sl) {
    const s = 10 * sl.z;
    ctx.save();
    ctx.translate(sl.x, sl.y);
    ctx.rotate(sl.rot);
    ctx.fillStyle = "#e6c27a";
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.7);
    ctx.lineTo(-s * 0.85, -s * 0.55);
    ctx.quadraticCurveTo(0, -s * 1.05, s * 0.85, -s * 0.55);
    ctx.lineTo(s, s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(-s * 0.55, -s * 0.15, s * 1.1, s * 0.55);
    ctx.restore();
  }

  let t0 = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    toasters.forEach(function (t) {
      t.x -= t.speed * dt;
      t.y += Math.sin(now * 0.0015 + t.flap) * 12 * dt;
      t.toastIn -= dt;
      if (t.toastIn <= 0) {
        slices.push({
          x: t.x,
          y: t.y - 18 * t.z,
          z: t.z,
          vx: -t.speed * 0.35,
          vy: -40 - Math.random() * 40,
          rot: Math.random() * Math.PI,
          spin: rand(-3, 3),
        });
        t.toastIn = rand(3, 9);
      }
      if (t.x < -80) {
        t.x = w + rand(20, 160);
        t.y = rand(40, h - 40);
      }
      drawToaster(t, now);
    });

    for (let i = slices.length - 1; i >= 0; i--) {
      const sl = slices[i];
      sl.x += sl.vx * dt;
      sl.vy += 55 * dt;
      sl.y += sl.vy * dt;
      sl.rot += sl.spin * dt;
      drawSlice(sl);
      if (sl.y > h + 40 || sl.x < -40) slices.splice(i, 1);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  resize();
  requestAnimationFrame(frame);
})();
