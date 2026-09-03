/* Original remake of the classic 2000s "euphoria" GL eye candy.
   Nauseating psychedelic plasma blobs / metaball-ish colored wisps
   with additive blending and a slow camera. Not derived from
   rss-glx / GPL sources. */
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

  var N_WISPS = reduced ? 2 : 5;
  var N_BG = reduced ? 1 : 3;
  var SLICES = reduced ? 12 : 22;
  var STACKS = reduced ? 8 : 16;
  var SATS = reduced ? 7 : 16;
  var N_TENDRIL = reduced ? 5 : 12;
  var TRAIL = reduced ? 20 : 48;
  var SPEED = reduced ? 0.32 : 0.78;
  var CAM_SPEED = reduced ? 0.028 : 0.062;
  var HUE_SPEED = reduced ? 0.018 : 0.042;
  var BLOB_AMP = reduced ? 0.18 : 0.32;
  var PLASMA_SIZE = reduced ? 64 : 128;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  var camRadius = 8.6;
  var camAngle = 0.4;
  camera.position.set(0, 1.6, camRadius);

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

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,255,0.88)");
    grd.addColorStop(mid, "rgba(255,255,255,0.32)");
    grd.addColorStop(0.7, "rgba(180,200,255,0.08)");
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
  var softTex = makeGlowTexture(96, 0.18, 0.48);

  function makePlasmaTexture(size, freq, sharp) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var img = g.createImageData(size, size);
    var d = img.data;
    for (var y = 0; y < size; y++) {
      var v = y / size;
      for (var x = 0; x < size; x++) {
        var u = x / size;
        var p =
          Math.sin(u * freq) +
          Math.sin(v * freq * 1.27) +
          Math.sin((u + v) * freq * 0.71) +
          Math.sin(Math.hypot(u - 0.5, v - 0.48) * freq * 2.15);
        if (sharp) {
          p = Math.pow(Math.abs(Math.sin(p * 1.6 + u * 9.0 + v * 4.2)), 4.2) * 4 - 2;
        }
        var h = ((p * 0.13 + 0.18) % 1 + 1) % 1;
        var val = 0.42 + 0.5 * (0.5 + 0.5 * Math.sin(p * 1.1));
        var rgb = hsv(h, 0.78, val);
        var i = (y * size + x) * 4;
        d[i] = (rgb[0] * 255) | 0;
        d[i + 1] = (rgb[1] * 255) | 0;
        d[i + 2] = (rgb[2] * 255) | 0;
        d[i + 3] = (70 + 140 * val) | 0;
      }
    }
    g.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  var plasmaTex = makePlasmaTexture(PLASMA_SIZE, 11.5, false);
  var stringyTex = makePlasmaTexture(PLASMA_SIZE, 16.0, true);

  function makeBlobGeometry(radius, slices, stacks) {
    var cols = slices + 1;
    var vertCount = cols * (stacks + 1);
    var pos = new Float32Array(vertCount * 3);
    var rest = new Float32Array(vertCount * 3);
    var col = new Float32Array(vertCount * 3);
    var uv = new Float32Array(vertCount * 2);
    var idx = [];
    var n = 0;
    for (var i = 0; i <= stacks; i++) {
      var tv = i / stacks;
      var phi = tv * Math.PI;
      var sp = Math.sin(phi);
      var cp = Math.cos(phi);
      for (var j = 0; j <= slices; j++) {
        var tu = j / slices;
        var th = tu * Math.PI * 2;
        var x = sp * Math.cos(th);
        var y = cp;
        var z = sp * Math.sin(th);
        rest[n * 3] = x * radius;
        rest[n * 3 + 1] = y * radius;
        rest[n * 3 + 2] = z * radius;
        pos[n * 3] = rest[n * 3];
        pos[n * 3 + 1] = rest[n * 3 + 1];
        pos[n * 3 + 2] = rest[n * 3 + 2];
        uv[n * 2] = tu;
        uv[n * 2 + 1] = tv;
        n++;
      }
    }
    for (var si = 0; si < stacks; si++) {
      for (var sj = 0; sj < slices; sj++) {
        var a = si * cols + sj;
        var b = a + cols;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.userData.rest = rest;
    geo.userData.radius = radius;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), radius * 3.2);
    return geo;
  }

  // --- wandering plasma blobs (wisps) ---
  var wisps = [];
  var blobGroup = new THREE.Group();
  scene.add(blobGroup);

  for (var wi = 0; wi < N_WISPS; wi++) {
    var radius = 1.62 + (wi % 3) * 0.36 + Math.random() * 0.1;
    var geo = makeBlobGeometry(radius, SLICES, STACKS);
    var outerMap = (wi % 2 === 0 ? plasmaTex : stringyTex).clone();
    outerMap.needsUpdate = true;
    var mat = new THREE.MeshBasicMaterial({
      map: outerMap,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    var mesh = new THREE.Mesh(geo, mat);
    blobGroup.add(mesh);

    var innerGeo = makeBlobGeometry(radius * 0.42, Math.max(8, SLICES - 8), Math.max(6, STACKS - 6));
    var innerMap = plasmaTex.clone();
    innerMap.needsUpdate = true;
    var innerMat = new THREE.MeshBasicMaterial({
      map: innerMap,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    var inner = new THREE.Mesh(innerGeo, innerMat);
    blobGroup.add(inner);

    wisps.push({
      mesh: mesh,
      inner: inner,
      hue: (wi / N_WISPS) * 0.94 + 0.02,
      sat: 0.72 + (wi % 3) * 0.08,
      phase: (wi / N_WISPS) * Math.PI * 2 + Math.random() * 0.5,
      ax: 1.85 + (wi % 2) * 0.45,
      ay: 1.15 + (wi % 3) * 0.28,
      az: 1.7 + ((wi + 1) % 3) * 0.4,
      wx: 0.11 + wi * 0.017,
      wy: 0.09 + wi * 0.013,
      wz: 0.13 + wi * 0.011,
      spin: 0.15 + wi * 0.04,
      tilt: 0.35 + wi * 0.4,
      cx: 0,
      cy: 0,
      cz: 0,
      pulse: 0.8 + (wi % 4) * 0.07,
    });
  }

  function deformBlob(geo, t, wisp, scale, hue, inner) {
    var rest = geo.userData.rest;
    var pos = geo.attributes.position.array;
    var col = geo.attributes.color.array;
    var nvert = rest.length / 3;
    var amp = BLOB_AMP * scale;
    var p0 = wisp.phase;
    for (var i = 0; i < nvert; i++) {
      var rx = rest[i * 3];
      var ry = rest[i * 3 + 1];
      var rz = rest[i * 3 + 2];
      var rlen = Math.hypot(rx, ry, rz) || 1;
      var nx = rx / rlen;
      var ny = ry / rlen;
      var nz = rz / rlen;
      var theta = Math.atan2(nz, nx);
      var d =
        Math.sin(theta * 2.0 + t * 0.48 + p0) * 0.62 +
        Math.sin(ny * 3.1 + t * 0.61 + p0 * 1.3) * 0.42 +
        Math.sin(nx * 2.6 + nz * 2.2 + t * 0.41) * 0.34 +
        Math.sin((nx + ny + nz) * 2.0 - t * 0.55 + p0) * 0.3;
      var squashX = 1 + 0.22 * Math.sin(t * 0.37 + p0);
      var squashY = 1 + 0.22 * Math.sin(t * 0.41 + p0 + 2.1);
      var squashZ = 1 + 0.22 * Math.sin(t * 0.33 + p0 + 4.2);
      var disp = rlen * (1 + amp * d);
      pos[i * 3] = nx * disp * squashX;
      pos[i * 3 + 1] = ny * disp * squashY;
      pos[i * 3 + 2] = nz * disp * squashZ;

      var plasma =
        Math.sin(nx * 4.8 + t * 0.9 + p0) +
        Math.sin(ny * 5.4 - t * 0.72) +
        Math.sin(nz * 4.1 + t * 0.58 + p0 * 0.7) +
        Math.sin((nx + ny) * 3.2 + t * 0.4);
      var h = hue + plasma * 0.045 + (inner ? 0.08 : 0);
      var val = inner
        ? 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(plasma + t * 1.4))
        : 0.38 + 0.55 * (0.5 + 0.5 * Math.sin(plasma));
      var rgb = hsv(h, wisp.sat, val);
      col[i * 3] = rgb[0];
      col[i * 3 + 1] = rgb[1];
      col[i * 3 + 2] = rgb[2];
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function updateWispCenters(t) {
    for (var i = 0; i < wisps.length; i++) {
      var w = wisps[i];
      w.cx =
        Math.sin(t * w.wx + w.phase) * w.ax +
        Math.sin(t * w.wx * 0.47 + w.phase * 1.7) * 0.55;
      w.cy =
        Math.sin(t * w.wy + w.phase * 1.3) * w.ay +
        Math.cos(t * w.wy * 0.61 + w.phase) * 0.4;
      w.cz =
        Math.cos(t * w.wz + w.phase * 0.8) * w.az +
        Math.sin(t * w.wz * 0.53 + w.phase * 2.1) * 0.5;
    }
  }

  // --- nested glow impostors (metaball merge) ---
  var corePos = new Float32Array(N_WISPS * 3);
  var coreCol = new Float32Array(N_WISPS * 3);
  var coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute("position", new THREE.BufferAttribute(corePos, 3));
  coreGeo.setAttribute("color", new THREE.BufferAttribute(coreCol, 3));
  scene.add(
    new THREE.Points(
      coreGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: 4.1,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var haloPos = new Float32Array(N_WISPS * 3);
  var haloCol = new Float32Array(N_WISPS * 3);
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  scene.add(
    new THREE.Points(
      haloGeo,
      new THREE.PointsMaterial({
        map: softTex,
        size: 8.6,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var midPos = new Float32Array(N_WISPS * 3);
  var midCol = new Float32Array(N_WISPS * 3);
  var midGeo = new THREE.BufferGeometry();
  midGeo.setAttribute("position", new THREE.BufferAttribute(midPos, 3));
  midGeo.setAttribute("color", new THREE.BufferAttribute(midCol, 3));
  scene.add(
    new THREE.Points(
      midGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: 6.0,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  // --- satellite motes around each blob ---
  var satCount = N_WISPS * SATS;
  var satPos = new Float32Array(satCount * 3);
  var satCol = new Float32Array(satCount * 3);
  var satellites = [];
  for (var si = 0; si < satCount; si++) {
    satellites.push({
      wisp: si % N_WISPS,
      a: Math.random() * Math.PI * 2,
      b: Math.random() * Math.PI * 2,
      ra: 1.1 + Math.random() * 1.9,
      rb: 0.7 + Math.random() * 1.4,
      wa: 0.25 + Math.random() * 0.7,
      wb: 0.2 + Math.random() * 0.55,
      hueJ: (Math.random() - 0.5) * 0.08,
    });
  }
  var satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute("position", new THREE.BufferAttribute(satPos, 3));
  satGeo.setAttribute("color", new THREE.BufferAttribute(satCol, 3));
  scene.add(
    new THREE.Points(
      satGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: 1.15,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  // --- stringy tendrils swirling in a cheap curl-ish field ---
  var tendrils = [];
  for (var ti = 0; ti < N_TENDRIL; ti++) {
    tendrils.push({
      x: (Math.random() - 0.5) * 6,
      y: (Math.random() - 0.5) * 4,
      z: (Math.random() - 0.5) * 6,
      hue: (ti / N_TENDRIL) * 0.9,
      phase: Math.random() * Math.PI * 2,
      trail: new Float32Array(TRAIL * 3),
      filled: 0,
      age: Math.random() * 10,
    });
  }

  var trailCount = N_TENDRIL * TRAIL;
  var trailPos = new Float32Array(trailCount * 3);
  var trailCol = new Float32Array(trailCount * 3);
  var trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  scene.add(
    new THREE.Points(
      trailGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: 1.25,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var spinePos = new Float32Array(trailCount * 3);
  var spineCol = new Float32Array(trailCount * 3);
  var spineIdx = [];
  for (var sp = 0; sp < N_TENDRIL; sp++) {
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

  function swirlAt(x, y, z, t) {
    var k = 0.52;
    var s = SPEED;
    return {
      x: s * (Math.sin(y * k + t * 0.41) + Math.cos(z * k * 0.9 - t * 0.27) + 0.15 * Math.sin(t * 0.19)),
      y: s * (Math.sin(z * k + t * 0.33) + Math.cos(x * k * 0.85 + t * 0.21) * 0.7),
      z: s * (Math.sin(x * k + t * 0.37) + Math.cos(y * k * 0.8 - t * 0.29)),
    };
  }

  function reseedTendril(p, t) {
    var w = wisps[(Math.random() * wisps.length) | 0];
    var a = Math.random() * Math.PI * 2;
    var r = 0.4 + Math.random() * 1.6;
    p.x = w.cx + Math.cos(a) * r;
    p.y = w.cy + (Math.random() - 0.5) * r;
    p.z = w.cz + Math.sin(a) * r;
    p.age = 0;
    p.filled = 0;
    p.hue = w.hue + (Math.random() - 0.5) * 0.1;
  }

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

  function stepTendril(p, dt, t) {
    var f = swirlAt(p.x, p.y, p.z, t);
    // mild attraction toward nearest blob so wisps feel connected
    var near = wisps[0];
    var best = 1e9;
    for (var i = 0; i < wisps.length; i++) {
      var dx = wisps[i].cx - p.x;
      var dy = wisps[i].cy - p.y;
      var dz = wisps[i].cz - p.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < best) {
        best = d2;
        near = wisps[i];
      }
    }
    var pull = 0.11;
    f.x += (near.cx - p.x) * pull * dt;
    f.y += (near.cy - p.y) * pull * dt;
    f.z += (near.cz - p.z) * pull * dt;
    p.x += f.x * dt * 2.4;
    p.y += f.y * dt * 2.4;
    p.z += f.z * dt * 2.4;
    p.age += dt;
    if (p.age > 14 || Math.hypot(p.x, p.y, p.z) > 11) {
      reseedTendril(p, t);
    }
  }

  // --- huge dim background wisps ---
  var bgSprites = [];
  for (var bi = 0; bi < N_BG; bi++) {
    var bgMat = new THREE.SpriteMaterial({
      map: softTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      color: 0xffffff,
    });
    var spr = new THREE.Sprite(bgMat);
    var sc = 9 + bi * 2.4;
    spr.scale.set(sc, sc, 1);
    scene.add(spr);
    bgSprites.push({
      sprite: spr,
      hue: 0.12 + bi * 0.28,
      phase: bi * 2.1,
      ax: 2.2 + bi * 0.45,
      ay: 1.4,
      az: 3.0 + bi * 0.4,
      wx: 0.05 + bi * 0.012,
    });
  }

  function warmStart() {
    updateWispCenters(0);
    for (var i = 0; i < tendrils.length; i++) {
      reseedTendril(tendrils[i], 0);
      for (var s = 0; s < TRAIL; s++) {
        stepTendril(tendrils[i], 0.03, s * 0.03);
        pushTrail(tendrils[i]);
      }
    }
  }
  warmStart();

  var hueShift = 0;
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;

  function writeSprites(t) {
    for (var i = 0; i < N_WISPS; i++) {
      var w = wisps[i];
      var h = w.hue + hueShift;
      var pulse = 0.55 + 0.45 * Math.sin(t * w.pulse + w.phase);
      var rgb = hsv(h, w.sat, 1);
      corePos[i * 3] = w.cx;
      corePos[i * 3 + 1] = w.cy;
      corePos[i * 3 + 2] = w.cz;
      coreCol[i * 3] = rgb[0];
      coreCol[i * 3 + 1] = rgb[1];
      coreCol[i * 3 + 2] = rgb[2];
      midPos[i * 3] = w.cx;
      midPos[i * 3 + 1] = w.cy;
      midPos[i * 3 + 2] = w.cz;
      var rgbMid = hsv(h + 0.04, w.sat * 0.9, 0.55 * pulse);
      midCol[i * 3] = rgbMid[0];
      midCol[i * 3 + 1] = rgbMid[1];
      midCol[i * 3 + 2] = rgbMid[2];
      haloPos[i * 3] = w.cx;
      haloPos[i * 3 + 1] = w.cy;
      haloPos[i * 3 + 2] = w.cz;
      var rgbH = hsv(h - 0.06, 0.55, 0.22 * pulse);
      haloCol[i * 3] = rgbH[0];
      haloCol[i * 3 + 1] = rgbH[1];
      haloCol[i * 3 + 2] = rgbH[2];
    }
    coreGeo.attributes.position.needsUpdate = true;
    coreGeo.attributes.color.needsUpdate = true;
    midGeo.attributes.position.needsUpdate = true;
    midGeo.attributes.color.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
    haloGeo.attributes.color.needsUpdate = true;

    for (var s = 0; s < satellites.length; s++) {
      var sat = satellites[s];
      var ww = wisps[sat.wisp];
      var a = t * sat.wa + sat.a;
      var b = t * sat.wb + sat.b;
      satPos[s * 3] = ww.cx + Math.cos(a) * sat.ra * Math.cos(b);
      satPos[s * 3 + 1] = ww.cy + Math.sin(b) * sat.rb;
      satPos[s * 3 + 2] = ww.cz + Math.sin(a) * sat.ra * Math.cos(b);
      var sr = hsv(ww.hue + hueShift + sat.hueJ, 0.7, 0.75 + 0.25 * Math.sin(a * 2));
      satCol[s * 3] = sr[0];
      satCol[s * 3 + 1] = sr[1];
      satCol[s * 3 + 2] = sr[2];
    }
    satGeo.attributes.position.needsUpdate = true;
    satGeo.attributes.color.needsUpdate = true;

    for (var k = 0; k < tendrils.length; k++) {
      var p = tendrils[k];
      var n = p.filled;
      var hh = p.hue + hueShift;
      for (var m = 0; m < TRAIL; m++) {
        var live = m < n;
        var src = live ? m : Math.max(0, n - 1);
        var tx = live ? p.trail[src * 3] : p.x;
        var ty = live ? p.trail[src * 3 + 1] : p.y;
        var tz = live ? p.trail[src * 3 + 2] : p.z;
        var fade = !live || n < 2 ? 0 : m / (n - 1);
        fade = fade * fade;
        var wave = 0.5 + 0.5 * Math.sin(t * 1.8 - m * 0.2 + p.phase);
        var rgbT = hsv(hh + m * 0.002, 0.8, fade * wave * 0.95);
        var gi = (k * TRAIL + m) * 3;
        trailPos[gi] = tx;
        trailPos[gi + 1] = ty;
        trailPos[gi + 2] = tz;
        trailCol[gi] = rgbT[0];
        trailCol[gi + 1] = rgbT[1];
        trailCol[gi + 2] = rgbT[2];
        spinePos[gi] = tx;
        spinePos[gi + 1] = ty;
        spinePos[gi + 2] = tz;
        spineCol[gi] = rgbT[0] * 1.1;
        spineCol[gi + 1] = rgbT[1] * 1.1;
        spineCol[gi + 2] = rgbT[2] * 1.1;
      }
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
    spineGeo.attributes.position.needsUpdate = true;
    spineGeo.attributes.color.needsUpdate = true;

    for (var b = 0; b < bgSprites.length; b++) {
      var bg = bgSprites[b];
      var bx =
        Math.sin(t * bg.wx + bg.phase) * bg.ax;
      var by = Math.cos(t * bg.wx * 0.7 + bg.phase) * bg.ay;
      var bz = Math.cos(t * bg.wx * 0.85 + bg.phase * 1.2) * bg.az;
      bg.sprite.position.set(bx, by, bz);
      var br = hsv(bg.hue + hueShift * 0.6, 0.65, 0.35 + 0.15 * Math.sin(t * 0.4 + bg.phase));
      bg.sprite.material.color.setRGB(br[0], br[1], br[2]);
      var pulseS = 1 + 0.12 * Math.sin(t * 0.25 + bg.phase);
      var baseS = 9 + b * 2.4;
      bg.sprite.scale.set(baseS * pulseS, baseS * pulseS, 1);
    }
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

    updateWispCenters(elapsed);

    for (var i = 0; i < wisps.length; i++) {
      var w = wisps[i];
      w.mesh.position.set(w.cx, w.cy, w.cz);
      w.inner.position.set(w.cx, w.cy, w.cz);
      w.mesh.rotation.y = elapsed * w.spin + w.phase;
      w.mesh.rotation.x = Math.sin(elapsed * 0.17 + w.phase) * w.tilt * 0.35;
      w.inner.rotation.y = -elapsed * w.spin * 0.7;
      w.inner.rotation.z = elapsed * 0.11 + w.phase;
      var h = w.hue + hueShift;
      deformBlob(w.mesh.geometry, elapsed, w, 1, h, false);
      deformBlob(w.inner.geometry, elapsed * 1.15, w, 0.7, h + 0.06, true);
      var uvOff = elapsed * 0.035 + w.phase * 0.1;
      w.mesh.material.map.offset.set(uvOff, elapsed * 0.022);
      w.inner.material.map.offset.set(-uvOff * 0.6, elapsed * 0.03);
    }

    for (var n = 0; n < tendrils.length; n++) {
      stepTendril(tendrils[n], dt, elapsed);
      pushTrail(tendrils[n]);
    }

    camAngle += CAM_SPEED * dt;
    var elev = 0.16 * Math.sin(elapsed * 0.09) + 0.1;
    var cr = camRadius + 0.7 * Math.sin(elapsed * 0.06);
    var roll = 0.08 * Math.sin(elapsed * 0.05);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.35,
      Math.sin(camAngle) * Math.cos(elev) * cr
    );
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(0, 0, 0);

    writeSprites(elapsed);
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

  writeSprites(0);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
