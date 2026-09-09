import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

const MODELS = {
  'nes/': 'assets/console-ring/models/nes_console.glb',
  'snes/': 'assets/console-ring/models/snes_mini_3_version.glb',
  'c64/': 'assets/console-ring/models/commodore_64_computer.glb',
  'amiga/': 'assets/console-ring/models/commodore_amiga_500_computer.glb',
};

const loader = new GLTFLoader();
const viewers = [];

function fitModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 2.1 / Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = false;
      node.receiveShadow = false;
      if (node.material) node.material.envMapIntensity = 0.45;
    }
  });
}

function makeViewer(canvas, url) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(116, 92, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 116 / 92, 0.01, 100);
  camera.position.set(0, 0.35, 6.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffe8bd, 0x160b13, 1.45));
  const key = new THREE.DirectionalLight(0xfff0cb, 2.2);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7d8dff, 0.65);
  fill.position.set(4, 1, -3);
  scene.add(fill);
  const pivot = new THREE.Group();
  scene.add(pivot);
  loader.load(url, (gltf) => {
    fitModel(gltf.scene);
    pivot.add(gltf.scene);
  });
  const viewer = { canvas, renderer, scene, camera, pivot };
  viewers.push(viewer);
  return viewer;
}

function init() {
  for (let index = viewers.length - 1; index >= 0; index -= 1) {
    if (!viewers[index].canvas.isConnected) {
      viewers[index].renderer.dispose();
      viewers.splice(index, 1);
    }
  }
  document.querySelectorAll('.inventory-item:not(.inventory-item--exit)').forEach((item) => {
    const href = item.href.slice(item.href.indexOf(location.host) + location.host.length).replace(/^\//, '');
    const path = MODELS[href];
    if (!path || item.querySelector('canvas')) return;
    const icon = item.querySelector('.inventory-item__icon');
    icon.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.className = 'inventory-model-canvas';
    canvas.width = 116;
    canvas.height = 92;
    icon.appendChild(canvas);
    makeViewer(canvas, path);
  });
  if (window.__console3dLoop) return;
  window.__console3dLoop = true;
  const frame = () => {
    viewers.forEach((viewer) => {
      if (viewer.canvas.closest('.inventory-item')?.classList.contains('is-selected')) {
        viewer.pivot.rotation.y += 0.006;
      }
      viewer.renderer.render(viewer.scene, viewer.camera);
    });
    requestAnimationFrame(frame);
  };
  frame();
}

window.addEventListener('load', init);
window.addEventListener('hashchange', () => {
  if (location.hash === '#console') window.setTimeout(init, 0);
});
