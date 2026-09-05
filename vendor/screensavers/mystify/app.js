(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;

  const PAL = [
    "#ff0000", "#00ff00", "#0000ff", "#ffff00",
    "#00ffff", "#ff00ff", "#ffffff", "#ff8000",
  ];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makePoly() {
    const verts = [];
    for (let i = 0; i < 4; i++) {
      verts.push({
        x: rand(20, Math.max(40, w - 20)),
        y: rand(20, Math.max(40, h - 20)),
        vx: rand(80, 180) * (Math.random() < 0.5 ? -1 : 1),
        vy: rand(80, 180) * (Math.random() < 0.5 ? -1 : 1),
      });
    }
    return {
      verts: verts,
      color: PAL[(Math.random() * PAL.length) | 0],
      next: 0,
    };
  }

  let polys = [];

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
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!polys.length) {
      polys = [makePoly(), makePoly()];
    }
  }

  let t0 = performance.now();

  function step(dt) {
    polys.forEach(function (p) {
      p.next -= dt;
      if (p.next <= 0) {
        p.color = PAL[(Math.random() * PAL.length) | 0];
        p.next = rand(1.4, 3.2);
      }
      p.verts.forEach(function (v) {
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        if (v.x < 0) {
          v.x = 0;
          v.vx = Math.abs(v.vx);
        } else if (v.x > w) {
          v.x = w;
          v.vx = -Math.abs(v.vx);
        }
        if (v.y < 0) {
          v.y = 0;
          v.vy = Math.abs(v.vy);
        } else if (v.y > h) {
          v.y = h;
          v.vy = -Math.abs(v.vy);
        }
      });
    });
  }

  function draw() {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, w, h);
    polys.forEach(function (p) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.verts[0].x, p.verts[0].y);
      for (let i = 1; i < p.verts.length; i++) {
        ctx.lineTo(p.verts[i].x, p.verts[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  resize();
  requestAnimationFrame(frame);
})();
