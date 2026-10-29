// The 3D PC case on the Build page, drawn with three.js. Each part is a real 3D model when its
// .glb file is set in pcModels.js, or else a detailed shape drawn in code, so the page always
// works. Models are general, not one per product.
//
// A part that is not chosen yet is a clean outline of where it goes (a "blueprint" box), so a
// beginner sees where each part sits without layers of see-through shapes. When the user chooses
// it, the real part drops into place with an orange flash, so the user watches the PC being built.
// The parts sit where they go in a real PC: the graphics card lies flat in the top PCIe slot, the
// tower cooler's fins stand out from the board, the power supply is under the shroud.
//
// Drag to turn it around. It turns slowly by itself until the user drags it, and stops while the
// pointer is over it so the circles are easy to reach. A circle (a real <button>) sits on each
// part and opens the picker. If WebGL is not available, createPcScene throws and the page falls
// back to the flat SVG drawing (pcCase.js).
//
// Colors: the scene is a dark showroom in both themes. Its fixed colors are below; the orange
// accent comes from the --color-stage-accent token in base.css. The small pictures on the parts
// (circuit lines, the front mesh, labels) are drawn on a canvas here, so no image files are needed.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { PART_MODELS } from '/js/pcModels.js';
import { t } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

// The case, in scene units (about 10 cm each): front at -x, back at +x, glass side at +z
const CASE = { depth: 4.4, height: 4.6, width: 2.2 };
const FLOOR_Y = -CASE.height / 2 - 0.14;
const DROP_MS = 700; // how long a new part takes to drop into place

// A black case with silver and white parts, so every part stands out from the case
const COLORS = {
  caseBody: 0x1a1d22,
  tray: 0x101216,
  pcb: 0x15181d,
  dark: 0x24282f,
  slot: 0x0c0d10,
  shroud: 0x2a2f37,
  silver: 0xc9ced6,
  white: 0xe9ecf0,
  copper: 0xd39a5f,
  sleeve: 0x16181c,
  glass: 0xffffff,
  edge: 0x3a404a,
  outline: 0xe8ebf0,
};

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// ---------- Materials, pictures and shapes ----------

function standard(color, { metalness = 0.3, roughness = 0.5, map = null } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, map });
}

const metal = (color = COLORS.silver, roughness = 0.3) => standard(color, { metalness: 0.95, roughness });
const brushed = (color = COLORS.silver) => standard(color, { metalness: 0.85, roughness: 0.42 });
const matte = (color, roughness = 0.75) => standard(color, { metalness: 0.15, roughness });

function glowMaterial(accent, intensity = 1.4) {
  const material = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: intensity, roughness: 0.4 });
  material.userData.isGlow = true;
  material.userData.glow = intensity;
  return material;
}

// A picture drawn on a canvas, used as a texture (circuit lines, mesh holes, labels)
function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// A box with rounded edges (radius in scene units)
function rbox(width, height, depth, material, radius = 0.03) {
  const r = Math.min(radius, width / 2, height / 2, depth / 2);
  return new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, r), material);
}

function cylinder(radius, length, material, segments = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
}

// A 120 mm style fan facing +z: square frame, a thin lit ring, hub and curved blades
// (the blades are returned so they can spin)
function makeFan(size, accent, frameColor, { ring = true } = {}) {
  const group = new THREE.Group();
  const bar = size * 0.1;
  const frame = matte(frameColor, 0.6);
  for (const [w, h, x, y] of [
    [size, bar, 0, (size - bar) / 2], [size, bar, 0, -(size - bar) / 2],
    [bar, size, (size - bar) / 2, 0], [bar, size, -(size - bar) / 2, 0],
  ]) {
    const side = rbox(w, h, 0.14, frame, 0.02);
    side.position.set(x, y, 0);
    group.add(side);
  }
  // The round opening inside the square frame
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.47, size * 0.47, 0.13, 40, 1, true), frame);
  shell.rotation.x = Math.PI / 2;
  group.add(shell);
  if (ring) {
    const glow = new THREE.Mesh(new THREE.TorusGeometry(size * 0.455, size * 0.012, 8, 64), glowMaterial(accent, 1.1));
    glow.position.z = 0.07;
    group.add(glow);
  }

  const hub = cylinder(size * 0.14, 0.12, matte(frameColor, 0.5), 32);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  const cap = cylinder(size * 0.1, 0.01, matte(frameColor === COLORS.white ? COLORS.silver : COLORS.edge, 0.4), 32);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.066;
  group.add(cap);

  // Seven wide blades, twisted, so the fan reads as a fan even at a small size
  const blades = new THREE.Group();
  const bladeMaterial = standard(frameColor, { roughness: 0.45, metalness: 0.1 });
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -size * 0.05);
  bladeShape.quadraticCurveTo(size * 0.2, -size * 0.12, size * 0.33, -size * 0.02);
  bladeShape.quadraticCurveTo(size * 0.26, size * 0.12, 0, size * 0.07);
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.012, bevelEnabled: false });
  for (let i = 0; i < 7; i += 1) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 7) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.x = size * 0.11;
    blade.rotation.x = 0.45;
    pivot.add(blade);
    blades.add(pivot);
  }
  group.add(blades);
  return { group, blades };
}

// A soft round cable through the given points (a sleeved power cable)
function cable(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), material);
}

// ---------- Pictures drawn on canvas ----------

