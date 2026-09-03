/* Original remake of the classic 2000s "Skyrocket" GL fireworks show.
   Rockets, smoke trails, a drifting camera, and bursts that illuminate
   the clouds and ground. Silent — no OpenAL / no audio. Not derived
   from rss-glx / GPL sources. */
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

  var MAX_ROCKETS = reduced ? 3 : 8;
  var SPARK_MAX = reduced ? 720 : 2400;
  var SMOKE_MAX = reduced ? 280 : 1000;
  var STAR_COUNT = reduced ? 140 : 360;
  var CLOUD_COUNT = reduced ? 6 : 11;
  var TOWN_COUNT = reduced ? 40 : 90;
  var LAUNCH_MIN = reduced ? 1.8 : 0.42;
  var LAUNCH_SPAN = reduced ? 2.6 : 1.15;
  var CAM_SPEED = reduced ? 0.032 : 0.072;
  var WIND = reduced ? 0.7 : 1.55;
  var GRAVITY = 7.6;
  var SMOKE_LIFE = reduced ? 3.2 : 5.0;
  var GROUND_SEGS = 28;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x03050c, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070f, 72, 210);

  var camera = new THREE.PerspectiveCamera(
    54,
    window.innerWidth / window.innerHeight,
    0.25,
    420
  );
  var camAngle = 0.55;
  var camRadius = 44;
  camera.position.set(0, 10, camRadius);

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

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,255,0.95)");
    grd.addColorStop(mid, "rgba(255,220,170,0.32)");
    grd.addColorStop(0.7, "rgba(140,170,255,0.08)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function makeSmokeTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var cx = 32;
    var grd = g.createRadialGradient(cx, cx, 2, cx, cx, 30);
    grd.addColorStop(0, "rgba(210,205,198,0.55)");
    grd.addColorStop(0.35, "rgba(160,155,148,0.28)");
    grd.addColorStop(0.7, "rgba(90,88,84,0.08)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function makeCloudTexture() {
    var c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    var g = c.getContext("2d");
    var i;
    for (i = 0; i < 18; i++) {
      var px = 40 + Math.random() * 176;
      var py = 28 + Math.random() * 72;
      var rx = 28 + Math.random() * 48;
      var ry = 12 + Math.random() * 22;
      var grd = g.createRadialGradient(px, py, 2, px, py, rx);
      var a = 0.12 + Math.random() * 0.18;
      grd.addColorStop(0, "rgba(255,255,255," + a.toFixed(3) + ")");
      grd.addColorStop(0.55, "rgba(230,235,245," + (a * 0.45).toFixed(3) + ")");
      grd.addColorStop(1, "rgba(200,210,230,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function makeMoonTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    var cx = 64;
    g.fillStyle = "#000";
    g.fillRect(0, 0, 128, 128);
    var grd = g.createRadialGradient(52, 50, 8, 64, 64, 58);
    grd.addColorStop(0, "#f4f1e4");
    grd.addColorStop(0.45, "#d8d4c4");
    grd.addColorStop(1, "#9aa0a8");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cx, 56, 0, Math.PI * 2);
    g.fill();
    var craters = [
      [44, 52, 9, 0.18],
      [78, 40, 6, 0.16],
      [70, 78, 11, 0.14],
      [38, 80, 5, 0.2],
      [86, 70, 4, 0.15],
      [55, 36, 4, 0.12],
    ];
    var i;
    for (i = 0; i < craters.length; i++) {
      var cr = craters[i];
      g.fillStyle = "rgba(90,95,100," + cr[3] + ")";
      g.beginPath();
      g.arc(cr[0], cr[1], cr[2], 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,245,0.12)";
      g.beginPath();
      g.arc(cr[0] - cr[2] * 0.25, cr[1] - cr[2] * 0.25, cr[2] * 0.55, 0, Math.PI * 2);
      g.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function hash2(ix, iz) {
    var n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function noise2(x, z) {
    var x0 = Math.floor(x);
    var z0 = Math.floor(z);
    var fx = x - x0;
    var fz = z - z0;
    var u = fx * fx * (3 - 2 * fx);
    var v = fz * fz * (3 - 2 * fz);
    var a = hash2(x0, z0);
    var b = hash2(x0 + 1, z0);
    var c = hash2(x0, z0 + 1);
    var d = hash2(x0 + 1, z0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, z) {
    var t = 0;
    var a = 0.55;
    var f = 1;
    var i;
    for (i = 0; i < 4; i++) {
      t += noise2(x * f, z * f) * a;
      a *= 0.5;
      f *= 2.03;
    }
    return t;
  }

  function makeGroundTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 512;
    var g = c.getContext("2d");
    var img = g.createImageData(512, 512);
    var d = img.data;
    var y;
    var x;
    for (y = 0; y < 512; y++) {
      for (x = 0; x < 512; x++) {
        var n = fbm(x * 0.018, y * 0.018);
        var n2 = fbm(x * 0.07 + 8, y * 0.07);
        var soil = 0.22 + n * 0.55;
        var i = (y * 512 + x) * 4;
        d[i] = (62 + soil * 96 + n2 * 28) | 0;
        d[i + 1] = (70 + soil * 88 + n2 * 22) | 0;
        d[i + 2] = (42 + soil * 48 + n2 * 10) | 0;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    for (x = 0; x < 220; x++) {
      g.fillStyle = "rgba(255," + ((170 + Math.random() * 60) | 0) + ",70," + (0.18 + Math.random() * 0.5).toFixed(2) + ")";
      g.fillRect((Math.random() * 512) | 0, (Math.random() * 512) | 0, 1, 1);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128, 0.1, 0.34);
  var softTex = makeGlowTexture(64, 0.18, 0.48);
  var smokeTex = makeSmokeTexture();
  var cloudTex = makeCloudTexture();
  var moonTex = makeMoonTexture();
  var groundTex = makeGroundTexture();

  // --- stars ---
  (function addStars() {
    var pos = new Float32Array(STAR_COUNT * 3);
    var col = new Float32Array(STAR_COUNT * 3);
    var i;
    for (i = 0; i < STAR_COUNT; i++) {
      var u = Math.random();
      var v = Math.random();
      var th = u * Math.PI * 2;
      var ph = Math.acos(0.08 + 0.92 * v);
      var r = 160 + Math.random() * 70;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) + 8;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      var warm = Math.random();
      var b = 0.35 + Math.random() * 0.6;
      col[i * 3] = b;
      col[i * 3 + 1] = b * (0.88 + warm * 0.1);
      col[i * 3 + 2] = b * (0.78 + (1 - warm) * 0.22);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.35,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
        fog: false,
      })
    );
    pts.renderOrder = 0;
    scene.add(pts);
  })();

  // --- moon + glow ---
  var moonPos = new THREE.Vector3(22, 34, -28);
  var moonGlowMat = new THREE.SpriteMaterial({
    map: softTex,
    color: 0xc8d2ee,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    opacity: reduced ? 0.35 : 0.55,
  });
  var moonGlow = new THREE.Sprite(moonGlowMat);
  moonGlow.position.copy(moonPos);
  moonGlow.scale.set(22, 22, 1);
  moonGlow.renderOrder = 1;
  scene.add(moonGlow);

  var moonMat = new THREE.SpriteMaterial({
    map: moonTex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  var moonSprite = new THREE.Sprite(moonMat);
  moonSprite.position.copy(moonPos);
  moonSprite.scale.set(6.4, 6.4, 1);
  moonSprite.renderOrder = 2;
  scene.add(moonSprite);

  // --- ground (earth) ---
  var groundGeo = new THREE.PlaneGeometry(240, 240, GROUND_SEGS, GROUND_SEGS);
  groundGeo.rotateX(-Math.PI * 0.5);
  var gp = groundGeo.attributes.position;
  var gcol = new Float32Array(gp.count * 3);
  var gi;
  for (gi = 0; gi < gp.count; gi++) {
    var gx = gp.getX(gi);
    var gz = gp.getZ(gi);
    var dist = Math.hypot(gx, gz);
    var h = (fbm(gx * 0.035 + 4, gz * 0.035) - 0.35) * 7.5;
    var rim = Math.max(0, (dist - 26) / 90);
    h *= 0.15 + rim * rim * 1.6;
    if (dist < 24) h *= dist / 24 * 0.2;
    gp.setY(gi, Math.max(-1.2, h));
    gcol[gi * 3] = 0.22;
    gcol[gi * 3 + 1] = 0.21;
    gcol[gi * 3 + 2] = 0.18;
  }
  gp.needsUpdate = true;
  groundGeo.setAttribute("color", new THREE.BufferAttribute(gcol, 3));
  groundGeo.computeVertexNormals();
  var ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshBasicMaterial({
      map: groundTex,
      vertexColors: true,
      fog: true,
    })
  );
  ground.renderOrder = 0;
  scene.add(ground);

  // distant town lights sitting on the terrain
  (function addTown() {
    var pos = new Float32Array(TOWN_COUNT * 3);
    var col = new Float32Array(TOWN_COUNT * 3);
    var i;
    for (i = 0; i < TOWN_COUNT; i++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = 38 + Math.random() * 70;
      var tx = Math.cos(ang) * rad;
      var tz = Math.sin(ang) * rad;
      pos[i * 3] = tx;
      pos[i * 3 + 1] = 0.6 + fbm(tx * 0.035, tz * 0.035) * 2;
      pos[i * 3 + 2] = tz;
      var warm = 0.7 + Math.random() * 0.3;
      col[i * 3] = warm;
      col[i * 3 + 1] = 0.45 + Math.random() * 0.25;
      col[i * 3 + 2] = 0.12 + Math.random() * 0.12;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          map: glowTex,
          size: 0.9,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          sizeAttenuation: true,
        })
      )
    );
  })();

  // --- clouds (billboards, tinted by burst lights) ---
  var clouds = [];
  var ci;
  for (ci = 0; ci < CLOUD_COUNT; ci++) {
    var mat = new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0x1a2233,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
      fog: true,
    });
    var spr = new THREE.Sprite(mat);
    var ang = (ci / CLOUD_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    var rad = 18 + (ci % 4) * 9 + Math.random() * 8;
    spr.position.set(
      Math.cos(ang) * rad,
      22 + (ci % 3) * 4.5 + Math.random() * 3,
      Math.sin(ang) * rad * 0.85
    );
    var sc = 14 + (ci % 5) * 3.5;
    spr.scale.set(sc * 1.7, sc * 0.72, 1);
    spr.renderOrder = 1;
    scene.add(spr);
    clouds.push({
      sprite: spr,
      mat: mat,
      phase: Math.random() * Math.PI * 2,
      drift: 0.35 + Math.random() * 0.45,
      baseY: spr.position.y,
    });
  }

  // --- particle buffers ---
  var sparkPos = new Float32Array(SPARK_MAX * 3);
  var sparkCol = new Float32Array(SPARK_MAX * 3);
  var sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  var sparkPoints = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 1.55,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
      fog: false,
    })
  );
  sparkPoints.renderOrder = 4;
  scene.add(sparkPoints);

  var haloPos = new Float32Array(SPARK_MAX * 3);
  var haloCol = new Float32Array(SPARK_MAX * 3);
  var haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  var haloPoints = new THREE.Points(
    haloGeo,
    new THREE.PointsMaterial({
      map: softTex,
      size: 3.4,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
      fog: false,
    })
  );
  haloPoints.renderOrder = 3;
  scene.add(haloPoints);

  var smokePos = new Float32Array(SMOKE_MAX * 3);
  var smokeCol = new Float32Array(SMOKE_MAX * 3);
  var smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute("color", new THREE.BufferAttribute(smokeCol, 3));
  var smokePoints = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({
      map: smokeTex,
      size: 4.4,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
      opacity: 0.9,
    })
  );
  smokePoints.renderOrder = 2;
  scene.add(smokePoints);

  var rocketPos = new Float32Array(MAX_ROCKETS * 3);
  var rocketCol = new Float32Array(MAX_ROCKETS * 3);
  var rocketGeo = new THREE.BufferGeometry();
  rocketGeo.setAttribute("position", new THREE.BufferAttribute(rocketPos, 3));
  rocketGeo.setAttribute("color", new THREE.BufferAttribute(rocketCol, 3));
  var rocketPoints = new THREE.Points(
    rocketGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 2.4,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
      fog: false,
    })
  );
  rocketPoints.renderOrder = 5;
  scene.add(rocketPoints);

  var FLASH_MAX = 10;
  var flashes = [];
  var fi;
  for (fi = 0; fi < FLASH_MAX; fi++) {
    var fm = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      opacity: 0,
    });
    var fs = new THREE.Sprite(fm);
    fs.scale.set(1, 1, 1);
    fs.visible = false;
    fs.renderOrder = 6;
    scene.add(fs);
    flashes.push({ sprite: fs, mat: fm, life: 0, max: 0.4, sx: 8, sy: 8 });
  }

  var FLARE_N = 5;
  var flares = [];
  var fl;
  for (fl = 0; fl < FLARE_N; fl++) {
    var flm = new THREE.SpriteMaterial({
      map: fl === 0 ? glowTex : softTex,
      color: 0xffe6b0,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      opacity: 0,
    });
    var fls = new THREE.Sprite(flm);
    fls.visible = false;
    fls.renderOrder = 7;
    scene.add(fls);
    flares.push({ sprite: fls, mat: flm });
  }

  var sparks = [];
  var smokes = [];
  var rockets = [];
  var lights = [];
  var delayed = [];

  var HUES = [0.02, 0.08, 0.12, 0.33, 0.48, 0.58, 0.78, 0.9, 0.0];
  var TYPES = [
    "peony",
    "chrys",
    "willow",
    "ring",
    "pistil",
    "crossette",
    "strobe",
    "shell",
    "crackle",
    "palm",
  ];

  function pickHue() {
    return HUES[(Math.random() * HUES.length) | 0];
  }

  function pickType() {
    var r = Math.random();
    if (r < 0.2) return "peony";
    if (r < 0.36) return "chrys";
    if (r < 0.5) return "willow";
    if (r < 0.6) return "ring";
    if (r < 0.7) return "pistil";
    if (r < 0.78) return "palm";
    if (r < 0.85) return "crossette";
    if (r < 0.91) return "shell";
    if (r < 0.96) return "strobe";
    return "crackle";
  }

  function addLight(x, y, z, rgb, power, life) {
    if (lights.length >= 10) lights.shift();
    lights.push({
      x: x,
      y: y,
      z: z,
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      power: power,
      life: life,
      max: life,
    });
  }

  function addFlash(x, y, z, rgb, scale) {
    var i;
    var slot = flashes[0];
    var best = 99;
    for (i = 0; i < flashes.length; i++) {
      if (flashes[i].life <= 0) {
        slot = flashes[i];
        break;
      }
      if (flashes[i].life < best) {
        best = flashes[i].life;
        slot = flashes[i];
      }
    }
    slot.sprite.position.set(x, y, z);
    slot.mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
    slot.mat.opacity = 1;
    slot.sprite.visible = true;
    slot.life = 0.38;
    slot.max = 0.38;
    slot.sx = scale;
    slot.sy = scale;
    slot.sprite.scale.set(scale * 0.4, scale * 0.4, 1);
  }

  function addSpark(x, y, z, vx, vy, vz, rgb, life, size, drag, grav, kind) {
    if (sparks.length >= SPARK_MAX) return;
    sparks.push({
      x: x,
      y: y,
      z: z,
      vx: vx,
      vy: vy,
      vz: vz,
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      life: life,
      max: life,
      size: size,
      drag: drag,
      grav: grav,
      kind: kind || 0,
      split: false,
    });
  }

  function addSmoke(x, y, z, vx, vy, vz, rgb, life, size) {
    if (smokes.length >= SMOKE_MAX) return;
    smokes.push({
      x: x,
      y: y,
      z: z,
      vx: vx,
      vy: vy,
      vz: vz,
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      life: life,
      max: life,
      size: size,
    });
  }

  function sphereBurst(x, y, z, rgb, n, speed, life, drag, grav, kind, jitter) {
    var i;
    for (i = 0; i < n; i++) {
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      var sp = speed * (0.72 + Math.random() * 0.5);
      if (jitter) sp *= 0.55 + Math.random() * 0.9;
      var vx = Math.sin(ph) * Math.cos(th) * sp;
      var vy = Math.cos(ph) * sp;
      var vz = Math.sin(ph) * Math.sin(th) * sp;
      var dim = 0.75 + Math.random() * 0.35;
      addSpark(
        x,
        y,
        z,
        vx,
        vy,
        vz,
        [rgb[0] * dim, rgb[1] * dim, rgb[2] * dim],
        life * (0.75 + Math.random() * 0.45),
        0.7 + Math.random() * 0.6,
        drag,
        grav,
        kind
      );
    }
  }

  function ringBurst(x, y, z, rgb, n, speed) {
    var ax = Math.random() - 0.5;
    var ay = 0.35 + Math.random() * 0.5;
    var az = Math.random() - 0.5;
    var al = Math.hypot(ax, ay, az) || 1;
    ax /= al;
    ay /= al;
    az /= al;
    var bx = ay;
    var by = -ax;
    var bz = 0;
    var bl = Math.hypot(bx, by, bz);
    if (bl < 1e-4) {
      bx = 0;
      by = az;
      bz = -ay;
      bl = Math.hypot(bx, by, bz) || 1;
    }
    bx /= bl;
    by /= bl;
    bz /= bl;
    var cx = ay * bz - az * by;
    var cy = az * bx - ax * bz;
    var cz = ax * by - ay * bx;
    var i;
    for (i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.08;
      var sp = speed * (0.92 + Math.random() * 0.16);
      var vx = (bx * Math.cos(a) + cx * Math.sin(a)) * sp;
      var vy = (by * Math.cos(a) + cy * Math.sin(a)) * sp;
      var vz = (bz * Math.cos(a) + cz * Math.sin(a)) * sp;
      addSpark(x, y, z, vx, vy, vz, rgb, 1.5 + Math.random() * 0.5, 0.9, 0.55, 5.2, 0);
    }
  }

  function burst(x, y, z, type, hue) {
    var rgb = hsv(hue, type === "strobe" ? 0.15 : 0.82, 1);
    var nMul = reduced ? 0.55 : 1;
    var smokeN = reduced ? 6 : 16;
    var i;
    var power = 14;
    var lifeL = 0.65;

    if (type === "peony") {
      sphereBurst(x, y, z, rgb, (90 * nMul) | 0, 9.5, 1.55, 0.62, 6.8, 0, false);
      power = 18;
      lifeL = 0.55;
    } else if (type === "chrys") {
      sphereBurst(x, y, z, rgb, (110 * nMul) | 0, 8.4, 2.15, 0.48, 6.2, 4, false);
      power = 16;
      lifeL = 0.8;
    } else if (type === "willow") {
      sphereBurst(x, y, z, rgb, (70 * nMul) | 0, 7.2, 3.4, 0.92, 8.6, 4, true);
      power = 9;
      lifeL = 1.3;
    } else if (type === "palm") {
      var k;
      var pn = (48 * nMul) | 0;
      for (k = 0; k < pn; k++) {
        var a = Math.random() * Math.PI * 2;
        var up = 5.5 + Math.random() * 5;
        addSpark(
          x,
          y,
          z,
          Math.cos(a) * (2.2 + Math.random() * 3.5),
          up,
          Math.sin(a) * (2.2 + Math.random() * 3.5),
          rgb,
          2.8 + Math.random(),
          0.85,
          0.88,
          9.2,
          4
        );
      }
      power = 10;
      lifeL = 1.1;
    } else if (type === "ring") {
      ringBurst(x, y, z, rgb, (72 * nMul) | 0, 8.8);
      power = 15;
      lifeL = 0.6;
    } else if (type === "pistil") {
      sphereBurst(x, y, z, rgb, (80 * nMul) | 0, 9.8, 1.45, 0.6, 6.8, 0, false);
      var inner = hsv((hue + 0.12) % 1, 0.35, 1);
      sphereBurst(x, y, z, inner, (36 * nMul) | 0, 4.2, 1.2, 0.7, 6.4, 0, false);
      power = 20;
      lifeL = 0.6;
    } else if (type === "crossette") {
      sphereBurst(x, y, z, rgb, (28 * nMul) | 0, 7.4, 1.35, 0.5, 6.5, 2, false);
      power = 12;
      lifeL = 0.7;
    } else if (type === "strobe") {
      sphereBurst(x, y, z, hsv(hue, 0.12, 1), (40 * nMul) | 0, 5.2, 2.4, 0.75, 4.8, 1, true);
      power = 11;
      lifeL = 0.9;
    } else if (type === "shell") {
      sphereBurst(x, y, z, rgb, (40 * nMul) | 0, 5.5, 1.1, 0.7, 6.2, 0, false);
      var arms = reduced ? 2 : 3 + ((Math.random() * 2) | 0);
      for (i = 0; i < arms; i++) {
        delayed.push({
          at: elapsed + 0.45 + i * 0.18 + Math.random() * 0.12,
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.4) * 4,
          z: z + (Math.random() - 0.5) * 6,
          type: Math.random() < 0.5 ? "peony" : "ring",
          hue: Math.random() < 0.4 ? hue : pickHue(),
        });
      }
      power = 13;
      lifeL = 0.5;
    } else if (type === "crackle") {
      sphereBurst(x, y, z, rgb, (50 * nMul) | 0, 6.5, 1.2, 0.65, 6.4, 0, false);
      var pops = reduced ? 5 : 14;
      for (i = 0; i < pops; i++) {
        delayed.push({
          at: elapsed + 0.35 + Math.random() * 0.9,
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 6,
          z: z + (Math.random() - 0.5) * 8,
          type: "pop",
          hue: hue,
        });
      }
      power = 12;
      lifeL = 0.7;
    } else if (type === "pop") {
      sphereBurst(x, y, z, rgb, (12 * nMul) | 0, 3.6, 0.7, 0.8, 7.0, 0, false);
      power = 6;
      lifeL = 0.28;
      smokeN = 3;
    }

    addLight(x, y, z, rgb, power, lifeL);
    addFlash(x, y, z, rgb, 7 + power * 0.35);
    for (i = 0; i < smokeN; i++) {
      addSmoke(
        x + (Math.random() - 0.5) * 1.4,
        y + (Math.random() - 0.5) * 1.4,
        z + (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 1.2,
        0.4 + Math.random() * 1.1,
        (Math.random() - 0.5) * 1.2,
        [rgb[0] * 0.55 + 0.35, rgb[1] * 0.55 + 0.35, rgb[2] * 0.55 + 0.35],
        SMOKE_LIFE * (0.55 + Math.random() * 0.5),
        2.2 + Math.random() * 2.4
      );
    }
  }

  var windX = WIND;
  var windZ = WIND * 0.22;
  var elapsed = 0;
  var nextLaunch = 0.15;

  function launchRocket(warm) {
    if (rockets.length >= MAX_ROCKETS) return;
    var x = (Math.random() - 0.5) * 24;
    var z = (Math.random() - 0.5) * 24;
    var y = 0.35;
    var vy = 13.5 + Math.random() * 9.5;
    var vx = (Math.random() - 0.5) * 3.8 + windX * 0.15;
    var vz = (Math.random() - 0.5) * 3.8 + windZ * 0.15;
    var fuse = 1.25 + Math.random() * 1.55;
    if (warm) {
      var t = 0.5 + Math.random() * 1.0;
      y += vy * t - 0.5 * GRAVITY * t * t;
      vy -= GRAVITY * t;
      x += vx * t;
      z += vz * t;
      fuse = Math.max(0.2, fuse - t);
      if (y < 1) y = 4 + Math.random() * 6;
    }
    var hue = pickHue();
    var type = pickType();
    var rgb = hsv(hue, 0.55, 1);
    rockets.push({
      x: x,
      y: y,
      z: z,
      vx: vx,
      vy: vy,
      vz: vz,
      fuse: fuse,
      type: type,
      hue: hue,
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      smokeAcc: 0,
    });
  }

  function maybeBarrage() {
    if (rockets.length >= MAX_ROCKETS) return;
    var n = 1;
    if (!reduced && Math.random() < 0.3) n = 2 + ((Math.random() * 3) | 0);
    var i;
    for (i = 0; i < n; i++) launchRocket(false);
  }

  var lit = { r: 0, g: 0, b: 0 };

  function lightAt(x, y, z) {
    var r = 0.16;
    var g = 0.17;
    var b = 0.2;
    var mdx = moonPos.x - x;
    var mdy = moonPos.y - y;
    var mdz = moonPos.z - z;
    var md = Math.hypot(mdx, mdy, mdz) || 1;
    var moon = 18 / md;
    r += 0.22 * moon;
    g += 0.23 * moon;
    b += 0.28 * moon;
    var i;
    for (i = 0; i < lights.length; i++) {
      var L = lights[i];
      var dx = x - L.x;
      var dy = y - L.y;
      var dz = z - L.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      var fade = L.life / L.max;
      var att = (L.power * fade) / (1 + d2 * 0.0022);
      if (att < 0.012) continue;
      r += L.r * att;
      g += L.g * att;
      b += L.b * att;
    }
    lit.r = r;
    lit.g = g;
    lit.b = b;
    return lit;
  }

  function illuminateGround() {
    var pos = groundGeo.attributes.position;
    var col = groundGeo.attributes.color;
    var i;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var z = pos.getZ(i);
      var L = lightAt(x, y, z);
      col.setXYZ(
        i,
        clamp01(0.18 + L.r * 0.7),
        clamp01(0.16 + L.g * 0.62),
        clamp01(0.12 + L.b * 0.5)
      );
    }
    col.needsUpdate = true;
  }

  function illuminateClouds(dt) {
    var i;
    for (i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.sprite.position.x += windX * 0.12 * dt * c.drift;
      if (c.sprite.position.x > 70) c.sprite.position.x = -70;
      c.sprite.position.y = c.baseY + Math.sin(elapsed * 0.17 + c.phase) * 0.6;
      var L = lightAt(c.sprite.position.x, c.sprite.position.y, c.sprite.position.z);
      c.mat.color.setRGB(
        clamp01(0.07 + L.r * 0.85),
        clamp01(0.08 + L.g * 0.8),
        clamp01(0.11 + L.b * 0.7)
      );
      c.mat.opacity = 0.55 + Math.min(0.4, (L.r + L.g + L.b) * 0.12);
    }
  }

  function brightestLight() {
    var best = null;
    var mag = 0;
    var i;
    for (i = 0; i < lights.length; i++) {
      var L = lights[i];
      var m = L.power * (L.life / L.max);
      if (m > mag) {
        mag = m;
        best = L;
      }
    }
    return best;
  }

  var _ndc = new THREE.Vector3();
  var _world = new THREE.Vector3();

  function updateFlares() {
    var L = brightestLight();
    var i;
    if (!L || L.power * (L.life / L.max) < 6) {
      for (i = 0; i < flares.length; i++) {
        flares[i].sprite.visible = false;
        flares[i].mat.opacity = 0;
      }
      return;
    }
    _ndc.set(L.x, L.y, L.z).project(camera);
    if (_ndc.z > 1 || _ndc.x < -1.15 || _ndc.x > 1.15 || _ndc.y < -1.15 || _ndc.y > 1.15) {
      for (i = 0; i < flares.length; i++) {
        flares[i].sprite.visible = false;
      }
      return;
    }
    var fade = Math.min(1, (L.power * (L.life / L.max)) / 18);
    var offsets = [0, 0.22, 0.45, 0.68, 0.88];
    var scales = [2.8, 1.1, 4.5, 0.8, 1.6];
    for (i = 0; i < flares.length; i++) {
      var t = offsets[i];
      _world.set(_ndc.x * (1 - t), _ndc.y * (1 - t), _ndc.z);
      _world.unproject(camera);
      flares[i].sprite.position.copy(_world);
      flares[i].sprite.visible = true;
      flares[i].mat.color.setRGB(
        clamp01(L.r * 0.6 + 0.4),
        clamp01(L.g * 0.55 + 0.35),
        clamp01(L.b * 0.4 + 0.25)
      );
      var sc = scales[i] * (0.7 + fade);
      if (i === 2) flares[i].sprite.scale.set(sc * 3.2, sc * 0.28, 1);
      else flares[i].sprite.scale.set(sc, sc, 1);
      flares[i].mat.opacity = fade * (i === 0 ? 0.55 : 0.28);
    }
  }

  function stepRockets(dt) {
    var i;
    for (i = rockets.length - 1; i >= 0; i--) {
      var rk = rockets[i];
      rk.vy -= GRAVITY * dt;
      rk.vx += windX * 0.12 * dt;
      rk.vz += windZ * 0.12 * dt;
      rk.x += rk.vx * dt;
      rk.y += rk.vy * dt;
      rk.z += rk.vz * dt;
      rk.fuse -= dt;
      rk.smokeAcc += dt;
      while (rk.smokeAcc > 0.028 && smokes.length < SMOKE_MAX) {
        rk.smokeAcc -= 0.028;
        addSmoke(
          rk.x + (Math.random() - 0.5) * 0.15,
          rk.y + (Math.random() - 0.5) * 0.15,
          rk.z + (Math.random() - 0.5) * 0.15,
          rk.vx * 0.12 + (Math.random() - 0.5) * 0.4,
          0.15,
          rk.vz * 0.12 + (Math.random() - 0.5) * 0.4,
          [0.78, 0.74, 0.68],
          SMOKE_LIFE * (0.7 + Math.random() * 0.4),
          1.1 + Math.random() * 0.9
        );
      }
      if (rk.y < 0.2 || rk.fuse <= 0 || (rk.vy < 1.2 && rk.y > 8)) {
        burst(rk.x, Math.max(4, rk.y), rk.z, rk.type, rk.hue);
        rockets.splice(i, 1);
      }
    }
  }

  function stepSparks(dt) {
    var i;
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.vx += windX * 0.18 * dt;
      s.vz += windZ * 0.18 * dt;
      s.vy -= s.grav * dt;
      var drag = Math.exp(-s.drag * dt);
      s.vx *= drag;
      s.vy *= drag;
      s.vz *= drag;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      if (s.kind === 2 && !s.split && s.life < s.max * 0.48) {
        s.split = true;
        var k;
        for (k = 0; k < 3; k++) {
          addSpark(
            s.x,
            s.y,
            s.z,
            s.vx + (Math.random() - 0.5) * 5,
            s.vy + (Math.random() - 0.5) * 5,
            s.vz + (Math.random() - 0.5) * 5,
            [s.r, s.g, s.b],
            0.7 + Math.random() * 0.35,
            0.55,
            0.7,
            7.2,
            0
          );
        }
      }
      if (s.kind === 4 && Math.random() < dt * 6 && smokes.length < SMOKE_MAX) {
        addSmoke(
          s.x,
          s.y,
          s.z,
          s.vx * 0.1,
          0.2,
          s.vz * 0.1,
          [s.r * 0.4 + 0.2, s.g * 0.38 + 0.2, s.b * 0.35 + 0.2],
          1.6,
          1.3
        );
      }
      if (s.life <= 0 || s.y < -0.5) {
        var last = sparks.pop();
        if (i < sparks.length) sparks[i] = last;
      }
    }
  }

  function stepSmoke(dt) {
    var i;
    for (i = smokes.length - 1; i >= 0; i--) {
      var m = smokes[i];
      m.vx += windX * 0.55 * dt;
      m.vz += windZ * 0.55 * dt;
      m.vy += 0.18 * dt;
      m.vx *= 0.985;
      m.vz *= 0.985;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      m.life -= dt;
      m.size += dt * 1.15;
      if (m.life <= 0) {
        var last = smokes.pop();
        if (i < smokes.length) smokes[i] = last;
      }
    }
  }

  function stepLights(dt) {
    var i;
    for (i = lights.length - 1; i >= 0; i--) {
      lights[i].life -= dt;
      if (lights[i].life <= 0) lights.splice(i, 1);
    }
  }

  function stepFlashes(dt) {
    var i;
    for (i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      if (f.life <= 0) {
        f.sprite.visible = false;
        continue;
      }
      f.life -= dt;
      var k = clamp01(f.life / f.max);
      f.mat.opacity = k * k;
      var sc = f.sx * (0.45 + (1 - k) * 0.9);
      f.sprite.scale.set(sc, sc, 1);
      f.sprite.visible = k > 0.02;
    }
  }

  function stepDelayed() {
    var i;
    for (i = delayed.length - 1; i >= 0; i--) {
      if (delayed[i].at <= elapsed) {
        var d = delayed[i];
        burst(d.x, d.y, d.z, d.type, d.hue);
        delayed.splice(i, 1);
      }
    }
  }

  function writeSparks() {
    var n = sparks.length;
    var i;
    for (i = 0; i < n; i++) {
      var s = sparks[i];
      var fade = clamp01(s.life / s.max);
      var head = fade * fade;
      if (s.kind === 1) {
        var strobe = ((elapsed * 14 + i * 0.37) % 1) > 0.45 ? 1 : 0.08;
        if (reduced) strobe = 0.55 + 0.45 * Math.sin(elapsed * 8 + i);
        head *= strobe;
      }
      var tw = 0.75 + 0.25 * Math.sin(elapsed * 18 + i * 2.1);
      sparkPos[i * 3] = s.x;
      sparkPos[i * 3 + 1] = s.y;
      sparkPos[i * 3 + 2] = s.z;
      sparkCol[i * 3] = s.r * head * tw;
      sparkCol[i * 3 + 1] = s.g * head * tw;
      sparkCol[i * 3 + 2] = s.b * head * tw;
      haloPos[i * 3] = s.x;
      haloPos[i * 3 + 1] = s.y;
      haloPos[i * 3 + 2] = s.z;
      haloCol[i * 3] = s.r * head * 0.28;
      haloCol[i * 3 + 1] = s.g * head * 0.28;
      haloCol[i * 3 + 2] = s.b * head * 0.28;
    }
    sparkGeo.setDrawRange(0, n);
    haloGeo.setDrawRange(0, n);
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
    haloGeo.attributes.color.needsUpdate = true;
  }

  function writeSmoke() {
    var n = smokes.length;
    var i;
    for (i = 0; i < n; i++) {
      var m = smokes[i];
      var fade = clamp01(m.life / m.max);
      var a = fade * (1 - fade) * 4;
      if (a > 1) a = 1;
      a *= 0.85;
      smokePos[i * 3] = m.x;
      smokePos[i * 3 + 1] = m.y;
      smokePos[i * 3 + 2] = m.z;
      smokeCol[i * 3] = m.r * a;
      smokeCol[i * 3 + 1] = m.g * a;
      smokeCol[i * 3 + 2] = m.b * a;
    }
    smokeGeo.setDrawRange(0, n);
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.color.needsUpdate = true;
    smokePoints.material.size = 4.4;
  }

  function writeRockets() {
    var n = rockets.length;
    var i;
    for (i = 0; i < n; i++) {
      var rk = rockets[i];
      rocketPos[i * 3] = rk.x;
      rocketPos[i * 3 + 1] = rk.y;
      rocketPos[i * 3 + 2] = rk.z;
      rocketCol[i * 3] = 1;
      rocketCol[i * 3 + 1] = 0.92;
      rocketCol[i * 3 + 2] = 0.72;
    }
    rocketGeo.setDrawRange(0, n);
    rocketGeo.attributes.position.needsUpdate = true;
    rocketGeo.attributes.color.needsUpdate = true;
  }

  var look = new THREE.Vector3();
  var last = performance.now();
  var raf = 0;
  var groundTick = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt;

    windX = WIND * (0.75 + 0.35 * Math.sin(elapsed * 0.13));
    windZ = WIND * 0.28 * Math.cos(elapsed * 0.1);

    if (elapsed >= nextLaunch) {
      maybeBarrage();
      nextLaunch = elapsed + LAUNCH_MIN + Math.random() * LAUNCH_SPAN;
    }

    stepRockets(dt);
    stepSparks(dt);
    stepSmoke(dt);
    stepLights(dt);
    stepFlashes(dt);
    stepDelayed();

    camAngle += CAM_SPEED * dt;
    var elev = 0.16 + 0.07 * Math.sin(elapsed * 0.09);
    var cr = camRadius + 6 * Math.sin(elapsed * 0.055);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      7.5 + Math.sin(elev) * cr * 0.35 + 2.2 * Math.sin(elapsed * 0.07),
      Math.sin(camAngle) * Math.cos(elev) * cr
    );
    look.set(
      3.5 * Math.sin(elapsed * 0.04),
      11 + 2.5 * Math.sin(elapsed * 0.06),
      3.5 * Math.cos(elapsed * 0.033)
    );
    camera.lookAt(look);
    camera.up.set(0, 1, 0);

    illuminateClouds(dt);
    groundTick += dt;
    if (groundTick > 0.05) {
      groundTick = 0;
      illuminateGround();
    }
    updateFlares();
    writeSparks();
    writeSmoke();
    writeRockets();
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

  var w;
  for (w = 0; w < (reduced ? 1 : 3); w++) launchRocket(true);
  burst(2.5, 15.5, -3.5, "peony", 0.12);
  if (!reduced) {
    burst(-7, 13.5, 6, "ring", 0.78);
    burst(8, 18, 2, "chrys", 0.33);
  }
  illuminateClouds(0);
  illuminateGround();
  writeSparks();
  writeSmoke();
  writeRockets();
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
