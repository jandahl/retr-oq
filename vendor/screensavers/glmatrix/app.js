/* Original remake of the 2000s GL "digital rain" eye candy.
   Stacked glyph sheets, phosphor green, slow camera drift.
   Homemade geometric atlas — not a movie typeface, not xscreensaver source. */
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

  var NX = reduced ? 10 : 18;
  var NZ = reduced ? 3 : 6;
  var ROWS = reduced ? 16 : 26;
  var CELL_W = 0.5;
  var CELL_H = 0.6;
  var SPACE_X = 0.56;
  var SPACE_Z = reduced ? 7.2 : 6.4;
  var SPEED_MIN = reduced ? 1.1 : 3.4;
  var SPEED_MAX = reduced ? 2.8 : 9.8;
  var LEN_MIN = reduced ? 4 : 6;
  var LEN_MAX = reduced ? 9 : 16;
  var CAM_SPEED = reduced ? 0.12 : 0.38;
  var MUTATE_HEAD = reduced ? 1.6 : 5.5;
  var MUTATE_TRAIL = reduced ? 0.25 : 0.85;
  var ATLAS_N = 8;
  var ATLAS_GLYPHS = ATLAS_N * ATLAS_N;
  var FOG_COLOR = 0x000201;
  var FOG_DENSITY = 0.036;

  var nCols = NX * NZ;
  var count = nCols * ROWS;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(FOG_COLOR, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = false;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

  var camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.15,
    90
  );
  camera.position.set(0, 1.8, 12.5);

  function strokePolys(g, s, polys, fat, thin) {
    var sc = s * 0.34;
    var i;
    var j;
    var p;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "rgba(190,255,210,0.32)";
    g.lineWidth = s * fat;
    for (i = 0; i < polys.length; i++) {
      p = polys[i];
      g.beginPath();
      g.moveTo(p[0] * sc, p[1] * sc);
      for (j = 2; j < p.length; j += 2) g.lineTo(p[j] * sc, p[j + 1] * sc);
      g.stroke();
    }
    g.strokeStyle = "#fff";
    g.lineWidth = s * thin;
    for (i = 0; i < polys.length; i++) {
      p = polys[i];
      g.beginPath();
      g.moveTo(p[0] * sc, p[1] * sc);
      for (j = 2; j < p.length; j += 2) g.lineTo(p[j] * sc, p[j + 1] * sc);
      g.stroke();
    }
  }

  function fillMarks(g, s, dots, rScale) {
    var sc = s * 0.34;
    var i;
    var r = s * rScale;
    g.fillStyle = "rgba(200,255,215,0.28)";
    for (i = 0; i < dots.length; i += 2) {
      g.beginPath();
      g.arc(dots[i] * sc, dots[i + 1] * sc, r * 1.7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#fff";
    for (i = 0; i < dots.length; i += 2) {
      g.beginPath();
      g.arc(dots[i] * sc, dots[i + 1] * sc, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  var SEG = [
    [-0.72, -0.88, 0.72, -0.88],
    [0.78, -0.8, 0.78, -0.08],
    [0.78, 0.08, 0.78, 0.8],
    [-0.72, 0.88, 0.72, 0.88],
    [-0.78, 0.08, -0.78, 0.8],
    [-0.78, -0.8, -0.78, -0.08],
    [-0.68, 0.0, 0.68, 0.0],
  ];
  var HEXMASK = [
    0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c,
    0x39, 0x5e, 0x79, 0x71,
  ];

  function glyphPolys(id) {
    if (id < 16) {
      var m = HEXMASK[id];
      var out = [];
      var s;
      for (s = 0; s < 7; s++) {
        if (m & (1 << s)) out.push(SEG[s]);
      }
      return out;
    }
    switch (id) {
      case 16:
        return [[0, -0.92, 0, 0.92]];
      case 17:
        return [
          [-0.28, -0.92, -0.28, 0.92],
          [0.28, -0.92, 0.28, 0.92],
        ];
      case 18:
        return [];
      case 19:
        return [[0, -0.95, 0.78, 0, 0, 0.95, -0.78, 0, 0, -0.95]];
      case 20:
        return [
          [0, -0.9, 0.72, 0],
          [0.72, 0, 0, 0.9],
          [0, 0.9, -0.72, 0],
          [-0.72, 0, 0, -0.9],
        ];
      case 21:
        return [[0, -0.9, 0.82, 0.78, -0.82, 0.78, 0, -0.9]];
      case 22:
        return [[-0.82, -0.78, 0.82, -0.78, 0, 0.9, -0.82, -0.78]];
      case 23:
        return [
          [-0.7, -0.55, 0, 0.15, 0.7, -0.55],
          [-0.7, 0.05, 0, 0.75, 0.7, 0.05],
        ];
      case 24:
        return [
          [-0.7, 0.55, 0, -0.15, 0.7, 0.55],
          [-0.7, -0.05, 0, -0.75, 0.7, -0.05],
        ];
      case 25:
        return [
          [0, -0.88, 0, 0.88],
          [-0.88, 0, 0.88, 0],
        ];
      case 26:
        return [
          [-0.72, -0.72, 0.72, 0.72],
          [0.72, -0.72, -0.72, 0.72],
        ];
      case 27:
        return [
          [-0.35, -0.85, -0.35, 0.85],
          [0.35, -0.85, 0.35, 0.85],
          [-0.85, -0.35, 0.85, -0.35],
          [-0.85, 0.35, 0.85, 0.35],
        ];
      case 28:
        return [];
      case 29:
        return [];
      case 30:
        return [
          [-0.7, -0.7, 0.7, -0.7, 0.7, 0.7, -0.7, 0.7, -0.7, -0.7],
        ];
      case 31:
        return [
          [-0.8, -0.85, 0.8, -0.85],
          [0, -0.85, 0, 0.9],
        ];
      case 32:
        return [
          [-0.75, 0.75, -0.75, -0.75, 0.75, -0.75],
        ];
      case 33:
        return [
          [0.75, -0.75, 0.75, 0.75, -0.75, 0.75],
        ];
      case 34:
        return [[-0.85, -0.55, -0.28, 0.2, 0.28, -0.2, 0.85, 0.55]];
      case 35:
        return [[-0.9, 0.15, -0.45, -0.55, 0, 0.15, 0.45, -0.55, 0.9, 0.15]];
      case 36:
        return [
          [0, -0.85, 0, 0.55],
          [-0.62, 0.05, 0, 0.85, 0.62, 0.05],
        ];
      case 37:
        return [
          [0, 0.85, 0, -0.55],
          [-0.62, -0.05, 0, -0.85, 0.62, -0.05],
        ];
      case 38:
        return [
          [-0.45, -0.85, -0.8, -0.85, -0.8, 0.85, -0.45, 0.85],
          [0.45, -0.85, 0.8, -0.85, 0.8, 0.85, 0.45, 0.85],
        ];
      case 39:
        return [
          [0, -0.88, -0.72, 0.88],
          [0, -0.2, 0.78, 0.88],
        ];
      case 40:
        return [
          [-0.7, -0.85, 0.7, -0.85, -0.7, 0.85, 0.7, 0.85, -0.7, -0.85],
        ];
      case 41:
        return [
          [0, -0.88, 0, 0.88],
          [-0.76, -0.44, 0.76, 0.44],
          [0.76, -0.44, -0.76, 0.44],
        ];
      case 42:
        return [
          [-0.7, -0.28, 0.7, -0.28],
          [-0.7, 0.28, 0.7, 0.28],
        ];
      case 43:
        return [];
      case 44:
        return [];
      case 45:
        return [
          [-0.78, -0.82, 0.78, -0.82, 0.78, -0.05, -0.78, -0.05, -0.78, -0.82],
        ];
      case 46:
        return [
          [-0.78, 0.05, 0.78, 0.05, 0.78, 0.82, -0.78, 0.82, -0.78, 0.05],
        ];
      case 47:
        return [
          [-0.82, -0.78, -0.05, -0.78, -0.05, 0.78, -0.82, 0.78, -0.82, -0.78],
        ];
      case 48:
        return [
          [-0.85, 0.7, -0.15, 0.7, -0.15, 0.0, 0.55, 0.0, 0.55, -0.7, 0.85, -0.7],
        ];
      case 49:
        return [
          [-0.85, 0, 0.85, 0],
          [0, 0, 0, 0.85],
          [0.85, 0, 0.85, -0.55],
        ];
      case 50:
        return [
          [-0.78, -0.55, -0.78, -0.85, 0.78, -0.85, 0.78, -0.55],
          [-0.28, -0.85, -0.28, 0.88],
          [0.28, -0.85, 0.28, 0.88],
        ];
      case 51:
        return [
          [0.7, -0.85, -0.7, -0.85, -0.7, 0, 0.45, 0],
          [-0.7, 0, -0.7, 0.85, 0.7, 0.85],
        ];
      case 52:
        return [
          [-0.85, -0.7, 0.85, 0.7],
          [0.85, -0.7, -0.85, 0.7],
          [-0.85, -0.7, 0.85, -0.7],
          [-0.85, 0.7, 0.85, 0.7],
        ];
      case 53:
        return [
          [0.0, -0.95, 0.82, -0.45, 0.82, 0.45, 0.0, 0.95, -0.82, 0.45, -0.82, -0.45, 0.0, -0.95],
        ];
      case 54:
        return [
          [0, -0.95, 0.22, -0.22, 0.95, 0, 0.22, 0.22, 0, 0.95, -0.22, 0.22, -0.95, 0, -0.22, -0.22, 0, -0.95],
        ];
      case 55:
        return [[-0.7, 0.82, 0.7, -0.82]];
      case 56:
        return [[-0.7, -0.82, 0.7, 0.82]];
      case 57:
        return [[-0.8, 0.78, 0.8, 0.78]];
      case 58:
        return [[-0.8, -0.78, 0.8, -0.78]];
      case 59:
        return [
          [-0.7, -0.35, 0.7, -0.35],
          [0, -0.75, 0, 0.05],
          [-0.7, 0.55, 0.7, 0.55],
        ];
      case 60:
        return [
          [0, -0.55, 0.45, 0, 0, 0.55, -0.45, 0, 0, -0.55],
          [0, 0.55, 0, 0.9],
        ];
      case 61:
        return [
          [-0.85, -0.85, 0.85, -0.85, 0.85, 0.85, -0.85, 0.85, -0.85, -0.85],
          [-0.42, -0.42, 0.42, -0.42, 0.42, 0.42, -0.42, 0.42, -0.42, -0.42],
        ];
      case 62:
        return [
          [0, -0.8, 0, 0.8],
          [-0.8, 0, 0.8, 0],
          [-0.8, -0.8, 0.8, -0.8, 0.8, 0.8, -0.8, 0.8, -0.8, -0.8],
        ];
      default:
        return [
          [-0.6, -0.7, 0.15, -0.15, 0.7, -0.55],
          [-0.2, 0.1, 0.55, 0.75],
          [-0.75, 0.45, -0.15, 0.85],
        ];
    }
  }

  function drawGlyph(g, id, s) {
    g.beginPath();
    g.rect(-s * 0.48, -s * 0.48, s * 0.96, s * 0.96);
    g.clip();
    if (id === 18) {
      fillMarks(g, s, [0, -0.62, 0, 0, 0, 0.62], 0.055);
      return;
    }
    if (id === 28) {
      var sc = s * 0.34;
      g.strokeStyle = "rgba(190,255,210,0.32)";
      g.lineWidth = s * 0.1;
      g.beginPath();
      g.arc(0, 0, sc * 0.85, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "#fff";
      g.lineWidth = s * 0.048;
      g.beginPath();
      g.arc(0, 0, sc * 0.85, 0, Math.PI * 2);
      g.stroke();
      return;
    }
    if (id === 29) {
      g.fillStyle = "rgba(200,255,215,0.22)";
      g.fillRect(-s * 0.26, -s * 0.26, s * 0.52, s * 0.52);
      g.fillStyle = "#fff";
      g.fillRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.4);
      return;
    }
    if (id === 43) {
      fillMarks(g, s, [0, -0.38, 0, 0.38], 0.058);
      return;
    }
    if (id === 44) {
      g.fillStyle = "rgba(200,255,215,0.2)";
      g.fillRect(-s * 0.28, -s * 0.32, s * 0.56, s * 0.64);
      g.fillStyle = "#edfff2";
      g.fillRect(-s * 0.22, -s * 0.26, s * 0.44, s * 0.52);
      return;
    }
    strokePolys(g, s, glyphPolys(id), 0.1, 0.046);
  }

  function makeAtlas() {
    var S = 64;
    var c = document.createElement("canvas");
    c.width = c.height = ATLAS_N * S;
    var g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    var i;
    for (i = 0; i < ATLAS_GLYPHS; i++) {
      g.save();
      g.translate((i % ATLAS_N) * S + S * 0.5, ((i / ATLAS_N) | 0) * S + S * 0.5);
      drawGlyph(g, i, S);
      g.restore();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  var atlas = makeAtlas();

  var geo = new THREE.PlaneBufferGeometry(1, 1);
  var aGlyph = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  var aBright = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  var aTint = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  aGlyph.setUsage(THREE.DynamicDrawUsage);
  aBright.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aGlyph", aGlyph);
  geo.setAttribute("aBright", aBright);
  geo.setAttribute("aTint", aTint);

  var uniforms = {
    atlas: { value: atlas },
    uFogDensity: { value: FOG_DENSITY },
  };

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: [
      "attribute float aGlyph;",
      "attribute float aBright;",
      "attribute float aTint;",
      "varying vec2 vUv;",
      "varying float vBright;",
      "varying float vTint;",
      "varying float vFog;",
      "uniform float uFogDensity;",
      "void main() {",
      "  vec3 transformed = position;",
      "  #ifdef USE_INSTANCING",
      "  transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;",
      "  #endif",
      "  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);",
      "  gl_Position = projectionMatrix * mv;",
      "  float gi = floor(aGlyph + 0.5);",
      "  float gx = mod(gi, 8.0);",
      "  float gy = floor(gi / 8.0);",
      "  vUv = vec2((gx + uv.x) / 8.0, (gy + 1.0 - uv.y) / 8.0);",
      "  vBright = aBright;",
      "  vTint = aTint;",
      "  float depth = length(mv.xyz);",
      "  vFog = exp(-uFogDensity * uFogDensity * depth * depth);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision mediump float;",
      "uniform sampler2D atlas;",
      "varying vec2 vUv;",
      "varying float vBright;",
      "varying float vTint;",
      "varying float vFog;",
      "void main() {",
      "  vec4 t = texture2D(atlas, vUv);",
      "  float m = max(t.r, t.a);",
      "  if (m < 0.05) discard;",
      "  vec3 cold = vec3(0.10, 0.70, 0.36);",
      "  vec3 warm = vec3(0.42, 0.98, 0.18);",
      "  vec3 base = mix(cold, warm, vTint);",
      "  vec3 head = vec3(0.84, 1.0, 0.90);",
      "  vec3 col = mix(base * 0.22, mix(base, head, 0.55), vBright);",
      "  col *= m;",
      "  col += head * m * vBright * vBright * 0.55;",
      "  col *= vFog;",
      "  gl_FragColor = vec4(col, m);",
      "}",
    ].join("\n"),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });

  var mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  scene.add(mesh);

  var dummy = new THREE.Object3D();
  var head = new Float32Array(nCols);
  var speed = new Float32Array(nCols);
  var trail = new Float32Array(nCols);
  var tint = new Float32Array(nCols);
  var hot = new Uint8Array(nCols);
  var residual = new Float32Array(nCols);
  var glyphs = new Uint8Array(count);

  function colIndex(ix, iz) {
    return iz * NX + ix;
  }

  function planeX(ix, iz) {
    var stagger = iz ? ((iz % 2) * 0.5 * SPACE_X) : 0;
    return (ix - (NX - 1) * 0.5) * SPACE_X + stagger;
  }

  function planeZ(iz) {
    return -iz * SPACE_Z;
  }

  function planeY(row) {
    return ((ROWS - 1) * 0.5 - row) * CELL_H;
  }

  function hash01(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }

  function seedColumn(c) {
    speed[c] = SPEED_MIN + hash01(c * 19 + 3) * (SPEED_MAX - SPEED_MIN);
    trail[c] = LEN_MIN + hash01(c * 37 + 11) * (LEN_MAX - LEN_MIN);
    tint[c] = hash01(c * 53 + 7);
    hot[c] = hash01(c * 71 + 13) > 0.82 ? 1 : 0;
    residual[c] = 0.09 + hash01(c * 97 + 17) * 0.1;
    head[c] = hash01(c * 23 + 5) * (ROWS + trail[c]) - trail[c] * 0.4;
    var r;
    var base = c * ROWS;
    for (r = 0; r < ROWS; r++) {
      glyphs[base + r] = (hash01(c * 131 + r * 17 + 9) * ATLAS_GLYPHS) | 0;
    }
  }

  function respawn(c) {
    speed[c] = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    trail[c] = LEN_MIN + Math.random() * (LEN_MAX - LEN_MIN);
    head[c] = -2 - Math.random() * 9;
    hot[c] = Math.random() > 0.8 ? 1 : 0;
  }

  (function place() {
    var iz;
    var ix;
    var row;
    var c;
    var i;
    for (iz = 0; iz < NZ; iz++) {
      for (ix = 0; ix < NX; ix++) {
        c = colIndex(ix, iz);
        seedColumn(c);
        for (row = 0; row < ROWS; row++) {
          i = c * ROWS + row;
          var yaw = (iz - (NZ - 1) * 0.5) * 0.08;
          var lx = planeX(ix, iz);
          var ly = planeY(row);
          var cy = Math.cos(yaw);
          var sy = Math.sin(yaw);
          dummy.position.set(lx * cy, ly, planeZ(iz) - lx * sy);
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.set(CELL_W * 0.9, CELL_H * 0.88, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          aTint.array[i] = tint[c];
          aGlyph.array[i] = glyphs[i];
          aBright.array[i] = 0;
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    aTint.needsUpdate = true;
    aGlyph.needsUpdate = true;
    aBright.needsUpdate = true;
  })();

  (function addFloor() {
    var y = planeY(ROWS - 1) - CELL_H * 0.7;
    var x0 = planeX(0, 0) - 1.6;
    var x1 = planeX(NX - 1, 1) + 1.6;
    var z0 = 3.5;
    var z1 = planeZ(NZ - 1) - 4.0;
    var nxg = reduced ? 8 : 14;
    var nzg = reduced ? 8 : 16;
    var pts = [];
    var i;
    var t;
    var x;
    var z;
    for (i = 0; i <= nxg; i++) {
      t = i / nxg;
      x = x0 + (x1 - x0) * t;
      pts.push(x, y, z0, x, y, z1);
    }
    for (i = 0; i <= nzg; i++) {
      t = i / nzg;
      z = z0 + (z1 - z0) * t;
      pts.push(x0, y, z, x1, y, z);
    }
    var lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    var lines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({
        color: 0x063018,
        transparent: true,
        opacity: reduced ? 0.22 : 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: true,
      })
    );
    scene.add(lines);
  })();

  function brightnessAt(c, row) {
    var dist = head[c] - row;
    var len = trail[c];
    var b;
    if (dist >= -0.45 && dist < 0.7) {
      b = 0.78 + (hot[c] ? 0.22 : 0.12);
      if (dist < 0) b *= 0.55 + 0.45 * (dist + 0.45) / 0.45;
      return b;
    }
    if (dist > 0 && dist < len) {
      b = Math.pow(1 - dist / len, 1.35);
      return (hot[c] ? 0.62 : 0.48) * b;
    }
    if (dist < -0.45 && dist > -2.2) {
      return residual[c] * 0.55;
    }
    return residual[c] * (0.55 + 0.45 * hash01(((c + 1) * 64 + row) | 0));
  }

  function stepRain(dt) {
    var c;
    var row;
    var i;
    var b;
    var mut;
    for (c = 0; c < nCols; c++) {
      head[c] += speed[c] * dt;
      if (head[c] > ROWS + trail[c] + 1.5) {
        respawn(c);
      }
      for (row = 0; row < ROWS; row++) {
        i = c * ROWS + row;
        b = brightnessAt(c, row);
        if (b > 0.72) mut = MUTATE_HEAD * dt;
        else if (b > 0.08) mut = MUTATE_TRAIL * dt;
        else mut = 0.12 * dt;
        if (Math.random() < mut) {
          glyphs[i] = (Math.random() * ATLAS_GLYPHS) | 0;
        }
        aGlyph.array[i] = glyphs[i];
        aBright.array[i] = b;
      }
    }
    aGlyph.needsUpdate = true;
    aBright.needsUpdate = true;
  }

  function updateCamera(t) {
    var ax = t * CAM_SPEED;
    var px = Math.sin(ax * 0.39) * 4.2 + Math.sin(ax * 0.17) * 1.15;
    var py = 1.15 + Math.sin(ax * 0.25) * 2.35 + Math.sin(ax * 0.09) * 0.5;
    var pz = 8.6 + Math.cos(ax * 0.21) * 5.0;
    camera.position.set(px, py, pz);
    camera.lookAt(
      Math.sin(ax * 0.18) * 1.6,
      0.15 + Math.sin(ax * 0.13) * 0.95,
      -7.0 + Math.cos(ax * 0.11) * 3.4
    );
    camera.up.set(Math.sin(ax * 0.05) * 0.1, 1, 0);
  }

  var last = 0;
  var elapsed = 0;
  var raf = 0;
  var running = false;

  function frame(now) {
    raf = 0;
    if (!running) return;
    if (document.hidden) {
      running = false;
      return;
    }
    var dt = Math.min(0.05, (now - last) * 0.001);
    last = now;
    elapsed += dt;
    stepRain(dt);
    updateCamera(elapsed);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onResize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    if (!running) renderer.render(scene, camera);
  }

  window.addEventListener("resize", onResize, false);
  document.addEventListener(
    "visibilitychange",
    function () {
      if (document.hidden) stop();
      else play();
    },
    false
  );

  try {
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var onMq = function (ev) {
      reduced = ev.matches;
      CAM_SPEED = reduced ? 0.12 : 0.38;
      SPEED_MIN = reduced ? 1.1 : 3.4;
      SPEED_MAX = reduced ? 2.8 : 9.8;
    };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else if (mq.addListener) mq.addListener(onMq);
  } catch (e2) {}

  stepRain(0);
  updateCamera(0);
  renderer.render(scene, camera);
  play();
})();
