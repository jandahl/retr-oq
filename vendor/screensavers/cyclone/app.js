/* Original remake of the classic 2000s tornado/vortex GL eye candy.
   Particles ride helical bands around a meandering 3D funnel; camera
   orbits. Not derived from rss-glx / GPL sources. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduced = false;
  }

  var N_BODY = reduced ? 280 : 1100;
  var N_CORE = reduced ? 48 : 160;
  var N_DEBRIS = reduced ? 50 : 180;
  var N_BANDS = reduced ? 5 : 7;
  var HEIGHT = 15.2;
  var TWIST = 6.2;
  var SPIN = reduced ? 0.55 : 1.35;
  var RISE = reduced ? 0.07 : 0.18;
  var CAM_SPEED = reduced ? 0.05 : 0.11;
  var HUE_SPEED = reduced ? 0.018 : 0.042;
  var STAR_COUNT = reduced ? 70 : 180;

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
  var camRadius = 20.2;
  var camAngle = 0.55;
  camera.position.set(0, 2.4, camRadius);

  function makeGlowTexture(size, inner, mid) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(inner, "rgba(255,255,255,0.9)");
    grd.addColorStop(mid, "rgba(210,225,255,0.28)");
    grd.addColorStop(0.7, "rgba(90,140,255,0.06)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  var glowTex = makeGlowTexture(128, 0.12, 0.36);
  var softTex = makeGlowTexture(64, 0.22, 0.5);

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

  (function addStars() {
    var pos = new Float32Array(STAR_COUNT * 3);
    var col = new Float32Array(STAR_COUNT * 3);
    for (var i = 0; i < STAR_COUNT; i++) {
      var u = Math.random();
      var v = Math.random();
      var th = u * Math.PI * 2;
      var ph = Math.acos(2 * v - 1);
      var r = 52 + Math.random() * 40;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
      var b = 0.14 + Math.random() * 0.28;
      col[i * 3] = b;
      col[i * 3 + 1] = b * (0.88 + Math.random() * 0.12);
      col[i * 3 + 2] = b * (0.95 + Math.random() * 0.2);
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

  var _axis = { x: 0, y: 0, z: 0 };
  var _axis2 = { x: 0, y: 0, z: 0 };

  function spine(h, t, out) {
    var y = (h - 0.38) * HEIGHT;
    var w = 0.1 + 0.9 * h * h;
    var x =
      1.18 * w * Math.sin(2.15 * h + t * 0.31 + 0.4) +
      0.52 * w * Math.sin(5.05 * h - t * 0.47 + 1.15) +
      0.2 * w * Math.sin(9.2 * h + t * 0.63) +
      0.85 * h * Math.sin(t * 0.068);
    var z =
      1.18 * w * Math.cos(1.72 * h + t * 0.27) +
      0.52 * w * Math.cos(4.35 * h + t * 0.39 + 0.7) +
      0.2 * w * Math.cos(8.05 * h - t * 0.55) +
      0.48 * h * Math.cos(t * 0.061);
    out.x = x;
    out.y = y;
    out.z = z;
  }

  function funnelR(h) {
    var body = 0.2 + 5.35 * Math.pow(h, 1.38);
    var rib = 1 + 0.045 * Math.sin(h * 16);
    return body * rib;
  }

  function placeOnFunnel(h, angle, spread, t, out) {
    spine(h, t, _axis);
    spine(Math.min(1, h + 0.014), t, _axis2);
    var tx = _axis2.x - _axis.x;
    var ty = _axis2.y - _axis.y;
    var tz = _axis2.z - _axis.z;
    var tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    var rx;
    var ry;
    var rz;
    if (Math.abs(ty) > 0.94) {
      rx = 0;
      ry = tz;
      rz = -ty;
    } else {
      rx = -tz;
      ry = 0;
      rz = tx;
    }
    var rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    var fx = ty * rz - tz * ry;
    var fy = tz * rx - tx * rz;
    var fz = tx * ry - ty * rx;
    var ang = angle + TWIST * h;
    var rad =
      funnelR(h) * spread * (1 + 0.035 * Math.sin(t * 1.9 + angle * 2.4));
    var ca = Math.cos(ang);
    var sa = Math.sin(ang);
    out.x = _axis.x + (rx * ca + fx * sa) * rad;
    out.y = _axis.y + (ry * ca + fy * sa) * rad;
    out.z = _axis.z + (rz * ca + fz * sa) * rad;
  }

  function makeParticle(kind, i, n) {
    var band = i % N_BANDS;
    var h;
    var spread;
    var spin;
    var rise;
    if (kind === 2) {
      h = Math.random() * 0.14;
      spread = 4.2 + Math.random() * 4.8;
      spin = 0.35 + Math.random() * 0.35;
      rise = 0.2 + Math.random() * 0.35;
    } else if (kind === 1) {
      h = Math.random();
      spread = 0.12 + Math.random() * 0.28;
      spin = 1.35 + Math.random() * 0.55;
      rise = 0.85 + Math.random() * 0.4;
    } else {
      h = (i + Math.random() * 0.85) / n;
      spread = 0.72 + (band % 3) * 0.09 + Math.random() * 0.22;
      spin = 0.85 + Math.random() * 0.45;
      rise = 0.65 + Math.random() * 0.5;
    }
    return {
      h: h,
      angle: (band / N_BANDS) * Math.PI * 2 + Math.random() * 0.12,
      spread: spread,
      spin: spin,
      rise: rise,
      hueJit: (band / N_BANDS) * 0.12 + Math.random() * 0.04,
      sat: kind === 1 ? 0.35 + Math.random() * 0.2 : 0.72 + (i % 4) * 0.07,
      kind: kind,
      band: band,
    };
  }

  var body = [];
  var core = [];
  var debris = [];
  var i;
  for (i = 0; i < N_BODY; i++) body.push(makeParticle(0, i, N_BODY));
  for (i = 0; i < N_CORE; i++) core.push(makeParticle(1, i, N_CORE));
  for (i = 0; i < N_DEBRIS; i++) debris.push(makeParticle(2, i, N_DEBRIS));

  function makeLayer(count, map, size) {
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    var pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: map,
        size: size,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: true,
      })
    );
    scene.add(pts);
    return { pos: pos, col: col, geo: geo, pts: pts };
  }

  var bodyLayer = makeLayer(N_BODY, glowTex, reduced ? 0.52 : 0.62);
  var bodyHalo = makeLayer(N_BODY, softTex, reduced ? 1.45 : 1.85);
  var coreLayer = makeLayer(N_CORE, glowTex, reduced ? 0.38 : 0.44);
  var debrisLayer = makeLayer(N_DEBRIS, softTex, reduced ? 0.95 : 1.25);

  var _pos = { x: 0, y: 0, z: 0 };

  function stepSet(set, dt) {
    for (var i = 0; i < set.length; i++) {
      var p = set[i];
      var r = funnelR(p.h) * p.spread + 0.2;
      p.angle += SPIN * p.spin * dt * (1.15 / (0.45 + r * 0.22));
      p.h += RISE * p.rise * dt * (0.55 + 0.55 * (1 - p.h));
      if (p.h > 1) {
        p.h -= 1;
        p.angle += 0.7;
      }
    }
  }

  function writeSet(set, layer, t, hueShift, valScale, satBoost) {
    var pos = layer.pos;
    var col = layer.col;
    for (var i = 0; i < set.length; i++) {
      var p = set[i];
      placeOnFunnel(p.h, p.angle, p.spread, t, _pos);
      pos[i * 3] = _pos.x;
      pos[i * 3 + 1] = _pos.y;
      pos[i * 3 + 2] = _pos.z;
      var hue = p.angle / (Math.PI * 2) + p.h * 0.18 + hueShift + p.hueJit;
      var pulse = 0.72 + 0.28 * Math.sin(t * 2.05 + p.angle * 3 + p.h * 6);
      var val = valScale * pulse;
      if (p.kind === 1) val *= 1.15;
      if (p.kind === 2) val *= 0.55 + 0.25 * (1 - p.h * 6);
      var sat = Math.min(1, p.sat + satBoost);
      if (p.kind === 1) sat *= 0.55;
      var rgb = hsv(hue, sat, Math.max(0, Math.min(1, val)));
      col[i * 3] = rgb[0];
      col[i * 3 + 1] = rgb[1];
      col[i * 3 + 2] = rgb[2];
    }
    layer.geo.attributes.position.needsUpdate = true;
    layer.geo.attributes.color.needsUpdate = true;
  }

  function writeHalo(set, layer, t, hueShift) {
    var pos = layer.pos;
    var col = layer.col;
    for (var i = 0; i < set.length; i++) {
      var p = set[i];
      placeOnFunnel(p.h, p.angle, p.spread, t, _pos);
      pos[i * 3] = _pos.x;
      pos[i * 3 + 1] = _pos.y;
      pos[i * 3 + 2] = _pos.z;
      var hue = p.angle / (Math.PI * 2) + p.h * 0.18 + hueShift + p.hueJit;
      var pulse = 0.55 + 0.45 * Math.sin(t * 1.6 + p.band);
      var rgb = hsv(hue, Math.min(1, p.sat + 0.05), 0.22 * pulse);
      col[i * 3] = rgb[0];
      col[i * 3 + 1] = rgb[1];
      col[i * 3 + 2] = rgb[2];
    }
    layer.geo.attributes.position.needsUpdate = true;
    layer.geo.attributes.color.needsUpdate = true;
  }

  var hueShift = 0;
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
    hueShift += HUE_SPEED * dt;

    stepSet(body, dt);
    stepSet(core, dt);
    stepSet(debris, dt);

    camAngle += CAM_SPEED * dt;
    var elev = 0.16 + 0.1 * Math.sin(elapsed * 0.12);
    var cr = camRadius + 1.15 * Math.sin(elapsed * 0.08);
    camera.position.set(
      Math.cos(camAngle) * Math.cos(elev) * cr,
      Math.sin(elev) * cr + 0.55,
      Math.sin(camAngle) * Math.cos(elev) * cr
    );
    camera.lookAt(0, 0.55, 0);
    camera.up.set(0, 1, 0);

    writeSet(body, bodyLayer, elapsed, hueShift, 0.92, 0.04);
    writeHalo(body, bodyHalo, elapsed, hueShift);
    writeSet(core, coreLayer, elapsed, hueShift, 1.05, -0.2);
    writeSet(debris, debrisLayer, elapsed, hueShift, 0.62, 0.02);

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

  writeSet(body, bodyLayer, 0, 0, 0.92, 0.04);
  writeHalo(body, bodyHalo, 0, 0);
  writeSet(core, coreLayer, 0, 0, 1.05, -0.2);
  writeSet(debris, debrisLayer, 0, 0, 0.62, 0.02);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
