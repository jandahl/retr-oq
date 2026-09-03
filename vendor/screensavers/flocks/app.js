/* Original remake of the classic 2000s "flocks" GL eye candy.
   Colored 3D boid schools of stretched blobs weaving through a dark
   volume, with short additive wisps. Not derived from rss-glx / GPL. */
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

  var N_FLOCKS = reduced ? 2 : 4;
  var FOLLOWERS = reduced ? 16 : 40;
  var TRAIL = reduced ? 10 : 22;
  var MAX_SPEED = reduced ? 2.05 : 4.35;
  var LEAD_SPEED = MAX_SPEED * 1.18;
  var MAX_FORCE = reduced ? 5.2 : 9.5;
  var STRETCH = reduced ? 1.15 : 1.85;
  var HUE_SPEED = reduced ? 0.012 : 0.028;
  var CAM_SPEED = reduced ? 0.055 : 0.11;
  var WOBBLE = reduced ? 0.06 : 0.14;
  var SEP_R = 1.35;
  var ALI_R = 2.55;
  var COH_R = 2.95;
  var BOUND = 9.4;
  var BLOB_R = reduced ? 0.18 : 0.22;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.032);

  var camera = new THREE.PerspectiveCamera(
    54,
    window.innerWidth / window.innerHeight,
    0.1,
    220
  );
  var camRadius = 18.5;
  var camAngle = 0.4;
  camera.position.set(0, 3.4, camRadius);

  scene.add(new THREE.AmbientLight(0x1c1c2a, 1));
  var key = new THREE.DirectionalLight(0xf2f0e8, 0.62);
  key.position.set(5.5, 9.0, 6.5);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0x3a5a88, 0.28);
  fill.position.set(-7.0, -1.5, -5.0);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0x8899cc, 0.16);
  rim.position.set(0.5, 4.0, -8.0);
  scene.add(rim);

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

  function makeGlowTexture(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.18, "rgba(255,255,255,0.85)");
    grd.addColorStop(0.42, "rgba(255,220,180,0.28)");
    grd.addColorStop(0.7, "rgba(120,160,255,0.06)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128);

  var flockHues = [0.02, 0.14, 0.52, 0.78];
  if (N_FLOCKS === 2) flockHues = [0.08, 0.55];

  var flocks = [];
  var flockLights = [];
  for (var fi = 0; fi < N_FLOCKS; fi++) {
    var hue = flockHues[fi % flockHues.length];
    var rgb0 = hsv(hue, 0.75, 1);
    var light = new THREE.PointLight(
      new THREE.Color(rgb0[0], rgb0[1], rgb0[2]),
      reduced ? 0.45 : 0.72,
      16,
      2
    );
    scene.add(light);
    flockLights.push(light);
    flocks.push({
      hue: hue,
      sat: 0.7 + (fi % 3) * 0.06,
      phase: (fi / N_FLOCKS) * Math.PI * 2 + 0.17 * fi,
      freq: 0.17 + fi * 0.021,
      cx: 0,
      cy: 0,
      cz: 0,
    });
  }

  function leaderTarget(flock, t, out) {
    var p = flock.phase;
    var w = flock.freq;
    out.x =
      6.2 * Math.sin(t * w * 1.15 + p) +
      2.05 * Math.sin(t * w * 2.07 + p * 2.1);
    out.y =
      3.6 * Math.sin(t * w * 0.93 + p * 1.65) +
      1.35 * Math.cos(t * w * 1.61 + p * 0.4);
    out.z =
      6.2 * Math.cos(t * w * 1.04 + p * 0.82) +
      1.9 * Math.sin(t * w * 1.88 + p * 1.3);
  }

  var _tgt = { x: 0, y: 0, z: 0 };

  var boids = [];
  var N = 0;
  for (var f = 0; f < N_FLOCKS; f++) {
    leaderTarget(flocks[f], f * 2.5, _tgt);
    boids.push({
      x: _tgt.x + (Math.random() - 0.5) * 0.4,
      y: _tgt.y + (Math.random() - 0.5) * 0.4,
      z: _tgt.z + (Math.random() - 0.5) * 0.4,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      vz: (Math.random() - 0.5) * 0.8,
      ax: 0,
      ay: 0,
      az: 0,
      flock: f,
      leader: true,
      radius: BLOB_R * 1.38,
      phase: Math.random() * Math.PI * 2,
      wobble: 0.7 + Math.random() * 1.1,
      trail: new Float32Array(TRAIL * 3),
      filled: 0,
    });
    for (var k = 0; k < FOLLOWERS; k++) {
      var a = Math.random() * Math.PI * 2;
      var b = Math.random() * Math.PI;
      var r = 0.6 + Math.random() * 2.1;
      boids.push({
        x: _tgt.x + r * Math.sin(b) * Math.cos(a),
        y: _tgt.y + r * Math.cos(b) * 0.7,
        z: _tgt.z + r * Math.sin(b) * Math.sin(a),
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        vz: (Math.random() - 0.5) * 1.2,
        ax: 0,
        ay: 0,
        az: 0,
        flock: f,
        leader: false,
        radius: BLOB_R * (0.82 + Math.random() * 0.34),
        phase: Math.random() * Math.PI * 2,
        wobble: 0.9 + Math.random() * 1.4,
        trail: new Float32Array(TRAIL * 3),
        filled: 0,
      });
    }
  }
  N = boids.length;

  var leaders = [];
  for (var li = 0; li < N; li++) {
    if (boids[li].leader) leaders.push(boids[li]);
  }

  var blobGeo = new THREE.SphereGeometry(1, 12, 9);
  var blobMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: 0x8a8aa0,
    shininess: 52,
    emissive: 0x14141c,
    flatShading: false,
    fog: true,
  });
  var blobs = new THREE.InstancedMesh(blobGeo, blobMat, N);
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blobs.frustumCulled = false;
  scene.add(blobs);

  var dummy = new THREE.Object3D();
  var tmpColor = new THREE.Color();
  var zAxis = new THREE.Vector3(0, 0, 1);
  var dirVec = new THREE.Vector3();

  var trailCount = N * TRAIL;
  var trailPos = new Float32Array(trailCount * 3);
  var trailCol = new Float32Array(trailCount * 3);
  var trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  var trailPts = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: reduced ? 0.55 : 0.78,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(trailPts);

  var headPos = new Float32Array(N * 3);
  var headCol = new Float32Array(N * 3);
  var headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
  headGeo.setAttribute("color", new THREE.BufferAttribute(headCol, 3));
  var headPts = new THREE.Points(
    headGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: reduced ? 1.35 : 1.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(headPts);

  var spineIdx = [];
  for (var sp = 0; sp < N; sp++) {
    var sb = sp * TRAIL;
    for (var st = 0; st < TRAIL - 1; st++) {
      spineIdx.push(sb + st, sb + st + 1);
    }
  }
  var spineGeo = new THREE.BufferGeometry();
  spineGeo.setAttribute("position", trailGeo.getAttribute("position"));
  spineGeo.setAttribute("color", trailGeo.getAttribute("color"));
  spineGeo.setIndex(spineIdx);
  scene.add(
    new THREE.LineSegments(
      spineGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      })
    )
  );

  function limitVec(x, y, z, max) {
    var m = Math.hypot(x, y, z);
    if (m > max && m > 1e-8) {
      var s = max / m;
      return [x * s, y * s, z * s];
    }
    return [x, y, z];
  }

  function steerToward(b, tx, ty, tz, maxSpd) {
    var dx = tx - b.x;
    var dy = ty - b.y;
    var dz = tz - b.z;
    var d = Math.hypot(dx, dy, dz) || 1;
    var desired = maxSpd;
    if (d < 2.4) desired *= d / 2.4;
    dx = (dx / d) * desired - b.vx;
    dy = (dy / d) * desired - b.vy;
    dz = (dz / d) * desired - b.vz;
    return limitVec(dx, dy, dz, MAX_FORCE);
  }

  function confine(b) {
    var d = Math.hypot(b.x, b.y, b.z);
    var inner = BOUND * 0.68;
    if (d > inner) {
      var t = (d - inner) / (BOUND - inner);
      t = t * t;
      var inv = 1 / (d || 1);
      return [-b.x * inv * t * 11, -b.y * inv * t * 11, -b.z * inv * t * 11];
    }
    return [0, 0, 0];
  }

  var sepR2 = SEP_R * SEP_R;
  var aliR2 = ALI_R * ALI_R;
  var cohR2 = COH_R * COH_R;

  function accumulate(t) {
    var i;
    var j;
    for (i = 0; i < N; i++) {
      boids[i].ax = 0;
      boids[i].ay = 0;
      boids[i].az = 0;
    }

    for (i = 0; i < N; i++) {
      var bi = boids[i];
      var sx = 0;
      var sy = 0;
      var sz = 0;
      var sc = 0;
      var ax = 0;
      var ay = 0;
      var az = 0;
      var ac = 0;
      var cx = 0;
      var cy = 0;
      var cz = 0;
      var cc = 0;

      for (j = 0; j < N; j++) {
        if (i === j) continue;
        var bj = boids[j];
        var dx = bi.x - bj.x;
        var dy = bi.y - bj.y;
        var dz = bi.z - bj.z;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < sepR2 && d2 > 1e-8) {
          var inv = 1 / d2;
          sx += dx * inv;
          sy += dy * inv;
          sz += dz * inv;
          sc++;
        }
        if (bj.flock === bi.flock && d2 < aliR2) {
          ax += bj.vx;
          ay += bj.vy;
          az += bj.vz;
          ac++;
          if (d2 < cohR2) {
            cx += bj.x;
            cy += bj.y;
            cz += bj.z;
            cc++;
          }
        }
      }

      if (sc > 0) {
        var sep = limitVec(sx / sc, sy / sc, sz / sc, MAX_FORCE);
        var wSep = bi.leader ? 1.15 : 1.85;
        bi.ax += sep[0] * wSep;
        bi.ay += sep[1] * wSep;
        bi.az += sep[2] * wSep;
      }

      if (!bi.leader) {
        if (ac > 0) {
          var ali = limitVec(
            ax / ac - bi.vx,
            ay / ac - bi.vy,
            az / ac - bi.vz,
            MAX_FORCE
          );
          bi.ax += ali[0] * 0.82;
          bi.ay += ali[1] * 0.82;
          bi.az += ali[2] * 0.82;
        }
        if (cc > 0) {
          var coh = steerToward(bi, cx / cc, cy / cc, cz / cc, MAX_SPEED);
          bi.ax += coh[0] * 0.58;
          bi.ay += coh[1] * 0.58;
          bi.az += coh[2] * 0.58;
        }
        var lead = leaders[bi.flock];
        var seek = steerToward(
          bi,
          lead.x + lead.vx * 0.42,
          lead.y + lead.vy * 0.42,
          lead.z + lead.vz * 0.42,
          MAX_SPEED
        );
        bi.ax += seek[0] * 1.22;
        bi.ay += seek[1] * 1.22;
        bi.az += seek[2] * 1.22;
        bi.ax += lead.vx * 0.18;
        bi.ay += lead.vy * 0.18;
        bi.az += lead.vz * 0.18;
        var wob = WOBBLE * Math.sin(t * bi.wobble + bi.phase);
        bi.ax += wob * Math.cos(bi.phase);
        bi.ay += wob * 0.6 * Math.sin(bi.phase * 1.3);
        bi.az += wob * Math.sin(bi.phase * 0.7);
      }

      var cnf = confine(bi);
      bi.ax += cnf[0];
      bi.ay += cnf[1];
      bi.az += cnf[2];
    }

    for (i = 0; i < leaders.length; i++) {
      var L = leaders[i];
      var fl = flocks[L.flock];
      leaderTarget(fl, t, _tgt);
      var st = steerToward(L, _tgt.x, _tgt.y, _tgt.z, LEAD_SPEED);
      L.ax += st[0] * 1.35;
      L.ay += st[1] * 1.35;
      L.az += st[2] * 1.35;
      for (j = 0; j < leaders.length; j++) {
        if (i === j) continue;
        var o = leaders[j];
        var lx = L.x - o.x;
        var ly = L.y - o.y;
        var lz = L.z - o.z;
        var ld2 = lx * lx + ly * ly + lz * lz;
        if (ld2 < 16 && ld2 > 1e-6) {
          var lin = 1 / ld2;
          L.ax += lx * lin * 4.8;
          L.ay += ly * lin * 4.8;
          L.az += lz * lin * 4.8;
        }
      }
    }
  }

  function integrate(dt) {
    for (var i = 0; i < N; i++) {
      var b = boids[i];
      var maxSp = b.leader ? LEAD_SPEED : MAX_SPEED;
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;
      b.vz += b.az * dt;
      b.vx *= 0.986;
      b.vy *= 0.986;
      b.vz *= 0.986;
      var lim = limitVec(b.vx, b.vy, b.vz, maxSp);
      b.vx = lim[0];
      b.vy = lim[1];
      b.vz = lim[2];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
    }
  }

  function pushTrail(b) {
    if (b.filled < TRAIL) {
      var i = b.filled * 3;
      b.trail[i] = b.x;
      b.trail[i + 1] = b.y;
      b.trail[i + 2] = b.z;
      b.filled++;
      return;
    }
    b.trail.copyWithin(0, 3);
    var t = (TRAIL - 1) * 3;
    b.trail[t] = b.x;
    b.trail[t + 1] = b.y;
    b.trail[t + 2] = b.z;
  }

  function writeBuffers(t) {
    var hueShift = t * HUE_SPEED;
    var centroids = [];
    var i;
    for (i = 0; i < N_FLOCKS; i++) {
      centroids.push({ x: 0, y: 0, z: 0, n: 0 });
    }

    for (i = 0; i < N; i++) {
      var b = boids[i];
      var fl = flocks[b.flock];
      var h = fl.hue + hueShift * (0.85 + (b.flock % 3) * 0.08);
      var sat = b.leader ? fl.sat * 0.72 : fl.sat;
      var val = b.leader ? 1 : 0.92;
      var rgb = hsv(h, sat, val);
      tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
      blobs.setColorAt(i, tmpColor);

      dummy.position.set(b.x, b.y, b.z);
      var spd = Math.hypot(b.vx, b.vy, b.vz);
      if (spd > 0.04) {
        dirVec.set(b.vx / spd, b.vy / spd, b.vz / spd);
        dummy.quaternion.setFromUnitVectors(zAxis, dirVec);
      }
      var st = 1 + STRETCH * Math.min(1, spd / MAX_SPEED);
      var rad = b.radius;
      dummy.scale.set(rad / Math.sqrt(st), rad / Math.sqrt(st), rad * st);
      dummy.updateMatrix();
      blobs.setMatrixAt(i, dummy.matrix);

      headPos[i * 3] = b.x;
      headPos[i * 3 + 1] = b.y;
      headPos[i * 3 + 2] = b.z;
      var pulse = 0.55 + 0.45 * Math.sin(t * 1.8 + b.phase);
      var hg = b.leader ? 0.55 : 0.32;
      headCol[i * 3] = rgb[0] * hg * pulse;
      headCol[i * 3 + 1] = rgb[1] * hg * pulse;
      headCol[i * 3 + 2] = rgb[2] * hg * pulse;

      var nfill = b.filled;
      for (var k = 0; k < TRAIL; k++) {
        var live = k < nfill;
        var src = live ? k : Math.max(0, nfill - 1);
        var tx = live ? b.trail[src * 3] : b.x;
        var ty = live ? b.trail[src * 3 + 1] : b.y;
        var tz = live ? b.trail[src * 3 + 2] : b.z;
        var fade = !live || nfill < 2 ? 0 : k / (nfill - 1);
        fade = fade * fade;
        var wave = 0.5 + 0.5 * Math.sin(t * 2.0 - k * 0.28 + b.phase);
        var v = fade * wave * pulse * 0.72;
        var tr = hsv(h + k * 0.002, Math.min(1, sat + 0.08), v);
        var gi = (i * TRAIL + k) * 3;
        trailPos[gi] = tx;
        trailPos[gi + 1] = ty;
        trailPos[gi + 2] = tz;
        trailCol[gi] = tr[0];
        trailCol[gi + 1] = tr[1];
        trailCol[gi + 2] = tr[2];
      }

      var c = centroids[b.flock];
      c.x += b.x;
      c.y += b.y;
      c.z += b.z;
      c.n++;
    }

    blobs.instanceMatrix.needsUpdate = true;
    if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
    headGeo.attributes.position.needsUpdate = true;
    headGeo.attributes.color.needsUpdate = true;
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;

    for (i = 0; i < N_FLOCKS; i++) {
      var ct = centroids[i];
      var invn = 1 / Math.max(1, ct.n);
      flocks[i].cx = ct.x * invn;
      flocks[i].cy = ct.y * invn;
      flocks[i].cz = ct.z * invn;
      flockLights[i].position.set(flocks[i].cx, flocks[i].cy, flocks[i].cz);
      var hr = hsv(flocks[i].hue + hueShift, 0.55, 1);
      flockLights[i].color.setRGB(hr[0], hr[1], hr[2]);
    }
  }

  function warmStart() {
    var t = 0;
    for (var s = 0; s < TRAIL + 8; s++) {
      t += 0.033;
      accumulate(t);
      integrate(0.033);
      for (var i = 0; i < N; i++) pushTrail(boids[i]);
    }
    return t;
  }

  var elapsed = warmStart();
  var last = performance.now();
  var raf = 0;

  writeBuffers(elapsed);
  renderer.render(scene, camera);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt;

    accumulate(elapsed);
    integrate(dt);
    for (var i = 0; i < N; i++) pushTrail(boids[i]);

    camAngle += CAM_SPEED * dt;
    var elev = 0.2 * Math.sin(elapsed * 0.13) + 0.12;
    var cr = camRadius + 1.1 * Math.sin(elapsed * 0.08);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.55,
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

  raf = requestAnimationFrame(frame);
})();