// The motherboard: dark board with faint circuit lines, white print around the slots and screw holes.
// box: the board in scene units; marks: rectangles to outline, in scene units too.
function pcbTexture(box, marks) {
  const scale = 200; // pixels per scene unit
  const width = Math.round((box.x1 - box.x0) * scale);
  const height = Math.round((box.y1 - box.y0) * scale);
  const px = (x) => (x - box.x0) * scale;
  const py = (y) => (box.y1 - y) * scale;
  return canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = '#16191f';
    ctx.fillRect(0, 0, width, height);
    // Circuit lines: thin, a bit lighter than the board, in straight runs with 45 degree turns
    ctx.strokeStyle = 'rgba(80, 92, 110, 0.35)';
    ctx.lineWidth = 1.2;
    let seed = 7;
    const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 140; i += 1) {
      let x = random() * width;
      let y = random() * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 3; step += 1) {
        const run = 20 + random() * 70;
        if (step % 2 === 0) x += random() > 0.5 ? run : -run;
        else { x += run * 0.5; y += random() > 0.5 ? run * 0.5 : -run * 0.5; }
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // White print around the slots and parts
    ctx.strokeStyle = 'rgba(220, 226, 235, 0.55)';
    ctx.lineWidth = 2;
    for (const [x0, y0, x1, y1] of marks) {
      ctx.strokeRect(px(x0), py(y1), (x1 - x0) * scale, (y1 - y0) * scale);
    }
    // Screw holes with a metal ring
    for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.5], [0.92, 0.5], [0.08, 0.93], [0.6, 0.93], [0.92, 0.93]]) {
      ctx.beginPath();
      ctx.arc(x * width, y * height, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#b9bfc8';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x * width, y * height, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0c0f';
      ctx.fill();
    }
    // Small chips and resistors
    ctx.fillStyle = '#0d0f12';
    for (let i = 0; i < 26; i += 1) {
      ctx.fillRect(random() * width, random() * height, 8 + random() * 18, 6 + random() * 10);
    }
  });
}

// The front of the case: a fine mesh of round holes
function meshTexture() {
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1b1e23';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#07080a';
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        ctx.beginPath();
        ctx.arc(x * 16 + (y % 2) * 8 + 4, y * 16 + 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 10);
  return texture;
}

// The back plate of the graphics card: dark metal with rows of air slots
function backplateTexture() {
  return canvasTexture(512, 220, (ctx, w, h) => {
    ctx.fillStyle = '#2c3038';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#121418';
    for (let row = 0; row < 3; row += 1) {
      for (let i = 0; i < 18; i += 1) ctx.fillRect(250 + i * 13, 40 + row * 55, 6, 36);
    }
    ctx.strokeStyle = 'rgba(200, 206, 214, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, h - 30);
    ctx.lineTo(200, h - 30);
    ctx.lineTo(230, 30);
    ctx.stroke();
  });
}

// The side of the power supply: a white label with grey lines and boxes (no words or numbers)
function labelTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e7eaee';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9aa1ab';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(18, 18 + i * 13, 90 + (i % 3) * 30, 5);
    ctx.strokeStyle = '#9aa1ab';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) ctx.strokeRect(150 + i * 24, 20, 18, 18);
    ctx.fillStyle = '#2b2f36';
    for (let i = 0; i < 26; i += 1) ctx.fillRect(150 + i * 3.6, 60, i % 3 === 0 ? 2.4 : 1.2, 44);
  });
}

// ---------- The scene ----------

