/* Original remake of the classic 2000s "flux fields" GL eye candy.
   Magnetic-dipole field-line tracing with additive light sprites and
   camera-facing ribbons. Not derived from rss-glx / GPL sources. */
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

  var N_DIPOLES = reduced ? 2 : 4;
  var N_PARTICLES = reduced ? 8 : 22;
  var TRAIL = reduced ? 22 : 52;
  var SUBSTEPS = reduced ? 1 : 2;
  var SPEED = reduced ? 0.55 : 1.15;
  var INSTABILITY = reduced ? 0.08 : 0.22;
  var WIND = reduced ? 0.04 : 0.12;
  var CAM_SPEED = reduced ? 0.045 : 0.085;
  var HUE_SPEED = reduced ? 0.012 : 0.028;
  var STAR_COUNT = reduced ? 80 : 220;
  var RIBBON_WIDTH = reduced ? 0.07 : 0.13;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    56,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  var camRadius = 17.5;
  var camAngle = 0.35;
  camera.position.set(0, 3.2, camRadius);

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,255,0.92)");
    grd.addColorStop(mid, "rgba(255,210,160,0.28)");
    grd.addColorStop(0.72, "rgba(120,160,255,0.07)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128, 0.12, 0.38);
  var softTex = makeGlowTexture(64, 0.2, 0.5);

  function hsv(h, s, v) {
    var hh = ((h % 1) + 1) % 1;
    var i = (hh * 6) | 0;
    var f = hh * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p];
      case 1: return [q, v, p];
      case 2: return [p, v, t];
      case 3: return [p, q, v];
      case 4: return [t, p, v];
      default: return [v, p, q];
    }
  }

  // --- faint starfield (dark space, not a UI) ---
  (function addStars() {
    var pos = new Float32Array(STAR_COUNT * 3);
    var col = new Float32Array(STAR_COUNT * 3);
    for (var i = 0; i < STAR_COUNT; i++) {
      var u = Math.random();
      var v = Math.random();
      var th = u * Math.PI * 2;
      var ph = Math.acos(2 * v - 1);
      var r = 48 + Math.random() * 36;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      var b = 0.18 + Math.random() * 0.35;
      col[i * 3] = b;
      col[i * 3 + 1] = b * (0.9 + Math.random() * 0.1);
      col[i * 3 + 2] = b * (0.95 + Math.random() * 0.2);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.12,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          sizeAttenuation: true,
        })
      )
    );
  })();

  // --- tumbling magnetic dipoles (the flux sources) ---
  var dipoles = [];
  for (var di = 0; di < N_DIPOLES; di++) {
    dipoles.push({
      phase: (di / N_DIPOLES) * Math.PI * 2 + Math.random() * 0.4,
      radius: 2.1 + (di % 3) * 0.85 + Math.random() * 0.3,
      orbit: 0.07 + di * 0.017,
      tilt: 0.4 + di * 0.55,
      precess: 0.09 + di * 0.025,
      strength: 1.15 + (di % 2) * 0.35,
      cx: 0,
      cy: 0,
      cz: 0,
      mx: 0,
      my: 1,
      mz: 0,
    });
  }

  function updateDipoles(t) {
    for (var i = 0; i < dipoles.length; i++) {
      var d = dipoles[i];
      var a = t * d.orbit + d.phase;
      d.cx = Math.cos(a) * d.radius;
      d.cy = Math.sin(a * 0.71 + d.phase * 1.2) * d.radius * 0.42;
      d.cz = Math.sin(a) * d.radius;
      var p = t * d.precess + d.phase * 1.7;
      d.mx = Math.sin(p) * Math.cos(d.tilt);
      d.my = Math.cos(p * 0.83);
      d.mz = Math.sin(p) * Math.sin(d.tilt);
    }
  }

  var _B = { x: 0, y: 0, z: 0 };

  function fieldAt(px, py, pz, t) {
    var bx = 0;
    var by = 0;
    var bz = 0;
    for (var i = 0; i < dipoles.length; i++) {
      var d = dipoles[i];
      var rx = px - d.cx;
      var ry = py - d.cy;
      var rz = pz - d.cz;
      var r2 = rx * rx + ry * ry + rz * rz + 0.55;
      var inv = d.strength / (r2 * r2 * Math.sqrt(r2));
      var md = d.mx * rx + d.my * ry + d.mz * rz;
      bx += (3 * md * rx - d.mx * r2) * inv;
      by += (3 * md * ry - d.my * r2) * inv;
      bz += (3 * md * rz - d.mz * r2) * inv;
    }
    bx += WIND * Math.sin(t * 0.13);
    by += WIND * 0.18 * Math.cos(t * 0.09);
    bz += WIND * Math.cos(t * 0.11);
    var k = 0.33;
    bx += INSTABILITY * Math.sin(py * k + t * 0.61) * Math.cos(pz * 0.27);
    by += INSTABILITY * Math.cos(pz * k - t * 0.47) * Math.sin(px * 0.29);
    bz += INSTABILITY * Math.sin(px * k + t * 0.53) * Math.cos(py * 0.31);
    _B.x = bx;
    _B.y = by;
    _B.z = bz;
    return _B;
  }

  function seedAroundDipole(out, d) {
    var nlen = Math.hypot(d.mx, d.my, d.mz) || 1;
    var nx = d.mx / nlen;
    var ny = d.my / nlen;
    var nz = d.mz / nlen;
    var ax = Math.abs(nx) < 0.9 ? 1 : 0;
    var bx_ = ny * 0 - nz * ax;
    var by_ = nz * ax - nx * 0;
    var bz_ = nx * ax - ny * 0;
    var bl = Math.hypot(bx_, by_, bz_) || 1;
    bx_ /= bl;
    by_ /= bl;
    bz_ /= bl;
    var cx_ = ny * bz_ - nz * by_;
    var cy_ = nz * bx_ - nx * bz_;
    var cz_ = nx * by_ - ny * bx_;
    var ang = Math.random() * Math.PI * 2;
    var rad = 1.4 + Math.random() * 3.6;
    var along = (Math.random() - 0.5) * 1.6;
    out.x = d.cx + nx * along + (bx_ * Math.cos(ang) + cx_ * Math.sin(ang)) * rad;
    out.y = d.cy + ny * along + (by_ * Math.cos(ang) + cy_ * Math.sin(ang)) * rad;
    out.z = d.cz + nz * along + (bz_ * Math.cos(ang) + cz_ * Math.sin(ang)) * rad;
  }

  function reseed(p) {
    seedAroundDipole(p, dipoles[(Math.random() * dipoles.length) | 0]);
    p.age = 0;
    p.filled = 0;
  }

  function stepParticle(p, dt, t) {
    var B = fieldAt(p.x, p.y, p.z, t);
    var mag = Math.hypot(B.x, B.y, B.z);
    if (mag < 1e-5 || mag > 48) {
      reseed(p);
      return;
    }
    var s = (SPEED * dt) / mag;
    p.x += B.x * s;
    p.y += B.y * s;
    p.z += B.z * s;
    p.age += dt;
    var dist = Math.hypot(p.x, p.y, p.z);
    if (dist > 16 || p.age > 28) {
      reseed(p);
    }
  }

  // --- particles / flux tubes ---
  var particles = [];
  for (var pi = 0; pi < N_PARTICLES; pi++) {
    particles.push({
      x: 0,
      y: 0,
      z: 0,
      hue: (pi / N_PARTICLES) * 0.92 + 0.02,
      sat: 0.72 + (pi % 3) * 0.08,
      phase: Math.random() * Math.PI * 2,
      age: Math.random() * 8,
      trail: new Float32Array(TRAIL * 3),
      filled: 0,
    });
  }

  var trailCount = N_PARTICLES * TRAIL;
  var trailPos = new Float32Array(trailCount * 3);
  var trailCol = new Float32Array(trailCount * 3);
  var trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  var trailPoints = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 1.05,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(trailPoints);

  var headPos = new Float32Array(N_PARTICLES * 3);
  var headCol = new Float32Array(N_PARTICLES * 3);
  var headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
  headGeo.setAttribute("color", new THREE.BufferAttribute(headCol, 3));
  var headPoints = new THREE.Points(
    headGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 2.7,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(headPoints);

  var haloPos = new Float32Array(N_PARTICLES * 3);
  var haloCol = new Float32Array(N_PARTICLES * 3);
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  var haloPoints = new THREE.Points(
    haloGeo,
    new THREE.PointsMaterial({
      map: softTex,
      size: 5.4,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(haloPoints);

  // camera-facing ribbons (magnetic flux tubes)
  var ribVerts = N_PARTICLES * TRAIL * 2;
  var ribPos = new Float32Array(ribVerts * 3);
  var ribCol = new Float32Array(ribVerts * 3);
  var ribIdx = [];
  for (var rp = 0; rp < N_PARTICLES; rp++) {
    var base = rp * TRAIL * 2;
    for (var rt = 0; rt < TRAIL - 1; rt++) {
      var a = base + rt * 2;
      ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  var ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute("position", new THREE.BufferAttribute(ribPos, 3));
  ribGeo.setAttribute("color", new THREE.BufferAttribute(ribCol, 3));
  ribGeo.setIndex(ribIdx);
  var ribMesh = new THREE.Mesh(
    ribGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  scene.add(ribMesh);

  var spinePos = new Float32Array(N_PARTICLES * TRAIL * 3);
  var spineCol = new Float32Array(N_PARTICLES * TRAIL * 3);
  var spineIdx = [];
  for (var sp = 0; sp < N_PARTICLES; sp++) {
    var sb = sp * TRAIL;
    for (var st = 0; st < TRAIL - 1; st++) {
      spineIdx.push(sb + st, sb + st + 1);
    }
  }
  var spineGeo = new THREE.BufferGeometry();
  spineGeo.setAttribute("position", new THREE.BufferAttribute(spinePos, 3));
  spineGeo.setAttribute("color", new THREE.BufferAttribute(spineCol, 3));
  spineGeo.setIndex(spineIdx);
  scene.add(
    new THREE.LineSegments(
      spineGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  function pushTrail(p) {
    if (p.filled < TRAIL) {
      var i = p.filled * 3;
      p.trail[i] = p.x;
      p.trail[i + 1] = p.y;
      p.trail[i + 2] = p.z;
      p.filled++;
      return;
    }
    p.trail.copyWithin(0, 3);
    var t = (TRAIL - 1) * 3;
    p.trail[t] = p.x;
    p.trail[t + 1] = p.y;
    p.trail[t + 2] = p.z;
  }

  function warmStart() {
    updateDipoles(0);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      seedAroundDipole(p, dipoles[i % dipoles.length]);
      p.filled = 0;
      for (var s = 0; s < TRAIL; s++) {
        stepParticle(p, 0.032, s * 0.032);
        pushTrail(p);
      }
    }
  }
  warmStart();

  var hueShift = 0;
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;

  function writeBuffers(t) {
    var camx = camera.position.x;
    var camy = camera.position.y;
    var camz = camera.position.z;

    for (var i = 0; i < N_PARTICLES; i++) {
      var p = particles[i];
      var h = p.hue + hueShift;
      var pulse = 0.62 + 0.38 * Math.sin(t * 1.7 + p.phase);
      var rgbHead = hsv(h, p.sat, 1);
      headPos[i * 3] = p.x;
      headPos[i * 3 + 1] = p.y;
      headPos[i * 3 + 2] = p.z;
      headCol[i * 3] = rgbHead[0];
      headCol[i * 3 + 1] = rgbHead[1];
      headCol[i * 3 + 2] = rgbHead[2];
      haloPos[i * 3] = p.x;
      haloPos[i * 3 + 1] = p.y;
      haloPos[i * 3 + 2] = p.z;
      haloCol[i * 3] = rgbHead[0] * 0.28 * pulse;
      haloCol[i * 3 + 1] = rgbHead[1] * 0.28 * pulse;
      haloCol[i * 3 + 2] = rgbHead[2] * 0.28 * pulse;

      var n = p.filled;
      for (var k = 0; k < TRAIL; k++) {
        var live = k < n;
        var src = live ? k : Math.max(0, n - 1);
        var tx = live ? p.trail[src * 3] : p.x;
        var ty = live ? p.trail[src * 3 + 1] : p.y;
        var tz = live ? p.trail[src * 3 + 2] : p.z;
        var fade = !live || n < 2 ? 0 : k / (n - 1);
        fade = fade * fade;
        var wave = 0.55 + 0.45 * Math.sin(t * 2.1 - k * 0.22 + p.phase);
        var v = fade * wave * pulse;
        var rgb = hsv(h + k * 0.0018, p.sat, v);

        var gi = (i * TRAIL + k) * 3;
        trailPos[gi] = tx;
        trailPos[gi + 1] = ty;
        trailPos[gi + 2] = tz;
        trailCol[gi] = rgb[0] * 0.85;
        trailCol[gi + 1] = rgb[1] * 0.85;
        trailCol[gi + 2] = rgb[2] * 0.85;

        spinePos[gi] = tx;
        spinePos[gi + 1] = ty;
        spinePos[gi + 2] = tz;
        spineCol[gi] = rgb[0] * 1.15;
        spineCol[gi + 1] = rgb[1] * 1.15;
        spineCol[gi + 2] = rgb[2] * 1.15;

        var nx, ny, nz;
        if (k < TRAIL - 1) {
          var ns = k + 1 < n ? k + 1 : src;
          nx = p.trail[ns * 3] - tx;
          ny = p.trail[ns * 3 + 1] - ty;
          nz = p.trail[ns * 3 + 2] - tz;
        } else if (k > 0) {
          var ps = k - 1;
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
        var w = RIBBON_WIDTH * (0.28 + 0.72 * fade) * (0.75 + 0.25 * wave);
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
        var vi = (i * TRAIL + k) * 2 * 3;
        ribPos[vi] = tx + sx;
        ribPos[vi + 1] = ty + sy;
        ribPos[vi + 2] = tz + sz;
        ribPos[vi + 3] = tx - sx;
        ribPos[vi + 4] = ty - sy;
        ribPos[vi + 5] = tz - sz;
        var rc = hsv(h + k * 0.0018, Math.min(1, p.sat + 0.05), v * 0.7);
        ribCol[vi] = rc[0];
        ribCol[vi + 1] = rc[1];
        ribCol[vi + 2] = rc[2];
        ribCol[vi + 3] = rc[0];
        ribCol[vi + 4] = rc[1];
        ribCol[vi + 5] = rc[2];
      }
    }

    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
    headGeo.attributes.position.needsUpdate = true;
    headGeo.attributes.color.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
    haloGeo.attributes.color.needsUpdate = true;
    ribGeo.attributes.position.needsUpdate = true;
    ribGeo.attributes.color.needsUpdate = true;
    spineGeo.attributes.position.needsUpdate = true;
    spineGeo.attributes.color.needsUpdate = true;
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

    updateDipoles(elapsed);
    var hdt = dt / SUBSTEPS;
    for (var s = 0; s < SUBSTEPS; s++) {
      var tt = elapsed - dt + (s + 1) * hdt;
      for (var i = 0; i < N_PARTICLES; i++) {
        stepParticle(particles[i], hdt, tt);
        pushTrail(particles[i]);
      }
    }

    camAngle += CAM_SPEED * dt;
    var elev = 0.18 * Math.sin(elapsed * 0.11) + 0.08;
    var cr = camRadius + 0.9 * Math.sin(elapsed * 0.07);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.4,
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
