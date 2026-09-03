(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;

  const COLORS = ["#ff4040", "#40ff40", "#4040ff", "#ffff40", "#40ffff", "#ff40ff"];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeCurve() {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      pts.push({
        x: rand(0, w || 320),
        y: rand(0, h || 200),
        vx: rand(40, 120) * (Math.random() < 0.5 ? -1 : 1),
        vy: rand(40, 120) * (Math.random() < 0.5 ? -1 : 1),
      });
    }
    return { pts: pts, color: COLORS[(Math.random() * COLORS.length) | 0] };
  }

  let curves = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!curves.length) {
      curves = [makeCurve(), makeCurve(), makeCurve()];
    }
  }

  let t0 = performance.now();

  function bounce(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0) {
      p.x = 0;
      p.vx = Math.abs(p.vx);
    } else if (p.x > w) {
      p.x = w;
      p.vx = -Math.abs(p.vx);
    }
    if (p.y < 0) {
      p.y = 0;
      p.vy = Math.abs(p.vy);
    } else if (p.y > h) {
      p.y = h;
      p.vy = -Math.abs(p.vy);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, w, h);
    curves.forEach(function (c) {
      c.pts.forEach(function (p) {
        bounce(p, dt);
      });
      const p = c.pts;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
      ctx.stroke();
    });
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
