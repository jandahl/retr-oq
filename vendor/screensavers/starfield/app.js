(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  const COUNT = 180;
  const stars = [];
  const meteors = [];
  let elapsed = 0;
  let nextMeteor = 3.5 + Math.random() * 1.5;

  function viewSize() {
    const vv = window.visualViewport;
    return {
      w: Math.max(1, Math.floor((vv && vv.width) || window.innerWidth || 320)),
      h: Math.max(1, Math.floor((vv && vv.height) || window.innerHeight || 200)),
    };
  }

  function spawn(star, far) {
    star.x = Math.random() * 2 - 1;
    star.y = Math.random() * 2 - 1;
    star.z = far ? 0.55 + Math.random() * 1.25 : 1.05 + Math.random() * 0.55;
    star.speed = 0.2 + Math.random() * 0.22;
  }

  function spawnMeteor() {
    const fromLeft = Math.random() < 0.5;
    return {
      x: fromLeft ? -20 : w + 20,
      y: Math.random() * h * 0.5,
      vx: (fromLeft ? 1 : -1) * (520 + Math.random() * 280),
      vy: 140 + Math.random() * 180,
      life: 0.55 + Math.random() * 0.35,
      age: 0,
    };
  }

  function resize() {
    const s = viewSize();
    w = canvas.width = s.w;
    h = canvas.height = s.h;
    while (stars.length < COUNT) {
      const star = {};
      spawn(star, true);
      stars.push(star);
    }
  }

  let t0 = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    elapsed += dt;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = Math.min(w, h) * 0.55;
    stars.forEach(function (s) {
      const ox = cx + (s.x / s.z) * scale;
      const oy = cy + (s.y / s.z) * scale;
      s.z -= s.speed * dt;
      const nx = cx + (s.x / s.z) * scale;
      const ny = cy + (s.y / s.z) * scale;
      const off =
        s.z <= 0.12 || nx < -20 || nx > w + 20 || ny < -20 || ny > h + 20;
      if (off) {
        spawn(s, false);
        return;
      }
      const near = 1 - Math.min(1, s.z);
      const size = 1 + near * 2.2;
      let dx = nx - ox;
      let dy = ny - oy;
      const len = Math.hypot(dx, dy);
      const maxTrail = 2 + near * 10;
      if (len > maxTrail && len > 0.001) {
        dx *= maxTrail / len;
        dy *= maxTrail / len;
      }
      ctx.strokeStyle = "rgba(255,255,255," + (0.3 + near * 0.7) + ")";
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(nx - dx, ny - dy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(nx - size * 0.4, ny - size * 0.4, size, size);
    });

    if (elapsed >= nextMeteor) {
      meteors.push(spawnMeteor());
      nextMeteor = elapsed + 2.2 + Math.random() * 3.2;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.age += dt;
      const px = m.x;
      const py = m.y;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const t = Math.max(0, 1 - m.age / m.life);
      ctx.strokeStyle = "rgba(220,230,255," + (0.35 + t * 0.65) + ")";
      ctx.lineWidth = 1.5 + t * 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255," + t + ")";
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
      if (m.age >= m.life || m.y > h + 40 || m.x < -40 || m.x > w + 40) {
        meteors.splice(i, 1);
      }
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
