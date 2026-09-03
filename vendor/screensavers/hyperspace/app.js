/* Original remake of the classic 2000s "hyperspace" GL eye candy.
   Star tunnel, warp streaks, and neon rings rushing past the camera.
   Not derived from rss-glx / GPL sources. */
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

  var Z_FAR = -260;
  var Z_NEAR = -0.85;
  var SPEED = reduced ? 14 : 52;
  var N_STAR = reduced ? 220 : 780;
  var N_SPARK = reduced ? 40 : 130;
  var N_PART = N_STAR + N_SPARK;
  var N_RING = reduced ? 8 : 18;
  var N_STREAM = reduced ? 7 : 14;
  var STREAM_SEGS = reduced ? 22 : 40;
  var STREAK = reduced ? 2.4 : 9.5;
  var CURVE = reduced ? 0.32 : 1;
  var HUE_SPEED = reduced ? 0.018 : 0.042;
  var FOV = 36;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000008, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    FOV,
    window.innerWidth / window.innerHeight,
    0.12,
    420
  );
  camera.position.set(0, 0, 0);

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,255,0.9)");
    grd.addColorStop(mid, "rgba(180,220,255,0.32)");
    grd.addColorStop(0.7, "rgba(80,140,255,0.06)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128, 0.1, 0.36);
  var softTex = makeGlowTexture(64, 0.18, 0.48);

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

  var _path = { x: 0, y: 0 };
  var _pathB = { x: 0, y: 0 };

  function pathAt(z, t, out) {
    out = out || _path;
    var u = -z * 0.015 + t * 0.28;
    out.x = (Math.sin(u) * 3.7 + Math.sin(u * 0.41 + 1.3) * 1.7) * CURVE;
    out.y = (Math.cos(u * 0.79) * 2.5 + Math.sin(u * 0.22) * 1.15) * CURVE;
    return out;
  }

  function depthFade(z) {
    var d = -z;
    if (d < 0.7) return 0;
    var f = d / -Z_FAR;
    if (f > 1) f = 1;
    var a = 0.14 + 0.86 * Math.pow(1 - f, 0.5);
    if (d < 3.2) a *= d / 3.2;
    return a;
  }

  // --- particles (stars + colored sparks) in cylindrical tunnel coords ---
  var parts = [];
  function spawnPart(isSpark, z) {
    var r;
    if (isSpark) {
      r = 2.2 + Math.random() * 9.5;
    } else {
      r = Math.pow(Math.random(), 0.55) * 13.5 + 0.25;
    }
    return {
      r: r,
      a: Math.random() * Math.PI * 2,
      z: z == null ? Z_FAR + Math.random() * (Z_NEAR - Z_FAR) : z,
      spin: isSpark ? (Math.random() - 0.5) * 0.7 : (Math.random() - 0.5) * 0.04,
      hue: isSpark ? Math.random() : 0.52 + Math.random() * 0.12,
      sat: isSpark ? 0.72 + Math.random() * 0.28 : 0.08 + Math.random() * 0.18,
      val: isSpark ? 0.85 + Math.random() * 0.15 : 0.55 + Math.random() * 0.45,
      fresh: 1,
    };
  }

  var pi;
  for (pi = 0; pi < N_STAR; pi++) parts.push(spawnPart(false));
  for (pi = 0; pi < N_SPARK; pi++) parts.push(spawnPart(true));

  var starPos = new Float32Array(N_PART * 3);
  var starCol = new Float32Array(N_PART * 3);
  var starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  var starPts = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: reduced ? 0.7 : 1.15,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  starPts.frustumCulled = false;
  scene.add(starPts);

  var sparkPos = new Float32Array(N_SPARK * 3);
  var sparkCol = new Float32Array(N_SPARK * 3);
  var sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  var sparkPts = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: reduced ? 1.6 : 2.6,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);

  var streakPos = new Float32Array(N_PART * 6);
  var streakCol = new Float32Array(N_PART * 6);
  var streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
  streakGeo.setAttribute("color", new THREE.BufferAttribute(streakCol, 3));
  var streaks = new THREE.LineSegments(
    streakGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  streaks.frustumCulled = false;
  scene.add(streaks);

  // --- neon rings (torus + membrane + optional ticks / inner hoop) ---
  var torusCore = new THREE.TorusGeometry(1, 0.016, 6, 72);
  var torusGlow = new THREE.TorusGeometry(1, 0.055, 6, 56);
  var membraneGeo = new THREE.RingGeometry(0.9, 1.1, 48);
  var tickPos = new Float32Array(12 * 6);
  for (var ti = 0; ti < 12; ti++) {
    var ta = (ti / 12) * Math.PI * 2;
    var tc = Math.cos(ta);
    var ts = Math.sin(ta);
    tickPos[ti * 6] = tc * 0.84;
    tickPos[ti * 6 + 1] = ts * 0.84;
    tickPos[ti * 6 + 2] = 0;
    tickPos[ti * 6 + 3] = tc * 1.18;
    tickPos[ti * 6 + 4] = ts * 1.18;
    tickPos[ti * 6 + 5] = 0;
  }
  var tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute("position", new THREE.BufferAttribute(tickPos, 3));

  function additiveMat(opacity) {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  function seedRing(r, i, n) {
    var style = i % 4;
    r.userData.radius = 5.4 + (i % 5) * 0.85 + Math.random() * 1.6;
    r.userData.hue = (i / n) * 0.85 + Math.random() * 0.08;
    r.userData.spin = (Math.random() - 0.5) * 0.9;
    r.userData.ox = (style === 3 ? (Math.random() - 0.5) * 6.5 : (Math.random() - 0.5) * 0.35);
    r.userData.oy = (style === 3 ? (Math.random() - 0.5) * 5.2 : (Math.random() - 0.5) * 0.35);
    r.userData.z = Z_FAR + ((i + Math.random() * 0.4) / n) * (Z_NEAR - Z_FAR);
    r.userData.phase = Math.random() * Math.PI * 2;
    r.userData.style = style;
    r.children[2].visible = style === 1 || style === 2;
    r.children[3].visible = style === 2 || style === 0;
  }

  var rings = [];
  for (var ri = 0; ri < N_RING; ri++) {
    var grp = new THREE.Group();
    var core = new THREE.Mesh(torusCore, additiveMat(0.95));
    var glow = new THREE.Mesh(torusGlow, additiveMat(0.22));
    var ticks = new THREE.LineSegments(
      tickGeo,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    var inner = new THREE.Mesh(torusCore, additiveMat(0.75));
    inner.scale.setScalar(0.72);
    var membrane = new THREE.Mesh(membraneGeo, additiveMat(0.1));
    core.frustumCulled = false;
    glow.frustumCulled = false;
    ticks.frustumCulled = false;
    inner.frustumCulled = false;
    membrane.frustumCulled = false;
    grp.add(core);
    grp.add(glow);
    grp.add(ticks);
    grp.add(inner);
    grp.add(membrane);
    grp.frustumCulled = false;
    seedRing(grp, ri, N_RING);
    scene.add(grp);
    rings.push(grp);
  }

  // --- helical tunnel streamers ---
  var streamers = [];
  for (var si = 0; si < N_STREAM; si++) {
    streamers.push({
      angle: (si / N_STREAM) * Math.PI * 2,
      radius: 6.6 + (si % 3) * 0.55 + Math.random() * 0.4,
      twist: (si % 2 === 0 ? 1 : -1) * (0.008 + (si % 4) * 0.002),
      spin: 0.05 + (si % 5) * 0.012,
      freq: 0.11 + (si % 3) * 0.03,
      wobble: 0.7 + (si % 4) * 0.25,
      amp: 0.22 + (si % 3) * 0.12,
      hue: si / N_STREAM,
    });
  }
  var nStreamVerts = N_STREAM * (STREAM_SEGS - 1) * 2;
  var streamPos = new Float32Array(nStreamVerts * 3);
  var streamCol = new Float32Array(nStreamVerts * 3);
  var streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
  streamGeo.setAttribute("color", new THREE.BufferAttribute(streamCol, 3));
  var streamLines = new THREE.LineSegments(
    streamGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  streamLines.frustumCulled = false;
  scene.add(streamLines);

  // --- distant warp glow ---
  function makeSprite(map, scale, opacity) {
    var spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: map,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: opacity,
      })
    );
    spr.scale.set(scale, scale, 1);
    spr.frustumCulled = false;
    scene.add(spr);
    return spr;
  }
  var glowFar = makeSprite(softTex, 78, 0.55);
  var glowMid = makeSprite(glowTex, 26, 0.7);
  var glowHot = makeSprite(glowTex, 7.5, 0.95);

  var hueShift = 0.58;
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;
  var _wx = { x: 0, y: 0, z: 0 };
  var _wz = { x: 0, y: 0, z: 0 };

  function worldOf(p, t, out) {
    pathAt(p.z, t, _path);
    out.x = _path.x + Math.cos(p.a) * p.r;
    out.y = _path.y + Math.sin(p.a) * p.r;
    out.z = p.z;
    return out;
  }

  function tintMat(mat, h, s, v, op) {
    var rgb = hsv(h, s, v);
    mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
    if (op != null) mat.opacity = op;
  }

  function writeParticles(t, dt) {
    var sparkI = 0;
    for (var i = 0; i < N_PART; i++) {
      var p = parts[i];
      p.z += SPEED * dt;
      p.a += p.spin * dt;
      if (p.z > Z_NEAR) {
        var isSpark = i >= N_STAR;
        var np = spawnPart(isSpark, Z_FAR - Math.random() * 12);
        parts[i] = np;
        p = np;
      }
      worldOf(p, t, _wx);
      var fade = depthFade(p.z);
      var h = p.hue + hueShift * 0.35;
      var rgb = hsv(h, p.sat, p.val * fade);

      starPos[i * 3] = _wx.x;
      starPos[i * 3 + 1] = _wx.y;
      starPos[i * 3 + 2] = _wx.z;
      starCol[i * 3] = rgb[0];
      starCol[i * 3 + 1] = rgb[1];
      starCol[i * 3 + 2] = rgb[2];

      if (i >= N_STAR) {
        sparkPos[sparkI * 3] = _wx.x;
        sparkPos[sparkI * 3 + 1] = _wx.y;
        sparkPos[sparkI * 3 + 2] = _wx.z;
        var sg = hsv(p.hue + hueShift, p.sat, fade);
        sparkCol[sparkI * 3] = sg[0];
        sparkCol[sparkI * 3 + 1] = sg[1];
        sparkCol[sparkI * 3 + 2] = sg[2];
        sparkI++;
      }

      var sl = p.fresh ? 0.05 : STREAK * (0.35 + 0.65 * fade);
      p.fresh = 0;
      var zBack = p.z - sl;
      pathAt(zBack, t, _pathB);
      _wz.x = _pathB.x + Math.cos(p.a) * p.r;
      _wz.y = _pathB.y + Math.sin(p.a) * p.r;
      _wz.z = zBack;

      var si2 = i * 6;
      streakPos[si2] = _wx.x;
      streakPos[si2 + 1] = _wx.y;
      streakPos[si2 + 2] = _wx.z;
      streakPos[si2 + 3] = _wz.x;
      streakPos[si2 + 4] = _wz.y;
      streakPos[si2 + 5] = _wz.z;
      streakCol[si2] = rgb[0];
      streakCol[si2 + 1] = rgb[1];
      streakCol[si2 + 2] = rgb[2];
      streakCol[si2 + 3] = rgb[0] * 0.05;
      streakCol[si2 + 4] = rgb[1] * 0.05;
      streakCol[si2 + 5] = rgb[2] * 0.05;
    }
    starGeo.attributes.position.needsUpdate = true;
    starGeo.attributes.color.needsUpdate = true;
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    streakGeo.attributes.position.needsUpdate = true;
    streakGeo.attributes.color.needsUpdate = true;
  }

  function writeRings(t, dt) {
    for (var i = 0; i < N_RING; i++) {
      var r = rings[i];
      var u = r.userData;
      u.z += SPEED * dt;
      if (u.z > Z_NEAR) {
        seedRing(r, i, N_RING);
        u.z = Z_FAR - Math.random() * 8;
      }
      var fade = depthFade(u.z);
      var pulse = 0.78 + 0.22 * Math.sin(t * 1.9 + u.phase);
      var h = u.hue + hueShift;
      var rad = u.radius * (1 + 0.04 * Math.sin(t * 0.8 + u.phase));
      pathAt(u.z, t, _path);
      r.position.set(_path.x + u.ox, _path.y + u.oy, u.z);
      pathAt(u.z - 5, t, _pathB);
      r.up.set(0, 1, 0);
      r.lookAt(_pathB.x + u.ox, _pathB.y + u.oy, u.z - 5);
      r.rotateZ(u.spin * t);
      r.scale.set(rad, rad, rad);

      tintMat(r.children[0].material, h, 0.55, pulse, 0.55 + 0.4 * fade);
      tintMat(r.children[1].material, h, 0.85, pulse * fade, 0.12 + 0.16 * fade);
      r.children[2].material.color.setRGB(
        hsv(h, 0.4, fade)[0],
        hsv(h, 0.4, fade)[1],
        hsv(h, 0.4, fade)[2]
      );
      r.children[2].material.opacity = 0.35 + 0.55 * fade;
      tintMat(r.children[3].material, h + 0.08, 0.7, pulse, 0.4 + 0.4 * fade);
      tintMat(r.children[4].material, h, 0.9, fade * pulse, 0.05 + 0.08 * fade);
    }
  }

  function writeStreamers(t) {
    var vi = 0;
    for (var s = 0; s < N_STREAM; s++) {
      var st = streamers[s];
      for (var k = 0; k < STREAM_SEGS - 1; k++) {
        var z0 = Z_FAR + (k / (STREAM_SEGS - 1)) * (Z_NEAR - Z_FAR);
        var z1 = Z_FAR + ((k + 1) / (STREAM_SEGS - 1)) * (Z_NEAR - Z_FAR);
        var a0 = st.angle + z0 * st.twist + t * st.spin;
        var a1 = st.angle + z1 * st.twist + t * st.spin;
        var rad0 = st.radius + Math.sin(z0 * st.freq + t * st.wobble) * st.amp;
        var rad1 = st.radius + Math.sin(z1 * st.freq + t * st.wobble) * st.amp;
        pathAt(z0, t, _path);
        pathAt(z1, t, _pathB);
        var x0 = _path.x + Math.cos(a0) * rad0;
        var y0 = _path.y + Math.sin(a0) * rad0;
        var x1 = _pathB.x + Math.cos(a1) * rad1;
        var y1 = _pathB.y + Math.sin(a1) * rad1;
        var b = vi * 3;
        streamPos[b] = x0;
        streamPos[b + 1] = y0;
        streamPos[b + 2] = z0;
        streamPos[b + 3] = x1;
        streamPos[b + 4] = y1;
        streamPos[b + 5] = z1;
        var f0 = depthFade(z0);
        var f1 = depthFade(z1);
        var rgb0 = hsv(st.hue + hueShift, 0.8, 0.55 * f0);
        var rgb1 = hsv(st.hue + hueShift, 0.8, 0.55 * f1);
        streamCol[b] = rgb0[0];
        streamCol[b + 1] = rgb0[1];
        streamCol[b + 2] = rgb0[2];
        streamCol[b + 3] = rgb1[0];
        streamCol[b + 4] = rgb1[1];
        streamCol[b + 5] = rgb1[2];
        vi += 2;
      }
    }
    streamGeo.attributes.position.needsUpdate = true;
    streamGeo.attributes.color.needsUpdate = true;
  }

  function writeGlow(t) {
    var z = Z_FAR * 0.92;
    pathAt(z, t, _path);
    glowFar.position.set(_path.x, _path.y, z);
    glowMid.position.set(_path.x, _path.y, z + 4);
    glowHot.position.set(_path.x, _path.y, z + 8);
    var pulse = 0.75 + 0.25 * Math.sin(t * 1.4);
    var rgb = hsv(hueShift, 0.55, pulse);
    glowFar.material.color.setRGB(rgb[0] * 0.45, rgb[1] * 0.45, rgb[2] * 0.55);
    glowMid.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    glowHot.material.color.setRGB(1, 0.95, 1);
    var look = pathAt(-40, t, _pathB);
    var dx = look.x - camera.position.x;
    var dy = look.y - camera.position.y;
    var dist = Math.hypot(dx, dy) + 40;
    var sc = dist * 0.08;
    glowFar.scale.set(70 + sc * 2, 70 + sc * 2, 1);
    glowMid.scale.set(22 + sc, 22 + sc, 1);
    glowHot.scale.set(6 + sc * 0.25, 6 + sc * 0.25, 1);
  }

  function aimCamera(t) {
    pathAt(0.2, t, _path);
    pathAt(-38, t, _pathB);
    var roll = Math.sin(t * 0.16) * (reduced ? 0.035 : 0.11);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.position.set(_path.x * 0.15, _path.y * 0.15, 0);
    camera.lookAt(_pathB.x, _pathB.y, -38);
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

    aimCamera(elapsed);
    writeParticles(elapsed, dt);
    writeRings(elapsed, dt);
    writeStreamers(elapsed);
    writeGlow(elapsed);
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

  aimCamera(0);
  writeParticles(0, 0);
  writeRings(0, 0);
  writeStreamers(0);
  writeGlow(0);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
