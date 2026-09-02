/* Original remake of the 2006 KDE-era Lattice GL eye candy:
   fly through an infinite cubic crystal of glowing nodes and bonds.
   Camera weaves corridor-to-corridor. Not derived from rss-glx / GPL sources. */
(function () {
  "use strict";

  if (typeof THREE === "undefined") return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduced = false;
  }

  var SPACING = 3.45;
  var NX = reduced ? 7 : 9;
  var NY = reduced ? 7 : 9;
  var NZ = reduced ? 9 : 13;
  var SPEED = reduced ? 0.72 : 1.85;
  var TURN_TIME = reduced ? 3.6 : 2.15;
  var HOLD_MIN = reduced ? 3.4 : 1.55;
  var HOLD_MAX = reduced ? 5.8 : 3.4;
  var WOBBLE = reduced ? 0.05 : 0.13;
  var HUE_SPEED = reduced ? 0.012 : 0.028;
  var NODE_R = 0.2;
  var BOND_R = 0.052;
  var LOOK_AHEAD = reduced ? 5.5 : 8.2;

  var BG = 0x02010a;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(BG, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, reduced ? 0.042 : 0.05);
  scene.background = new THREE.Color(BG);

  var camera = new THREE.PerspectiveCamera(
    78,
    window.innerWidth / window.innerHeight,
    0.12,
    90
  );
  scene.add(camera);

  var ambient = new THREE.AmbientLight(0x243050, 0.55);
  scene.add(ambient);
  var camLight = new THREE.PointLight(0xb8d4ff, 1.35, 32, 1.4);
  camLight.position.set(0.15, 0.2, 0.4);
  camera.add(camLight);
  var rim = new THREE.DirectionalLight(0x6688cc, 0.35);
  rim.position.set(-4, 6, 2);
  scene.add(rim);

  function makeGlowTexture(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var cx = size * 0.5;
    var grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.14, "rgba(230,245,255,0.95)");
    grd.addColorStop(0.34, "rgba(140,200,255,0.38)");
    grd.addColorStop(0.62, "rgba(80,120,220,0.1)");
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

  function crystalHue(z, t) {
    return (
      0.52 +
      0.2 * Math.sin(z * 0.021 + t * HUE_SPEED * 6.2) +
      0.07 * Math.sin(z * 0.008 + t * 0.11)
    );
  }

  function hash3(ix, iy, iz) {
    var n = ix * 374761393 + iy * 668265263 + iz * 1274126177;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = (n ^ (n >>> 16)) >>> 0;
    return (n % 10000) / 10000;
  }

  var dummy = new THREE.Object3D();
  var yAxis = new THREE.Vector3(0, 1, 0);
  var dir = new THREE.Vector3();
  var tmpColor = new THREE.Color();

  var nodeGeo = new THREE.SphereGeometry(NODE_R, reduced ? 7 : 9, reduced ? 5 : 7);
  var nodeMat = new THREE.MeshPhongMaterial({
    color: 0xc8e8ff,
    emissive: 0x1a4068,
    specular: 0xffffff,
    shininess: 92,
    transparent: true,
    opacity: 0.94,
    fog: true,
  });
  var maxNodes = NX * NY * NZ;
  var nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, maxNodes);
  nodeMesh.frustumCulled = false;
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(nodeMesh);

  var bondGeo = new THREE.CylinderGeometry(BOND_R, BOND_R, 1, reduced ? 5 : 6, 1, false);
  var bondMat = new THREE.MeshPhongMaterial({
    color: 0x88c8ff,
    emissive: 0x102848,
    specular: 0xaad4ff,
    shininess: 70,
    transparent: true,
    opacity: 0.88,
    fog: true,
  });
  var maxBonds = (NX - 1) * NY * NZ + NX * (NY - 1) * NZ + NX * NY * (NZ - 1);
  var bondMesh = new THREE.InstancedMesh(bondGeo, bondMat, maxBonds);
  bondMesh.frustumCulled = false;
  bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bondMesh);

  var glowPos = new Float32Array(maxNodes * 3);
  var glowCol = new Float32Array(maxNodes * 3);
  var glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute("color", new THREE.BufferAttribute(glowCol, 3));
  var glowPoints = new THREE.Points(
    glowGeo,
    new THREE.PointsMaterial({
      map: glowTex,
      size: reduced ? 1.15 : 1.55,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
      fog: true,
    })
  );
  glowPoints.frustumCulled = false;
  scene.add(glowPoints);

  var fly = {
    z: 0.5 * SPACING,
    cx: 0,
    cy: 0,
    tx: 0,
    ty: 0,
    blend: 1,
    hold: HOLD_MIN + Math.random() * (HOLD_MAX - HOLD_MIN),
  };

  function smoother(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function pickTurn() {
    if (Math.random() < 0.5) {
      fly.tx = fly.cx + (Math.random() < 0.5 ? -1 : 1);
      fly.ty = fly.cy;
    } else {
      fly.tx = fly.cx;
      fly.ty = fly.cy + (Math.random() < 0.5 ? -1 : 1);
    }
    fly.blend = 0;
  }

  function corridorXY(blend, t) {
    var e = smoother(blend);
    var wx =
      (fly.cx + (fly.tx - fly.cx) * e + 0.5) * SPACING +
      WOBBLE * SPACING * Math.sin(t * 0.61 + 0.4);
    var wy =
      (fly.cy + (fly.ty - fly.cy) * e + 0.5) * SPACING +
      WOBBLE * SPACING * Math.sin(t * 0.47 + 1.3);
    return [wx, wy];
  }

  function lookBlend(dtAhead) {
    var b = fly.blend;
    if (b < 1) {
      b += dtAhead / TURN_TIME;
      if (b > 1) b = 1;
    }
    return b;
  }

  function placeLattice(camx, camy, camz, t) {
    var ox = Math.round(camx / SPACING) - ((NX / 2) | 0);
    var oy = Math.round(camy / SPACING) - ((NY / 2) | 0);
    var oz = Math.round(camz / SPACING) - ((NZ / 2) | 0);

    var ni = 0;
    var bi = 0;
    var ix, iy, iz, wx, wy, wz, hx, rgb, pulse, sc;
    var wx2, wy2, wz2;

    for (iz = 0; iz < NZ; iz++) {
      for (iy = 0; iy < NY; iy++) {
        for (ix = 0; ix < NX; ix++) {
          wx = (ox + ix) * SPACING;
          wy = (oy + iy) * SPACING;
          wz = (oz + iz) * SPACING;
          hx = crystalHue(wz, t) + hash3(ox + ix, oy + iy, oz + iz) * 0.04;
          rgb = hsv(hx, 0.55, 1);
          pulse = 0.92 + 0.08 * Math.sin(t * 1.7 + hash3(ox + ix, 3, oz + iz) * 6.28);
          sc = pulse;

          dummy.position.set(wx, wy, wz);
          dummy.scale.set(sc, sc, sc);
          dummy.quaternion.identity();
          dummy.updateMatrix();
          nodeMesh.setMatrixAt(ni, dummy.matrix);
          tmpColor.setRGB(rgb[0], rgb[1] * 0.92 + 0.08, rgb[2]);
          nodeMesh.setColorAt(ni, tmpColor);

          glowPos[ni * 3] = wx;
          glowPos[ni * 3 + 1] = wy;
          glowPos[ni * 3 + 2] = wz;
          glowCol[ni * 3] = rgb[0] * 0.55 * pulse;
          glowCol[ni * 3 + 1] = rgb[1] * 0.5 * pulse;
          glowCol[ni * 3 + 2] = rgb[2] * 0.7 * pulse;
          ni++;

          if (ix < NX - 1) {
            wx2 = wx + SPACING;
            dummy.position.set((wx + wx2) * 0.5, wy, wz);
            dir.set(1, 0, 0);
            dummy.scale.set(1, SPACING, 1);
            dummy.quaternion.setFromUnitVectors(yAxis, dir);
            dummy.updateMatrix();
            bondMesh.setMatrixAt(bi, dummy.matrix);
            rgb = hsv(hx + 0.01, 0.62, 0.85);
            tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
            bondMesh.setColorAt(bi, tmpColor);
            bi++;
          }
          if (iy < NY - 1) {
            wy2 = wy + SPACING;
            dummy.position.set(wx, (wy + wy2) * 0.5, wz);
            dir.set(0, 1, 0);
            dummy.scale.set(1, SPACING, 1);
            dummy.quaternion.setFromUnitVectors(yAxis, dir);
            dummy.updateMatrix();
            bondMesh.setMatrixAt(bi, dummy.matrix);
            rgb = hsv(hx, 0.62, 0.85);
            tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
            bondMesh.setColorAt(bi, tmpColor);
            bi++;
          }
          if (iz < NZ - 1) {
            wz2 = wz + SPACING;
            dummy.position.set(wx, wy, (wz + wz2) * 0.5);
            dir.set(0, 0, 1);
            dummy.scale.set(1, SPACING, 1);
            dummy.quaternion.setFromUnitVectors(yAxis, dir);
            dummy.updateMatrix();
            bondMesh.setMatrixAt(bi, dummy.matrix);
            rgb = hsv(crystalHue(wz + SPACING * 0.5, t), 0.62, 0.85);
            tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
            bondMesh.setColorAt(bi, tmpColor);
            bi++;
          }
        }
      }
    }

    nodeMesh.count = ni;
    bondMesh.count = bi;
    nodeMesh.instanceMatrix.needsUpdate = true;
    bondMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    if (bondMesh.instanceColor) bondMesh.instanceColor.needsUpdate = true;
    glowGeo.attributes.position.needsUpdate = true;
    glowGeo.attributes.color.needsUpdate = true;
    glowGeo.setDrawRange(0, ni);
  }

  var look = new THREE.Vector3();
  var up = new THREE.Vector3();
  var last = performance.now();
  var elapsed = 0;
  var raf = 0;
  var prevX = 0.5 * SPACING;
  var prevY = 0.5 * SPACING;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt;

    fly.z += SPEED * dt;
    if (fly.blend < 1) {
      fly.blend += dt / TURN_TIME;
      if (fly.blend >= 1) {
        fly.blend = 1;
        fly.cx = fly.tx;
        fly.cy = fly.ty;
        fly.hold = HOLD_MIN + Math.random() * (HOLD_MAX - HOLD_MIN);
      }
    } else {
      fly.hold -= dt;
      if (fly.hold <= 0) pickTurn();
    }

    var xy = corridorXY(fly.blend, elapsed);
    var vx = xy[0] - prevX;
    var vy = xy[1] - prevY;
    prevX = xy[0];
    prevY = xy[1];

    camera.position.set(xy[0], xy[1], fly.z);

    var aheadT = LOOK_AHEAD / Math.max(0.4, SPEED);
    var lb = lookBlend(aheadT);
    var lxy = corridorXY(lb, elapsed + aheadT);
    look.set(lxy[0], lxy[1], fly.z + LOOK_AHEAD);

    var roll = Math.atan2(vx, dt * SPEED + 1e-5) * 0.35 + Math.atan2(vy, 0.08) * 0.18;
    roll += 0.04 * Math.sin(elapsed * 0.23);
    up.set(Math.sin(roll), Math.cos(roll), 0).normalize();
    camera.up.copy(up);
    camera.lookAt(look);

    var hue = crystalHue(fly.z, elapsed);
    var rgbL = hsv(hue, 0.35, 1);
    camLight.color.setRGB(rgbL[0], rgbL[1], rgbL[2]);

    placeLattice(xy[0], xy[1], fly.z, elapsed);
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

  var startXY = corridorXY(1, 0);
  camera.position.set(startXY[0], startXY[1], fly.z);
  camera.lookAt(startXY[0], startXY[1], fly.z + LOOK_AHEAD);
  placeLattice(startXY[0], startXY[1], fly.z, 0);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
})();
