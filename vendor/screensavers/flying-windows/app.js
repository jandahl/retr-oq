const scene = new THREE.Scene();
const fov = 75;
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
const renderer = new THREE.WebGLRenderer();
const loader = new THREE.TextureLoader();

function gagWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 208;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#c0c0c0";
  g.fillRect(8, 8, 240, 24);
  g.fillStyle = "#000080";
  g.fillRect(12, 12, 160, 16);
  const panes = [
    ["#c00000", 16, 44],
    ["#00a000", 132, 44],
    ["#0000c0", 16, 124],
    ["#c0c000", 132, 124],
  ];
  for (const [color, x, y] of panes) {
    g.fillStyle = color;
    g.fillRect(x, y, 108, 72);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(x + 8, y + 8, 40, 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const flyingWindows = createFlyingWindows(40);
flyingWindows.forEach(flyingWindow => scene.add(flyingWindow));

camera.position.z = 2;

animate();
window.addEventListener('resize', onWindowResize, false);

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
  const width = 1.235;
  const height = 1;
  const depth = 0.01;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const flyingWindows = [];

  const windowImageMaterial = new THREE.MeshBasicMaterial({
    map: gagWindowTexture(),
    transparent: true,
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
