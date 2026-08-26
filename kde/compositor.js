(() => {
  "use strict";

  // Compiz-style compositor.
  //
  // Fine pointer (mouse): snapshot the live HTML window with html2canvas
  // onto #compositor and deform a spring mesh — the 2006 "redirect to
  // texture" trick.
  //
  // Coarse pointer / iOS: html2canvas is a lottery (blank frames, 400ms+
  // stalls, windows stuck opacity:0). Same plugins, live CSS transforms
  // instead of a bitmap. Never wait on a snapshot before the window
  // follows the finger.

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isCoarse() {
    try {
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.matchMedia("(hover: none)").matches) return true;
    } catch (_) { /* matchMedia can throw in odd webviews */ }
    const ua = navigator.userAgent || "";
    if (/iP(hone|ad|od)/.test(ua)) return true;
    // iPadOS 13+ desktop UA
    if (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) return true;
    return false;
  }

  function canCanvas() {
    if (reduceMotion()) return false;
    if (isCoarse()) return false;
    return typeof html2canvas === "function";
  }

  const canvas = document.getElementById("compositor");
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let raf = 0;
  let fx = null; // active window effect (canvas mesh)
  let cssFx = null; // live-element wobble on coarse/iOS
  let rainOn = false;
  let rainDrops = [];
  let ripples = [];
  let sparks = [];
  let cube = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  resize();

  function fract(n) {
    return n - Math.floor(n);
  }
  function hash2(i, j) {
    return fract(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453);
  }

  function onceDone(el, eventName, ms) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener(eventName, finish);
        resolve();
      };
      el.addEventListener(eventName, finish);
      setTimeout(finish, ms);
    });
  }

  function clearLiveFx(el) {
    if (!el) return;
    el.classList.remove("compiz-captured", "compiz-wobbling", "compiz-burning", "compiz-lamping", "compiz-cube");
    el.style.transform = "";
    el.style.opacity = "";
    el.style.transformOrigin = "";
    el.style.filter = "";
  }

  function snapshot(el) {
    if (typeof html2canvas !== "function") {
      return Promise.reject(new Error("html2canvas is required for Compiz effects"));
    }
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const shot = html2canvas(el, {
      backgroundColor: null,
      scale: Math.min(dpr, 1.25),
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 1200,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      ignoreElements: (node) =>
        node.id === "compositor" ||
        !!(node.classList && (node.classList.contains("kde-resize") || node.classList.contains("kicker"))),
    });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("snapshot timeout")), 1500);
    });
    return Promise.race([shot, timeout]);
  }

  function makeMesh(x, y, w, h, cols, rows) {
    const verts = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const v = j / rows;
        verts.push({
          x: x + u * w,
          y: y + v * h,
          vx: 0,
          vy: 0,
          u,
          v,
        });
      }
    }
    return { verts, cols, rows, w, h };
  }

  function vert(mesh, i, j) {
    return mesh.verts[j * (mesh.cols + 1) + i];
  }

  // Jacobi spring step. In-place Gauss-Seidel was injecting energy via a
  // left-to-right wave, so settle never dropped below the threshold.
  function stepSprings(mesh, originX, originY, extra) {
    const { cols, rows, w, h, verts } = mesh;
    const k = extra && extra.k != null ? extra.k : 0.16;
    const damp = extra && extra.damp != null ? extra.damp : 0.86;
    const nK = extra && extra.nK != null ? extra.nK : 0.1;
    const cellW = w / cols;
    const cellH = h / rows;
    const fxBuf = new Float64Array(verts.length);
    const fyBuf = new Float64Array(verts.length);
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const idx = j * (cols + 1) + i;
        const p = verts[idx];
        let restX = originX + p.u * w;
        let restY = originY + p.v * h;
        if (extra && extra.lampT != null) {
          const t = extra.lampT;
          const along = Math.min(1, Math.max(0, t * 1.35 - p.v * 0.6));
          restX += (extra.tx - restX) * along;
          restY += (extra.ty - restY) * along;
        }
        let fxx = (restX - p.x) * k;
        let fyy = (restY - p.y) * k;
        if (i > 0) {
          const q = verts[idx - 1];
          fxx += (q.x + cellW - p.x) * nK;
          fyy += (q.y - p.y) * nK;
        }
        if (i < cols) {
          const q = verts[idx + 1];
          fxx += (q.x - cellW - p.x) * nK;
          fyy += (q.y - p.y) * nK;
        }
        if (j > 0) {
          const q = verts[idx - (cols + 1)];
          fxx += (q.x - p.x) * nK;
          fyy += (q.y + cellH - p.y) * nK;
        }
        if (j < rows) {
          const q = verts[idx + (cols + 1)];
          fxx += (q.x - p.x) * nK;
          fyy += (q.y - cellH - p.y) * nK;
        }
        fxBuf[idx] = fxx;
        fyBuf[idx] = fyy;
      }
    }
    for (let n = 0; n < verts.length; n++) {
      const p = verts[n];
      p.vx = (p.vx + fxBuf[n]) * damp;
      p.vy = (p.vy + fyBuf[n]) * damp;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  function energy(mesh) {
    let e = 0;
    for (const p of mesh.verts) e += p.vx * p.vx + p.vy * p.vy;
    return e / mesh.verts.length;
  }

  function cellBurnAt(i, j, cols, rows) {
    const edge = Math.min(i / cols, 1 - i / cols, j / rows, 1 - j / rows) * 2;
    return edge * 0.78 + hash2(i, j) * 0.32;
  }

  function drawMesh(img, mesh, opt) {
    const { cols, rows, w, h } = mesh;
    const sw = img.width / cols;
    const sh = img.height / rows;
    const burnT = opt && opt.burnT;
    const cssCellW = w / cols;
    const cssCellH = h / rows;

    if (!opt || !opt.noShadow) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      for (let i = 0; i <= cols; i++) {
        const p = vert(mesh, i, 0);
        if (i === 0) ctx.moveTo((p.x + 6) * dpr, (p.y + 10) * dpr);
        else ctx.lineTo((p.x + 6) * dpr, (p.y + 10) * dpr);
      }
      for (let j = 1; j <= rows; j++) {
        const p = vert(mesh, cols, j);
        ctx.lineTo((p.x + 6) * dpr, (p.y + 10) * dpr);
      }
      for (let i = cols - 1; i >= 0; i--) {
        const p = vert(mesh, i, rows);
        ctx.lineTo((p.x + 6) * dpr, (p.y + 10) * dpr);
      }
      for (let j = rows - 1; j >= 0; j--) {
        const p = vert(mesh, 0, j);
        ctx.lineTo((p.x + 6) * dpr, (p.y + 10) * dpr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const burnAt = burnT != null ? cellBurnAt(i, j, cols, rows) : 2;
        if (burnT != null && burnAt < burnT) continue;
        const a = vert(mesh, i, j);
        const b = vert(mesh, i + 1, j);
        const c = vert(mesh, i, j + 1);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ex = c.x - a.x;
        const ey = c.y - a.y;
        ctx.save();
        ctx.setTransform(
          (dx * dpr) / sw,
          (dy * dpr) / sw,
          (ex * dpr) / sh,
          (ey * dpr) / sh,
          a.x * dpr,
          a.y * dpr,
        );
        if (burnT != null && burnAt < burnT + 0.16) {
          const f = (burnAt - burnT) / 0.16;
          ctx.fillStyle =
            f > 0.55
              ? `rgba(255, ${Math.floor(170 + f * 80)}, ${Math.floor(30 + f * 40)}, 0.95)`
              : "rgba(255, 70, 0, 0.92)";
          ctx.fillRect(0, 0, sw, sh);
        } else {
          ctx.drawImage(img, i * sw, j * sh, sw, sh, 0, 0, sw, sh);
        }
        ctx.restore();
        if (burnT != null && burnAt >= burnT && burnAt < burnT + 0.16 && Math.random() < 0.22) {
          sparks.push({
            x: a.x + cssCellW * 0.5,
            y: a.y + cssCellH * 0.5,
            vx: (Math.random() - 0.5) * 2.8,
            vy: -1.8 - Math.random() * 3.6,
            life: 1,
            hue: 18 + Math.random() * 42,
          });
        }
      }
    }
  }

  function drawSparks() {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy -= 0.04;
      s.life -= 0.045;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `hsla(${s.hue}, 100%, 55%, ${s.life})`;
      ctx.beginPath();
      ctx.arc(s.x * dpr, s.y * dpr, (2 + s.life * 2.5) * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ensureRain() {
    const n = Math.floor(window.innerWidth / 14);
    while (rainDrops.length < n) {
      rainDrops.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        z: 0.4 + Math.random() * 0.8,
        len: 8 + Math.random() * 16,
      });
    }
  }

  function drawRain() {
    ensureRain();
    ctx.strokeStyle = "rgba(170, 200, 255, 0.45)";
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    for (const d of rainDrops) {
      d.y += 14 * d.z;
      if (d.y > window.innerHeight + 20) {
        d.y = -20;
        d.x = Math.random() * window.innerWidth;
      }
      ctx.moveTo(d.x * dpr, d.y * dpr);
      ctx.lineTo((d.x + 2) * dpr, (d.y + d.len) * dpr);
    }
    ctx.stroke();
  }

  function drawRipples() {
    const now = performance.now();
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const age = (now - r.t0) / 900;
      if (age >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      const radius = 12 + age * 140;
      ctx.strokeStyle = `rgba(180, 220, 255, ${0.45 * (1 - age)})`;
      ctx.lineWidth = (2.5 - age * 1.5) * dpr;
      ctx.beginPath();
      ctx.arc(r.x * dpr, r.y * dpr, radius * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x * dpr, r.y * dpr, radius * 0.55 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCube() {
    if (!cube) return;
    cube.t += 0.018;
    const t = Math.min(1, cube.t);
    const ang = t * Math.PI;
    const img = cube.img;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const persp = 900;
    function project(x, z) {
      const zz = persp / (persp + z);
      return { x: cw / 2 + (x - cw / 2) * zz, s: zz };
    }
    const half = cw * 0.42;
    const top = ch * 0.12;
    const bot = ch * 0.78;
    const zL = Math.sin(ang) * half;
    const zR = Math.sin(ang + Math.PI) * half;
    const xL = cw / 2 + Math.cos(ang) * -half;
    const xR = cw / 2 + Math.cos(ang) * half;
    const pL = project(xL, zL);
    const pR = project(xR, zR);
    ctx.save();
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    ctx.fillStyle = "#0a2a4a";
    ctx.beginPath();
    ctx.moveTo(pL.x * dpr, top * dpr);
    ctx.lineTo(pR.x * dpr, top * dpr);
    ctx.lineTo(pR.x * dpr, bot * dpr);
    ctx.lineTo(pL.x * dpr, bot * dpr);
    ctx.closePath();
    ctx.fill();
    const dw = pR.x - pL.x;
    if (Math.abs(dw) > 2) {
      ctx.setTransform((dw * dpr) / img.width, 0, 0, ((bot - top) * dpr) / img.height, pL.x * dpr, top * dpr);
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
    if (cube.t >= 1) {
      const done = cube.onDone;
      cube = null;
      if (done) done();
    }
  }

  function looping() {
    return !!(fx || rainOn || ripples.length || cube || sparks.length);
  }

  function tick() {
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (rainOn) drawRain();
    drawRipples();
    if (cube) drawCube();
    if (fx) {
      fx.age = (fx.age || 0) + 1;
      if (fx.kind === "wobble") {
        stepSprings(fx.mesh, fx.originX, fx.originY);
        drawMesh(fx.img, fx.mesh);
      } else if (fx.kind === "burn") {
        fx.burnT += 0.038;
        drawMesh(fx.img, fx.mesh, { burnT: fx.burnT, noShadow: fx.burnT > 0.4 });
        drawSparks();
        if (fx.burnT > 1.2 && sparks.length === 0) finishFx();
        else if (fx.burnT > 1.45) finishFx();
      } else if (fx.kind === "lamp") {
        fx.lampT += 0.036;
        stepSprings(fx.mesh, fx.originX, fx.originY, {
          lampT: fx.lampT,
          tx: fx.tx,
          ty: fx.ty,
          k: 0.3,
          damp: 0.7,
        });
        ctx.globalAlpha = Math.max(0, 1 - fx.lampT * 0.85);
        drawMesh(fx.img, fx.mesh);
        ctx.globalAlpha = 1;
        if (fx.lampT >= 1.12 || fx.age > 48) finishFx();
      } else if (fx.kind === "settle") {
        stepSprings(fx.mesh, fx.originX, fx.originY, { k: 0.42, damp: 0.58, nK: 0.08 });
        drawMesh(fx.img, fx.mesh);
        if (energy(fx.mesh) < 0.18 || fx.age > 28) finishFx();
      }
    } else {
      drawSparks();
    }
    if (looping()) raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function finishFx() {
    const done = fx && fx.onDone;
    const el = fx && fx.el;
    fx = null;
    sparks = [];
    if (done) done();
    requestAnimationFrame(() => {
      if (el && !fx) el.classList.remove("compiz-captured");
    });
  }

  function gridFor() {
    const coarse = isCoarse();
    const cols = coarse ? 10 : 16;
    const rows = coarse ? 7 : 10;
    return { cols, rows };
  }

  let grabToken = 0;
  let grabInFlight = false;
  let pendingRelease = null;
  let pendingMove = null;

  function applyMove(clientX, clientY) {
    if (!fx || fx.kind !== "wobble") return;
    const nx = clientX - fx.grabOffX;
    const ny = clientY - fx.grabOffY;
    const dx = nx - fx.originX;
    const dy = ny - fx.originY;
    fx.originX = nx;
    fx.originY = ny;
    const { w, h } = fx.mesh;
    const gx = w ? fx.grabOffX / w : 0;
    const gy = h ? fx.grabOffY / h : 0;
    for (const p of fx.mesh.verts) {
      const dist = Math.hypot(p.u - gx, p.v - gy);
      const fall = Math.max(0, 1 - dist * 1.15);
      p.vx += dx * 0.5 * fall;
      p.vy += dy * 0.5 * fall;
    }
  }

  function posOf() {
    if (!fx) return null;
    return { x: fx.originX, y: fx.originY };
  }

  function beginSettle(resolve) {
    if (!fx) {
      resolve(null);
      return;
    }
    const pos = posOf();
    fx.kind = "settle";
    fx.age = 0;
    fx.onDone = () => resolve(pos);
  }

  function takeOver(el, kind, extra) {
    if (!fx || fx.el !== el || !fx.img) return false;
    const prevDone = fx.onDone;
    const pos = posOf();
    fx.kind = kind;
    fx.age = 0;
    Object.assign(fx, extra);
    if (prevDone) prevDone(pos);
    startLoop();
    return true;
  }

  function clampNum(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function startCssWobble(el, clientX, clientY) {
    const rect = el.getBoundingClientRect();
    cssFx = {
      el,
      skewX: 0,
      skewY: 0,
      grabOffX: clientX - rect.left,
      originX: rect.left,
      originY: rect.top,
    };
    el.style.transformOrigin = `${cssFx.grabOffX}px 0px`;
    el.classList.add("compiz-wobbling");
  }

  function applyCssWobble(vx, vy) {
    if (!cssFx) return;
    cssFx.skewX = clampNum(cssFx.skewX * 0.6 + vx * 1.2, -26, 26);
    cssFx.skewY = clampNum(cssFx.skewY * 0.6 + vy * 0.75, -16, 16);
    const rot = cssFx.skewX * 0.16;
    const squash = 1 + clampNum(vy * 0.004, -0.08, 0.08);
    cssFx.el.style.transform = `skew(${cssFx.skewX}deg, ${cssFx.skewY}deg) rotate(${rot}deg) scaleY(${squash})`;
  }

  function cssSettle() {
    const state = cssFx;
    cssFx = null;
    if (!state) return Promise.resolve(null);
    const el = state.el;
    const pos = { x: state.originX, y: state.originY };
    return new Promise((resolve) => {
      const t0 = performance.now();
      function step() {
        state.skewX *= 0.7;
        state.skewY *= 0.7;
        const done =
          (Math.abs(state.skewX) < 0.2 && Math.abs(state.skewY) < 0.2) ||
          performance.now() - t0 > 280;
        if (done) {
          el.style.transform = "";
          el.style.transformOrigin = "";
          el.classList.remove("compiz-wobbling");
          resolve(pos);
          return;
        }
        el.style.transform = `skew(${state.skewX}deg, ${state.skewY}deg) rotate(${state.skewX * 0.16}deg)`;
        requestAnimationFrame(step);
      }
      step();
    });
  }

  async function cssBurn(el) {
    el.classList.remove("compiz-wobbling", "compiz-lamping");
    el.style.transform = "";
    el.classList.add("compiz-burning");
    await onceDone(el, "animationend", 750);
    el.classList.remove("compiz-burning");
    el.style.filter = "";
    el.style.opacity = "";
    el.style.transform = "";
  }

  async function cssLamp(el, targetRect) {
    const rect = el.getBoundingClientRect();
    const tx = targetRect.left + targetRect.width / 2;
    const ty = targetRect.top + targetRect.height / 2;
    const ox = rect.width ? ((tx - rect.left) / rect.width) * 100 : 50;
    const oy = rect.height ? ((ty - rect.top) / rect.height) * 100 : 100;
    el.classList.remove("compiz-wobbling", "compiz-burning");
    el.style.transform = "";
    el.style.opacity = "1";
    el.style.transformOrigin = `${ox}% ${oy}%`;
    el.classList.add("compiz-lamping");
    await new Promise((r) => requestAnimationFrame(r));
    el.style.transform = "scale(0.04)";
    el.style.opacity = "0";
    await onceDone(el, "transitionend", 480);
    el.classList.remove("compiz-lamping");
    el.style.transform = "";
    el.style.opacity = "";
    el.style.transformOrigin = "";
  }

  async function cssCube(rootEl) {
    rootEl.classList.add("compiz-cube");
    await onceDone(rootEl, "animationend", 900);
    rootEl.classList.remove("compiz-cube");
  }

  async function grab(el, clientX, clientY) {
    if (reduceMotion()) return false;
    if (fx && (fx.kind === "burn" || fx.kind === "lamp")) return false;
    if (cssFx && cssFx.el !== el) {
      cssFx.el.classList.remove("compiz-wobbling");
      cssFx.el.style.transform = "";
      cssFx = null;
    }
    if (fx) finishFx();

    if (!canCanvas()) {
      startCssWobble(el, clientX, clientY);
      pendingMove = { x: clientX, y: clientY };
      return true;
    }

    const token = ++grabToken;
    grabInFlight = true;
    pendingRelease = null;
    pendingMove = { x: clientX, y: clientY };
    let img;
    try {
      img = await snapshot(el);
    } catch {
      grabInFlight = false;
      if (token === grabToken) startCssWobble(el, clientX, clientY);
      if (pendingRelease) {
        const resolve = pendingRelease;
        pendingRelease = null;
        if (cssFx) cssSettle().then(resolve);
        else resolve(null);
      }
      return false;
    }
    grabInFlight = false;
    if (token !== grabToken) {
      if (pendingRelease) {
        pendingRelease(null);
        pendingRelease = null;
      }
      return false;
    }
    if (pendingRelease) {
      // Finger already up — live window was moved by the WM. Skip the mesh.
      const resolve = pendingRelease;
      pendingRelease = null;
      resolve(null);
      return false;
    }
    const rect = el.getBoundingClientRect();
    el.classList.add("compiz-captured");
    const { cols, rows } = gridFor();
    const mesh = makeMesh(rect.left, rect.top, rect.width, rect.height, cols, rows);
    const gx = pendingMove ? pendingMove.x : clientX;
    const gy = pendingMove ? pendingMove.y : clientY;
    fx = {
      kind: "wobble",
      img,
      mesh,
      el,
      originX: rect.left,
      originY: rect.top,
      grabOffX: gx - rect.left,
      grabOffY: gy - rect.top,
      age: 0,
      onDone: null,
    };
    startLoop();
    return true;
  }

  function move(clientX, clientY) {
    const vx = pendingMove ? clientX - pendingMove.x : 0;
    const vy = pendingMove ? clientY - pendingMove.y : 0;
    pendingMove = { x: clientX, y: clientY };
    if (cssFx) {
      cssFx.originX += vx;
      cssFx.originY += vy;
      applyCssWobble(vx, vy);
      return;
    }
    applyMove(clientX, clientY);
  }

  function release() {
    return new Promise((resolve) => {
      if (cssFx) {
        cssSettle().then(resolve);
        return;
      }
      if (fx && fx.kind === "wobble") {
        beginSettle(resolve);
        return;
      }
      if (grabInFlight) {
        pendingRelease = resolve;
        return;
      }
      resolve(null);
    });
  }

  async function burn(el) {
    if (reduceMotion()) return;
    if (cssFx && cssFx.el === el) {
      cssFx.el.classList.remove("compiz-wobbling");
      cssFx.el.style.transform = "";
      cssFx = null;
    }
    if (!canCanvas()) {
      await cssBurn(el);
      return;
    }
    if (takeOver(el, "burn", { burnT: 0, onDone: null })) {
      return new Promise((resolve) => {
        fx.onDone = resolve;
      });
    }
    if (fx) finishFx();
    const rect = el.getBoundingClientRect();
    let img;
    try {
      img = await snapshot(el);
    } catch {
      await cssBurn(el);
      return;
    }
    el.classList.add("compiz-captured");
    const { cols, rows } = gridFor();
    const mesh = makeMesh(rect.left, rect.top, rect.width, rect.height, cols, rows);
    return new Promise((resolve) => {
      fx = {
        kind: "burn",
        img,
        mesh,
        el,
        burnT: 0,
        originX: rect.left,
        originY: rect.top,
        age: 0,
        onDone: resolve,
      };
      startLoop();
    });
  }

  async function lamp(el, targetRect) {
    if (reduceMotion()) return;
    if (cssFx && cssFx.el === el) {
      cssFx.el.classList.remove("compiz-wobbling");
      cssFx.el.style.transform = "";
      cssFx = null;
    }
    const tx = targetRect.left + targetRect.width / 2;
    const ty = targetRect.top + targetRect.height / 2;
    if (!canCanvas()) {
      await cssLamp(el, targetRect);
      return;
    }
    if (takeOver(el, "lamp", { lampT: 0, tx, ty, onDone: null })) {
      return new Promise((resolve) => {
        fx.onDone = resolve;
      });
    }
    if (fx) finishFx();
    const rect = el.getBoundingClientRect();
    let img;
    try {
      img = await snapshot(el);
    } catch {
      await cssLamp(el, targetRect);
      return;
    }
    el.classList.add("compiz-captured");
    const { cols, rows } = gridFor();
    const mesh = makeMesh(rect.left, rect.top, rect.width, rect.height, cols, rows);
    return new Promise((resolve) => {
      fx = {
        kind: "lamp",
        img,
        mesh,
        el,
        originX: rect.left,
        originY: rect.top,
        lampT: 0,
        tx,
        ty,
        age: 0,
        onDone: resolve,
      };
      startLoop();
    });
  }

  async function spinCube(rootEl) {
    if (reduceMotion() || cube) return;
    if (!canCanvas()) {
      await cssCube(rootEl);
      return;
    }
    let img;
    try {
      img = await snapshot(rootEl);
    } catch {
      await cssCube(rootEl);
      return;
    }
    return new Promise((resolve) => {
      cube = { img, t: 0, onDone: resolve };
      startLoop();
    });
  }

  function setRain(on) {
    rainOn = !!on;
    if (rainOn) ensureRain();
    else rainDrops = [];
    startLoop();
  }

  function ripple(x, y) {
    ripples.push({ x, y, t0: performance.now() });
    startLoop();
  }

  function busy() {
    return !!(fx || cssFx);
  }

  function cancel() {
    grabToken += 1;
    grabInFlight = false;
    if (pendingRelease) {
      pendingRelease(null);
      pendingRelease = null;
    }
    if (cssFx) {
      clearLiveFx(cssFx.el);
      cssFx = null;
    }
    if (fx && fx.el) clearLiveFx(fx.el);
    fx = null;
    sparks = [];
  }

  window.OqCompiz = {
    reduceMotion,
    canCanvas,
    isCoarse,
    snapshot,
    grab,
    move,
    release,
    burn,
    lamp,
    spinCube,
    setRain,
    ripple,
    setRainOn: setRain,
    isRaining: () => rainOn,
    busy,
    cancel,
    clearLiveFx,
  };
})();
