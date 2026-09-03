/* Original remake of the 2006 night-city GL eye candy (rss-glx /
   Shamus Young vibe): boxy towers, chunky window grids, sodium streets,
   and a camera flyover. Procedural geometry only — not derived from
   Pixel City / rss-glx GPL sources. */
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

  var N_LOTS = reduced ? 10 : 16;
  var LOT = 12;
  var STREET = 7;
  var CELL = LOT + STREET;
  var HALF = (N_LOTS * CELL) / 2;
  var SPAN = (N_LOTS + 2) * CELL;
  var FOG_COL = 0x07091a;
  var CAM_SPEED = reduced ? 0.26 : 0.68;
  var N_CARS = reduced ? 28 : 96;
  var N_STARS = reduced ? 70 : 180;
  var N_TEX = reduced ? 8 : 14;
  var MAX_H = reduced ? 42 : 62;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(FOG_COL, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COL);
  scene.fog = new THREE.FogExp2(FOG_COL, reduced ? 0.016 : 0.011);

  var camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.45,
    720
  );

  scene.add(new THREE.HemisphereLight(0x1c2848, 0x08080c, 0.55));
  scene.add(new THREE.AmbientLight(0x10141e, 0.35));
  var moonLight = new THREE.DirectionalLight(0x6e7aa0, 0.28);
  moonLight.position.set(-50, 80, 30);
  scene.add(moonLight);

  function makeGlowTexture(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.18, "rgba(255,240,210,0.9)");
    grd.addColorStop(0.42, "rgba(255,190,90,0.28)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(64);
  var boxGeo = new THREE.BoxGeometry(1, 1, 1);

  var WARM = ["#ffd27a", "#ffc45c", "#ffe6a8", "#ffb347", "#fff1c4", "#e8c070"];
  var COOL = ["#e4ecf8", "#c8d4e8", "#d8e0f0"];
  var TV = ["#6a9cff", "#7eb0ff", "#98c4ff"];
  var WALLS = ["#101018", "#0c0e16", "#14141c", "#0e1018", "#12121a", "#0a0c12"];

  function makeWindowTexture() {
    var cols = 8;
    var rows = 16;
    var cw = 4;
    var ch = 5;
    var c = document.createElement("canvas");
    c.width = cols * cw;
    c.height = rows * ch;
    var g = c.getContext("2d");
    var wall = pick(WALLS);
    g.fillStyle = wall;
    g.fillRect(0, 0, c.width, c.height);
    var i;
    for (i = 0; i < 90; i++) {
      g.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.18)";
      g.fillRect((Math.random() * c.width) | 0, (Math.random() * c.height) | 0, 1, 1);
    }
    var litChance = 0.4 + Math.random() * 0.38;
    var coolBias = Math.random();
    var y;
    var x;
    for (y = 0; y < rows; y++) {
      if (y === 0 && Math.random() < 0.22) {
        g.fillStyle = pick(["#1a3048", "#3a2010", "#102818", "#2a1020"]);
        g.fillRect(0, 0, c.width, ch);
        continue;
      }
      for (x = 0; x < cols; x++) {
        var wx = x * cw + 1;
        var wy = y * ch + 1;
        var on = Math.random() < litChance && Math.random() > 0.08;
        if (!on) {
          g.fillStyle = Math.random() > 0.5 ? "#06060a" : "#08080e";
          g.fillRect(wx, wy, cw - 2, ch - 2);
          continue;
        }
        var pal = coolBias > 0.72 ? COOL : coolBias < 0.12 ? TV : WARM;
        if (Math.random() < 0.08) pal = TV;
        if (Math.random() < 0.04) pal = COOL;
        var hex = pick(pal);
        var dim = 0.55 + Math.random() * 0.45;
        var r = parseInt(hex.slice(1, 3), 16);
        var gv = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        g.fillStyle =
          "rgb(" +
          ((r * dim) | 0) +
          "," +
          ((gv * dim) | 0) +
          "," +
          ((b * dim) | 0) +
          ")";
        g.fillRect(wx, wy, cw - 2, ch - 2);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  var windowPool = [];
  var pi;
  for (pi = 0; pi < N_TEX; pi++) windowPool.push(makeWindowTexture());

  var roofMats = [
    new THREE.MeshLambertMaterial({ color: 0x0a0a10 }),
    new THREE.MeshLambertMaterial({ color: 0x0c0e14 }),
    new THREE.MeshLambertMaterial({ color: 0x100e0c }),
    new THREE.MeshLambertMaterial({ color: 0x0a1014 }),
  ];
  var hvacMat = new THREE.MeshLambertMaterial({ color: 0x16161c });
  var mastMat = new THREE.MeshLambertMaterial({ color: 0x2a2a32 });

  function wallMaterial(w, h) {
    var tex = pick(windowPool).clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    var winW = 1.15;
    var winH = 1.55;
    tex.repeat.set(Math.max(0.35, w / winW / 8), Math.max(0.4, h / winH / 16));
    tex.offset.set(Math.random(), Math.random());
    tex.needsUpdate = true;
    return new THREE.MeshLambertMaterial({
      color: 0x3a3a46,
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 1.05 + Math.random() * 0.25,
    });
  }

  function faceMats(wall, roof) {
    return [wall, wall, roof, roof, wall, wall];
  }

  var bboxes = [];
  var pulseMats = [];
  var antennas = [];

  function addBox(x, y, z, w, h, d, mats) {
    var mesh = new THREE.Mesh(boxGeo, mats);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    scene.add(mesh);
    return mesh;
  }

  function addBuilding(cx, cz, w, d, h) {
    var wall = wallMaterial(w, h);
    var roof = pick(roofMats);
    if (Math.random() < 0.35) pulseMats.push(wall);
    addBox(cx, h * 0.5, cz, w, h, d, faceMats(wall, roof));
    bboxes.push({
      minx: cx - w * 0.5 - 1.2,
      maxx: cx + w * 0.5 + 1.2,
      maxy: h,
      minz: cz - d * 0.5 - 1.2,
      maxz: cz + d * 0.5 + 1.2,
    });

    if (h > 18 && Math.random() < 0.55) {
      var hw = w * (0.28 + Math.random() * 0.22);
      var hd = d * (0.32 + Math.random() * 0.22);
      var hh = 0.6 + Math.random() * 1.1;
      addBox(
        cx + rand(-w * 0.2, w * 0.2),
        h + hh * 0.5,
        cz + rand(-d * 0.2, d * 0.2),
        hw,
        hh,
        hd,
        hvacMat
      );
    }

    var topH = h;
    if (h > 26 && Math.random() < 0.48) {
      var sw = w * (0.42 + Math.random() * 0.28);
      var sd = d * (0.42 + Math.random() * 0.28);
      var sh = h * (0.18 + Math.random() * 0.22);
      var swall = wallMaterial(sw, sh);
      addBox(cx, h + sh * 0.5, cz, sw, sh, sd, faceMats(swall, roof));
      topH = h + sh;
      bboxes[bboxes.length - 1].maxy = topH;
      bboxes.push({
        minx: cx - sw * 0.5 - 0.8,
        maxx: cx + sw * 0.5 + 0.8,
        maxy: topH,
        minz: cz - sd * 0.5 - 0.8,
        maxz: cz + sd * 0.5 + 0.8,
      });
    }

    if (topH > 22 && Math.random() < 0.32) {
      var mastH = 6 + Math.random() * 14;
      addBox(cx, topH + mastH * 0.5, cz, 0.18, mastH, 0.18, mastMat);
      antennas.push({
        x: cx,
        y: topH + mastH + 0.4,
        z: cz,
        phase: Math.random() * Math.PI * 2,
        cool: Math.random() < 0.18,
      });
    }
  }

  (function buildCity() {
    var ix;
    var iz;
    for (iz = 0; iz < N_LOTS; iz++) {
      for (ix = 0; ix < N_LOTS; ix++) {
        if (Math.random() < 0.11) continue;
        var x0 = -HALF + ix * CELL + STREET * 0.5 + 0.7;
        var x1 = -HALF + (ix + 1) * CELL - STREET * 0.5 - 0.7;
        var z0 = -HALF + iz * CELL + STREET * 0.5 + 0.7;
        var z1 = -HALF + (iz + 1) * CELL - STREET * 0.5 - 0.7;
        var mx = (x0 + x1) * 0.5;
        var mz = (z0 + z1) * 0.5;
        var dist = Math.hypot(mx, mz) / (HALF * 0.92);
        var core = clamp(1 - dist, 0, 1);
        var n = Math.random() < 0.3 + core * 0.15 ? 2 : 1;
        var k;
        for (k = 0; k < n; k++) {
          var availW = x1 - x0;
          var availD = z1 - z0;
          var w = clamp(rand(3.4, availW * (n === 1 ? 0.92 : 0.46)), 3.2, availW - 0.4);
          var d = clamp(rand(3.4, availD * (n === 1 ? 0.92 : 0.7)), 3.2, availD - 0.4);
          var bx =
            n === 1
              ? lerp(x0 + w * 0.5, x1 - w * 0.5, Math.random())
              : k === 0
                ? x0 + w * 0.5
                : x1 - w * 0.5;
          var bz = lerp(z0 + d * 0.5, z1 - d * 0.5, Math.random());
          var h =
            5 +
            Math.pow(Math.random(), 0.55) * (8 + core * 22) +
            core * core * MAX_H * (0.35 + Math.random() * 0.65);
          if (core > 0.72 && Math.random() < 0.12) h += 18 + Math.random() * 22;
          h = Math.max(5.5, h);
          addBuilding(bx, bz, w, d, h);
        }
      }
    }
    addBuilding(CELL * 0.4, -CELL * 0.2, 9.5, 8.2, MAX_H * 1.15);
    addBuilding(-CELL * 1.1, CELL * 0.8, 7.4, 7.4, MAX_H * 0.92);
    addBuilding(CELL * 1.6, CELL * 1.3, 6.2, 8.8, MAX_H * 0.78);
  })();

  (function addGround() {
    var size = 512;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    g.fillStyle = "#07070c";
    g.fillRect(0, 0, size, size);
    function w2p(v) {
      return ((v + SPAN * 0.5) / SPAN) * size;
    }
    var streetW = (STREET / SPAN) * size;
    g.fillStyle = "#0c0b10";
    var i;
    for (i = 0; i <= N_LOTS; i++) {
      var x = w2p(-HALF + i * CELL) - streetW * 0.5;
      var z = w2p(-HALF + i * CELL) - streetW * 0.5;
      g.fillRect(x, 0, streetW, size);
      g.fillRect(0, z, size, streetW);
    }
    g.strokeStyle = "rgba(90, 78, 40, 0.18)";
    g.lineWidth = 1;
    for (i = 0; i <= N_LOTS; i++) {
      var cx = w2p(-HALF + i * CELL);
      var cz = w2p(-HALF + i * CELL);
      g.beginPath();
      g.moveTo(cx, 0);
      g.lineTo(cx, size);
      g.stroke();
      g.beginPath();
      g.moveTo(0, cz);
      g.lineTo(size, cz);
      g.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(SPAN, SPAN),
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex })
    );
    ground.rotation.x = -Math.PI * 0.5;
    ground.position.y = 0;
    scene.add(ground);

    var glowC = document.createElement("canvas");
    glowC.width = glowC.height = 256;
    var gg = glowC.getContext("2d");
    var grd = gg.createRadialGradient(128, 128, 8, 128, 128, 128);
    grd.addColorStop(0, "rgba(90, 70, 36, 0.42)");
    grd.addColorStop(0.45, "rgba(40, 36, 60, 0.14)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    gg.fillStyle = grd;
    gg.fillRect(0, 0, 256, 256);
    var glowMap = new THREE.CanvasTexture(glowC);
    glowMap.needsUpdate = true;
    var haze = new THREE.Mesh(
      new THREE.PlaneGeometry(SPAN * 1.15, SPAN * 1.15),
      new THREE.MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    haze.rotation.x = -Math.PI * 0.5;
    haze.position.y = 0.04;
    scene.add(haze);
  })();

  (function addStars() {
    var pos = new Float32Array(N_STARS * 3);
    var col = new Float32Array(N_STARS * 3);
    var i;
    for (i = 0; i < N_STARS; i++) {
      var th = Math.random() * Math.PI * 2;
      var ph = 0.12 + Math.random() * 1.15;
      var r = 280 + Math.random() * 160;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = 30 + r * Math.cos(ph) * 0.55;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      var b = 0.22 + Math.random() * 0.45;
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
          size: 1.4,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          sizeAttenuation: true,
          fog: false,
        })
      )
    );
  })();

  (function addMoon() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,252,240,1)");
    grd.addColorStop(0.28, "rgba(230,232,240,0.85)");
    grd.addColorStop(0.5, "rgba(180,190,220,0.18)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    var moon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    moon.position.set(-160, 78, -210);
    moon.scale.set(28, 28, 1);
    scene.add(moon);
  })();

  var lampPos;
  var lampCol;
  var lampGeo;
  (function addStreetLamps() {
    var pts = [];
    var i;
    var j;
    function streetAt(n) {
      return -HALF + n * CELL;
    }
    for (i = 0; i <= N_LOTS; i++) {
      for (j = 0; j <= N_LOTS; j++) {
        pts.push(streetAt(i), 0.55, streetAt(j));
      }
      for (j = 0; j < N_LOTS; j++) {
        var mid = -HALF + j * CELL + CELL * 0.5;
        pts.push(streetAt(i) + STREET * 0.28, 0.5, mid);
        pts.push(mid, 0.5, streetAt(i) + STREET * 0.28);
      }
    }
    var n = pts.length / 3;
    lampPos = new Float32Array(pts);
    lampCol = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      lampCol[i * 3] = 1;
      lampCol[i * 3 + 1] = 0.72 + Math.random() * 0.12;
      lampCol[i * 3 + 2] = 0.32 + Math.random() * 0.12;
    }
    lampGeo = new THREE.BufferGeometry();
    lampGeo.setAttribute("position", new THREE.BufferAttribute(lampPos, 3));
    lampGeo.setAttribute("color", new THREE.BufferAttribute(lampCol, 3));
    scene.add(
      new THREE.Points(
        lampGeo,
        new THREE.PointsMaterial({
          map: glowTex,
          size: 2.35,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          sizeAttenuation: true,
        })
      )
    );
  })();

  var cars = [];
  var carPos;
  var carCol;
  var carGeo;
  (function addCars() {
    var i;
    for (i = 0; i < N_CARS; i++) {
      var alongX = Math.random() < 0.5;
      var streetI = (Math.random() * (N_LOTS + 1)) | 0;
      var fixed = -HALF + streetI * CELL + (Math.random() < 0.5 ? -0.9 : 0.9);
      var dir = Math.random() < 0.5 ? 1 : -1;
      var warm = Math.random() < 0.7;
      cars.push({
        alongX: alongX,
        fixed: fixed,
        pos: rand(-HALF, HALF),
        speed: dir * rand(7, 16) * (reduced ? 0.4 : 1),
        r: warm ? 1 : 0.95,
        g: warm ? 0.82 : 0.18,
        b: warm ? 0.42 : 0.12,
      });
    }
    carPos = new Float32Array(N_CARS * 3);
    carCol = new Float32Array(N_CARS * 3);
    carGeo = new THREE.BufferGeometry();
    carGeo.setAttribute("position", new THREE.BufferAttribute(carPos, 3));
    carGeo.setAttribute("color", new THREE.BufferAttribute(carCol, 3));
    scene.add(
      new THREE.Points(
        carGeo,
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
  })();

  var antPos = new Float32Array(Math.max(1, antennas.length) * 3);
  var antCol = new Float32Array(Math.max(1, antennas.length) * 3);
  var antGeo = new THREE.BufferGeometry();
  antGeo.setAttribute("position", new THREE.BufferAttribute(antPos, 3));
  antGeo.setAttribute("color", new THREE.BufferAttribute(antCol, 3));
  var antPoints = new THREE.Points(
    antGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 2.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(antPoints);

  function clearanceY(x, z) {
    var y = 7;
    var i;
    for (i = 0; i < bboxes.length; i++) {
      var b = bboxes[i];
      if (x > b.minx && x < b.maxx && z > b.minz && z < b.maxz) {
        if (b.maxy + 5 > y) y = b.maxy + 5;
      }
    }
    return y;
  }

  function samplePath(t) {
    var a = t * 0.19;
    var r = HALF * 0.38 + HALF * 0.2 * Math.sin(t * 0.071);
    var x = Math.cos(a) * r + Math.cos(a * 1.63 + 0.5) * (CELL * 2.6);
    var z = Math.sin(a * 0.88) * r + Math.sin(a * 1.27 + 1.2) * (CELL * 2.1);
    var y = 24 + 18 * (0.5 + 0.5 * Math.sin(t * 0.083)) + 7 * Math.sin(t * 0.17);
    return { x: x, y: y, z: z };
  }

  var camX = 0;
  var camY = 24;
  var camZ = HALF * 0.4;
  var lookX = 0;
  var lookY = 10;
  var lookZ = 0;
  var initedCam = false;

  function updateCars(dt) {
    var i;
    var wrap = HALF + CELL;
    for (i = 0; i < cars.length; i++) {
      var c = cars[i];
      c.pos += c.speed * dt;
      if (c.pos > wrap) c.pos = -wrap;
      if (c.pos < -wrap) c.pos = wrap;
      if (c.alongX) {
        carPos[i * 3] = c.pos;
        carPos[i * 3 + 1] = 0.42;
        carPos[i * 3 + 2] = c.fixed;
      } else {
        carPos[i * 3] = c.fixed;
        carPos[i * 3 + 1] = 0.42;
        carPos[i * 3 + 2] = c.pos;
      }
      carCol[i * 3] = c.r;
      carCol[i * 3 + 1] = c.g;
      carCol[i * 3 + 2] = c.b;
    }
    carGeo.attributes.position.needsUpdate = true;
    carGeo.attributes.color.needsUpdate = true;
  }

  function updateAntennas(t) {
    var i;
    for (i = 0; i < antennas.length; i++) {
      var a = antennas[i];
      antPos[i * 3] = a.x;
      antPos[i * 3 + 1] = a.y;
      antPos[i * 3 + 2] = a.z;
      var on = Math.sin(t * 3.1 + a.phase) > (reduced ? -0.15 : -0.35);
      if (a.cool) {
        antCol[i * 3] = on ? 0.45 : 0.05;
        antCol[i * 3 + 1] = on ? 0.85 : 0.08;
        antCol[i * 3 + 2] = on ? 1 : 0.12;
      } else {
        antCol[i * 3] = on ? 1 : 0.12;
        antCol[i * 3 + 1] = on ? 0.18 : 0.03;
        antCol[i * 3 + 2] = on ? 0.1 : 0.02;
      }
    }
    antGeo.attributes.position.needsUpdate = true;
    antGeo.attributes.color.needsUpdate = true;
  }

  var last = performance.now();
  var elapsed = 0;
  var raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt;

    updateCars(dt);
    updateAntennas(elapsed);

    var i;
    for (i = 0; i < pulseMats.length; i++) {
      pulseMats[i].emissiveIntensity = 1.02 + 0.14 * Math.sin(elapsed * 2.4 + i * 0.37);
    }

    var t = elapsed * CAM_SPEED;
    var p0 = samplePath(t);
    var p1 = samplePath(t + 0.42);
    var clear0 = clearanceY(p0.x, p0.z);
    var clear1 = clearanceY(p1.x, p1.z);
    var targetY = Math.max(p0.y, clear0, clear1 * 0.9);
    var targetX = p0.x;
    var targetZ = p0.z;
    if (!initedCam) {
      camX = targetX;
      camY = targetY;
      camZ = targetZ;
      lookX = p1.x;
      lookY = Math.max(4, p1.y - 16);
      lookZ = p1.z;
      initedCam = true;
    } else {
      var k = 1 - Math.exp(-dt * 1.65);
      camX += (targetX - camX) * k;
      camY += (targetY - camY) * k;
      camZ += (targetZ - camZ) * k;
      lookX += (p1.x - lookX) * k;
      lookY += (Math.max(4, p1.y - 16) - lookY) * k;
      lookZ += (p1.z - lookZ) * k;
    }
    camera.position.set(camX, camY, camZ);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookX, lookY, lookZ);

    var vx = p1.x - p0.x;
    var vz = p1.z - p0.z;
    var p2 = samplePath(t + 0.85);
    var turn = Math.atan2(p2.x - p1.x, p2.z - p1.z) - Math.atan2(vx, vz);
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    var bank = clamp(turn * 1.6, -0.16, 0.16);
    var yaw = Math.atan2(vx, vz);
    camera.up.set(Math.sin(bank) * Math.cos(yaw), Math.cos(bank), Math.sin(bank) * Math.sin(yaw));

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

  updateCars(0);
  updateAntennas(0);
  var pStart = samplePath(0);
  camera.position.set(pStart.x, Math.max(pStart.y, clearanceY(pStart.x, pStart.z)), pStart.z);
  camera.lookAt(0, 6, 0);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