// onModels(slugs): called once the model files have loaded, with the parts that have a real model
// zoom: false on the home page, so the mouse wheel scrolls the page instead of zooming
// distance: how far the camera starts (1 = the Build page; bigger leaves room around the case)
// gridDivisions: how many squares the floor grid has along each side (more = smaller squares)
export function createPcScene(container, { slugs, categoryName, partInfo, status, onPick, onModels, zoom = true, distance = 1, gridDivisions = 40 }) {
  // WebGLRenderer throws when the browser cannot draw 3D; the caller falls back to the SVG drawing
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Neutral tone mapping keeps the real colors of the parts (white stays white, black stays black)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  RectAreaLightUniformsLib.init();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const accent = new THREE.Color(cssColor('--color-stage-accent', '#ff7a29'));

  const scene = new THREE.Scene();
  // Reflections of a soft room on metal and glass: the biggest step towards a real look
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(-5.4, 2.6, 8.4).multiplyScalar(distance); // a three-quarter view from the front, so the depth shows

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.1, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = zoom;
  controls.minDistance = 5.5;
  controls.maxDistance = Math.max(14, camera.position.length());
  controls.maxPolarAngle = Math.PI * 0.56; // never look from under the floor
  controls.autoRotateSpeed = 0.6;

  // Turning by itself: until the user drags the case, and never while the pointer is over it
  let autoTurn = !reducedMotion;
  let pointerInside = false;
  controls.addEventListener('start', () => { autoTurn = false; });
  container.addEventListener('pointerenter', () => { pointerInside = true; });
  container.addEventListener('pointerleave', () => { pointerInside = false; });

  // Lights, like a product photo: a soft key light that casts shadows, a fill from the other side,
  // a white LED strip inside the top of the case so the parts are clear, and an orange rim
  // light from behind for the stage color
  scene.add(new THREE.HemisphereLight(0xe6ecff, 0x101014, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-5, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.7);
  fill.position.set(7, 2, 5);
  scene.add(fill);
  // Low and from behind, so it outlines the case without coloring the parts inside
  const rim = new THREE.DirectionalLight(accent, 0.8);
  rim.position.set(5, -0.5, -8);
  scene.add(rim);
  const strip = new THREE.RectAreaLight(0xffffff, 2.4, CASE.depth - 0.6, 0.5);
  strip.position.set(0, CASE.height / 2 - 0.12, 0.25);
  strip.lookAt(0, -CASE.height / 2, 0.25);
  scene.add(strip);

  // The floor: catches the shadow of the case, with a faint grid like a showroom
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(40, gridDivisions, accent, COLORS.edge);
  grid.position.y = FLOOR_Y + 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  scene.add(grid);

  // ---------- Parts ----------

  // slug -> { group, ghost, meshes, fans, anchor, ghostEach, chosen, drop }
  const parts = {};
  let spinning = []; // fan blades

  function addPart(slug, anchor, { ghostEach = false } = {}) {
    const group = new THREE.Group();
    scene.add(group);
    parts[slug] = { group, ghost: null, meshes: [], fans: [], anchor: new THREE.Vector3(...anchor), ghostEach, chosen: null, drop: null };
    return parts[slug];
  }

  // Each mesh gets its own copy of the material, so lighting one part up never touches another.
  // noGhost: the object is left out of the part's outline (e.g. cables, which go everywhere).
  function add(part, object, position = [0, 0, 0], rotation = [0, 0, 0], { noGhost = false } = {}) {
    object.position.set(...position);
    object.rotation.set(...rotation);
    object.userData.noGhost = noGhost;
    part.group.add(object);
    object.traverse((child) => {
      if (!child.isMesh) return;
      // A model's mesh can have several materials; each one gets its own copy
      const copy = (material) => material.clone();
      child.material = Array.isArray(child.material) ? child.material.map(copy) : copy(child.material);
      child.castShadow = true;
      child.receiveShadow = true;
      part.meshes.push(child);
    });
    return object;
  }

  function addFan(part, size, position, rotation, frameColor = COLORS.dark, options = {}) {
    const fan = makeFan(size, accent, frameColor, options);
    add(part, fan.group, position, rotation);
    spinning.push(fan.blades);
    part.fans.push(fan.blades);
  }

  const { depth: D, height: H, width: W } = CASE;
  const TRAY_Z = -W / 2 + 0.06; // the inside face of the back tray, where the motherboard sits
  const FACE_FRONT = [0, -Math.PI / 2, 0]; // turns a fan to face the front of the case (-x)
  const FACE_UP = [-Math.PI / 2, 0, 0];
  const FACE_DOWN = [Math.PI / 2, 0, 0];
  const SHROUD_Y = -1.36; // top of the cover over the power supply

  // The motherboard (ATX, 30.5 x 24.4 cm, standing up) and where its slots are
  const BOARD = { x0: -0.6, x1: 1.92, y0: -1.2, y1: 1.95 };
  const SOCKET = { x: 0.92, y: 1.22 };
  const DIMM_X = [0.08, 0.2, 0.32, 0.44];
  const DIMM_Y = 1.25;
  const PCIE_Y = 0.22;      // the top x16 slot, where the graphics card goes
  const PCIE2_Y = -0.62;
  const M2 = { x: 0.95, y: 0.62 };

  // --- Case: panels, tinted glass side with a black frame, mesh front, feet, fans and the shroud ---
  const pcCase = addPart('case', [-D / 2 + 0.2, H / 2 - 0.2, W / 2]);
  const caseMetal = standard(COLORS.caseBody, { metalness: 0.55, roughness: 0.42 });
  add(pcCase, rbox(D, 0.1, W, caseMetal, 0.05), [0, H / 2, 0]);                     // top
  add(pcCase, rbox(D, 0.1, W, caseMetal, 0.05), [0, -H / 2, 0]);                    // bottom
  add(pcCase, rbox(0.1, H, W, caseMetal, 0.04), [D / 2, 0, 0]);                     // back
  add(pcCase, rbox(D, H, 0.06, matte(COLORS.tray, 0.85), 0.02), [0, 0, -W / 2]);    // tray behind the board
  add(pcCase, rbox(0.1, H, W, standard(0xffffff, { roughness: 0.8, metalness: 0.2, map: meshTexture() }), 0.04), [-D / 2, 0, 0]); // mesh front
  // Rubber cable holes in the tray, beside the board and above it
  for (const [w, h, x, y] of [[0.16, 0.8, BOARD.x0 - 0.28, 0.85], [0.16, 0.6, BOARD.x0 - 0.28, -0.4], [0.7, 0.14, 0.3, H / 2 - 0.22]]) {
    add(pcCase, rbox(w, h, 0.02, matte(0x050506, 0.9), 0.06), [x, y, TRAY_Z + 0.005]);
  }
  // The rear panel inside: the slot covers for the expansion cards, and a cutout for the board's ports
  for (let i = 0; i < 5; i += 1) add(pcCase, rbox(0.03, 0.12, 0.7, brushed(COLORS.dark), 0.01), [D / 2 - 0.07, PCIE_Y - 0.05 - i * 0.2, TRAY_Z + 0.5]);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xc4ccd8, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.05, clearcoat: 1, depthWrite: false,
  });
  const pane = add(pcCase, new THREE.Mesh(new THREE.BoxGeometry(D - 0.1, H - 0.1, 0.02), glass), [0, 0, W / 2]);
  pane.castShadow = false;
  for (const [w, h, x, y] of [[D, 0.08, 0, H / 2 - 0.04], [D, 0.08, 0, -H / 2 + 0.04], [0.08, H, -D / 2 + 0.04, 0], [0.08, H, D / 2 - 0.04, 0]]) {
    add(pcCase, rbox(w, h, 0.04, matte(0x0b0c0e, 0.5), 0.01), [x, y, W / 2 + 0.01]); // black glass frame
  }
  for (const x of [-D / 2 + 0.4, D / 2 - 0.4]) {
    for (const z of [-W / 2 + 0.3, W / 2 - 0.3]) add(pcCase, rbox(0.45, 0.14, 0.32, matte(COLORS.tray), 0.06), [x, -H / 2 - 0.07, z]);
  }
  for (const y of [1.6, 0.48]) addFan(pcCase, 1.08, [-D / 2 + 0.17, y, -0.05], FACE_FRONT);        // front intake
  addFan(pcCase, 1.0, [D / 2 - 0.17, 1.5, -0.35], FACE_FRONT);                                      // rear exhaust
  for (const x of [-1.05, 0.15]) addFan(pcCase, 1.0, [x, H / 2 - 0.15, -0.3], FACE_UP);             // top exhaust
  // Shroud over the power supply, with a window at the back where the PSU shows
  add(pcCase, rbox(D - 0.14, 0.06, W - 0.1, caseMetal, 0.02), [0, SHROUD_Y, 0]);
  add(pcCase, rbox(2.6, H / 2 + SHROUD_Y - 0.05, 0.06, caseMetal, 0.02), [-0.85, (SHROUD_Y - H / 2) / 2, W / 2 - 0.1]);
  add(pcCase, rbox(0.2, H / 2 + SHROUD_Y - 0.05, 0.06, caseMetal, 0.02), [D / 2 - 0.16, (SHROUD_Y - H / 2) / 2, W / 2 - 0.1]);

  // --- Motherboard: printed board, slots, power heatsinks, port cover and chipset heatsink ---
  const board = addPart('motherboard', [-0.25, -0.95, TRAY_Z + 0.1]);
  const BOARD_Z = TRAY_Z + 0.04;
  const boardWidth = BOARD.x1 - BOARD.x0;
  const boardHeight = BOARD.y1 - BOARD.y0;
  const marks = [
    [SOCKET.x - 0.38, SOCKET.y - 0.38, SOCKET.x + 0.38, SOCKET.y + 0.38],
    [DIMM_X[0] - 0.06, DIMM_Y - 0.72, DIMM_X[3] + 0.06, DIMM_Y + 0.72],
    [BOARD.x1 - 1.95, PCIE_Y - 0.06, BOARD.x1 - 0.1, PCIE_Y + 0.06],
    [BOARD.x1 - 1.95, PCIE2_Y - 0.06, BOARD.x1 - 0.1, PCIE2_Y + 0.06],
    [M2.x - 0.45, M2.y - 0.12, M2.x + 0.45, M2.y + 0.12],
    [-0.35, -1.1, 0.35, -0.75],
  ];
  const pcb = standard(0xffffff, { metalness: 0.2, roughness: 0.65, map: pcbTexture(BOARD, marks) });
  add(board, rbox(boardWidth, boardHeight, 0.05, pcb, 0.015), [(BOARD.x0 + BOARD.x1) / 2, (BOARD.y0 + BOARD.y1) / 2, BOARD_Z]);
  // CPU socket frame: a metal bracket with a lever (the CPU itself is its own part)
  add(board, rbox(0.82, 0.82, 0.05, brushed(0x9aa1ab), 0.03), [SOCKET.x, SOCKET.y, BOARD_Z + 0.05]);
  add(board, rbox(0.68, 0.68, 0.06, matte(COLORS.slot), 0.02), [SOCKET.x, SOCKET.y, BOARD_Z + 0.06]);
  add(board, cylinder(0.012, 0.75, metal()), [SOCKET.x + 0.45, SOCKET.y, BOARD_Z + 0.08]);
  // Power delivery heatsinks with fins, above and behind the socket
  const vrm = standard(COLORS.dark, { metalness: 0.75, roughness: 0.35 });
  add(board, rbox(0.95, 0.3, 0.26, vrm, 0.04), [SOCKET.x - 0.05, SOCKET.y + 0.58, BOARD_Z + 0.16]);
  add(board, rbox(0.3, 1.0, 0.26, vrm, 0.04), [SOCKET.x + 0.62, SOCKET.y + 0.05, BOARD_Z + 0.16]);
  for (let i = 0; i < 6; i += 1) add(board, rbox(0.9, 0.02, 0.05, brushed(), 0.005), [SOCKET.x - 0.05, SOCKET.y + 0.47 + i * 0.045, BOARD_Z + 0.3]);
  // The port cover at the back top, over the rear ports
  add(board, rbox(0.32, 1.05, 0.5, standard(0x1e2228, { metalness: 0.6, roughness: 0.35 }), 0.05), [BOARD.x1 - 0.2, 1.38, BOARD_Z + 0.28]);
  add(board, rbox(0.02, 0.9, 0.04, glowMaterial(accent, 0.9), 0.005), [BOARD.x1 - 0.37, 1.38, BOARD_Z + 0.51]);
  // Memory slots, the long slots for expansion cards (the top one with a metal shield) and the M.2 slot
  for (const x of DIMM_X) {
    add(board, rbox(0.06, 1.42, 0.08, matte(COLORS.slot), 0.01), [x, DIMM_Y, BOARD_Z + 0.06]);
    add(board, rbox(0.07, 0.07, 0.1, matte(COLORS.edge), 0.01), [x, DIMM_Y + 0.74, BOARD_Z + 0.07]);
  }
  add(board, rbox(0.95, 0.09, 0.1, brushed(), 0.015), [BOARD.x1 - 0.6, PCIE_Y, BOARD_Z + 0.07]);
  add(board, rbox(0.95, 0.07, 0.08, matte(COLORS.slot), 0.01), [BOARD.x1 - 0.6, PCIE2_Y, BOARD_Z + 0.06]);
  add(board, rbox(0.9, 0.22, 0.04, matte(COLORS.slot), 0.01), [M2.x, M2.y, BOARD_Z + 0.04]);
  // Chipset heatsink at the lower front, and the power connectors at the edge
  add(board, rbox(0.72, 0.42, 0.14, standard(COLORS.shroud, { metalness: 0.8, roughness: 0.3 }), 0.05), [0.0, -0.92, BOARD_Z + 0.09]);
  add(board, rbox(0.4, 0.05, 0.02, glowMaterial(accent, 0.9), 0.01), [0.0, -0.92, BOARD_Z + 0.17]);
  add(board, rbox(0.12, 0.55, 0.16, matte(0x0e0f12, 0.6), 0.02), [BOARD.x0 + 0.1, 0.85, BOARD_Z + 0.1]);   // 24-pin
  add(board, rbox(0.4, 0.12, 0.16, matte(0x0e0f12, 0.6), 0.02), [0.3, BOARD.y1 - 0.1, BOARD_Z + 0.1]);    // CPU 8-pin
  // Capacitors around the socket
  for (const [x, y] of [[0.4, 0.6], [0.5, 0.6], [1.45, 0.75], [1.45, 0.65], [-0.3, 0.2], [-0.2, 0.2]]) {
    add(board, cylinder(0.035, 0.1, brushed(0x6a7079), 12), [x, y, BOARD_Z + 0.07], [Math.PI / 2, 0, 0]);
  }

  // --- CPU: the metal lid with chamfered edges in the socket (under the cooler) ---
  const cpu = addPart('cpu', [SOCKET.x - 0.3, SOCKET.y - 0.32, BOARD_Z + 0.15]);
  add(cpu, rbox(0.6, 0.6, 0.04, standard(0x1d4d3a, { roughness: 0.6 }), 0.01), [SOCKET.x, SOCKET.y, BOARD_Z + 0.1]);
  add(cpu, rbox(0.5, 0.5, 0.05, metal(0xc4c9d0, 0.38), 0.04), [SOCKET.x, SOCKET.y, BOARD_Z + 0.14]);

  // --- Tower air cooler: copper heat pipes, a tall stack of fins that stands out from the board,
  //     a top cover, and a fan on the front of the fins blowing to the back ---
  const cooler = addPart('cooler', [SOCKET.x, SOCKET.y + 0.75, -0.05]);
  const FIN_X = SOCKET.x + 0.05;
  const FIN_Z0 = BOARD_Z + 0.42;
  add(cooler, rbox(0.45, 0.45, 0.1, metal(COLORS.copper, 0.3), 0.02), [SOCKET.x, SOCKET.y, BOARD_Z + 0.21]);   // base
  for (const dy of [-0.3, -0.1, 0.1, 0.3]) {
    add(cooler, cylinder(0.03, 1.25, metal(COLORS.copper, 0.25), 12), [FIN_X, SOCKET.y + dy, BOARD_Z + 0.85], [Math.PI / 2, 0, 0]);
  }
  for (let i = 0; i < 20; i += 1) add(cooler, rbox(0.55, 1.15, 0.018, brushed(), 0.004), [FIN_X, SOCKET.y, FIN_Z0 + i * 0.05]);
  add(cooler, rbox(0.6, 1.2, 0.06, standard(COLORS.white, { metalness: 0.4, roughness: 0.35 }), 0.03), [FIN_X, SOCKET.y, FIN_Z0 + 1.02]); // top cover
  for (const dy of [-0.3, -0.1, 0.1, 0.3]) {
    add(cooler, cylinder(0.034, 0.04, metal(0xb9bfc7), 16), [FIN_X, SOCKET.y + dy, FIN_Z0 + 1.07], [Math.PI / 2, 0, 0]); // pipe ends
  }
  addFan(cooler, 1.05, [FIN_X - 0.36, SOCKET.y, FIN_Z0 + 0.5], FACE_FRONT, COLORS.white, { ring: false });

  // --- RAM: four sticks standing in their slots: white heat spreaders, the green board edge with
  //     gold contacts showing at the bottom, and a light bar on top ---
  const ram = addPart('ram', [DIMM_X[1] + 0.06, DIMM_Y + 0.55, BOARD_Z + 0.5], { ghostEach: true });
  for (const x of DIMM_X) {
    const stick = new THREE.Group();
    const spreader = rbox(0.055, 1.33, 0.36, standard(COLORS.white, { metalness: 0.55, roughness: 0.3 }), 0.012);
    spreader.position.z = 0.22;
    const edge = rbox(0.03, 1.3, 0.1, matte(0x1e3a2a, 0.6), 0.005);
    edge.position.z = 0.06;
    const contacts = rbox(0.032, 1.2, 0.03, metal(0xd4a94a, 0.3), 0.005);
    contacts.position.z = 0.03;
    const light = rbox(0.045, 1.25, 0.03, glowMaterial(accent, 0.7), 0.012);
    light.position.z = 0.415;
    stick.add(spreader, edge, contacts, light);
    add(ram, stick, [x, DIMM_Y, BOARD_Z + 0.06]);
  }

  // --- Graphics card: lies flat in the top slot like in most PCs. Its fans face down, its back
  //     plate is on top, and its side with a light bar faces the glass. The metal bracket screws
  //     to the back of the case. ---
  const gpu = addPart('gpu', [0.2, PCIE_Y - 0.25, TRAY_Z + 1.45]);
  const GPU = { x0: -0.95, x1: D / 2 - 0.12, yTop: PCIE_Y + 0.02, thick: 0.58, z0: TRAY_Z + 0.16, z1: TRAY_Z + 1.4 };
  const gpuLength = GPU.x1 - GPU.x0;
  const gpuCenterX = (GPU.x0 + GPU.x1) / 2 - 0.06;
  const gpuCenterZ = (GPU.z0 + GPU.z1) / 2;
  const gpuShell = standard(COLORS.shroud, { metalness: 0.7, roughness: 0.32 });
  add(gpu, rbox(gpuLength - 0.12, GPU.thick - 0.06, GPU.z1 - GPU.z0, gpuShell, 0.08), [gpuCenterX, GPU.yTop - GPU.thick / 2 - 0.03, gpuCenterZ]);
  add(gpu, rbox(gpuLength - 0.12, 0.04, GPU.z1 - GPU.z0, standard(0xffffff, { metalness: 0.8, roughness: 0.4, map: backplateTexture() }), 0.02), [gpuCenterX, GPU.yTop + 0.01, gpuCenterZ]); // back plate
  // The side that faces the glass: a light bar and two silver accent lines
  add(gpu, rbox(gpuLength * 0.55, 0.035, 0.02, glowMaterial(accent, 1.6), 0.01), [gpuCenterX - 0.3, GPU.yTop - 0.12, GPU.z1 + 0.005]);
  for (const dy of [0.24, 0.32]) add(gpu, rbox(gpuLength * 0.3, 0.015, 0.02, metal(), 0.005), [gpuCenterX + 0.55, GPU.yTop - dy, GPU.z1 + 0.005]);
  // Three fans under the card, behind a frame
  for (const x of [-0.6, 0.35, 1.3]) addFan(gpu, 0.86, [gpuCenterX + x - 0.35, GPU.yTop - GPU.thick - 0.01, gpuCenterZ], FACE_DOWN, COLORS.dark, { ring: false });
  // The bracket with display ports, and the 16-pin power socket on the side facing the glass
  add(gpu, rbox(0.03, GPU.thick + 0.1, 1.1, brushed(), 0.01), [GPU.x1 + 0.03, GPU.yTop - GPU.thick / 2, TRAY_Z + 0.72]);
  add(gpu, rbox(0.3, 0.1, 0.06, matte(0x0b0c0e, 0.6), 0.01), [gpuCenterX + 0.15, GPU.yTop - 0.06, GPU.z1 + 0.02]);

  // --- Power supply: under the shroud at the back, fan facing down, its label through the window.
  //     Its cables go up through the tray to the board (24-pin), the CPU (8-pin) and the graphics card. ---
  const psu = addPart('psu', [1.35, -1.85, W / 2 - 0.05]);
  const PSU = { x: 1.25, y: -1.83, z: -0.15 };
  add(psu, rbox(1.5, 0.86, 1.4, standard(0x15171b, { metalness: 0.55, roughness: 0.45 }), 0.06), [PSU.x, PSU.y, PSU.z]);
  add(psu, rbox(1.0, 0.5, 0.02, standard(0xffffff, { roughness: 0.7, map: labelTexture() }), 0.02), [PSU.x, PSU.y, PSU.z + 0.71]);
  addFan(psu, 0.8, [PSU.x, PSU.y - 0.44, PSU.z], FACE_DOWN, COLORS.dark, { ring: false });
  const sleeve = standard(COLORS.sleeve, { metalness: 0.1, roughness: 0.85 });
  const grommet = BOARD.x0 - 0.28;
  // 24-pin: a wide bundle of thin wires from the tray hole into the board's power connector
  for (let i = 0; i < 6; i += 1) {
    const y = 0.68 + i * 0.065;
    add(psu, cable([[grommet, y, TRAY_Z - 0.02], [grommet + 0.05, y, TRAY_Z + 0.2], [BOARD.x0 + 0.02, y, BOARD_Z + 0.2], [BOARD.x0 + 0.1, y, BOARD_Z + 0.17]], 0.022, sleeve), [0, 0, 0], [0, 0, 0], { noGhost: true });
  }
  // CPU 8-pin: through the hole at the top of the tray
  for (let i = 0; i < 2; i += 1) {
    const x = 0.2 + i * 0.07;
    add(psu, cable([[x, H / 2 - 0.22, TRAY_Z - 0.02], [x, H / 2 - 0.3, TRAY_Z + 0.2], [x + 0.1, BOARD.y1 - 0.1, BOARD_Z + 0.18]], 0.025, sleeve), [0, 0, 0], [0, 0, 0], { noGhost: true });
  }
  // Graphics card power: up from the shroud into the socket on the card's glass side
  add(psu, cable([[gpuCenterX + 0.15, SHROUD_Y + 0.02, GPU.z1 - 0.1], [gpuCenterX + 0.12, SHROUD_Y + 0.35, GPU.z1 + 0.2], [gpuCenterX + 0.15, GPU.yTop - 0.06, GPU.z1 + 0.12], [gpuCenterX + 0.15, GPU.yTop - 0.06, GPU.z1 + 0.04]], 0.04, sleeve), [0, 0, 0], [0, 0, 0], { noGhost: true });

  // --- Storage: an M.2 drive with a heatsink on the board, and a 2.5" SSD on top of the shroud ---
  const storage = addPart('storage', [-1.55, SHROUD_Y + 0.12, 0.35], { ghostEach: true });
  add(storage, rbox(0.85, 0.2, 0.06, standard(COLORS.shroud, { metalness: 0.85, roughness: 0.3 }), 0.02), [M2.x, M2.y, BOARD_Z + 0.08]);
  const ssd = new THREE.Group();
  const ssdBody = rbox(1.0, 0.07, 0.7, standard(COLORS.white, { metalness: 0.45, roughness: 0.4 }), 0.02);
  const ssdLabel = rbox(0.6, 0.005, 0.4, matte(0x2b2f36, 0.6), 0.002);
  ssdLabel.position.y = 0.037;
  ssd.add(ssdBody, ssdLabel);
  add(storage, ssd, [-1.55, SHROUD_Y + 0.07, 0.3]);

  // ---------- Outlines of the parts that are not chosen yet ----------

  const outlineMaterial = new THREE.LineBasicMaterial({ color: COLORS.outline, transparent: true, opacity: 0.34, depthWrite: false });
  const ghostFill = new THREE.MeshBasicMaterial({ color: COLORS.outline, transparent: true, opacity: 0.035, depthWrite: false });

  // The boxes around a part (one for the whole part, or one per object when ghostEach), as
  // thin lines and a very faint fill, so its place is clear without see-through layers
  function buildGhost(part) {
    if (part.ghost) scene.remove(part.ghost);
    const ghost = new THREE.Group();
    const boxes = [];
    for (const child of part.group.children) {
      if (child.userData.noGhost) continue;
      const box = new THREE.Box3().setFromObject(child);
      if (part.ghostEach || boxes.length === 0) boxes.push(box);
      else boxes[0].union(box);
    }
    for (const box of boxes) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const shape = new THREE.BoxGeometry(size.x, size.y, size.z);
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(shape), outlineMaterial.clone());
      const fillMesh = new THREE.Mesh(shape, ghostFill.clone());
      lines.position.copy(center);
      fillMesh.position.copy(center);
      ghost.add(lines, fillMesh);
    }
    scene.add(ghost);
    part.ghost = ghost;
  }

  // ---------- Real models: each one takes the place of the shape drawn for its part ----------

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/'); // for compressed models
  loader.setDRACOLoader(draco);

  // Scales and moves a model so it fills the box of the drawn shape, then swaps them
  function useModel(slug, model, settings) {
    const part = parts[slug];
    const space = new THREE.Box3();
    for (const child of part.group.children) if (!child.userData.noGhost) space.union(new THREE.Box3().setFromObject(child));
    const spaceSize = space.getSize(new THREE.Vector3());
    const spaceCenter = space.getCenter(new THREE.Vector3());

    const pivot = new THREE.Group();
    model.rotation.set(...settings.rotation.map(THREE.MathUtils.degToRad));
    pivot.add(model);
    const modelSize = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3());
    const fit = Math.min(spaceSize.x / modelSize.x, spaceSize.y / modelSize.y, spaceSize.z / modelSize.z);
    pivot.scale.setScalar(fit * (settings.scale ?? 1));
    const modelCenter = new THREE.Box3().setFromObject(pivot).getCenter(new THREE.Vector3());

    // Remove the drawn shape (and stop its fans), then put the model in its place
    part.group.clear();
    part.meshes = [];
    spinning = spinning.filter((blades) => !part.fans.includes(blades));
    part.fans = [];
    add(part, pivot, spaceCenter.sub(modelCenter).toArray());
    buildGhost(part);
    // The model gets the chosen or not-chosen look of the part (no drop-in: it was not just chosen)
    part.chosen = status(slug) !== 'empty';
    setLook(part, part.chosen);
  }

  // Only parts with a file set in pcModels.js are asked for, so a missing file is never requested
  async function loadModels() {
    const loaded = [];
    await Promise.all(Object.entries(PART_MODELS).map(async ([slug, settings]) => {
      if (!parts[slug] || !settings.file) return;
      try {
        const gltf = await loader.loadAsync(settings.file);
        useModel(slug, gltf.scene, settings);
        loaded.push(slug);
      } catch {
        // A broken file: the shape drawn in code stays
      }
    }));
    onModels?.(loaded);
  }

  // ---------- States: chosen or outline, dropping in, and the hovered part ----------

  // Every material of a part (a model's mesh can have several)
  function materialsOf(part) {
    return part.meshes.flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
  }

  function setLook(part, chosen) {
    part.group.visible = chosen;
    part.ghost.visible = !chosen;
  }

  // An orange light on the part (hover, or the flash when it drops in). Only materials that
  // can glow (have `emissive`) take it; the RGB parts keep their own glow.
  function setGlow(part, amount) {
    for (const material of materialsOf(part)) {
      if (material.userData.isGlow || !material.emissive) continue;
      if (!material.userData.baseEmissive) material.userData.baseEmissive = material.emissive.clone();
      if (amount > 0) material.emissive.copy(accent);
      else material.emissive.copy(material.userData.baseEmissive);
      material.emissiveIntensity = amount > 0 ? amount : 1;
    }
  }

  // The outline of a part that is not chosen turns orange and a little stronger when pointed at
  function setGhostHighlight(part, on) {
    for (const child of part.ghost.children) {
      child.material.color.set(on ? accent : COLORS.outline);
      child.material.opacity = child.isLineSegments ? (on ? 0.95 : 0.34) : (on ? 0.12 : 0.035);
    }
  }

  let firstUpdate = true;
  function applyState(slug) {
    const part = parts[slug];
    const chosen = status(slug) !== 'empty';
    if (part.chosen === chosen) return;
    // A part chosen now (not on page load) drops into place with a flash
    if (chosen && !firstUpdate && !reducedMotion) part.drop = { start: performance.now() };
    part.chosen = chosen;
    setLook(part, chosen);
  }

  function animateDrops(now) {
    for (const part of Object.values(parts)) {
      if (!part.drop) continue;
      const progress = Math.min((now - part.drop.start) / DROP_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      part.group.position.y = (1 - eased) * 1.2;
      setGlow(part, (1 - progress) * 0.9);
      if (progress === 1) {
        part.drop = null;
        part.group.position.y = 0;
      }
    }
  }

  let highlighted = null;
  function lightUp(slug, on) {
    const part = parts[slug];
    if (!part || part.drop) return;
    if (part.chosen) setGlow(part, on ? 0.45 : 0);
    else setGhostHighlight(part, on);
  }

  function highlight(slug) {
    if (highlighted) lightUp(highlighted, false);
    highlighted = slug && parts[slug] ? slug : null;
    if (highlighted) lightUp(highlighted, true);
  }

  // ---------- The circles over the parts ----------

  const dots = {};
  const shown = slugs.filter((slug) => parts[slug]);

  function tooltip(slug) {
    const info = partInfo(slug);
    return el('span', { class: 'pc-tip', 'aria-hidden': 'true' },
      info?.image ? el('img', { src: info.image, alt: '' }) : null,
      el('span', { class: 'pc-tip-text' },
        el('strong', { text: categoryName(slug) }),
        el('span', { text: info?.name || t('build.notChosen') })));
  }

  function renderDots() {
    for (const slug of shown) {
      const info = partInfo(slug);
      const label = t('build.hotspot', { category: categoryName(slug), part: info?.name || t('build.notChosen') });
      let dot = dots[slug];
      if (!dot) {
        dot = el('button', { type: 'button' });
        dot.addEventListener('click', () => onPick(slug));
        dot.addEventListener('pointerenter', () => highlight(slug));
        dot.addEventListener('pointerleave', () => highlight(null));
        dot.addEventListener('focus', () => highlight(slug));
        dot.addEventListener('blur', () => highlight(null));
        container.append(dot);
        dots[slug] = dot;
      }
      dot.className = `pc-dot is-${status(slug)}`;
      dot.setAttribute('aria-label', label);
      dot.replaceChildren(tooltip(slug));
    }
  }

  // Each frame, every circle follows its part on the screen
  const projected = new THREE.Vector3();
  function placeDots(width, height) {
    for (const slug of shown) {
      projected.copy(parts[slug].anchor);
      projected.y += parts[slug].group.position.y; // follows a part while it drops in
      projected.project(camera);
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      const dot = dots[slug];
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      dot.classList.toggle('tip-left', x > width / 2);
    }
  }

  // ---------- Size and drawing loop ----------

  container.prepend(renderer.domElement);
  renderer.domElement.classList.add('pc-canvas');
  renderer.domElement.setAttribute('aria-hidden', 'true');

  // The drawing follows the canvas's own size. On the Build page the canvas fills the stage; on the
  // home page it reaches below it, and that extra part only shows more floor: the case stays
  // framed as in the stage (a view offset extends the picture downwards).
  let width = 0;
  let height = 0;
  function resize() {
    width = renderer.domElement.clientWidth;
    height = renderer.domElement.clientHeight;
    const framed = Math.min(container.clientHeight || height, height);
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / framed;
    if (height > framed) camera.setViewOffset(width, framed, 0, 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(renderer.domElement);
  resize();

  const timer = new THREE.Timer();
  function drawFrame(now) {
    requestAnimationFrame(drawFrame);
    timer.update(now);
    if (document.hidden || !width) return;
    const delta = timer.getDelta();
    if (!reducedMotion) spinning.forEach((blades) => { blades.rotation.z -= delta * 5; });
    animateDrops(now ?? performance.now());
    controls.autoRotate = autoTurn && !pointerInside;
    controls.update();
    renderer.render(scene, camera);
    placeDots(width, height);
  }

  function update() {
    Object.keys(parts).forEach(applyState);
    firstUpdate = false;
    renderDots();
  }

  Object.values(parts).forEach(buildGhost);
  update();
  drawFrame();
  loadModels();
  return { update, highlight };
}
