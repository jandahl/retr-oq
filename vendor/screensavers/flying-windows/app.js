const scene = new THREE.Scene();
const fov = 75;
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setClearColor(0x000000, 1);

function greenlandFlagTexture() {
  // Erfalasorput: 12×18 units, disk diameter 8, center 7 from the hoist.
  const unit = 16;
  const c = document.createElement("canvas");
  c.width = 18 * unit;
  c.height = 12 * unit;
  const g = c.getContext("2d");
  const red = "#C8102E";
  const white = "#FFFFFF";
  g.fillStyle = red;
  g.fillRect(0, 0, c.width, c.height / 2);
  g.fillStyle = white;
  g.fillRect(0, c.height / 2, c.width, c.height / 2);
  const cx = c.width * (7 / 18);
  const cy = c.height / 2;
  const r = c.height * (8 / 12) / 2;
  g.save();
  g.beginPath();
  g.rect(0, 0, c.width, c.height / 2);
  g.clip();
  g.fillStyle = white;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.beginPath();
  g.rect(0, c.height / 2, c.width, c.height / 2);
  g.clip();
  g.fillStyle = red;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function viewSize() {
  const vv = window.visualViewport;
  return {
    w: Math.max(1, Math.floor((vv && vv.width) || window.innerWidth || 320)),
    h: Math.max(1, Math.floor((vv && vv.height) || window.innerHeight || 200)),
  };
}

function applyRendererSize() {
  const s = viewSize();
  camera.aspect = s.w / s.h;
  camera.updateProjectionMatrix();
  renderer.setSize(s.w, s.h, false);
  const el = renderer.domElement;
  el.style.position = "fixed";
  el.style.inset = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.display = "block";
  el.style.background = "#000";
}

applyRendererSize();
document.body.appendChild(renderer.domElement);

const flyingWindows = createFlyingWindows(40);
flyingWindows.forEach(flyingWindow => scene.add(flyingWindow));

camera.position.z = 2;

animate();
window.addEventListener("resize", onWindowResize, false);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", onWindowResize);
}

function animate() {
  requestAnimationFrame(animate);
  camera.position.z -= 0.7;

  flyingWindows.forEach(flyingWindow => {
    if (camera.position.z < flyingWindow.position.z) {
      randomlyPositionFlyingWindow(flyingWindow, camera);
    }
  });

  renderer.render(scene, camera);
}

function createFlyingWindows(qty) {
  const width = 1.5;
  const height = 1;
  const depth = 0.01;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const flyingWindows = [];

  const windowImageMaterial = new THREE.MeshBasicMaterial({
    map: greenlandFlagTexture(),
    transparent: false,
    side: THREE.FrontSide,
  });

  const blackMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: 1,
  });

  for (let i = 0; i < qty; i++) {
    const color = getRandomColor();
    const colorMaterial = new THREE.MeshBasicMaterial({
      color,
      side: THREE.BackSide,
    });

    const materials = [
      blackMaterial,
      blackMaterial,
      blackMaterial,
      blackMaterial,
      windowImageMaterial,
      colorMaterial,
    ];

    const flyingWindow = new THREE.Mesh(geometry, materials);
    randomlyPositionFlyingWindow(flyingWindow, camera);
    flyingWindows.push(flyingWindow);
  }

  return flyingWindows;
}

function randomlyPositionFlyingWindow(flyingWindow, camera) {
  flyingWindow.position.z = camera.position.z - Math.floor(Math.random() * 50) - 100;
  const distance = Math.abs(camera.position.z - flyingWindow.position.z);

  flyingWindow.position.x = Math.floor(Math.random() * (distance / 3)) + 0.5;
  flyingWindow.position.y = Math.floor(Math.random() * (distance / 3)) + 0.5;

  if (Math.random() > 0.5) {
    flyingWindow.position.x *= -1;
  }

  if (Math.random() > 0.5) {
    flyingWindow.position.y *= -1;
  }

  const color = getRandomColor();
  flyingWindow.material[0].color.setHex = color;
  flyingWindow.material[1].color.setHex = color;
  flyingWindow.material[2].color.setHex = color;
  flyingWindow.material[3].color.setHex = color;
  flyingWindow.material[5].color.setHex = color;
}

function onWindowResize() {
  applyRendererSize();
}
