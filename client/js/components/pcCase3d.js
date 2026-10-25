// The 3D PC case on the Build page, drawn with three.js. Each part is a real 3D model when its
// .glb file is in client/models (see pcModels.js), or else a shape drawn in code, so the page
// always works. Models are general, not one per product. A part that is not chosen yet is a faint "ghost"; when the user
// chooses it, it drops into place with an orange flash and stays solid, so the user watches
// the PC being built.
//
// Drag to turn it around. It turns slowly by itself until the user drags it, and stops while the
// pointer is over it so the circles are easy to reach. A circle (a real <button>) sits on each
// part and opens the picker. If WebGL is not available, createPcScene throws and the page falls
// back to the flat SVG drawing (pcCase.js).
//
// Colors: the scene is a dark showroom in both themes. Its fixed colors are below; the orange
// accent comes from the --color-stage-accent token in base.css.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { PART_MODELS } from '/js/pcModels.js';
import { t } from '/js/i18n.js';
import { el } from '/js/components/dom.js';

// The case, in scene units (about 10 cm each): front at -x, back at +x, glass side at +z
const CASE = { depth: 4.4, height: 4.6, width: 2.2 };
const FLOOR_Y = -CASE.height / 2 - 0.14;

const GHOST_OPACITY = 0.07;      // a part that is not chosen: barely there
const CASE_GHOST_OPACITY = 0.4;  // the case stays easier to see, it holds everything
const DROP_MS = 700;             // how long a new part takes to drop into place

// A black case with silver and white parts, so every part stands out from the case
const COLORS = {
  caseBody: 0x15171b,
  tray: 0x0e1013,
  pcb: 0x14171c,
  dark: 0x23272e,
  shroud: 0x2b3038,
  silver: 0xc8cdd5,
  white: 0xe8ebef,
  glass: 0xffffff,
  edge: 0x3a404a,
};

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// ---------- Materials and shapes ----------

function standard(color, { metalness = 0.3, roughness = 0.5, opacity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: opacity < 1, opacity });
}

const metal = (color = COLORS.silver) => standard(color, { metalness: 0.95, roughness: 0.28 });
const matte = (color) => standard(color, { metalness: 0.2, roughness: 0.7 });

function glowMaterial(accent) {
  const material = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2, roughness: 0.4 });
  material.userData.isGlow = true;
  return material;
}

// A box with rounded edges (radius in scene units)
function rbox(width, height, depth, material, radius = 0.03) {
  const r = Math.min(radius, width / 2, height / 2, depth / 2);
  return new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, r), material);
}

// A 120 mm style fan facing +z: square frame, glowing ring, hub and blades (returned to spin)
function makeFan(size, accent, frameColor) {
  const group = new THREE.Group();
  const bar = size * 0.12;
  const frame = matte(frameColor);
  for (const [w, h, x, y] of [
    [size, bar, 0, (size - bar) / 2], [size, bar, 0, -(size - bar) / 2],
    [bar, size, (size - bar) / 2, 0], [bar, size, -(size - bar) / 2, 0],
  ]) {
    const side = rbox(w, h, 0.12, frame, 0.02);
    side.position.set(x, y, 0);
    group.add(side);
  }
  group.add(new THREE.Mesh(new THREE.TorusGeometry(size * 0.42, size * 0.03, 10, 48), glowMaterial(accent)));

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.13, size * 0.13, 0.1, 24), frame);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  const blades = new THREE.Group();
  const bladeMaterial = standard(frameColor, { roughness: 0.4, opacity: 0.92 });
  for (let i = 0; i < 9; i += 1) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 9) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(size * 0.3, size * 0.12, 0.012), bladeMaterial);
    blade.position.x = size * 0.27;
    blade.rotation.x = 0.5;
    pivot.add(blade);
    blades.add(pivot);
  }
  group.add(blades);
  return { group, blades };
}

// ---------- The scene ----------

