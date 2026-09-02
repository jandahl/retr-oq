/* Original remake of the classic 2000s "solar winds" GL eye candy.
   Parametric particle winds: nested lissajous cores, twisting emitter
   rings, additive glow sprites, and occasional neighbor links.
   Not derived from rss-glx / GPL sources. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduced = false;
  }

  var N_WINDS = reduced ? 2 : 3;
  var N_EMIT = reduced ? 10 : 24;
  var TRAIL = reduced ? 16 : 36;
  var TIME_SCALE = reduced ? 0.38 : 1;
  var CAM_SPEED = reduced ? 0.04 : 0.078;
  var HUE_SPEED = reduced ? 0.018 : 0.042;
  var CLIMATE_HOLD = reduced ? 22 : 13;
  var CLIMATE_FADE = reduced ? 10 : 6.5;

  var TWO_PI = Math.PI * 2;
  var N_PART = N_WINDS * N_EMIT * TRAIL;
  var N_HEAD = N_WINDS * N_EMIT;

  var renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  var camRadius = reduced ? 15.8 : 13.6;
  var camAngle = 0.55;
  camera.position.set(0, 2.4, camRadius);

  var fadeScene = new THREE.Scene();
  var fadeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  fadeCam.position.z = 1;
  var fadeMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: reduced ? 0.32 : 0.16,
    depthTest: false,
    depthWrite: false,
  });
  fadeScene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), fadeMat));

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,255,0.9)");
    grd.addColorStop(mid, "rgba(255,255,255,0.28)");
    grd.addColorStop(0.72, "rgba(255,255,255,0.05)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128, 0.1, 0.36);
  var softTex = makeGlowTexture(64, 0.22, 0.52);

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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    var x = t < 0 ? 0 : t > 1 ? 1 : t;
    return x * x * (3 - 2 * x);
  }

  /* Original morph climates — not the rss-glx named presets. */
  var CLIMATES = [
    {
      r1: 1.85,
      r2: 0.32,
      r3: 0.12,
      harm: 2,
      peel: 0.45,
      twist: 0.85,
      spin: 0.72,
      web: 0.06,
      str: 0.28,
      size: 1.28,
      lag: 0.03,
      blur: 0.14,
      spread: 1.0,
      wobble: 0.35,
    },
    {
      r1: 2.7,
      r2: 1.55,
      r3: 0.4,
      harm: 5,
      peel: 1.85,
      twist: 2.3,
      spin: 0.34,
      web: 0.14,
      str: 0.18,
      size: 1.08,
      lag: 0.042,
      blur: 0.19,
      spread: 1.12,
      wobble: 0.7,
    },
    {
      r1: 2.05,
      r2: 0.88,
      r3: 0.22,
      harm: 3,
      peel: 0.22,
      twist: 1.55,
      spin: 1.12,
      web: 0.64,
      str: 0.88,
      size: 0.7,
      lag: 0.021,
      blur: 0.11,
      spread: 0.92,
      wobble: 0.2,
    },
    {
      r1: 3.35,
      r2: 0.22,
      r3: 0.08,
      harm: 1,
      peel: 2.55,
      twist: 0.28,
      spin: 0.24,
      web: 0.42,
      str: 0.58,
      size: 0.92,
      lag: 0.052,
      blur: 0.21,
      spread: 1.2,
      wobble: 0.15,
    },
    {
      r1: 1.15,
      r2: 2.15,
      r3: 0.55,
      harm: 7,
      peel: 0.95,
      twist: 3.4,
      spin: 1.38,
      web: 0.9,
      str: 0.72,
      size: 0.56,
      lag: 0.017,
      blur: 0.1,
      spread: 0.85,
      wobble: 1.05,
    },
  ];

  var climateKeys = [
    "r1",
    "r2",
    "r3",
    "harm",
    "peel",
    "twist",
    "spin",
    "web",
    "str",
    "size",
    "lag",
    "blur",
    "spread",
    "wobble",
  ];

  var climate = {};
  var ci;
  for (ci = 0; ci < climateKeys.length; ci++) {
    climate[climateKeys[ci]] = CLIMATES[0][climateKeys[ci]];
  }

  var winds = [];
  var wi;
  for (wi = 0; wi < N_WINDS; wi++) {
    winds.push({
      phase: wi * 2.094 + 0.17,
      hue: wi / N_WINDS,
      A: 4.05 + wi * 0.42,
      B: 2.15 + (wi % 2) * 0.62,
      C: 3.85 - wi * 0.22,
      f1: 0.27 + wi * 0.051,
      f2: 0.41 + wi * 0.047,
      f3: 0.23 + wi * 0.063,
      p1: wi * 1.13,
      p2: wi * 0.71 + 0.4,
      p3: wi * 1.67,
      spin0: 0.58 + wi * 0.14,
      ox: (wi === 1 ? 2.4 : wi === 2 ? -2.6 : 0.15),
      oy: (wi === 1 ? 1.15 : wi === 2 ? -1.05 : 0.35),
      oz: (wi === 1 ? -1.7 : wi === 2 ? 1.9 : 0.1),
      hx: 0,
      hy: 0,
      hz: 0,
    });
  }

  var _T = { x: 0, y: 0, z: 1 };
  var _N = { x: 1, y: 0, z: 0 };
  var _B = { x: 0, y: 1, z: 0 };
  var _H = { x: 0, y: 0, z: 0 };

  function hubAt(w, tau, out) {
    var a1 = tau * w.f1 + w.p1;
    var a2 = tau * w.f2 + w.p2;
    var a3 = tau * w.f3 + w.p3;
    var s = climate.spread;
    out.x = w.A * s * Math.sin(a1) + w.ox;
    out.y = w.B * s * Math.sin(a2) + w.oy;
    out.z = w.C * s * Math.cos(a3) + w.oz;
  }

  function tangentAt(w, tau, out) {
    var a1 = tau * w.f1 + w.p1;
    var a2 = tau * w.f2 + w.p2;
    var a3 = tau * w.f3 + w.p3;
    var s = climate.spread;
    out.x = w.A * s * w.f1 * Math.cos(a1);
    out.y = w.B * s * w.f2 * Math.cos(a2);
    out.z = -w.C * s * w.f3 * Math.sin(a3);
    var len = Math.hypot(out.x, out.y, out.z) || 1;
    out.x /= len;
    out.y /= len;
    out.z /= len;
  }

  function frenet(w, tau) {
    hubAt(w, tau, _H);
    tangentAt(w, tau, _T);
    var ux = Math.sin(tau * 0.073 + w.phase);
    var uy = 0.35 + 0.65 * Math.cos(tau * 0.061 + w.phase * 0.5);
    var uz = Math.cos(tau * 0.073 + w.phase);
    var nx = uy * _T.z - uz * _T.y;
    var ny = uz * _T.x - ux * _T.z;
    var nz = ux * _T.y - uy * _T.x;
    var nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-5) {
      ux = 1;
      uy = 0;
      uz = 0;
      nx = uy * _T.z - uz * _T.y;
      ny = uz * _T.x - ux * _T.z;
      nz = ux * _T.y - uy * _T.x;
      nl = Math.hypot(nx, ny, nz) || 1;
    }
    nx /= nl;
    ny /= nl;
    nz /= nl;
    _N.x = nx;
    _N.y = ny;
    _N.z = nz;
    _B.x = _T.y * nz - _T.z * ny;
    _B.y = _T.z * nx - _T.x * nz;
    _B.z = _T.x * ny - _T.y * nx;
  }

  function sampleClimate(elapsed) {
    var span = CLIMATE_HOLD + CLIMATE_FADE;
    var n = CLIMATES.length;
    var cycle = elapsed / span;
    var idx = Math.floor(cycle) % n;
    var next = (idx + 1) % n;
    var local = elapsed - Math.floor(cycle) * span;
    var u = 0;
    if (local > CLIMATE_HOLD) {
      u = smoothstep((local - CLIMATE_HOLD) / CLIMATE_FADE);
    }
    var a = CLIMATES[idx];
    var b = CLIMATES[next];
    var k;
    for (k = 0; k < climateKeys.length; k++) {
      var key = climateKeys[k];
      climate[key] = lerp(a[key], b[key], u);
    }
  }

  var bodyPos = new Float32Array(N_PART * 3);
  var bodyCol = new Float32Array(N_PART * 3);
  var bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute("position", new THREE.BufferAttribute(bodyPos, 3));
  bodyGeo.setAttribute("color", new THREE.BufferAttribute(bodyCol, 3));
  var bodyPoints = new THREE.Points(
    bodyGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 1.12,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(bodyPoints);

  var headPos = new Float32Array(N_HEAD * 3);
  var headCol = new Float32Array(N_HEAD * 3);
  var headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
  headGeo.setAttribute("color", new THREE.BufferAttribute(headCol, 3));
  var headPoints = new THREE.Points(
    headGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 2.65,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    })
  );
  scene.add(headPoints);

  var haloPos = new Float32Array(N_HEAD * 3);
  var haloCol = new Float32Array(N_HEAD * 3);
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

  var nStreamer = N_WINDS * N_EMIT * (TRAIL - 1);
  var streamPos = new Float32Array(nStreamer * 2 * 3);
  var streamCol = new Float32Array(nStreamer * 2 * 3);
  var streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
  streamGeo.setAttribute("color", new THREE.BufferAttribute(streamCol, 3));
  scene.add(
    new THREE.LineSegments(
      streamGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  var nWeb = N_WINDS * N_EMIT * TRAIL;
  var webPos = new Float32Array(nWeb * 2 * 3);
  var webCol = new Float32Array(nWeb * 2 * 3);
  var webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute("position", new THREE.BufferAttribute(webPos, 3));
  webGeo.setAttribute("color", new THREE.BufferAttribute(webCol, 3));
  scene.add(
    new THREE.LineSegments(
      webGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    )
  );

  var px = new Float32Array(N_PART);
  var py = new Float32Array(N_PART);
  var pz = new Float32Array(N_PART);
  var pr = new Float32Array(N_PART);
  var pg = new Float32Array(N_PART);
  var pb = new Float32Array(N_PART);

  var hueShift = 0;
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;
  var didClear = false;

  function pid(w, e, k) {
    return (w * N_EMIT + e) * TRAIL + k;
  }

  function writeParticles(t) {
    var stringGate = 0.5 + 0.5 * Math.sin(t * 0.068);
    var webGate = 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.038 + 1.15));
    var strAmt = climate.str * stringGate;
    var webAmt = climate.web * webGate;
    var pulse = 0.78 + 0.22 * Math.sin(t * 1.55);

    var w;
    var e;
    var k;
    for (w = 0; w < N_WINDS; w++) {
      var wind = winds[w];
      var spin = climate.spin * wind.spin0;
      for (k = 0; k < TRAIL; k++) {
        var age = TRAIL < 2 ? 0 : k / (TRAIL - 1);
        var tau = t * 0.62 * TIME_SCALE - k * climate.lag + wind.phase;
        frenet(wind, tau);
        if (k === 0) {
          wind.hx = _H.x;
          wind.hy = _H.y;
          wind.hz = _H.z;
        }
        var peel = climate.peel * age * age;
        var twist = climate.twist * age;
        for (e = 0; e < N_EMIT; e++) {
          var theta =
            tau * spin + (e / N_EMIT) * TWO_PI + twist + wind.phase * 0.2;
          var rho =
            climate.r1 +
            climate.r2 * Math.sin(climate.harm * theta + t * climate.wobble) +
            climate.r3 * Math.cos(theta * 2.0 + e * 0.3);
          rho += peel * (0.55 + 0.45 * Math.sin(tau * 0.8 + e));
          var ct = Math.cos(theta);
          var st = Math.sin(theta);
          var id = pid(w, e, k);
          px[id] = _H.x + ( _N.x * ct + _B.x * st) * rho + _T.x * peel * 0.35;
          py[id] = _H.y + ( _N.y * ct + _B.y * st) * rho + _T.y * peel * 0.35;
          pz[id] = _H.z + ( _N.z * ct + _B.z * st) * rho + _T.z * peel * 0.35;

          var h = wind.hue + hueShift + age * 0.07 + e * 0.008;
          var sat = 0.62 + 0.32 * (1 - age * 0.45);
          var val = (1 - age * 0.68) * pulse;
          if (k === 0) val = 1;
          var rgb = hsv(h, sat, Math.max(0.04, val));
          pr[id] = rgb[0];
          pg[id] = rgb[1];
          pb[id] = rgb[2];

          var gi = id * 3;
          bodyPos[gi] = px[id];
          bodyPos[gi + 1] = py[id];
          bodyPos[gi + 2] = pz[id];
          var fade = 0.55 + 0.45 * (1 - age);
          bodyCol[gi] = rgb[0] * fade;
          bodyCol[gi + 1] = rgb[1] * fade;
          bodyCol[gi + 2] = rgb[2] * fade;
        }
      }

      for (e = 0; e < N_EMIT; e++) {
        var hid = w * N_EMIT + e;
        var hid3 = hid * 3;
        var headId = pid(w, e, 0);
        headPos[hid3] = px[headId];
        headPos[hid3 + 1] = py[headId];
        headPos[hid3 + 2] = pz[headId];
        headCol[hid3] = pr[headId];
        headCol[hid3 + 1] = pg[headId];
        headCol[hid3 + 2] = pb[headId];
        haloPos[hid3] = px[headId];
        haloPos[hid3 + 1] = py[headId];
        haloPos[hid3 + 2] = pz[headId];
        haloCol[hid3] = pr[headId] * 0.22 * pulse;
        haloCol[hid3 + 1] = pg[headId] * 0.22 * pulse;
        haloCol[hid3 + 2] = pb[headId] * 0.22 * pulse;
      }
    }

    var si = 0;
    for (w = 0; w < N_WINDS; w++) {
      for (e = 0; e < N_EMIT; e++) {
        for (k = 0; k < TRAIL - 1; k++) {
          var a = pid(w, e, k);
          var b = pid(w, e, k + 1);
          var ageN = k / (TRAIL - 1);
          var sa = strAmt * (0.9 - ageN * 0.35);
          streamPos[si] = px[a];
          streamPos[si + 1] = py[a];
          streamPos[si + 2] = pz[a];
          streamCol[si] = pr[a] * sa;
          streamCol[si + 1] = pg[a] * sa;
          streamCol[si + 2] = pb[a] * sa;
          streamPos[si + 3] = px[b];
          streamPos[si + 4] = py[b];
          streamPos[si + 5] = pz[b];
          streamCol[si + 3] = pr[b] * sa * 0.75;
          streamCol[si + 4] = pg[b] * sa * 0.75;
          streamCol[si + 5] = pb[b] * sa * 0.75;
          si += 6;
        }
      }
    }

    var wi2 = 0;
    var webScale = webAmt * 1.15;
    for (w = 0; w < N_WINDS; w++) {
      for (e = 0; e < N_EMIT; e++) {
        var e2 = e + 1 < N_EMIT ? e + 1 : 0;
        for (k = 0; k < TRAIL; k++) {
          var a2 = pid(w, e, k);
          var b2 = pid(w, e2, k);
          var ageW = TRAIL < 2 ? 0 : k / (TRAIL - 1);
          var wa = webScale * (1 - ageW * 0.4);
          webPos[wi2] = px[a2];
          webPos[wi2 + 1] = py[a2];
          webPos[wi2 + 2] = pz[a2];
          webCol[wi2] = pr[a2] * wa;
          webCol[wi2 + 1] = pg[a2] * wa;
          webCol[wi2 + 2] = pb[a2] * wa;
          webPos[wi2 + 3] = px[b2];
          webPos[wi2 + 4] = py[b2];
          webPos[wi2 + 5] = pz[b2];
          webCol[wi2 + 3] = pr[b2] * wa;
          webCol[wi2 + 4] = pg[b2] * wa;
          webCol[wi2 + 5] = pb[b2] * wa;
          wi2 += 6;
        }
      }
    }

    bodyPoints.material.size = 1.12 * climate.size;
    headPoints.material.size = 2.65 * climate.size;
    haloPoints.material.size = 5.4 * climate.size;
    fadeMat.opacity = reduced ? Math.max(0.28, climate.blur + 0.16) : climate.blur;

    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.attributes.color.needsUpdate = true;
    headGeo.attributes.position.needsUpdate = true;
    headGeo.attributes.color.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
    haloGeo.attributes.color.needsUpdate = true;
    streamGeo.attributes.position.needsUpdate = true;
    streamGeo.attributes.color.needsUpdate = true;
    webGeo.attributes.position.needsUpdate = true;
    webGeo.attributes.color.needsUpdate = true;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt * TIME_SCALE;
    hueShift += HUE_SPEED * dt * TIME_SCALE;

    sampleClimate(elapsed);
    writeParticles(elapsed);

    camAngle += CAM_SPEED * dt * TIME_SCALE;
    var elev = 0.2 * Math.sin(elapsed * 0.09) + 0.11;
    var cr = camRadius + 1.6 * Math.sin(elapsed * 0.055);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.25,
      Math.sin(camAngle) * Math.cos(elev) * cr
    );
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);

    if (!didClear) {
      renderer.clear();
      didClear = true;
    }
    renderer.clearDepth();
    renderer.render(fadeScene, fadeCam);
    renderer.render(scene, camera);
  }

  function onResize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    didClear = true;
  }

  window.addEventListener("resize", onResize, false);
  document.addEventListener(
    "visibilitychange",
    function () {
      if (!document.hidden) last = performance.now();
    },
    false
  );

  sampleClimate(elapsed);
  writeParticles(elapsed);
  renderer.clear();
  renderer.render(scene, camera);
  didClear = true;
  raf = requestAnimationFrame(frame);
})();
