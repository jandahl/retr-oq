/* Original remake of the classic 2000s Helios GL eye candy.
   Solar-flare / sun-particle fountain with a bright core and arcing
   sparks. Attraction/repulsion ions, not derived from rss-glx / GPL. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduced = false;
  }

  var SUN_R = 2.15;
  var N_EMIT = reduced ? 2 : 3;
  var N_ATTR = reduced ? 2 : 3;
  var N_IONS = reduced ? 420 : 1250;
  var N_SPARKS = reduced ? 22 : 72;
  var ION_TRAIL = reduced ? 4 : 7;
  var SPARK_TRAIL = reduced ? 18 : 36;
  var N_PROM = reduced ? 3 : 7;
  var PROM_SEGS = reduced ? 22 : 40;
  var STAR_COUNT = reduced ? 70 : 200;
  var SPEED = reduced ? 0.42 : 1.0;
  var CAM_SPEED = reduced ? 0.035 : 0.078;
  var HUE_SPEED = reduced ? 0.01 : 0.024;
  var GRAV = reduced ? 1.6 : 2.35;
  var ATTR_STR = reduced ? 7.5 : 12.5;
  var EMIT_PUSH = reduced ? 5.5 : 9.2;
  var MAG = reduced ? 0.55 : 1.15;
  var RIBBON_W = reduced ? 0.09 : 0.16;

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
  camera.position.set(0, 2.6, camRadius);

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,240,0.95)");
    grd.addColorStop(mid, "rgba(255,190,80,0.38)");
    grd.addColorStop(0.7, "rgba(255,70,20,0.08)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function makeSoftTexture(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,0.85)");
    grd.addColorStop(0.28, "rgba(255,210,140,0.4)");
    grd.addColorStop(0.62, "rgba(255,90,40,0.1)");
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
  var softTex = makeSoftTexture(64);

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

  // Keep the palette in the solar band (magenta-red-orange-gold).
  function solarHue(h) {
    var u = ((h % 1) + 1) % 1;
    return 0.955 + u * 0.155;
  }

  function sph(radius, u, v) {
    var th = u * Math.PI * 2;
    var ph = Math.acos(2 * v - 1);
    return {
      x: radius * Math.sin(ph) * Math.cos(th),
      y: radius * Math.cos(ph),
      z: radius * Math.sin(ph) * Math.sin(th),
    };
  }

  (function addStars() {
    var pos = new Float32Array(STAR_COUNT * 3);
    var col = new Float32Array(STAR_COUNT * 3);
    for (var i = 0; i < STAR_COUNT; i++) {
      var p = sph(52 + Math.random() * 40, Math.random(), Math.random());
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      var b = 0.16 + Math.random() * 0.32;
      col[i * 3] = b;
      col[i * 3 + 1] = b * (0.88 + Math.random() * 0.12);
      col[i * 3 + 2] = b * (0.92 + Math.random() * 0.18);
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

  function addSprite(tex, scale, color) {
    var mat = new THREE.SpriteMaterial({
      map: tex,
      color: color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    var spr = new THREE.Sprite(mat);
    spr.scale.set(scale, scale, 1);
    scene.add(spr);
    return spr;
  }

  var coreHot = addSprite(glowTex, 3.8, 0xfff6d8);
  var coreMid = addSprite(glowTex, 7.2, 0xffb24a);
  var coreHalo = addSprite(softTex, 13.8, 0xff5a18);
  var coreBloom = addSprite(softTex, 22.0, 0xff2a08);
  coreBloom.material.opacity = 0.55;

  var emitters = [];
  var emitSprites = [];
  for (var ei = 0; ei < N_EMIT; ei++) {
    emitters.push({
      phase: (ei / N_EMIT) * Math.PI * 2 + Math.random() * 0.5,
      spin: 0.11 + ei * 0.037,
      wobble: 0.19 + ei * 0.05,
      tilt: 0.45 + (ei / Math.max(1, N_EMIT - 1)) * (Math.PI - 0.9),
      x: 0,
      y: SUN_R,
      z: 0,
    });
    emitSprites.push(addSprite(glowTex, 2.1, 0xffe08a));
  }

  var attracters = [];
  var attrSprites = [];
  for (var ai = 0; ai < N_ATTR; ai++) {
    attracters.push({
      phase: (ai / N_ATTR) * Math.PI * 2 + 0.7,
      ox: 0.13 + ai * 0.021,
      oy: 0.09 + ai * 0.017,
      oz: 0.11 + ai * 0.019,
      rad: 5.4 + ai * 0.85,
      x: 0,
      y: 0,
      z: 0,
    });
    var as = addSprite(softTex, 3.8, 0xff8844);
    as.material.opacity = 0.55;
    attrSprites.push(as);
  }

  function updateBodies(t) {
    var i;
    for (i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      var th = t * e.spin + e.phase;
      var ph = e.tilt + Math.sin(t * e.wobble + e.phase * 1.4) * 0.55;
      e.x = Math.cos(th) * Math.sin(ph) * SUN_R;
      e.y = Math.cos(ph) * SUN_R;
      e.z = Math.sin(th) * Math.sin(ph) * SUN_R;
      emitSprites[i].position.set(e.x, e.y, e.z);
    }
    for (i = 0; i < attracters.length; i++) {
      var a = attracters[i];
      a.x = Math.cos(t * a.ox + a.phase) * a.rad;
      a.y = Math.sin(t * a.oy + a.phase * 1.31) * a.rad * 0.48;
      a.z = Math.sin(t * a.oz + a.phase * 0.77) * a.rad;
      attrSprites[i].position.set(a.x, a.y, a.z);
    }
  }

  var dipole = { x: 0, y: 1, z: 0 };

  function updateDipole(t) {
    var p = t * 0.17;
    dipole.x = Math.sin(p) * 0.55;
    dipole.y = Math.cos(p * 0.61);
    dipole.z = Math.sin(p * 0.83) * 0.48;
  }

  function fieldAt(px, py, pz) {
    var rx = px;
    var ry = py;
    var rz = pz;
    var r2 = rx * rx + ry * ry + rz * rz + 0.65;
    var inv = 1 / (r2 * r2 * Math.sqrt(r2));
    var md = dipole.x * rx + dipole.y * ry + dipole.z * rz;
    return {
      x: (3 * md * rx - dipole.x * r2) * inv,
      y: (3 * md * ry - dipole.y * r2) * inv,
      z: (3 * md * rz - dipole.z * r2) * inv,
    };
  }

  function forces(p, out) {
    var ax = 0;
    var ay = 0;
    var az = 0;
    var r = Math.hypot(p.x, p.y, p.z);
    var invr = 1 / (r + 0.12);
    ax -= p.x * GRAV * invr;
    ay -= p.y * GRAV * invr;
    az -= p.z * GRAV * invr;
    if (r < SUN_R * 1.28) {
      var bump = (SUN_R * 1.28 - r) * 18;
      ax += p.x * invr * bump;
      ay += p.y * invr * bump;
      az += p.z * invr * bump;
    }
    var i;
    for (i = 0; i < attracters.length; i++) {
      var a = attracters[i];
      var dx = a.x - p.x;
      var dy = a.y - p.y;
      var dz = a.z - p.z;
      var d2 = dx * dx + dy * dy + dz * dz + 0.4;
      var s = ATTR_STR / (d2 * Math.sqrt(d2));
      ax += dx * s;
      ay += dy * s;
      az += dz * s;
    }
    for (i = 0; i < emitters.length; i++) {
      var e = emitters[i];
      dx = p.x - e.x;
      dy = p.y - e.y;
      dz = p.z - e.z;
      d2 = dx * dx + dy * dy + dz * dz + 0.22;
      s = EMIT_PUSH / (d2 * Math.sqrt(d2));
      ax += dx * s;
      ay += dy * s;
      az += dz * s;
    }
    if (p.kind === 1) {
      var B = fieldAt(p.x, p.y, p.z);
      ax += (p.vy * B.z - p.vz * B.y) * MAG;
      ay += (p.vz * B.x - p.vx * B.z) * MAG;
      az += (p.vx * B.y - p.vy * B.x) * MAG;
    }
    out.x = ax;
    out.y = ay;
    out.z = az;
  }

  var _F = { x: 0, y: 0, z: 0 };

  function spawnAtEmitter(p) {
    var n = sph(1, Math.random(), Math.random());
    var ox, oy, oz;
    if (Math.random() < 0.32) {
      ox = n.x * SUN_R;
      oy = n.y * SUN_R;
      oz = n.z * SUN_R;
    } else {
      var e = emitters[(Math.random() * emitters.length) | 0];
      ox = e.x;
      oy = e.y;
      oz = e.z;
    }
    var jitter = 0.16 + Math.random() * 0.24;
    p.x = ox + n.x * jitter;
    p.y = oy + n.y * jitter;
    p.z = oz + n.z * jitter;
    var er = Math.hypot(ox, oy, oz) || 1;
    var kick = (p.kind === 1 ? 4.1 : 2.5) + Math.random() * 2.8;
    var swirl = (Math.random() - 0.5) * 1.7;
    p.vx = (ox / er) * kick + n.x * swirl;
    p.vy = (oy / er) * kick + n.y * swirl;
    p.vz = (oz / er) * kick + n.z * swirl;
    p.age = 0;
    p.life = (p.kind === 1 ? 4.8 : 2.9) + Math.random() * (p.kind === 1 ? 5.8 : 3.5);
    p.filled = 0;
  }

  function pushTrail(p, arr, max) {
    if (p.filled < max) {
      var i = p.filled * 3;
      arr[i] = p.x;
      arr[i + 1] = p.y;
      arr[i + 2] = p.z;
      p.filled++;
      return;
    }
    arr.copyWithin(0, 3);
    var t = (max - 1) * 3;
    arr[t] = p.x;
    arr[t + 1] = p.y;
    arr[t + 2] = p.z;
  }

  function stepParticle(p, trail, trailLen, dt) {
    forces(p, _F);
    p.vx += _F.x * dt;
    p.vy += _F.y * dt;
    p.vz += _F.z * dt;
    var damp = p.kind === 1 ? 0.992 : 0.984;
    p.vx *= damp;
    p.vy *= damp;
    p.vz *= damp;
    p.x += p.vx * dt * SPEED;
    p.y += p.vy * dt * SPEED;
    p.z += p.vz * dt * SPEED;
    p.age += dt;
    var dist = Math.hypot(p.x, p.y, p.z);
    if (p.age > p.life || dist > 17.5 || dist < SUN_R * 0.42) {
      spawnAtEmitter(p);
      return;
    }
    pushTrail(p, trail, trailLen);
  }

  var ions = [];
  for (var ii = 0; ii < N_IONS; ii++) {
    ions.push({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 3,
      kind: 0,
      filled: 0,
      hue: Math.random(),
      sat: 0.62 + Math.random() * 0.28,
      trail: new Float32Array(ION_TRAIL * 3),
    });
  }

  var sparks = [];
  for (var si = 0; si < N_SPARKS; si++) {
    sparks.push({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 6,
      kind: 1,
      filled: 0,
      hue: (si / N_SPARKS),
      sat: 0.55 + (si % 3) * 0.12,
      trail: new Float32Array(SPARK_TRAIL * 3),
    });
  }

  var ionCount = N_IONS * ION_TRAIL;
  var ionPos = new Float32Array(ionCount * 3);
  var ionCol = new Float32Array(ionCount * 3);
  var ionGeo = new THREE.BufferGeometry();
  ionGeo.setAttribute("position", new THREE.BufferAttribute(ionPos, 3));
  ionGeo.setAttribute("color", new THREE.BufferAttribute(ionCol, 3));
  scene.add(
    new THREE.Points(
      ionGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: reduced ? 0.72 : 0.95,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var sparkHeadPos = new Float32Array(N_SPARKS * 3);
  var sparkHeadCol = new Float32Array(N_SPARKS * 3);
  var sparkHeadGeo = new THREE.BufferGeometry();
  sparkHeadGeo.setAttribute("position", new THREE.BufferAttribute(sparkHeadPos, 3));
  sparkHeadGeo.setAttribute("color", new THREE.BufferAttribute(sparkHeadCol, 3));
  scene.add(
    new THREE.Points(
      sparkHeadGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        size: reduced ? 1.7 : 2.45,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    )
  );

  var sparkTrailCount = N_SPARKS * SPARK_TRAIL;
  var sparkPos = new Float32Array(sparkTrailCount * 3);
  var sparkCol = new Float32Array(sparkTrailCount * 3);
  var sparkIdx = [];
  for (var spk = 0; spk < N_SPARKS; spk++) {
    var sb = spk * SPARK_TRAIL;
    for (var st = 0; st < SPARK_TRAIL - 1; st++) {
      sparkIdx.push(sb + st, sb + st + 1);
    }
  }
  var sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  sparkGeo.setIndex(sparkIdx);
  scene.add(
    new THREE.LineSegments(
      sparkGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  function randFoot() {
    return sph(SUN_R, Math.random(), 0.12 + Math.random() * 0.76);
  }

  var proms = [];
  for (var pr = 0; pr < N_PROM; pr++) {
    proms.push({
      a: randFoot(),
      b: randFoot(),
      height: 3.2 + Math.random() * 5.4,
      flow: Math.random(),
      speed: 0.08 + Math.random() * 0.12,
      hue: Math.random(),
      age: Math.random() * 10,
      life: 9 + Math.random() * 10,
    });
  }

  function loopPoint(prom, t, out) {
    var ax = prom.a.x;
    var ay = prom.a.y;
    var az = prom.a.z;
    var bx = prom.b.x;
    var by = prom.b.y;
    var bz = prom.b.z;
    var ox = ax + (bx - ax) * t;
    var oy = ay + (by - ay) * t;
    var oz = az + (bz - az) * t;
    var len = Math.hypot(ox, oy, oz) || 1;
    var lift = prom.height * Math.sin(Math.PI * t);
    var r = SUN_R + lift;
    out.x = (ox / len) * r;
    out.y = (oy / len) * r;
    out.z = (oz / len) * r;
  }

  var _lp = { x: 0, y: 0, z: 0 };
  var ribVerts = N_PROM * PROM_SEGS * 2;
  var ribPos = new Float32Array(ribVerts * 3);
  var ribCol = new Float32Array(ribVerts * 3);
  var ribIdx = [];
  for (var rp = 0; rp < N_PROM; rp++) {
    var base = rp * PROM_SEGS * 2;
    for (var rt = 0; rt < PROM_SEGS - 1; rt++) {
      var a = base + rt * 2;
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

  var spinePos = new Float32Array(N_PROM * PROM_SEGS * 3);
  var spineCol = new Float32Array(N_PROM * PROM_SEGS * 3);
  var spineIdx = [];
  for (var spp = 0; spp < N_PROM; spp++) {
    var sbase = spp * PROM_SEGS;
    for (var sst = 0; sst < PROM_SEGS - 1; sst++) {
      spineIdx.push(sbase + sst, sbase + sst + 1);
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

  function warmStart() {
    updateDipole(0);
    updateBodies(0);
    var k, s;
    for (k = 0; k < ions.length; k++) {
      spawnAtEmitter(ions[k]);
      for (s = 0; s < ION_TRAIL; s++) {
        stepParticle(ions[k], ions[k].trail, ION_TRAIL, 0.028);
      }
    }
    for (k = 0; k < sparks.length; k++) {
      spawnAtEmitter(sparks[k]);
      for (s = 0; s < SPARK_TRAIL; s++) {
        stepParticle(sparks[k], sparks[k].trail, SPARK_TRAIL, 0.028);
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
    var pulse = 0.82 + 0.18 * Math.sin(t * 1.9);
    var coreH = 0.07 + 0.03 * Math.sin(t * 0.11) + hueShift * 0.12;
    var cRgb = hsv(solarHue(coreH), 0.55, 1);
    coreHot.material.color.setRGB(1, 0.96, 0.86);
    coreMid.material.color.setRGB(cRgb[0], cRgb[1] * 0.72, cRgb[2] * 0.28);
    coreHalo.material.color.setRGB(cRgb[0], cRgb[1] * 0.38, cRgb[2] * 0.12);
    var breathe = 1 + 0.06 * Math.sin(t * 2.3);
    coreHot.scale.set(3.8 * breathe, 3.8 * breathe, 1);
    coreMid.scale.set(7.2 * pulse, 7.2 * pulse, 1);

    var i, k, rgb;
    for (i = 0; i < emitSprites.length; i++) {
      rgb = hsv(solarHue(coreH + 0.02), 0.5, 1);
      emitSprites[i].material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      var es = 1.7 + 0.55 * Math.sin(t * 3.1 + emitters[i].phase);
      emitSprites[i].scale.set(es, es, 1);
    }
    for (i = 0; i < attrSprites.length; i++) {
      rgb = hsv(solarHue(coreH + 0.08 + i * 0.05), 0.7, 0.55);
      attrSprites[i].material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    }

    for (i = 0; i < N_IONS; i++) {
      var p = ions[i];
      var n = p.filled;
      var spd = Math.hypot(p.vx, p.vy, p.vz);
      var hot = Math.min(1, spd * 0.12);
      for (k = 0; k < ION_TRAIL; k++) {
        var live = k < n;
        var src = live ? k : Math.max(0, n - 1);
        var gi = (i * ION_TRAIL + k) * 3;
        ionPos[gi] = live ? p.trail[src * 3] : p.x;
        ionPos[gi + 1] = live ? p.trail[src * 3 + 1] : p.y;
        ionPos[gi + 2] = live ? p.trail[src * 3 + 2] : p.z;
        var fade = !live || n < 2 ? 0 : 0.25 + 0.75 * (k / (n - 1));
        var v = fade * (0.45 + 0.55 * hot);
        rgb = hsv(solarHue(p.hue + hueShift + k * 0.003), p.sat * (1 - hot * 0.45), v);
        ionCol[gi] = rgb[0];
        ionCol[gi + 1] = rgb[1];
        ionCol[gi + 2] = rgb[2];
      }
    }

    for (i = 0; i < N_SPARKS; i++) {
      p = sparks[i];
      n = p.filled;
      sparkHeadPos[i * 3] = p.x;
      sparkHeadPos[i * 3 + 1] = p.y;
      sparkHeadPos[i * 3 + 2] = p.z;
      rgb = hsv(solarHue(p.hue + hueShift), p.sat * 0.4, 1);
      sparkHeadCol[i * 3] = rgb[0];
      sparkHeadCol[i * 3 + 1] = rgb[1];
      sparkHeadCol[i * 3 + 2] = rgb[2];
      for (k = 0; k < SPARK_TRAIL; k++) {
        live = k < n;
        src = live ? k : Math.max(0, n - 1);
        gi = (i * SPARK_TRAIL + k) * 3;
        sparkPos[gi] = live ? p.trail[src * 3] : p.x;
        sparkPos[gi + 1] = live ? p.trail[src * 3 + 1] : p.y;
        sparkPos[gi + 2] = live ? p.trail[src * 3 + 2] : p.z;
        fade = !live || n < 2 ? 0 : k / (n - 1);
        fade = fade * fade;
        v = fade * (0.55 + 0.45 * Math.sin(t * 2.4 - k * 0.18 + i));
        rgb = hsv(solarHue(p.hue + hueShift + k * 0.002), p.sat, v);
        sparkCol[gi] = rgb[0];
        sparkCol[gi + 1] = rgb[1];
        sparkCol[gi + 2] = rgb[2];
      }
    }

    for (i = 0; i < N_PROM; i++) {
      var prom = proms[i];
      var head = prom.flow;
      for (k = 0; k < PROM_SEGS; k++) {
        var tt = k / (PROM_SEGS - 1);
        loopPoint(prom, tt, _lp);
        var tx = _lp.x;
        var ty = _lp.y;
        var tz = _lp.z;
        var along = 1 - Math.abs(tt - head);
        along = Math.max(0, along);
        along = along * along;
        var edge = Math.sin(Math.PI * tt);
        v = (0.18 + 0.82 * along) * edge * 0.95;
        rgb = hsv(solarHue(prom.hue + hueShift + tt * 0.03), 0.7, v);
        gi = (i * PROM_SEGS + k) * 3;
        spinePos[gi] = tx;
        spinePos[gi + 1] = ty;
        spinePos[gi + 2] = tz;
        spineCol[gi] = rgb[0] * 1.2;
        spineCol[gi + 1] = rgb[1] * 1.2;
        spineCol[gi + 2] = rgb[2] * 1.2;

        var nx, ny, nz;
        if (k < PROM_SEGS - 1) {
          loopPoint(prom, (k + 1) / (PROM_SEGS - 1), _lp);
          nx = _lp.x - tx;
          ny = _lp.y - ty;
          nz = _lp.z - tz;
        } else {
          loopPoint(prom, (k - 1) / (PROM_SEGS - 1), _lp);
          nx = tx - _lp.x;
          ny = ty - _lp.y;
          nz = tz - _lp.z;
        }
        var tox = camx - tx;
        var toy = camy - ty;
        var toz = camz - tz;
        var sx = ny * toz - nz * toy;
        var sy = nz * tox - nx * toz;
        var sz = nx * toy - ny * tox;
        var sl = Math.hypot(sx, sy, sz);
        var w = RIBBON_W * (0.35 + 0.65 * edge) * (0.7 + 0.3 * along);
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
        var vi = (i * PROM_SEGS + k) * 2 * 3;
        ribPos[vi] = tx + sx;
        ribPos[vi + 1] = ty + sy;
        ribPos[vi + 2] = tz + sz;
        ribPos[vi + 3] = tx - sx;
        ribPos[vi + 4] = ty - sy;
        ribPos[vi + 5] = tz - sz;
        var rc = hsv(solarHue(prom.hue + hueShift + tt * 0.03), 0.66, v * 0.72);
        ribCol[vi] = rc[0];
        ribCol[vi + 1] = rc[1];
        ribCol[vi + 2] = rc[2];
        ribCol[vi + 3] = rc[0];
        ribCol[vi + 4] = rc[1];
        ribCol[vi + 5] = rc[2];
      }
    }

    ionGeo.attributes.position.needsUpdate = true;
    ionGeo.attributes.color.needsUpdate = true;
    sparkHeadGeo.attributes.position.needsUpdate = true;
    sparkHeadGeo.attributes.color.needsUpdate = true;
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
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

    updateDipole(elapsed);
    updateBodies(elapsed);

    var i;
    for (i = 0; i < ions.length; i++) {
      stepParticle(ions[i], ions[i].trail, ION_TRAIL, dt);
    }
    for (i = 0; i < sparks.length; i++) {
      stepParticle(sparks[i], sparks[i].trail, SPARK_TRAIL, dt);
    }
    for (i = 0; i < proms.length; i++) {
      var prom = proms[i];
      prom.flow += prom.speed * dt * (reduced ? 0.45 : 1);
      if (prom.flow > 1.15) prom.flow = -0.1;
      prom.age += dt;
      if (prom.age > prom.life) {
        prom.a = randFoot();
        prom.b = randFoot();
        prom.height = 3.0 + Math.random() * 5.6;
        prom.speed = 0.08 + Math.random() * 0.12;
        prom.hue = Math.random();
        prom.age = 0;
        prom.life = 8 + Math.random() * 12;
        prom.flow = 0;
      }
    }

    camAngle += CAM_SPEED * dt;
    var elev = 0.16 * Math.sin(elapsed * 0.09) + 0.1;
    var cr = camRadius + 1.1 * Math.sin(elapsed * 0.06);
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
