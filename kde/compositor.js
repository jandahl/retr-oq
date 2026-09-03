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
  const ctx = canvas.getContext("2d", { alpha: true });
  const cubeCanvas = document.createElement("canvas");
  cubeCanvas.id = "gl-desktop-cube";
  cubeCanvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:4001;visibility:hidden;pointer-events:none;background:#03010d url('art/galaxy.png') center/cover no-repeat";
  document.body.appendChild(cubeCanvas);
  const gl = cubeCanvas.getContext("webgl", { alpha: true, antialias: true });
  let glCube = null;
  let glRaf = 0;
  let glProgram = null;
  let glBuffer = null;
  let glTexture = null;
  function initGl() {
    if (!gl || glProgram) return !!gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, "attribute vec3 p; attribute vec2 uv; uniform mat4 m; varying vec2 v; void main(){gl_Position=m*vec4(p,1.0);v=uv;}"); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, "precision mediump float; uniform sampler2D tex; uniform float shade; varying vec2 v; void main(){gl_FragColor=texture2D(tex,v)*vec4(vec3(shade),1.0);}"); gl.compileShader(fs);
    glProgram = gl.createProgram(); gl.attachShader(glProgram, vs); gl.attachShader(glProgram, fs); gl.linkProgram(glProgram);
    glBuffer = gl.createBuffer();
    return gl.getProgramParameter(glProgram, gl.LINK_STATUS);
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  function mul(a,b) { const out = new Array(16).fill(0); for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k]; return out; }
  function rotY(a) { const c=Math.cos(a),s=Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; }
  function translate(z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,z,1]; }
  function scale3(s) { return [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]; }
  const cubeVerts = [
    [-1,-.75,1,0,0, 1,-.75,1,1,0, 1,.75,1,1,1, -1,.75,1,0,1],
    [1,-.75,1,0,0, 1,-.75,-1,1,0, 1,.75,-1,1,1, 1,.75,1,0,1],
    [1,-.75,-1,0,0, -1,-.75,-1,1,0, -1,.75,-1,1,1, 1,.75,-1,0,1],
    [-1,-.75,-1,0,0, -1,-.75,1,1,0, -1,.75,1,1,1, -1,.75,-1,0,1],
  ];
  function drawGlCube() {
    if (!glCube || !gl) return;
    const now = performance.now();
    const opening = Math.min(1, (now - glCube.started) / 900);
    const shellScale = 1;
    glCube.root.style.transformOrigin = "center center";
    glCube.root.style.transform = `scale(${shellScale})`;
    glCube.root.style.opacity = "1";
    const kicker = document.getElementById("kicker");
    kicker.style.transformOrigin = "center center";
    kicker.style.transform = `scale(${shellScale})`;
    kicker.style.opacity = "1";
    cubeCanvas.style.opacity = "1";
    let cubeScale = 1.72 - 0.72 * opening;
    if (!glCube.holding) {
      glCube.angle = Math.min(Math.PI / 2, opening * Math.PI / 2);
      glCube.pitch = 0.44 * opening;
    }
    if (opening >= 0.12 && !glCube.shellHidden) {
      glCube.root.style.visibility = "hidden";
      kicker.style.visibility = "hidden";
      glCube.shellHidden = true;
    }
    if (glCube.closing) {
      const closeT = Math.min(1, (now - glCube.closeStarted) / 420);
      glCube.angle *= 1 - closeT;
      glCube.pitch *= 1 - closeT;
      cubeScale = 1 + closeT * 0.68;
      if (closeT >= 1) { finishGlCube(); return; }
    }
    cubeCanvas.width = Math.max(1, Math.round(innerWidth * devicePixelRatio)); cubeCanvas.height = Math.max(1, Math.round(innerHeight * devicePixelRatio));
    gl.viewport(0,0,cubeCanvas.width,cubeCanvas.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(glProgram); gl.bindBuffer(gl.ARRAY_BUFFER,glBuffer);
    const data=[]; for(const face of cubeVerts) data.push(...face.slice(0,5),...face.slice(5,10),...face.slice(10,15),...face.slice(15,20));
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STREAM_DRAW);
    const p=gl.getAttribLocation(glProgram,"p"), u=gl.getAttribLocation(glProgram,"uv"); gl.enableVertexAttribArray(p); gl.enableVertexAttribArray(u); gl.vertexAttribPointer(p,3,gl.FLOAT,false,20,0); gl.vertexAttribPointer(u,2,gl.FLOAT,false,20,12);
    gl.uniformMatrix4fv(gl.getUniformLocation(glProgram,"m"),false,new Float32Array(mul(perspective(Math.PI/3,innerWidth/innerHeight,.1,100),mul(translate(-4),mul(rotX(glCube.pitch),mul(rotY(glCube.angle),scale3(cubeScale)))))));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,glTexture); gl.uniform1i(gl.getUniformLocation(glProgram,"tex"),0);
    for(let i=0;i<4;i++){ gl.uniform1f(gl.getUniformLocation(glProgram,"shade"),i===0?1:.55); gl.drawArrays(gl.TRIANGLE_FAN,i*4,4); }
    glRaf=requestAnimationFrame(drawGlCube);
  }
  function rotX(a) { const c=Math.cos(a),s=Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
  function finishGlCube() { if(!glCube)return; glCube.root.style.visibility=""; glCube.root.style.transform=""; glCube.root.style.opacity=""; const kicker=document.getElementById("kicker"); kicker.style.visibility=""; kicker.style.transform=""; kicker.style.opacity=""; cubeCanvas.style.opacity=""; cubeCanvas.style.pointerEvents="none"; cubeCanvas.style.visibility="hidden"; glCube=null; if(glRaf)cancelAnimationFrame(glRaf); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); }
  function closeGlCube() { if (!glCube || glCube.closing) return; glCube.closing=true; glCube.closeStarted=performance.now(); }
  let cubeDrag = null;
  cubeCanvas.addEventListener("pointerdown", (event) => { if (!glCube) return; cubeDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false}; cubeCanvas.setPointerCapture(event.pointerId); event.preventDefault(); });
  cubeCanvas.addEventListener("pointermove", (event) => { if (!cubeDrag || !glCube || cubeDrag.id !== event.pointerId) return; const dx=event.clientX-cubeDrag.x,dy=event.clientY-cubeDrag.y; if(Math.abs(dx)+Math.abs(dy)>3)cubeDrag.moved=true; glCube.holding=true; glCube.angle+=dx*.012; glCube.pitch=Math.max(-.9,Math.min(.9,glCube.pitch+dy*.009)); cubeDrag.x=event.clientX; cubeDrag.y=event.clientY; });
  cubeCanvas.addEventListener("pointerup", (event) => { if(!cubeDrag || cubeDrag.id !== event.pointerId)return; if(!cubeDrag.moved) closeGlCube(); cubeDrag=null; });
  cubeCanvas.addEventListener("pointercancel", () => { cubeDrag=null; });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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

  function snapshot(el, options = {}) {
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
        node.id === "compositor" || node.id === "gl-desktop-cube" ||
        !!(node.classList && (node.classList.contains("kde-resize") || (node.classList.contains("kicker") && !options.includeShell))),
    });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("snapshot timeout")), 1500);
    });
    return Promise.race([shot, timeout]);
  }
  async function snapshotShell() {
    const shell = await snapshot(document.body, { includeShell: true });
    // html2canvas cannot cross an iframe boundary. The saver preview is
    // same-origin here, so composite its live canvas into the shell texture
    // before uploading the texture to WebGL.
    const frame = document.getElementById("screensaver-preview");
    try {
      if (frame && frame.contentDocument && frame.contentDocument.body) {
        const preview = await snapshot(frame.contentDocument.body);
        const rect = frame.getBoundingClientRect();
        const scale = shell.width / Math.max(1, innerWidth);
        const out = document.createElement("canvas"); out.width = shell.width; out.height = shell.height;
        const outCtx = out.getContext("2d"); outCtx.drawImage(shell, 0, 0);
        outCtx.drawImage(preview, rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale);
        return out;
      }
    } catch (_) { /* iframe may still be loading; retain its captured fallback */ }
    return shell;
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

  // Distance springs (not axis-aligned). The old (q.x + cellW - p.x)
  // neighbor term fought shear, so the mesh stayed a rectangle with
  // corners yanked on straight lines. Compiz is a jelly sheet: edges
  // keep length, diagonals keep the face from folding, rest pose
  // slowly restores the window rect.
  let springFx = new Float64Array(0);
  let springFy = new Float64Array(0);

  function stepSprings(mesh, originX, originY, extra) {
    const { cols, rows, w, h, verts } = mesh;
    const k = extra && extra.k != null ? extra.k : 0.07;
    const damp = extra && extra.damp != null ? extra.damp : 0.91;
    const nK = extra && extra.nK != null ? extra.nK : 0.22;
    const dK = extra && extra.dK != null ? extra.dK : nK * 0.45;
    const cellW = w / cols;
    const cellH = h / rows;
    const diag = Math.hypot(cellW, cellH);
    const n = verts.length;
    if (springFx.length !== n) {
      springFx = new Float64Array(n);
      springFy = new Float64Array(n);
    } else {
      springFx.fill(0);
      springFy.fill(0);
    }
    const stride = cols + 1;

    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const idx = j * stride + i;
        const p = verts[idx];
        let restX = originX + p.u * w;
        let restY = originY + p.v * h;
        if (extra && extra.lampT != null) {
          const t = extra.lampT;
          const along = Math.min(1, Math.max(0, t * 1.35 - p.v * 0.6));
          restX += (extra.tx - restX) * along;
          restY += (extra.ty - restY) * along;
        }
        springFx[idx] += (restX - p.x) * k;
        springFy[idx] += (restY - p.y) * k;
      }
    }

    function edge(ia, ib, rest, stiff) {
      const pa = verts[ia];
      const pb = verts[ib];
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || rest;
      const f = ((len - rest) * stiff) / len;
      const fxv = dx * f;
      const fyv = dy * f;
      springFx[ia] += fxv;
      springFy[ia] += fyv;
      springFx[ib] -= fxv;
      springFy[ib] -= fyv;
    }

    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i < cols; i++) edge(j * stride + i, j * stride + i + 1, cellW, nK);
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i <= cols; i++) edge(j * stride + i, (j + 1) * stride + i, cellH, nK);
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * stride + i;
        edge(a, a + stride + 1, diag, dK);
        edge(a + 1, a + stride, diag, dK);
      }
    }

    for (let i = 0; i < n; i++) {
      const p = verts[i];
      p.vx = (p.vx + springFx[i]) * damp;
      p.vy = (p.vy + springFy[i]) * damp;
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

  // Affine-map a textured triangle. Each mesh cell is two of these so all
  // four vertices count — a parallelogram (3 verts) is what made the
  // wobble look like corners on rubber bands.
  function drawTexTriangle(img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    x0 *= dpr;
    y0 *= dpr;
    x1 *= dpr;
    y1 *= dpr;
    x2 *= dpr;
    y2 *= dpr;
    const det = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(det) < 1e-4) return;
    const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / det;
    const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / det;
    const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / det;
    const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / det;
    const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / det;
    const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / det;
    // Inflate the clip a fraction of a pixel so adjacent triangles don't gap.
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    function out(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [x + (dx / len) * dpr, y + (dy / len) * dpr];
    }
    const p0 = out(x0, y0);
    const p1 = out(x1, y1);
    const p2 = out(x2, y2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
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
        const d = vert(mesh, i + 1, j + 1);
        if (burnT != null && burnAt < burnT + 0.16) {
          const f = (burnAt - burnT) / 0.16;
          ctx.fillStyle =
            f > 0.55
              ? `rgba(255, ${Math.floor(170 + f * 80)}, ${Math.floor(30 + f * 40)}, 0.95)`
              : "rgba(255, 70, 0, 0.92)";
          ctx.beginPath();
          ctx.moveTo(a.x * dpr, a.y * dpr);
          ctx.lineTo(b.x * dpr, b.y * dpr);
          ctx.lineTo(d.x * dpr, d.y * dpr);
          ctx.lineTo(c.x * dpr, c.y * dpr);
          ctx.closePath();
          ctx.fill();
        } else {
          const sx = i * sw;
          const sy = j * sh;
          drawTexTriangle(
            img,
            a.x, a.y, b.x, b.y, c.x, c.y,
            sx, sy, sx + sw, sy, sx, sy + sh,
          );
          drawTexTriangle(
            img,
            d.x, d.y, c.x, c.y, b.x, b.y,
            sx + sw, sy + sh, sx, sy + sh, sx + sw, sy,
          );
        }
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
    const ang = t * Math.PI / 2;
    const img = cube.img;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const persp = 760;
    const half = Math.min(cw * 0.32, ch * 0.42);
    const halfH = ch * 0.34;
    const faces = [];
    function project(x, z, y) {
      const scale = persp / (persp + z);
      return { x: cw / 2 + x * scale, y: ch / 2 + y * scale, scale };
    }
    // Four identical faces are intentional: the pager is an illusion and
    // all faces lead back to the one shared Desktop 1 surface.
    for (let i = 0; i < 4; i++) {
      const a = ang + i * Math.PI / 2;
      const left = project(Math.sin(a - Math.PI / 4) * half, Math.cos(a - Math.PI / 4) * half, 0);
      const right = project(Math.sin(a + Math.PI / 4) * half, Math.cos(a + Math.PI / 4) * half, 0);
      const depth = (left.scale + right.scale) / 2;
      faces.push({ left, right, depth, i });
    }
    faces.sort((a, b) => a.depth - b.depth);
    ctx.save();
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    for (const face of faces) {
      const x0 = face.left.x;
      const x1 = face.right.x;
      const y0 = ch / 2 - halfH * face.left.scale;
      const y1 = ch / 2 + halfH * face.left.scale;
      const width = x1 - x0;
      if (Math.abs(width) < 2) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.moveTo(x0 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y0 * dpr);
      ctx.lineTo(x1 * dpr, y1 * dpr);
      ctx.lineTo(x0 * dpr, y1 * dpr);
      ctx.closePath();
      ctx.fillStyle = "#0a2a4a";
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.42 + face.depth * 0.58;
      ctx.drawImage(img, x0 * dpr, y0 * dpr, width * dpr, (y1 - y0) * dpr);
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(8, 28, 48, 0.7)";
      ctx.font = `700 ${Math.max(14, Math.round(ch * 0.025))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Desktop 1", ((x0 + x1) / 2) * dpr, (y0 + 34) * dpr);
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
        stepSprings(fx.mesh, fx.originX, fx.originY, { k: 0.055, damp: 0.92, nK: 0.24, dK: 0.1 });
        stepSprings(fx.mesh, fx.originX, fx.originY, { k: 0.055, damp: 0.92, nK: 0.24, dK: 0.1 });
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
        stepSprings(fx.mesh, fx.originX, fx.originY, { k: 0.22, damp: 0.78, nK: 0.16, dK: 0.07 });
        drawMesh(fx.img, fx.mesh);
        if (energy(fx.mesh) < 0.22 || fx.age > 36) finishFx();
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
    // Hide the live element before resolving the effect. The window manager
    // changes it to `.minimized` in the promise continuation; deferring this
    // cleanup by a frame briefly exposes the last captured frame above Kicker.
    if (el) clearLiveFx(el);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (done) done();
  }

  function gridFor() {
    const coarse = isCoarse();
    const cols = coarse ? 10 : 20;
    const rows = coarse ? 7 : 13;
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
    // Pin the grab neighbourhood to the cursor; the far edge stays put
    // this frame and the springs catch up — that's the jelly. Title-bar
    // grabs fall off slower horizontally so the whole top comes along.
    for (const p of fx.mesh.verts) {
      const dist = Math.hypot((p.u - gx) * 0.95, (p.v - gy) * 1.35);
      const pin = Math.max(0, 1 - dist);
      const pin2 = pin * pin;
      p.x += dx * (0.2 + 0.8 * pin2);
      p.y += dy * (0.2 + 0.8 * pin2);
      p.vx += dx * 0.65 * pin2;
      p.vy += dy * 0.65 * pin2;
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
    if (reduceMotion() || cube || glCube) return;
    if (initGl()) {
      let img;
      try { img = await snapshotShell(); } catch { return; }
      glTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      glCube = { root: rootEl, started: performance.now(), angle: 0, pitch: 0, closing: false };
      rootEl.style.visibility = "visible";
      document.getElementById("kicker").style.visibility = "visible";
      cubeCanvas.style.visibility = "visible"; cubeCanvas.style.opacity = "0"; cubeCanvas.style.pointerEvents = "auto"; drawGlCube();
      return;
    }
    if (cube) return;
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

  async function restore(el, sourceRect) {
    if (reduceMotion()) return;
    const rect = el.getBoundingClientRect();
    const tx = sourceRect.left + sourceRect.width / 2;
    const ty = sourceRect.top + sourceRect.height / 2;
    const ox = rect.width ? ((tx - rect.left) / rect.width) * 100 : 50;
    const oy = rect.height ? ((ty - rect.top) / rect.height) * 100 : 100;
    el.style.transformOrigin = `${ox}% ${oy}%`;
    el.style.transform = "scale(0.04)";
    el.style.opacity = "0";
    el.classList.add("compiz-lamping");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    el.style.transform = "scale(1)";
    el.style.opacity = "1";
    await onceDone(el, "transitionend", 500);
    clearLiveFx(el);
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
    restore,
    setRain,
    ripple,
    setRainOn: setRain,
    isRaining: () => rainOn,
    busy,
    cancel,
    clearLiveFx,
  };
})();
