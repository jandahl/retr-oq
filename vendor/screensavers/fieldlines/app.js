/* Original remake of the classic 2000s field-lines GL eye candy
   (KDE / Really Slick era). Glowing traces of the Coulomb field
   around moving point charges. Complete line traces are rebuilt
   each frame as the charges wander — not dipole ribbons, not
   particle trails, and not derived from rss-glx / GPL sources. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduced = false;
  }

  var N_CHARGES = reduced ? 3 : 5;
  var LINES_PER = reduced ? 10 : 22;
  var MAX_STEPS = reduced ? 44 : 92;
  var STEP = reduced ? 0.18 : 0.125;
  var START_R = 0.48;
  var HIT_R = 0.42;
  var ESCAPE_R = 15.5;
  var CHARGE_SPEED = reduced ? 0.22 : 0.52;
  var CAM_SPEED = reduced ? 0.028 : 0.068;
  var HUE_SPEED = reduced ? 0.01 : 0.022;
  var SPIN = reduced ? 0.08 : 0.18;
  var GLOW_SIZE = reduced ? 0.72 : 1.08;
  var CORE_SIZE = reduced ? 2.1 : 2.85;
  var HALO_SIZE = reduced ? 4.2 : 5.6;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    54,
    window.innerWidth / window.innerHeight,
    0.1,
    220
  );
  var camRadius = 16.4;
  var camAngle = 0.55;
  camera.position.set(0, 2.8, camRadius);

  function makeGlowTexture(size, midStop) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.16, "rgba(255,255,255,0.88)");
    grd.addColorStop(midStop, "rgba(160,210,255,0.22)");
    grd.addColorStop(0.7, "rgba(40,80,180,0.05)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(96, 0.4);
  var softTex = makeGlowTexture(64, 0.52);

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

  function fibonacciDir(i, n, out) {
    var ga = Math.PI * (3 - Math.sqrt(5));
    var y = n <= 1 ? 1 : 1 - (i / (n - 1)) * 2;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var th = ga * i + 0.31;
    out.x = Math.cos(th) * r;
    out.y = y;
    out.z = Math.sin(th) * r;
  }

  // --- wandering point charges (sources / sinks) ---
  var charges = [];
  for (var ci = 0; ci < N_CHARGES; ci++) {
    var pos = ci % 2 === 0;
    charges.push({
      x: 0,
      y: 0,
      z: 0,
      q: pos ? 1 : -1,
      hue: pos ? 0.03 + (ci * 0.045) % 0.14 : 0.5 + (ci * 0.04) % 0.16,
      sat: pos ? 0.82 : 0.78,
      phase: (ci / N_CHARGES) * Math.PI * 2 + 0.17 * ci,
      rx: 3.1 + (ci % 3) * 0.72,
      ry: 2.15 + ((ci + 1) % 3) * 0.58,
      rz: 3.35 + ((ci + 2) % 3) * 0.64,
      fy: 0.67 + ci * 0.11,
      fz: 0.81 + (N_CHARGES - ci) * 0.07,
      spin: SPIN * (0.75 + (ci % 3) * 0.18),
      speed: CHARGE_SPEED * (0.82 + (ci % 4) * 0.09),
    });
  }

  function updateCharges(t) {
    var i, j, c, a;
    for (i = 0; i < N_CHARGES; i++) {
      c = charges[i];
      a = t * c.speed + c.phase;
      c.x = Math.sin(a) * c.rx;
      c.y = Math.sin(a * c.fy + c.phase * 1.15) * c.ry;
      c.z = Math.cos(a * c.fz + c.phase * 0.6) * c.rz;
    }
    // keep sources from stacking (singular field, ugly pinch)
    for (i = 0; i < N_CHARGES; i++) {
      for (j = i + 1; j < N_CHARGES; j++) {
        var dx = charges[j].x - charges[i].x;
        var dy = charges[j].y - charges[i].y;
        var dz = charges[j].z - charges[i].z;
        var d2 = dx * dx + dy * dy + dz * dz;
        var minD = 1.35;
        if (d2 < minD * minD && d2 > 1e-6) {
          var d = Math.sqrt(d2);
          var push = (minD - d) * 0.5;
          dx = (dx / d) * push;
          dy = (dy / d) * push;
          dz = (dz / d) * push;
          charges[i].x -= dx;
          charges[i].y -= dy;
          charges[i].z -= dz;
          charges[j].x += dx;
          charges[j].y += dy;
          charges[j].z += dz;
        }
      }
    }
  }

  var _E = { x: 0, y: 0, z: 0 };
  var _S = { x: 0, y: 0, z: 0 };
  var _P = { x: 0, y: 0, z: 0 };

  function fieldAt(px, py, pz) {
    var ex = 0;
    var ey = 0;
    var ez = 0;
    for (var i = 0; i < N_CHARGES; i++) {
      var c = charges[i];
      var dx = px - c.x;
      var dy = py - c.y;
      var dz = pz - c.z;
      var r2 = dx * dx + dy * dy + dz * dz + 0.14;
      var inv = c.q / (r2 * Math.sqrt(r2));
      ex += dx * inv;
      ey += dy * inv;
      ez += dz * inv;
    }
    _E.x = ex;
    _E.y = ey;
    _E.z = ez;
    return _E;
  }

  function rotateSeed(c, x, y, z, t, out) {
    var a = t * c.spin + c.phase;
    var ca = Math.cos(a);
    var sa = Math.sin(a);
    var b = t * c.spin * 0.63 + c.phase * 1.4;
    var cb = Math.cos(b);
    var sb = Math.sin(b);
    var x1 = x * ca + z * sa;
    var z1 = -x * sa + z * ca;
    out.x = x1;
    out.y = y * cb - z1 * sb;
    out.z = y * sb + z1 * cb;
  }

  function nearestOther(px, py, pz, selfIdx, radius) {
    var r2 = radius * radius;
    var hit = -1;
    var best = r2;
    for (var i = 0; i < N_CHARGES; i++) {
      if (i === selfIdx) continue;
      var c = charges[i];
      var dx = px - c.x;
      var dy = py - c.y;
      var dz = pz - c.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < best) {
        best = d2;
        hit = i;
      }
    }
    return hit;
  }

  var maxSegVerts = N_CHARGES * LINES_PER * (MAX_STEPS - 1) * 2;
  var maxGlow = N_CHARGES * LINES_PER * MAX_STEPS;
  var segPos = new Float32Array(maxSegVerts * 3);
  var segCol = new Float32Array(maxSegVerts * 3);
  var glowPos = new Float32Array(maxGlow * 3);
  var glowCol = new Float32Array(maxGlow * 3);

  var segGeo = new THREE.BufferGeometry();
  segGeo.setAttribute("position", new THREE.BufferAttribute(segPos, 3));
  segGeo.setAttribute("color", new THREE.BufferAttribute(segCol, 3));
  scene.add(
    new THREE.LineSegments(
      segGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  var glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute("color", new THREE.BufferAttribute(glowCol, 3));
  scene.add(
    new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: GLOW_SIZE,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var ionPos = new Float32Array(N_CHARGES * 3);
  var ionCol = new Float32Array(N_CHARGES * 3);
  var ionGeo = new THREE.BufferGeometry();
  ionGeo.setAttribute("position", new THREE.BufferAttribute(ionPos, 3));
  ionGeo.setAttribute("color", new THREE.BufferAttribute(ionCol, 3));
  scene.add(
    new THREE.Points(
      ionGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: CORE_SIZE,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var haloPos = new Float32Array(N_CHARGES * 3);
  var haloCol = new Float32Array(N_CHARGES * 3);
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  scene.add(
    new THREE.Points(
      haloGeo,
      new THREE.PointsMaterial({
        map: softTex,
        size: HALO_SIZE,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var hueShift = 0;
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;
  var usedSeg = 0;
  var usedGlow = 0;

  function traceAll(t) {
    usedSeg = 0;
    usedGlow = 0;
    var si = 0;
    var gi = 0;

    for (var i = 0; i < N_CHARGES; i++) {
      var c = charges[i];
      var dirSign = c.q >= 0 ? 1 : -1;
      var h0 = c.hue + hueShift;

      for (var li = 0; li < LINES_PER; li++) {
        fibonacciDir(li, LINES_PER, _S);
        rotateSeed(c, _S.x, _S.y, _S.z, t, _S);
        _P.x = c.x + _S.x * START_R;
        _P.y = c.y + _S.y * START_R;
        _P.z = c.z + _S.z * START_R;

        if (nearestOther(_P.x, _P.y, _P.z, i, HIT_R) >= 0) continue;

        var px = _P.x;
        var py = _P.y;
        var pz = _P.z;
        var pdx = dirSign * _S.x;
        var pdy = dirSign * _S.y;
        var pdz = dirSign * _S.z;
        var hitSink = false;
        var npts = 0;
        var prevx = px;
        var prevy = py;
        var prevz = pz;

        for (var s = 0; s < MAX_STEPS; s++) {
          var fade = 1 - (s / MAX_STEPS) * 0.62;
          var dist = Math.hypot(px, py, pz);
          var distFade = 1 / (1 + dist * 0.035);
          var v = fade * distFade;
          var rgb = hsv(h0 + s * 0.0014, c.sat, v);
          var gx = gi * 3;
          glowPos[gx] = px;
          glowPos[gx + 1] = py;
          glowPos[gx + 2] = pz;
          glowCol[gx] = rgb[0] * 0.9;
          glowCol[gx + 1] = rgb[1] * 0.9;
          glowCol[gx + 2] = rgb[2] * 0.9;
          gi++;
          npts++;

          if (s > 0) {
            var sx = si * 3;
            var hot = hsv(h0 + s * 0.0014, Math.max(0.35, c.sat - 0.18), Math.min(1, v * 1.25));
            segPos[sx] = prevx;
            segPos[sx + 1] = prevy;
            segPos[sx + 2] = prevz;
            segCol[sx] = hot[0];
            segCol[sx + 1] = hot[1];
            segCol[sx + 2] = hot[2];
            segPos[sx + 3] = px;
            segPos[sx + 4] = py;
            segPos[sx + 5] = pz;
            segCol[sx + 3] = hot[0];
            segCol[sx + 4] = hot[1];
            segCol[sx + 5] = hot[2];
            si += 2;
          }

          prevx = px;
          prevy = py;
          prevz = pz;

          var hit = nearestOther(px, py, pz, i, HIT_R);
          if (hit >= 0) {
            hitSink = true;
            break;
          }
          if (dist > ESCAPE_R) break;

          var e1 = fieldAt(px, py, pz);
          var m1 = Math.hypot(e1.x, e1.y, e1.z);
          if (m1 < 1e-6) break;
          var hx = (e1.x / m1) * dirSign;
          var hy = (e1.y / m1) * dirSign;
          var hz = (e1.z / m1) * dirSign;
          if (hx * pdx + hy * pdy + hz * pdz < -0.15 && s > 2) break;

          var mx = px + hx * STEP * 0.5;
          var my = py + hy * STEP * 0.5;
          var mz = pz + hz * STEP * 0.5;
          var e2 = fieldAt(mx, my, mz);
          var m2 = Math.hypot(e2.x, e2.y, e2.z);
          if (m2 < 1e-6) break;
          var nx = (e2.x / m2) * dirSign;
          var ny = (e2.y / m2) * dirSign;
          var nz = (e2.z / m2) * dirSign;
          px += nx * STEP;
          py += ny * STEP;
          pz += nz * STEP;
          pdx = nx;
          pdy = ny;
          pdz = nz;
        }

        if (hitSink && npts > 3) {
          // connected traces stay a bit hotter at the sink end
          var lastG = (gi - 1) * 3;
          glowCol[lastG] = Math.min(1, glowCol[lastG] * 1.35);
          glowCol[lastG + 1] = Math.min(1, glowCol[lastG + 1] * 1.35);
          glowCol[lastG + 2] = Math.min(1, glowCol[lastG + 2] * 1.35);
        }
      }
    }

    usedSeg = si;
    usedGlow = gi;
    segGeo.setDrawRange(0, usedSeg);
    glowGeo.setDrawRange(0, usedGlow);
    segGeo.attributes.position.needsUpdate = true;
    segGeo.attributes.color.needsUpdate = true;
    glowGeo.attributes.position.needsUpdate = true;
    glowGeo.attributes.color.needsUpdate = true;
  }

  function writeIons(t) {
    for (var i = 0; i < N_CHARGES; i++) {
      var c = charges[i];
      var pulse = 0.72 + 0.28 * Math.sin(t * 1.9 + c.phase);
      var rgb = hsv(c.hue + hueShift, c.sat * 0.55, 1);
      ionPos[i * 3] = c.x;
      ionPos[i * 3 + 1] = c.y;
      ionPos[i * 3 + 2] = c.z;
      ionCol[i * 3] = rgb[0];
      ionCol[i * 3 + 1] = rgb[1];
      ionCol[i * 3 + 2] = rgb[2];
      haloPos[i * 3] = c.x;
      haloPos[i * 3 + 1] = c.y;
      haloPos[i * 3 + 2] = c.z;
      haloCol[i * 3] = rgb[0] * 0.32 * pulse;
      haloCol[i * 3 + 1] = rgb[1] * 0.32 * pulse;
      haloCol[i * 3 + 2] = rgb[2] * 0.32 * pulse;
    }
    ionGeo.attributes.position.needsUpdate = true;
    ionGeo.attributes.color.needsUpdate = true;
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

    updateCharges(elapsed);
    traceAll(elapsed);
    writeIons(elapsed);

    camAngle += CAM_SPEED * dt;
    var elev = 0.16 * Math.sin(elapsed * 0.09) + 0.07;
    var cr = camRadius + 0.7 * Math.sin(elapsed * 0.06);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.35,
      Math.sin(camAngle) * Math.cos(elev) * cr
    );
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);

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

  updateCharges(0);
  traceAll(0);
  writeIons(0);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