// onModels(slugs): called once the model files have loaded, with the parts that have a real model
// zoom: false on the home page, so the mouse wheel scrolls the page instead of zooming
export function createPcScene(container, { slugs, categoryName, partInfo, status, onPick, onModels, zoom = true }) {
  // WebGLRenderer throws when the browser cannot draw 3D; the caller falls back to the SVG drawing
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const accent = new THREE.Color(cssColor('--color-stage-accent', '#ff7a29'));

  const scene = new THREE.Scene();
  // Reflections of a soft room on metal and glass: the biggest step towards a real look
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(-3.4, 1.7, 9.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.1, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = zoom;
  controls.minDistance = 5.5;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.56; // never look from under the floor
  controls.autoRotateSpeed = 0.6;

  // Turning by itself: until the user drags the case, and never while the pointer is over it
  let autoTurn = !reducedMotion;
  let pointerInside = false;
  controls.addEventListener('start', () => { autoTurn = false; });
  container.addEventListener('pointerenter', () => { pointerInside = true; });
  container.addEventListener('pointerleave', () => { pointerInside = false; });

  // Lights: a key light that casts shadows, an orange rim light from behind, and an orange glow
  // inside the case (the "RGB")
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x0a0a0d, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-5, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 1.4);
  rim.position.set(6, 3, -7);
  scene.add(rim);
  const inner = new THREE.PointLight(accent, 5, 6);
  inner.position.set(0, 0.6, 0.2);
  scene.add(inner);

  // The floor: catches the shadow of the case, with a faint grid like a showroom
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, accent, COLORS.edge);
  grid.position.y = FLOOR_Y + 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  scene.add(grid);

  // ---------- Parts ----------

  const parts = {}; // slug -> { group, meshes, fans, anchor, ghostOpacity, chosen, drop }
  let spinning = []; // fan blades

  function addPart(slug, anchor, ghostOpacity = GHOST_OPACITY) {
    const group = new THREE.Group();
    scene.add(group);
    parts[slug] = { group, meshes: [], fans: [], anchor: new THREE.Vector3(...anchor), ghostOpacity, chosen: null, drop: null };
    return parts[slug];
  }

  // Each mesh gets its own copy of the material, so ghosting one part never touches another
  function add(part, object, position = [0, 0, 0], rotation = [0, 0, 0]) {
    object.position.set(...position);
    object.rotation.set(...rotation);
    part.group.add(object);
    object.traverse((child) => {
      if (!child.isMesh) return;
      // A model's mesh can have several materials; each one gets its own copy
      const copy = (material) => {
        const clone = material.clone();
        clone.userData.baseOpacity = clone.opacity;
        clone.userData.baseTransparent = clone.transparent;
        return clone;
      };
      child.material = Array.isArray(child.material) ? child.material.map(copy) : copy(child.material);
      child.castShadow = true;
      child.receiveShadow = true;
      part.meshes.push(child);
    });
    return object;
  }

  function addFan(part, size, position, rotation, frameColor = COLORS.dark) {
    const fan = makeFan(size, accent, frameColor);
    add(part, fan.group, position, rotation);
    spinning.push(fan.blades);
    part.fans.push(fan.blades);
  }

  const { depth: D, height: H, width: W } = CASE;
  const TRAY_Z = -W / 2 + 0.06; // the inside face of the back tray, where the motherboard sits
  const FACE_FRONT = [0, -Math.PI / 2, 0]; // turns a fan to face the front of the case (-x)

  // --- Case: panels, glass side with a black frame, feet, fans, and the shroud over the PSU ---
  const pcCase = addPart('case', [-D / 2 + 0.05, H / 2 - 0.35, W / 2 - 0.1], CASE_GHOST_OPACITY);
  const caseMetal = standard(COLORS.caseBody, { metalness: 0.6, roughness: 0.38 });
  add(pcCase, rbox(D, 0.1, W, caseMetal, 0.04), [0, H / 2, 0]);                    // top
  add(pcCase, rbox(D, 0.1, W, caseMetal, 0.04), [0, -H / 2, 0]);                   // bottom
  add(pcCase, rbox(0.1, H, W, caseMetal, 0.04), [D / 2, 0, 0]);                    // back
  add(pcCase, rbox(D, H, 0.06, matte(COLORS.tray), 0.02), [0, 0, -W / 2]);         // tray
  add(pcCase, rbox(0.08, H, W, standard(COLORS.caseBody, { roughness: 0.8, opacity: 0.6 }), 0.03), [-D / 2, 0, 0]); // front mesh
  const glass = new THREE.MeshPhysicalMaterial({
    color: COLORS.glass, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.06, clearcoat: 1,
  });
  add(pcCase, new THREE.Mesh(new THREE.BoxGeometry(D - 0.1, H - 0.1, 0.02), glass), [0, 0, W / 2]);
  for (const [w, h, x, y] of [[D, 0.06, 0, H / 2 - 0.03], [D, 0.06, 0, -H / 2 + 0.03], [0.06, H, -D / 2 + 0.03, 0], [0.06, H, D / 2 - 0.03, 0]]) {
    add(pcCase, rbox(w, h, 0.03, caseMetal, 0.01), [x, y, W / 2 + 0.01]);          // glass frame
  }
  for (const x of [-D / 2 + 0.35, D / 2 - 0.35]) {
    for (const z of [-W / 2 + 0.3, W / 2 - 0.3]) add(pcCase, rbox(0.4, 0.14, 0.34, matte(COLORS.tray), 0.05), [x, -H / 2 - 0.07, z]);
  }
  for (const y of [1.25, 0.05]) addFan(pcCase, 1.15, [-D / 2 + 0.16, y, 0], FACE_FRONT);
  addFan(pcCase, 1.0, [D / 2 - 0.16, 1.45, -0.25], FACE_FRONT);
  // PSU shroud: a top plate and a side plate with an opening at the back where the PSU shows
  add(pcCase, rbox(D - 0.12, 0.06, W - 0.12, caseMetal, 0.02), [0, -1.36, 0]);
  add(pcCase, rbox(2.55, 0.86, 0.06, caseMetal, 0.02), [-0.86, -1.82, W / 2 - 0.12]);
  add(pcCase, rbox(0.25, 0.86, 0.06, caseMetal, 0.02), [D / 2 - 0.18, -1.82, W / 2 - 0.12]);

  // --- Motherboard: board, power heatsinks, rear I/O cover, slots and chipset heatsink ---
  const board = addPart('motherboard', [-0.95, -0.85, TRAY_Z + 0.1]);
  add(board, rbox(3.0, 3.35, 0.06, matte(COLORS.pcb), 0.02), [0.4, 0.55, TRAY_Z + 0.03]);
  add(board, rbox(0.28, 1.05, 0.22, metal(), 0.04), [-0.6, 1.35, TRAY_Z + 0.17]);
  add(board, rbox(1.05, 0.28, 0.22, metal(), 0.04), [0.3, 2.02, TRAY_Z + 0.17]);
  add(board, rbox(0.4, 1.15, 0.42, matte(COLORS.dark), 0.05), [1.72, 1.55, TRAY_Z + 0.27]);
  add(board, rbox(0.75, 0.75, 0.12, metal(), 0.05), [1.0, -0.85, TRAY_Z + 0.12]);
  for (const y of [-0.15, -0.65]) add(board, rbox(2.1, 0.07, 0.09, metal(COLORS.dark), 0.02), [0.1, y, TRAY_Z + 0.1]);
  for (let i = 0; i < 4; i += 1) add(board, rbox(0.07, 1.15, 0.06, matte(COLORS.dark), 0.01), [0.82 + i * 0.13, 1.18, TRAY_Z + 0.08]);
  add(board, rbox(0.12, 0.5, 0.12, matte(COLORS.dark), 0.02), [-1.0, 0.95, TRAY_Z + 0.1]);  // 24-pin power connector

  // --- CPU: the metal lid in the socket (under the cooler) ---
  const cpu = addPart('cpu', [-0.05, 1.0, TRAY_Z + 0.15]);
  add(cpu, rbox(0.6, 0.6, 0.06, metal(), 0.03), [0.25, 1.22, TRAY_Z + 0.09]);
  add(cpu, rbox(0.7, 0.7, 0.03, matte(COLORS.dark), 0.02), [0.25, 1.22, TRAY_Z + 0.06]);

  // --- Tower air cooler: heat pipes, a stack of silver fins, a cap and a white fan in front ---
  const cooler = addPart('cooler', [0.3, 2.05, -0.35]);
  const COOLER_Z = -0.45;
  for (const z of [-0.75, -0.55, -0.35, -0.15]) {
    add(cooler, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.45, 12), metal(0xd9a066)), [0.25, 1.28, z]);
  }
  for (let i = 0; i < 18; i += 1) add(cooler, rbox(0.5, 0.025, 0.95, metal(), 0.005), [0.25, 0.68 + i * 0.07, COOLER_Z]);
  add(cooler, rbox(0.54, 0.09, 0.99, matte(COLORS.white), 0.03), [0.25, 1.98, COOLER_Z]);
  addFan(cooler, 1.0, [-0.08, 1.3, COOLER_Z], FACE_FRONT, COLORS.white);

  // --- RAM: four sticks with white heat spreaders and a glowing top ---
  const ram = addPart('ram', [1.25, 1.85, -0.6]);
  for (let i = 0; i < 4; i += 1) {
    const x = 0.82 + i * 0.13;
    add(ram, rbox(0.06, 1.05, 0.36, standard(COLORS.white, { metalness: 0.5, roughness: 0.35 }), 0.015), [x, 1.2, TRAY_Z + 0.26]);
    add(ram, rbox(0.065, 0.09, 0.36, glowMaterial(accent), 0.015), [x, 1.76, TRAY_Z + 0.26]);
  }

  // --- Graphics card: mounted upright behind the glass, so its three fans face the user ---
  const gpu = addPart('gpu', [-1.35, -0.1, 0.8]);
  const GPU_Z = 0.5;
  add(gpu, rbox(2.85, 1.15, 0.42, standard(COLORS.shroud, { metalness: 0.7, roughness: 0.3 }), 0.08), [-0.05, -0.5, GPU_Z]);
  add(gpu, rbox(2.85, 1.15, 0.04, metal(), 0.03), [-0.05, -0.5, GPU_Z - 0.23]);          // backplate
  add(gpu, rbox(2.5, 0.05, 0.03, glowMaterial(accent), 0.01), [-0.05, 0.05, GPU_Z + 0.21]); // light strip
  add(gpu, rbox(0.08, 1.35, 0.5, metal(), 0.02), [1.42, -0.5, GPU_Z]);                   // bracket
  for (const x of [-0.98, -0.05, 0.88]) addFan(gpu, 0.82, [x, -0.52, GPU_Z + 0.24], [0, 0, 0]);

  // --- Power supply: under the shroud, its white label shows through the opening ---
  const psu = addPart('psu', [1.15, -1.85, W / 2 - 0.15]);
  add(psu, rbox(1.6, 0.8, 1.5, standard(COLORS.tray, { metalness: 0.5, roughness: 0.5 }), 0.06), [1.15, -1.85, -0.1]);
  add(psu, rbox(1.05, 0.4, 0.02, matte(COLORS.white), 0.02), [1.15, -1.85, 0.66]);
  addFan(psu, 0.7, [1.15, -1.44, -0.1], [-Math.PI / 2, 0, 0]);

  // --- Storage: an M.2 heatsink on the board and two drives standing on the shroud ---
  const storage = addPart('storage', [-1.75, -0.75, 0.6]);
  add(storage, rbox(0.8, 0.2, 0.06, metal(), 0.02), [-0.3, 0.2, TRAY_Z + 0.08]);
  for (const z of [0.55, 0.15]) add(storage, rbox(0.45, 0.72, 0.07, standard(COLORS.white, { metalness: 0.4, roughness: 0.4 }), 0.03), [-1.75, -0.97, z]);

  // ---------- Real models: each one takes the place of the shape drawn for its part ----------

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/'); // for compressed models
  loader.setDRACOLoader(draco);

  // Scales and moves a model so it fills the box of the drawn shape, then swaps them
  function useModel(slug, model, settings) {
    const part = parts[slug];
    const space = new THREE.Box3().setFromObject(part.group);
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
    // The new meshes get the ghost or solid look of the part (no drop-in: it was not just chosen)
    part.chosen = status(slug) !== 'empty';
    setLook(part, part.chosen);
  }

  async function loadModels() {
    const loaded = [];
    await Promise.all(Object.entries(PART_MODELS).map(async ([slug, settings]) => {
      if (!parts[slug]) return;
      try {
        const gltf = await loader.loadAsync(settings.file);
        useModel(slug, gltf.scene, settings);
        loaded.push(slug);
      } catch {
        // No file yet (or a broken one): the shape drawn in code stays
      }
    }));
    onModels?.(loaded);
  }

  // ---------- States: ghost or solid, dropping in, and the hovered part ----------

  // Every material of a part (a model's mesh can have several)
  function materialsOf(part) {
    return part.meshes.flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
  }

  function setLook(part, chosen) {
    for (const mesh of part.meshes) mesh.castShadow = chosen;
    for (const material of materialsOf(part)) {
      material.transparent = !chosen || material.userData.baseTransparent;
      material.opacity = material.userData.baseOpacity * (chosen ? 1 : part.ghostOpacity);
      material.depthWrite = !material.transparent;
      if (material.userData.isGlow) material.emissiveIntensity = chosen ? 2 : 0.1;
      material.needsUpdate = true;
    }
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
  function highlight(slug) {
    if (highlighted && parts[highlighted] && !parts[highlighted].drop) setGlow(parts[highlighted], 0);
    highlighted = slug && parts[slug] ? slug : null;
    if (highlighted && !parts[highlighted].drop) setGlow(parts[highlighted], 0.45);
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

  let width = 0;
  let height = 0;
  function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  function drawFrame(now) {
    requestAnimationFrame(drawFrame);
    if (document.hidden || !width) return;
    const delta = clock.getDelta();
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

  update();
  drawFrame();
  loadModels();
  return { update, highlight };
}
