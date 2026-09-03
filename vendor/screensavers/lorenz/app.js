/* Original remake of the mid-2000s KDE / RSS Lorenz attractor GL
   eye candy. Classic Lorenz ODE, neon additive trail, slow orbit.
   Not derived from kdeartwork / rss-glx GPL sources. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") {
    document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;color:#fff;font:16px sans-serif">Screen saver unavailable offline.</div>';
    return;
  }

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduced = false;
  }

  var SIGMA = 10;
  var RHO = 28;
  var BETA = 8 / 3;
  var SCALE = 0.4;
  var Z_OFF = 27;

  var N_INK = reduced ? 3 : 7;
  var INK_TRAIL = reduced ? 720 : 2400;
  var N_SAT = reduced ? 4 : 12;
  var SAT_TRAIL = reduced ? 36 : 88;
  var SUBSTEPS = reduced ? 2 : 5;
  var H = reduced ? 0.0042 : 0.0056;
  var CAM_SPEED = reduced ? 0.032 : 0.072;
  var HUE_SPEED = reduced ? 0.01 : 0.022;
  var STAR_COUNT = reduced ? 48 : 140;
  var INK_WIDTH = reduced ? 0.045 : 0.07;
  var SAT_WIDTH = reduced ? 0.13 : 0.2;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    220
  );
  var camRadius = 21.5;
  var camAngle = 0.55;
  camera.position.set(0, 6.5, camRadius);

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(220,255,255,0.95)");
    grd.addColorStop(mid, "rgba(80,220,255,0.32)");
    grd.addColorStop(0.7, "rgba(160,60,255,0.08)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128, 0.1, 0.34);
  var softTex = makeGlowTexture(64, 0.18, 0.48);

  function hsv(h, s, v) {
    var hh = ((h % 1) + 1) % 1;
    var i = (hh * 6) | 0;
    var f = hh * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        return [v, t, p];
      case 1:
        return [q, v, p];
      case 2:
        return [p, v, t];
      case 3:
        return [p, q, v];
      case 4:
        return [t, p, v];
      default:
        return [v, p, q];
    }
  }

  function stepLorenz(p, h) {
    var x = p.lx;
    var y = p.ly;
    var z = p.lz;
    var k1x = SIGMA * (y - x);
    var k1y = x * (RHO - z) - y;
    var k1z = x * y - BETA * z;
    var x2 = x + k1x * h;
    var y2 = y + k1y * h;
    var z2 = z + k1z * h;
    var k2x = SIGMA * (y2 - x2);
    var k2y = x2 * (RHO - z2) - y2;
    var k2z = x2 * y2 - BETA * z2;
    p.lx += 0.5 * (k1x + k2x) * h;
    p.ly += 0.5 * (k1y + k2y) * h;
    p.lz += 0.5 * (k1z + k2z) * h;
    p.wx = p.lx * SCALE;
    p.wy = (p.lz - Z_OFF) * SCALE;
    p.wz = p.ly * SCALE;
  }

  function pushTrail(p, len) {
    p.head = (p.head + 1) % len;
    var i = p.head * 3;
    p.trail[i] = p.wx;
    p.trail[i + 1] = p.wy;
    p.trail[i + 2] = p.wz;
    if (p.filled < len) p.filled++;
  }

  function trailSrc(p, k, len) {
    return (p.head - p.filled + 1 + k + len * 4) % len;
  }

  (function addStars() {
    var pos = new Float32Array(STAR_COUNT * 3);
    var col = new Float32Array(STAR_COUNT * 3);
    var i;
    for (i = 0; i < STAR_COUNT; i++) {
      var u = Math.random();
      var v = Math.random();
      var th = u * Math.PI * 2;
      var ph = Math.acos(2 * v - 1);
      var r = 52 + Math.random() * 40;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      var b = 0.1 + Math.random() * 0.22;
      col[i * 3] = b * (0.7 + Math.random() * 0.2);
      col[i * 3 + 1] = b * (0.85 + Math.random() * 0.15);
      col[i * 3 + 2] = b * (1.05 + Math.random() * 0.2);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.11,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          sizeAttenuation: true,
        })
      )
    );
  })();

  function seedState(i, n) {
    var a = (i / n) * Math.PI * 2 + 0.31;
    var sign = i % 2 ? 1 : -1;
    return {
      lx: sign * (0.8 + 0.35 * Math.cos(a)),
      ly: 0.4 * Math.sin(a * 1.7),
      lz: 12 + 8 * ((i * 0.37) % 1),
      wx: 0,
      wy: 0,
      wz: 0,
      hue: (i / n) * 0.18,
      phase: a,
      head: 0,
      filled: 0,
      trail: null,
    };
  }

  var inks = [];
  var si;
  for (si = 0; si < N_INK; si++) {
    var ink = seedState(si, N_INK);
    ink.trail = new Float32Array(INK_TRAIL * 3);
    inks.push(ink);
  }

  var sats = [];
  for (si = 0; si < N_SAT; si++) {
    var sat = seedState(si, N_SAT);
    sat.trail = new Float32Array(SAT_TRAIL * 3);
    sat.hue = 0.08 + (si / N_SAT) * 0.7;
    sats.push(sat);
  }

  var inkVert = N_INK * INK_TRAIL;
  var inkPos = new Float32Array(inkVert * 3);
  var inkCol = new Float32Array(inkVert * 3);
  var inkIdx = [];
  for (si = 0; si < N_INK; si++) {
    var ib = si * INK_TRAIL;
    var k;
    for (k = 0; k < INK_TRAIL - 1; k++) inkIdx.push(ib + k, ib + k + 1);
  }
  var inkGeo = new THREE.BufferGeometry();
  inkGeo.setAttribute("position", new THREE.BufferAttribute(inkPos, 3));
  inkGeo.setAttribute("color", new THREE.BufferAttribute(inkCol, 3));
  inkGeo.setIndex(inkIdx);
  scene.add(
    new THREE.LineSegments(
      inkGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  var inkGlowPos = new Float32Array(inkVert * 3);
  var inkGlowCol = new Float32Array(inkVert * 3);
  var inkGlowGeo = new THREE.BufferGeometry();
  inkGlowGeo.setAttribute("position", new THREE.BufferAttribute(inkGlowPos, 3));
  inkGlowGeo.setAttribute("color", new THREE.BufferAttribute(inkGlowCol, 3));
  var inkGlow = new THREE.Points(
    inkGlowGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: reduced ? 0.42 : 0.58,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(inkGlow);

  var ribVerts = N_INK * INK_TRAIL * 2;
  var ribPos = new Float32Array(ribVerts * 3);
  var ribCol = new Float32Array(ribVerts * 3);
  var ribIdx = [];
  for (si = 0; si < N_INK; si++) {
    var rb = si * INK_TRAIL * 2;
    for (k = 0; k < INK_TRAIL - 1; k++) {
      var a = rb + k * 2;
      ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  var ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute("position", new THREE.BufferAttribute(ribPos, 3));
  ribGeo.setAttribute("color", new THREE.BufferAttribute(ribCol, 3));
  ribGeo.setIndex(ribIdx);
  scene.add(
    new THREE.Mesh(
      ribGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );

  var satVert = N_SAT * SAT_TRAIL;
  var satPos = new Float32Array(satVert * 3);
  var satCol = new Float32Array(satVert * 3);
  var satIdx = [];
  for (si = 0; si < N_SAT; si++) {
    var sb = si * SAT_TRAIL;
    for (k = 0; k < SAT_TRAIL - 1; k++) satIdx.push(sb + k, sb + k + 1);
  }
  var satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute("position", new THREE.BufferAttribute(satPos, 3));
  satGeo.setAttribute("color", new THREE.BufferAttribute(satCol, 3));
  satGeo.setIndex(satIdx);
  scene.add(
    new THREE.LineSegments(
      satGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  var satRibVerts = N_SAT * SAT_TRAIL * 2;
  var satRibPos = new Float32Array(satRibVerts * 3);
  var satRibCol = new Float32Array(satRibVerts * 3);
  var satRibIdx = [];
  for (si = 0; si < N_SAT; si++) {
    var srb = si * SAT_TRAIL * 2;
    for (k = 0; k < SAT_TRAIL - 1; k++) {
      var sa = srb + k * 2;
      satRibIdx.push(sa, sa + 1, sa + 2, sa + 1, sa + 3, sa + 2);
    }
  }
  var satRibGeo = new THREE.BufferGeometry();
  satRibGeo.setAttribute("position", new THREE.BufferAttribute(satRibPos, 3));
  satRibGeo.setAttribute("color", new THREE.BufferAttribute(satRibCol, 3));
  satRibGeo.setIndex(satRibIdx);
  scene.add(
    new THREE.Mesh(
      satRibGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
  );

  var headPos = new Float32Array(N_SAT * 3);
  var headCol = new Float32Array(N_SAT * 3);
  var headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
  headGeo.setAttribute("color", new THREE.BufferAttribute(headCol, 3));
  scene.add(
    new THREE.Points(
      headGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: reduced ? 2.1 : 3.4,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var haloPos = new Float32Array(N_SAT * 3);
  var haloCol = new Float32Array(N_SAT * 3);
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  scene.add(
    new THREE.Points(
      haloGeo,
      new THREE.PointsMaterial({
        map: softTex,
        size: reduced ? 4.2 : 6.8,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  function warmStart() {
    var i;
    var s;
    var burn = reduced ? 400 : 900;
    for (i = 0; i < inks.length; i++) {
      var p = inks[i];
      for (s = 0; s < burn; s++) stepLorenz(p, H);
      for (s = 0; s < INK_TRAIL; s++) {
        stepLorenz(p, H);
        pushTrail(p, INK_TRAIL);
      }
    }
    for (i = 0; i < sats.length; i++) {
      var q = sats[i];
      var pre = burn + 80 + i * 47;
      for (s = 0; s < pre; s++) stepLorenz(q, H);
      for (s = 0; s < SAT_TRAIL; s++) {
        stepLorenz(q, H);
        pushTrail(q, SAT_TRAIL);
      }
    }
  }
  warmStart();

  function neonHue(lx, lz, base, shift) {
    var lobe = 0.5 + 0.5 * Math.tanh(lx * 0.14);
    return 0.5 + lobe * 0.38 + base + shift + (lz - Z_OFF) * 0.0035;
  }

  function writeRibbon(
    p,
    trailLen,
    filled,
    k,
    width,
    camx,
    camy,
    camz,
    posArr,
    colArr,
    baseVert,
    rgb,
    fade
  ) {
    var src = trailSrc(p, Math.min(k, filled - 1), trailLen);
    var tx = p.trail[src * 3];
    var ty = p.trail[src * 3 + 1];
    var tz = p.trail[src * 3 + 2];
    var nx;
    var ny;
    var nz;
    if (k < filled - 1) {
      var ns = trailSrc(p, k + 1, trailLen);
      nx = p.trail[ns * 3] - tx;
      ny = p.trail[ns * 3 + 1] - ty;
      nz = p.trail[ns * 3 + 2] - tz;
    } else if (k > 0 && filled > 1) {
      var ps = trailSrc(p, Math.max(0, k - 1), trailLen);
      nx = tx - p.trail[ps * 3];
      ny = ty - p.trail[ps * 3 + 1];
      nz = tz - p.trail[ps * 3 + 2];
    } else {
      nx = 0;
      ny = 1;
      nz = 0;
    }
    var tox = camx - tx;
    var toy = camy - ty;
    var toz = camz - tz;
    var sx = ny * toz - nz * toy;
    var sy = nz * tox - nx * toz;
    var sz = nx * toy - ny * tox;
    var sl = Math.hypot(sx, sy, sz);
    var w = width * (0.35 + 0.65 * fade);
    if (sl < 1e-6) {
      sx = w;
      sy = 0;
      sz = 0;
    } else {
      w /= sl;
      sx *= w;
      sy *= w;
      sz *= w;
    }
    var vi = (baseVert + k) * 2 * 3;
    posArr[vi] = tx + sx;
    posArr[vi + 1] = ty + sy;
    posArr[vi + 2] = tz + sz;
    posArr[vi + 3] = tx - sx;
    posArr[vi + 4] = ty - sy;
    posArr[vi + 5] = tz - sz;
    colArr[vi] = rgb[0];
    colArr[vi + 1] = rgb[1];
    colArr[vi + 2] = rgb[2];
    colArr[vi + 3] = rgb[0];
    colArr[vi + 4] = rgb[1];
    colArr[vi + 5] = rgb[2];
  }

  var hueShift = 0;
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;

  function writeBuffers(t) {
    var camx = camera.position.x;
    var camy = camera.position.y;
    var camz = camera.position.z;
    var i;
    var k;

    for (i = 0; i < N_INK; i++) {
      var p = inks[i];
      var n = p.filled;
      for (k = 0; k < INK_TRAIL; k++) {
        var live = k < n;
        var src = live ? trailSrc(p, k, INK_TRAIL) : trailSrc(p, Math.max(0, n - 1), INK_TRAIL);
        var tx = p.trail[src * 3];
        var ty = p.trail[src * 3 + 1];
        var tz = p.trail[src * 3 + 2];
        var age = !live || n < 2 ? 0 : k / (n - 1);
        var fade = live ? 0.2 + 0.8 * Math.pow(age, 0.55) : 0;
        var lx = tx / SCALE;
        var lz = ty / SCALE + Z_OFF;
        var h = neonHue(lx, lz, p.hue, hueShift);
        var wave = 0.72 + 0.28 * Math.sin(t * 1.4 - k * 0.012 + p.phase);
        var rgb = hsv(h, 0.82, fade * wave);
        var gi = (i * INK_TRAIL + k) * 3;
        inkPos[gi] = tx;
        inkPos[gi + 1] = ty;
        inkPos[gi + 2] = tz;
        inkCol[gi] = rgb[0] * 1.05;
        inkCol[gi + 1] = rgb[1] * 1.05;
        inkCol[gi + 2] = rgb[2] * 1.05;
        inkGlowPos[gi] = tx;
        inkGlowPos[gi + 1] = ty;
        inkGlowPos[gi + 2] = tz;
        var gfade = fade * fade * 0.38;
        inkGlowCol[gi] = rgb[0] * gfade;
        inkGlowCol[gi + 1] = rgb[1] * gfade;
        inkGlowCol[gi + 2] = rgb[2] * gfade;
        var rrgb = hsv(h, 0.75, fade * wave * 0.42);
        writeRibbon(
          p,
          INK_TRAIL,
          n,
          k,
          INK_WIDTH,
          camx,
          camy,
          camz,
          ribPos,
          ribCol,
          i * INK_TRAIL,
          rrgb,
          fade
        );
      }
    }

    for (i = 0; i < N_SAT; i++) {
      var q = sats[i];
      var qn = q.filled;
      var pulse = 0.7 + 0.3 * Math.sin(t * 2.2 + q.phase);
      var rgbHead = hsv(q.hue + hueShift * 0.6, 0.55, 1);
      headPos[i * 3] = q.wx;
      headPos[i * 3 + 1] = q.wy;
      headPos[i * 3 + 2] = q.wz;
      headCol[i * 3] = rgbHead[0];
      headCol[i * 3 + 1] = rgbHead[1];
      headCol[i * 3 + 2] = rgbHead[2];
      haloPos[i * 3] = q.wx;
      haloPos[i * 3 + 1] = q.wy;
      haloPos[i * 3 + 2] = q.wz;
      haloCol[i * 3] = rgbHead[0] * 0.32 * pulse;
      haloCol[i * 3 + 1] = rgbHead[1] * 0.32 * pulse;
      haloCol[i * 3 + 2] = rgbHead[2] * 0.32 * pulse;

      for (k = 0; k < SAT_TRAIL; k++) {
        var qlive = k < qn;
        var qsrc = qlive
          ? trailSrc(q, k, SAT_TRAIL)
          : trailSrc(q, Math.max(0, qn - 1), SAT_TRAIL);
        var qx = q.trail[qsrc * 3];
        var qy = q.trail[qsrc * 3 + 1];
        var qz = q.trail[qsrc * 3 + 2];
        var qage = !qlive || qn < 2 ? 0 : k / (qn - 1);
        var qfade = qlive ? Math.pow(qage, 1.15) * pulse : 0;
        var qh = q.hue + hueShift * 0.6 + k * 0.002;
        var qrgb = hsv(qh, 0.62, qfade);
        var qgi = (i * SAT_TRAIL + k) * 3;
        satPos[qgi] = qx;
        satPos[qgi + 1] = qy;
        satPos[qgi + 2] = qz;
        satCol[qgi] = qrgb[0] * 1.2;
        satCol[qgi + 1] = qrgb[1] * 1.2;
        satCol[qgi + 2] = qrgb[2] * 1.2;
        var qrr = hsv(qh, 0.5, qfade * 0.7);
        writeRibbon(
          q,
          SAT_TRAIL,
          qn,
          k,
          SAT_WIDTH * (0.55 + 0.45 * qage),
          camx,
          camy,
          camz,
          satRibPos,
          satRibCol,
          i * SAT_TRAIL,
          qrr,
          qfade
        );
      }
    }

    inkGeo.attributes.position.needsUpdate = true;
    inkGeo.attributes.color.needsUpdate = true;
    inkGlowGeo.attributes.position.needsUpdate = true;
    inkGlowGeo.attributes.color.needsUpdate = true;
    ribGeo.attributes.position.needsUpdate = true;
    ribGeo.attributes.color.needsUpdate = true;
    satGeo.attributes.position.needsUpdate = true;
    satGeo.attributes.color.needsUpdate = true;
    satRibGeo.attributes.position.needsUpdate = true;
    satRibGeo.attributes.color.needsUpdate = true;
    headGeo.attributes.position.needsUpdate = true;
    headGeo.attributes.color.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
    haloGeo.attributes.color.needsUpdate = true;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt;
    hueShift += HUE_SPEED * dt;

    var s;
    var i;
    for (s = 0; s < SUBSTEPS; s++) {
      for (i = 0; i < N_INK; i++) {
        stepLorenz(inks[i], H);
        pushTrail(inks[i], INK_TRAIL);
      }
      for (i = 0; i < N_SAT; i++) {
        stepLorenz(sats[i], H);
        pushTrail(sats[i], SAT_TRAIL);
      }
    }

    camAngle += CAM_SPEED * dt;
    var elev = 0.32 + 0.14 * Math.sin(elapsed * 0.09);
    var cr = camRadius + 1.6 * Math.sin(elapsed * 0.055);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.35,
      Math.sin(camAngle) * Math.cos(elev) * cr
    );
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);

    writeBuffers(elapsed);
    renderer.render(scene, camera);
  }

  function onResize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", onResize, false);
  document.addEventListener(
    "visibilitychange",
    function () {
      if (!document.hidden) last = performance.now();
    },
    false
  );

  writeBuffers(0);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
