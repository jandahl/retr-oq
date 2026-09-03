(function () {
  "use strict";

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let w = 0;
  let h = 0;
  let t0 = performance.now();

  const fish = [];
  const bubbles = [];
  const plants = [];
  const gravel = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    layoutDecor();
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  const PALETTES = [
    { body: "#e85d04", fin: "#ffba08", stripe: "#fff3b0", eye: "#1a1a1a" },
    { body: "#0077b6", fin: "#90e0ef", stripe: "#caf0f8", eye: "#0b132b" },
    { body: "#9b2226", fin: "#ee9b00", stripe: "#e9d8a6", eye: "#1d0200" },
    { body: "#2d6a4f", fin: "#95d5b2", stripe: "#d8f3dc", eye: "#081c15" },
    { body: "#6a4c93", fin: "#c77dff", stripe: "#e0aaff", eye: "#240046" },
    { body: "#f4a261", fin: "#e76f51", stripe: "#fff1d0", eye: "#264653" },
    { body: "#ffdd00", fin: "#ff7b00", stripe: "#fffde7", eye: "#1b1b1b" },
  ];

  function makeFish() {
    const pal = pick(PALETTES);
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      x: rand(0, w),
      y: rand(h * 0.12, h * 0.72),
      z: rand(0.45, 1.15),
      dir: dir,
      speed: rand(18, 52),
      bob: rand(0, Math.PI * 2),
      bobAmp: rand(4, 14),
      pal: pal,
      kind: (Math.random() * 3) | 0,
      wiggle: rand(0, Math.PI * 2),
    };
  }

  function layoutDecor() {
    plants.length = 0;
    gravel.length = 0;
    const nPlants = Math.max(6, Math.round(w / 140));
    for (let i = 0; i < nPlants; i++) {
      plants.push({
        x: (i + 0.3 + Math.random() * 0.4) * (w / nPlants),
        h: rand(h * 0.18, h * 0.42),
        segs: 5 + ((Math.random() * 4) | 0),
        phase: rand(0, Math.PI * 2),
        hue: rand(110, 150),
        lean: rand(-0.25, 0.25),
      });
    }
    const nG = Math.max(40, Math.round(w / 18));
    for (let i = 0; i < nG; i++) {
      gravel.push({
        x: rand(0, w),
        y: rand(h * 0.9, h),
        r: rand(4, 14),
        c: pick(["#6b4f2a", "#8a6a3b", "#5a4630", "#a0845c", "#4a3728", "#c4b07a"]),
      });
    }
    while (fish.length < 14) fish.push(makeFish());
    while (bubbles.length < 28) {
      bubbles.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(2, 7),
        speed: rand(22, 55),
        wobble: rand(0, Math.PI * 2),
      });
    }
  }

  function drawWater() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#063a5a");
    g.addColorStop(0.35, "#0a5a7a");
    g.addColorStop(0.75, "#0c6b7c");
    g.addColorStop(1, "#0a4a52");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const caustics = ctx.createLinearGradient(0, 0, w, h * 0.5);
    caustics.addColorStop(0, "rgba(180,230,255,0)");
    caustics.addColorStop(0.5, "rgba(180,230,255,0.07)");
    caustics.addColorStop(1, "rgba(180,230,255,0)");
    ctx.fillStyle = caustics;
    ctx.fillRect(0, 0, w, h * 0.55);
  }

  function drawCastle() {
    const baseX = w * 0.78;
    const baseY = h * 0.9;
    const s = Math.min(w, h) * 0.12;
    ctx.fillStyle = "#8d7b63";
    ctx.fillRect(baseX - s * 1.1, baseY - s * 1.4, s * 2.2, s * 1.4);
    ctx.fillStyle = "#6e5c48";
    ctx.fillRect(baseX - s * 1.25, baseY - s * 2.05, s * 0.7, s * 0.7);
    ctx.fillRect(baseX + s * 0.55, baseY - s * 2.05, s * 0.7, s * 0.7);
    ctx.fillRect(baseX - s * 0.28, baseY - s * 2.35, s * 0.56, s * 0.95);
    ctx.fillStyle = "#4a3b2c";
    ctx.beginPath();
    ctx.arc(baseX, baseY - s * 0.55, s * 0.42, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(baseX - s * 0.18, baseY - s * 0.55, s * 0.36, s * 0.55);
  }

  function drawChest() {
    const x = w * 0.18;
    const y = h * 0.88;
    const bw = Math.min(w, h) * 0.09;
    const bh = bw * 0.55;
    ctx.fillStyle = "#7a4e1d";
    ctx.fillRect(x, y - bh, bw, bh);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(x, y - bh, bw, 3);
    ctx.fillRect(x + bw * 0.45, y - bh * 0.55, bw * 0.1, bh * 0.35);
    ctx.fillStyle = "rgba(255,220,80,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + bw * 0.5, y - bh * 0.7, bw * 0.18, bh * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlants(now) {
    plants.forEach(function (p) {
      ctx.strokeStyle = "hsla(" + p.hue + ",45%,32%,0.85)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, h * 0.93);
      for (let i = 1; i <= p.segs; i++) {
        const u = i / p.segs;
        const sway = Math.sin(now * 0.0012 + p.phase + u * 2) * (18 + u * 22);
        ctx.lineTo(p.x + sway + p.lean * u * 40, h * 0.93 - p.h * u);
      }
      ctx.stroke();
      ctx.strokeStyle = "hsla(" + (p.hue + 12) + ",50%,42%,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + 6, h * 0.93);
      for (let i = 1; i <= p.segs; i++) {
        const u = i / p.segs;
        const sway = Math.sin(now * 0.0012 + p.phase + 0.7 + u * 2) * (12 + u * 16);
        ctx.lineTo(p.x + 6 + sway + p.lean * u * 30, h * 0.93 - p.h * u * 0.82);
      }
      ctx.stroke();
    });
  }

  function drawGravel() {
    gravel.forEach(function (g) {
      ctx.fillStyle = g.c;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.r, g.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawFishOne(f, now) {
    const s = 18 * f.z;
    const y = f.y + Math.sin(now * 0.0018 + f.bob) * f.bobAmp;
    const wag = Math.sin(now * 0.012 + f.wiggle) * 0.35;
    ctx.save();
    ctx.translate(f.x, y);
    ctx.scale(f.dir, 1);
    ctx.rotate(wag * 0.15);

    ctx.fillStyle = f.pal.fin;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, 0);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.95, s * 0.35, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, 0);
    ctx.quadraticCurveTo(0, s * 0.7, s * 0.3, s * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = f.pal.body;
    ctx.beginPath();
    if (f.kind === 0) {
      ctx.ellipse(0, 0, s * 1.15, s * 0.55, 0, 0, Math.PI * 2);
    } else if (f.kind === 1) {
      ctx.moveTo(s * 1.2, 0);
      ctx.quadraticCurveTo(s * 0.2, -s * 0.7, -s * 0.9, 0);
      ctx.quadraticCurveTo(s * 0.2, s * 0.7, s * 1.2, 0);
    } else {
      ctx.ellipse(0, 0, s * 1.05, s * 0.72, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = f.pal.stripe;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(-s * 0.15, -s * 0.35, s * 0.18, s * 0.7);
    ctx.fillRect(s * 0.2, -s * 0.3, s * 0.14, s * 0.6);
    ctx.globalAlpha = 1;

    ctx.fillStyle = f.pal.fin;
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, 0);
    ctx.lineTo(-s * 1.55, -s * 0.45 + wag * 10);
    ctx.lineTo(-s * 1.45, s * 0.45 - wag * 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s * 0.62, -s * 0.08, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = f.pal.eye;
    ctx.beginPath();
    ctx.arc(s * 0.66, -s * 0.08, s * 0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBubbles(now) {
    ctx.strokeStyle = "rgba(210,240,255,0.55)";
    ctx.lineWidth = 1.2;
    bubbles.forEach(function (b) {
      const x = b.x + Math.sin(now * 0.002 + b.wobble) * 8;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(220,245,255,0.12)";
      ctx.fill();
    });
  }

  function step(now, dt) {
    fish.forEach(function (f) {
      f.x += f.dir * f.speed * dt;
      const margin = 80 * f.z;
      if (f.x > w + margin) {
        f.x = -margin;
        f.y = rand(h * 0.12, h * 0.72);
      } else if (f.x < -margin) {
        f.x = w + margin;
        f.y = rand(h * 0.12, h * 0.72);
      }
    });
    bubbles.forEach(function (b) {
      b.y -= b.speed * dt;
      if (b.y < -10) {
        b.y = h * 0.92;
        b.x = rand(w * 0.05, w * 0.95);
      }
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    step(now, dt);
    drawWater();
    drawCastle();
    drawChest();
    drawPlants(now);
    fish
      .slice()
      .sort(function (a, b) {
        return a.z - b.z;
      })
      .forEach(function (f) {
        drawFishOne(f, now);
      });
    drawBubbles(now);
    drawGravel();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
