/* Original remake: Windows XP-era OpenGL showroom drift. Not derived from
   maze-backrooms or rss-glx. Yellow plate, partitions, fluorescent troffers. */
(function () {
  "use strict";

  var FOG = 0xc6b06c;
  var PLATE_W = 38;
  var PLATE_D = 30;
  var CEILING = 2.7;
  var STUB_H = 1.18;
  var THICK = 0.14;
  var TILE = 2.44;
  var MIN_SPAN = 6.4;
  var MAX_DEPTH = 4;
  var EYE = 1.58;
  var RADIUS = 0.28;
  var SPEED = 1.15;
  var UV_U = 1.15;

  var reduced = false;
  var coarse = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
  } catch (e) {
    coarse = window.innerWidth < 720;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function frand(rng, lo, hi) {
    return lo + rng() * (hi - lo);
  }
  function irand(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  function wallAabb(w) {
    if (w.axis === "x") {
      return {
        minX: w.x - w.length * 0.5,
        maxX: w.x + w.length * 0.5,
        minZ: w.z - w.thickness * 0.5,
        maxZ: w.z + w.thickness * 0.5,
      };
    }
    return {
      minX: w.x - w.thickness * 0.5,
      maxX: w.x + w.thickness * 0.5,
      minZ: w.z - w.length * 0.5,
      maxZ: w.z + w.length * 0.5,
    };
  }
  function circleHits(px, pz, r, b) {
    var qx = Math.max(b.minX, Math.min(px, b.maxX));
    var qz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    var dx = px - qx;
    var dz = pz - qz;
    return dx * dx + dz * dz < r * r;
  }
  function emit(walls, x, z, length, axis, height, paper) {
    if (length < 0.85) return;
    walls.push({ x: x, z: z, length: length, thickness: THICK, height: height, axis: axis, paper: paper });
  }
  function paperAt(x, z, rx, rz) {
    var dx = x - rx;
    var dz = z - rz;
    if (dx * dx + dz * dz < 7.5 * 7.5) return 2;
    return Math.abs(Math.sin(x * 0.21 + z * 0.17)) > 0.62 ? 1 : 0;
  }
  function cut(walls, rng, x0, z0, x1, z1, depth, rx, rz) {
    var w = x1 - x0;
    var d = z1 - z0;
    if (Math.min(w, d) < MIN_SPAN || depth >= MAX_DEPTH || rng() < 0.2 + depth * 0.2) return;
    if (w >= d) {
      var x = x0 + w * frand(rng, 0.34, 0.66);
      var gap = frand(rng, 2.6, 6.2);
      var gapC = z0 + d * frand(rng, 0.22, 0.78);
      var gap0 = Math.max(z0 + 0.35, gapC - gap * 0.5);
      var gap1 = Math.min(z1 - 0.35, gapC + gap * 0.5);
      var paper = paperAt(x, (z0 + z1) * 0.5, rx, rz);
      var h = rng() < 0.34 ? STUB_H : CEILING;
      emit(walls, x, (z0 + gap0) * 0.5, gap0 - z0, "z", h, paper);
      emit(walls, x, (gap1 + z1) * 0.5, z1 - gap1, "z", h, paper);
      cut(walls, rng, x0, z0, x, z1, depth + 1, rx, rz);
      cut(walls, rng, x, z0, x1, z1, depth + 1, rx, rz);
    } else {
      var z = z0 + d * frand(rng, 0.34, 0.66);
      var gap = frand(rng, 2.6, 6.2);
      var gapC = x0 + w * frand(rng, 0.22, 0.78);
      var gap0 = Math.max(x0 + 0.35, gapC - gap * 0.5);
      var gap1 = Math.min(x1 - 0.35, gapC + gap * 0.5);
      var paper = paperAt((x0 + x1) * 0.5, z, rx, rz);
      var h = rng() < 0.34 ? STUB_H : CEILING;
      emit(walls, (x0 + gap0) * 0.5, z, gap0 - x0, "x", h, paper);
      emit(walls, (gap1 + x1) * 0.5, z, x1 - gap1, "x", h, paper);
      cut(walls, rng, x0, z0, x1, z, depth + 1, rx, rz);
      cut(walls, rng, x0, z, x1, z1, depth + 1, rx, rz);
    }
  }
  function generatePlate(seed) {
    var rng = mulberry32(seed);
    var walls = [];
    var hw = PLATE_W * 0.5;
    var hd = PLATE_D * 0.5;
    var rx = frand(rng, -hw * 0.45, hw * 0.45);
    var rz = frand(rng, -hd * 0.45, hd * 0.45);
    var sides = [
      { axis: "x", x: 0, z: -hd, length: PLATE_W },
      { axis: "x", x: 0, z: hd, length: PLATE_W },
      { axis: "z", x: -hw, z: 0, length: PLATE_D },
      { axis: "z", x: hw, z: 0, length: PLATE_D },
    ];
    for (var s = 0; s < sides.length; s++) {
      var side = sides[s];
      var gap = frand(rng, 4.4, 8.5);
      var along = side.axis === "x" ? side.x : side.z;
      var span = side.length;
      var gapC = along + frand(rng, -span * 0.28, span * 0.28);
      var a0 = along - span * 0.5;
      var a1 = along + span * 0.5;
      var g0 = Math.max(a0 + 0.8, gapC - gap * 0.5);
      var g1 = Math.min(a1 - 0.8, gapC + gap * 0.5);
      var p = paperAt(side.x, side.z, rx, rz);
      if (side.axis === "x") {
        emit(walls, (a0 + g0) * 0.5, side.z, g0 - a0, "x", CEILING, p);
        emit(walls, (g1 + a1) * 0.5, side.z, a1 - g1, "x", CEILING, p);
      } else {
        emit(walls, side.x, (a0 + g0) * 0.5, g0 - a0, "z", CEILING, p);
        emit(walls, side.x, (g1 + a1) * 0.5, a1 - g1, "z", CEILING, p);
      }
    }
    cut(walls, rng, -hw + 0.2, -hd + 0.2, hw - 0.2, hd - 0.2, 0, rx, rz);
    var i;
    for (i = 0; i < irand(rng, 7, 12); i++) {
      emit(walls, frand(rng, -hw + 2, hw - 2), frand(rng, -hd + 2, hd - 2), frand(rng, 1.4, 3.4), rng() < 0.5 ? "x" : "z", STUB_H, 0);
    }
    var columns = [];
    for (i = 0; i < irand(rng, 4, 7); i++) {
      columns.push({ x: frand(rng, -hw + 3, hw - 3), z: frand(rng, -hd + 3, hd - 3), size: frand(rng, 0.28, 0.38) });
    }
    var fixtures = [];
    var ox = -Math.floor(PLATE_W / TILE) * 0.5 * TILE + TILE * 0.5;
    var oz = -Math.floor(PLATE_D / TILE) * 0.5 * TILE + TILE * 0.5;
    var nx = Math.floor(PLATE_W / TILE);
    var nz = Math.floor(PLATE_D / TILE);
    var iz, ix;
    for (iz = 0; iz < nz; iz++) {
      for (ix = 0; ix < nx; ix++) {
        var fx = ox + ix * TILE;
        var fz = oz + iz * TILE;
        var missing = rng() < 0.045;
        fixtures.push({ x: fx, z: fz, live: !missing && rng() > 0.11, missing: missing });
      }
    }
    return { walls: walls, columns: columns, fixtures: fixtures };
  }
  function allAabbs(plate) {
    var boxes = plate.walls.map(wallAabb);
    for (var c = 0; c < plate.columns.length; c++) {
      var col = plate.columns[c];
      var h = col.size * 0.5;
      boxes.push({ minX: col.x - h, maxX: col.x + h, minZ: col.z - h, maxZ: col.z + h });
    }
    return boxes;
  }
  function isOpen(px, pz, r, boxes) {
    var hw = PLATE_W * 0.5 - 0.45;
    var hd = PLATE_D * 0.5 - 0.45;
    if (px < -hw + r || px > hw - r || pz < -hd + r || pz > hd - r) return false;
    for (var i = 0; i < boxes.length; i++) if (circleHits(px, pz, r, boxes[i])) return false;
    return true;
  }
  function clearance(px, pz, boxes) {
    var m = 99;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      var qx = Math.max(b.minX, Math.min(px, b.maxX));
      var qz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      m = Math.min(m, Math.hypot(px - qx, pz - qz));
    }
    var hw = PLATE_W * 0.5 - 0.45;
    var hd = PLATE_D * 0.5 - 0.45;
    return Math.min(m, hw - Math.abs(px), hd - Math.abs(pz));
  }
  function slideMove(px, pz, dx, dz, r, boxes) {
    var nx = px + dx;
    var nz = pz;
    if (!isOpen(nx, nz, r, boxes)) nx = px;
    nz = pz + dz;
    if (!isOpen(nx, nz, r, boxes)) nz = pz;
    return { x: nx, z: nz };
  }
  function viewLength(x, z, yaw, boxes, max) {
    max = max || 16;
    var step = 0.4;
    var fx = -Math.sin(yaw);
    var fz = -Math.cos(yaw);
    var d = 0;
    while (d < max) {
      d += step;
      if (!isOpen(x + fx * d, z + fz * d, 0.16, boxes)) return d - step;
    }
    return max;
  }

  function canvas2d(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    return { c: c, ctx: c.getContext("2d") };
  }
  function grain(ctx, size, amp) {
    var img = ctx.getImageData(0, 0, size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * amp;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.92));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.7));
    }
    ctx.putImageData(img, 0, 0);
  }
  function tex(c, rx, ry) {
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    t.minFilter = THREE.LinearMipMapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }
  function bumpFrom(c) {
    var size = c.width;
    var b = canvas2d(size);
    b.ctx.drawImage(c, 0, 0);
    var img = b.ctx.getImageData(0, 0, size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var l = (d[i] * 0.35 + d[i + 1] * 0.45 + d[i + 2] * 0.2) | 0;
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    b.ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(b.c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  function arrowMotif(ctx, x, y, s, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.bezierCurveTo(x + s * 0.85, y - s * 0.55, x + s * 0.75, y + s * 0.05, x + s * 0.28, y + s * 0.62);
    ctx.lineTo(x, y + s * 0.18);
    ctx.lineTo(x - s * 0.28, y + s * 0.62);
    ctx.bezierCurveTo(x - s * 0.75, y + s * 0.05, x - s * 0.85, y - s * 0.55, x, y - s);
    ctx.fill();
  }
  function makeWallpaper(kind) {
    var size = 512;
    var o = canvas2d(size);
    var ctx = o.ctx;
    var row, col, oy, ox;
    if (kind === 2) {
      ctx.fillStyle = "#8a4740";
      ctx.fillRect(0, 0, size, size);
      for (row = -1; row < size / 72 + 2; row++) {
        oy = row * 72;
        ox = (row % 2) * 36;
        for (col = -1; col < size / 72 + 2; col++) arrowMotif(ctx, ox + col * 72, oy, 26, row % 3 === 0 ? "#9a5248" : "#7a3e38");
      }
    } else if (kind === 1) {
      ctx.fillStyle = "#d7c17a";
      ctx.fillRect(0, 0, size, size);
      for (row = -1; row < size / 84 + 2; row++) {
        oy = row * 84 * 0.86;
        ox = (row % 2) * 42;
        for (col = -1; col < size / 84 + 2; col++) arrowMotif(ctx, ox + col * 84, oy, 30, "#c7b068");
      }
    } else {
      ctx.fillStyle = "#e1c86f";
      ctx.fillRect(0, 0, size, size);
      for (row = -1; row < size / 88 + 3; row++) {
        oy = row * 88 * 0.84;
        ox = (row % 2) * 44;
        for (col = -1; col < size / 88 + 3; col++) {
          arrowMotif(ctx, ox + col * 88, oy, 32, (row + col) % 2 === 0 ? "#c9b05c" : "#d4bc66");
        }
      }
    }
    grain(ctx, size, 14);
    var map = tex(o.c, 1, 1);
    var bump = bumpFrom(o.c);
    return { map: map, bump: bump };
  }
  function makeCarpet() {
    var size = 256;
    var o = canvas2d(size);
    var img = o.ctx.createImageData(size, size);
    var d = img.data;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var i = (y * size + x) * 4;
        var pile = ((x * 17 + y * 13) ^ (x * 7 + y * 31)) & 15;
        var n = pile - 8;
        d[i] = 196 + n;
        d[i + 1] = 168 + n * 0.8;
        d[i + 2] = 86 + n * 0.4;
        d[i + 3] = 255;
      }
    }
    o.ctx.putImageData(img, 0, 0);
    grain(o.ctx, size, 10);
    var map = tex(o.c, 22, 17);
    var bump = bumpFrom(o.c);
    bump.repeat.copy(map.repeat);
    return { map: map, bump: bump };
  }
  function makeCeiling() {
    var size = 256;
    var o = canvas2d(size);
    o.ctx.fillStyle = "#ebe4d2";
    o.ctx.fillRect(0, 0, size, size);
    o.ctx.fillStyle = "#d9d1bc";
    for (var y = 18; y < size - 12; y += 14) {
      for (var x = 18; x < size - 12; x += 14) {
        o.ctx.beginPath();
        o.ctx.arc(x, y, 1.35, 0, Math.PI * 2);
        o.ctx.fill();
      }
    }
    o.ctx.strokeStyle = "#c4bba6";
    o.ctx.lineWidth = 18;
    o.ctx.strokeRect(9, 9, size - 18, size - 18);
    grain(o.ctx, size, 8);
    var map = tex(o.c, PLATE_W / 1.22, PLATE_D / 1.22);
    var bump = bumpFrom(o.c);
    bump.repeat.copy(map.repeat);
    return { map: map, bump: bump };
  }

  function fallback2d() {
    var canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
    resize();
    window.addEventListener("resize", resize);
    var t = 0;
    var last = performance.now();
    function draw(now) {
      requestAnimationFrame(draw);
      t += Math.min(0.05, (now - last) * 0.001);
      last = now;
      var w = canvas.width;
      var h = canvas.height;
      var yaw = t * 0.08;
      var horizon = h * 0.42;
      ctx.fillStyle = "#c6b06c";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e4dcc8";
      ctx.fillRect(0, 0, w, horizon);
      ctx.fillStyle = "#c4b06a";
      ctx.fillRect(0, horizon, w, h - horizon);
      var vx = w * 0.5 + Math.sin(yaw * 0.7) * w * 0.08;
      ctx.fillStyle = "#d6c47c";
      ctx.fillRect(0, horizon * 0.15, w * 0.22, horizon * 0.85);
      ctx.fillRect(w * 0.78, horizon * 0.2, w * 0.22, horizon * 0.8);
      ctx.fillStyle = "#fff4c8";
      for (var i = 0; i < 6; i++) ctx.fillRect(vx - 80 + i * 32, horizon * 0.12, 22, 8);
    }
    requestAnimationFrame(draw);
  }

  if (typeof THREE === "undefined") {
    fallback2d();
    return;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !coarse, alpha: false, preserveDrawingBuffer: true });
    if (!renderer.getContext()) throw new Error("no gl");
  } catch (e) {
    fallback2d();
    return;
  }

  renderer.setClearColor(FOG, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, reduced ? 0.032 : 0.042);

  var camera = new THREE.PerspectiveCamera(reduced ? 62 : 68, window.innerWidth / window.innerHeight, 0.08, 48);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xe2d19a, 0.42));
  scene.add(new THREE.HemisphereLight(0xfff4d2, 0x8a7340, 0.48));
  var fill = new THREE.PointLight(0xfff1c8, 0.35, 7, 2);
  fill.position.set(0.1, 0.25, 0.15);
  camera.add(fill);

  var plate = generatePlate((Math.random() * 0xffffffff) >>> 0);
  var boxes = allAabbs(plate);
  var papers = [makeWallpaper(0), makeWallpaper(1), makeWallpaper(2)];
  var carpet = makeCarpet();
  var ceilTex = makeCeiling();

  var floor = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(PLATE_W, PLATE_D),
    new THREE.MeshPhongMaterial({ map: carpet.map, bumpMap: carpet.bump, bumpScale: 0.035, color: 0xf0dc9a, shininess: 3 })
  );
  floor.rotation.x = -Math.PI * 0.5;
  scene.add(floor);

  var ceiling = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(PLATE_W, PLATE_D),
    new THREE.MeshPhongMaterial({ map: ceilTex.map, bumpMap: ceilTex.bump, bumpScale: 0.06, color: 0xf0eadc, shininess: 14 })
  );
  ceiling.rotation.x = Math.PI * 0.5;
  ceiling.position.y = CEILING;
  scene.add(ceiling);

  function applyWorldUV(geo, ox, oz) {
    var pos = geo.attributes.position;
    var nrm = geo.attributes.normal;
    var uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i) + ox;
      var y = pos.getY(i);
      var z = pos.getZ(i) + oz;
      var nx = nrm.getX(i);
      var ny = nrm.getY(i);
      if (Math.abs(ny) > 0.5) uv.setXY(i, x / UV_U, z / UV_U);
      else if (Math.abs(nx) > 0.5) uv.setXY(i, z / UV_U, y / CEILING);
      else uv.setXY(i, x / UV_U, y / CEILING);
    }
    uv.needsUpdate = true;
  }

  var mats = papers.map(function (p) {
    return new THREE.MeshPhongMaterial({
      map: p.map,
      bumpMap: p.bump,
      bumpScale: 0.045,
      color: 0xffffff,
      shininess: 22,
      specular: 0x3a2e18,
    });
  });
  var railMat = new THREE.MeshPhongMaterial({ color: 0xc4b07a, shininess: 42 });
  var baseMat = new THREE.MeshPhongMaterial({ color: 0x8d7844, shininess: 8 });

  for (var wi = 0; wi < plate.walls.length; wi++) {
    var w = plate.walls[wi];
    var sx = w.axis === "x" ? w.length : w.thickness;
    var sz = w.axis === "x" ? w.thickness : w.length;
    var geo = new THREE.BoxBufferGeometry(sx, w.height, sz);
    applyWorldUV(geo, w.x, w.z);
    var mesh = new THREE.Mesh(geo, mats[w.paper]);
    mesh.position.set(w.x, w.height * 0.5, w.z);
    scene.add(mesh);
    var rail = new THREE.Mesh(new THREE.BoxBufferGeometry(sx + 0.01, 0.07, sz + 0.04), railMat);
    rail.position.set(w.x, 0.92, w.z);
    scene.add(rail);
    var base = new THREE.Mesh(new THREE.BoxBufferGeometry(sx + 0.01, 0.1, sz + 0.03), baseMat);
    base.position.set(w.x, 0.05, w.z);
    scene.add(base);
  }

  var dummy = new THREE.Object3D();
  var boxGeo = new THREE.BoxBufferGeometry(1, 1, 1);
  if (plate.columns.length) {
    var colMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshPhongMaterial({ color: 0xd6c8a4, shininess: 18 }), plate.columns.length);
    plate.columns.forEach(function (c, i) {
      dummy.position.set(c.x, CEILING * 0.5, c.z);
      dummy.scale.set(c.size, CEILING, c.size);
      dummy.updateMatrix();
      colMesh.setMatrixAt(i, dummy.matrix);
    });
    colMesh.instanceMatrix.needsUpdate = true;
    scene.add(colMesh);
  }

  var liveFix = plate.fixtures.filter(function (f) { return f.live; });
  var deadFix = plate.fixtures.filter(function (f) { return !f.live && !f.missing; });
  var holes = plate.fixtures.filter(function (f) { return f.missing; });
  var shownLive = coarse ? liveFix.filter(function (_, i) { return i % 2 === 0; }) : liveFix;

  function place(list, mat, sy, y, sx, sz) {
    if (!list.length) return;
    var mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach(function (f, i) {
      dummy.position.set(f.x, y, f.z);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
  var housingMat = new THREE.MeshPhongMaterial({ color: 0xcfc6b0, shininess: 20 });
  var diffuserMat = new THREE.MeshPhongMaterial({ color: 0xfff8e4, emissive: 0xfff1c0, emissiveIntensity: 1.35, shininess: 4 });
  var deadDiff = new THREE.MeshPhongMaterial({ color: 0x9a9078, emissive: 0x1a1810, emissiveIntensity: 0.08 });
  var holeMat = new THREE.MeshPhongMaterial({ color: 0x16140f });
  place(shownLive, housingMat, 0.06, CEILING - 0.03, 1.24, 0.4);
  place(shownLive, diffuserMat, 0.025, CEILING - 0.07, 1.08, 0.26);
  var shownDead = coarse ? deadFix.filter(function (_, i) { return i % 3 === 0; }) : deadFix;
  place(shownDead, housingMat, 0.05, CEILING - 0.03, 1.24, 0.4);
  place(shownDead, deadDiff, 0.02, CEILING - 0.06, 1.08, 0.26);
  place(holes, holeMat, 0.04, CEILING + 0.08, 1.18, 1.18);

  var poolN = coarse ? 3 : 5;
  var poolLights = [];
  for (var li = 0; li < poolN; li++) {
    var l = new THREE.PointLight(0xfff3c6, 0, 8.5, 1.7);
    scene.add(l);
    poolLights.push(l);
  }

  function pickStart() {
    var best = { x: 0, z: 0, yaw: 0, score: -1 };
    for (var iz = -6; iz <= 6; iz++) {
      for (var ix = -8; ix <= 8; ix++) {
        var x = ix * 1.8;
        var z = iz * 1.8;
        if (!isOpen(x, z, RADIUS + 0.25, boxes) || clearance(x, z, boxes) < 1.1) continue;
        for (var k = 0; k < 8; k++) {
          var yaw = (k * Math.PI) / 4;
          var vis = viewLength(x, z, yaw, boxes, 16);
          var s = (vis < 5 ? vis * 0.4 : vis > 12 ? 12 : vis) + Math.min(clearance(x, z, boxes), 2.2);
          if (s > best.score) best = { x: x, z: z, yaw: yaw, score: s };
        }
      }
    }
    return best;
  }
  function pickYaw(x, z, yaw, blocked) {
    var bestYaw = yaw + Math.PI;
    var best = -1e9;
    var n = blocked ? 24 : 11;
    for (var i = 0; i < n; i++) {
      var a = blocked ? yaw + (i / n) * Math.PI * 2 : yaw + (i - (n - 1) / 2) * 0.32;
      var vis = viewLength(x, z, a, boxes, 18);
      var turn = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
      var clr = clearance(x - Math.sin(a) * 2.6, z - Math.cos(a) * 2.6, boxes);
      var sweet = vis < 3.2 ? vis * 0.2 : vis > 14 ? 14 - (vis - 14) * 0.25 : vis;
      var s = sweet + Math.min(clr, 2.5) * 2.1 - (blocked ? turn * 0.12 : turn * 0.7);
      if (s > best) {
        best = s;
        bestYaw = a;
      }
    }
    if (viewLength(x, z, bestYaw, boxes, 8) < 1.35) bestYaw = yaw + Math.PI;
    return bestYaw;
  }

  var start = pickStart();
  var x = start.x;
  var z = start.z;
  var yaw = start.yaw;
  var targetYaw = yaw;
  var bob = 0;
  var stuck = 0;
  var think = 0;
  var lightTick = 0;
  var look = new THREE.Vector3();
  camera.position.set(x, EYE, z);
  look.set(x - Math.sin(yaw) * 5, EYE - 0.08, z - Math.cos(yaw) * 5);
  camera.lookAt(look);

  function updatePools() {
    var nearest = shownLive.slice().sort(function (a, b) {
      var da = (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z);
      var db = (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z);
      return da - db;
    });
    for (var i = 0; i < poolLights.length; i++) {
      var f = nearest[i];
      if (!f) {
        poolLights[i].intensity = 0;
        continue;
      }
      poolLights[i].position.set(f.x, CEILING - 0.2, f.z);
      poolLights[i].intensity = 1.55;
    }
  }
  updatePools();

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    var ahead = viewLength(x, z, yaw, boxes, 10);
    var blocked = ahead < 3.6 || stuck > 0.16;
    think -= dt;
    if (think <= 0 || (blocked && think < 0.2)) {
      think = blocked ? 0.12 : reduced ? 1.1 : 0.4;
      targetYaw = pickYaw(x, z, yaw, blocked || reduced);
    }
    var dyaw = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
    yaw += dyaw * Math.min(1, (blocked ? 5.4 : 2.1) * dt);
    var turning = Math.abs(dyaw) > 0.55;
    var speedMul = 1;
    if (ahead < 1.5) speedMul = 0.06;
    else if (ahead < 2.6) speedMul = 0.28;
    else if (ahead < 4) speedMul = 0.62;
    if (turning && blocked) speedMul = Math.min(speedMul, 0.12);
    if (reduced) speedMul *= 0.22;
    var speed = SPEED * speedMul;
    var fx = -Math.sin(yaw);
    var fz = -Math.cos(yaw);
    var moved = slideMove(x, z, fx * speed * dt, fz * speed * dt, RADIUS, boxes);
    var dist = Math.hypot(moved.x - x, moved.z - z);
    if (dist < speed * dt * 0.2 + 0.0004) stuck += dt;
    else stuck = Math.max(0, stuck - dt * 2.4);
    x = moved.x;
    z = moved.z;
    if (stuck > 0.28) {
      targetYaw = yaw + 1.7;
      stuck = 0.05;
      think = 0.18;
    }
    bob += dt * (reduced ? 0.5 : 1.9);
    var eye = EYE + (reduced ? 0 : Math.sin(bob) * 0.016);
    camera.position.set(x, eye, z);
    look.set(x + fx * 6.5, eye - 0.07, z + fz * 6.5);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    lightTick -= dt;
    if (lightTick <= 0) {
      lightTick = 0.28;
      updatePools();
    }
    renderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
})();
