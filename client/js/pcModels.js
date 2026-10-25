// Real 3D models of the parts for the Build page (glTF binary .glb files in client/models).
// Each model replaces the shape drawn in code for its part. When a file is missing, the drawn
// shape stays, so the page always works. How to get the files: client/models/README.md
//
// file:     the model's address
// rotation: degrees around x, y, z, applied first when a model comes facing another way.
//           In the scene the front of the case is to the left (-x), the glass side faces you (+z)
//           and up is +y; the graphics card stands upright with its fans facing the glass.
// scale:    a little bigger or smaller than the space of the part (1 = fits it exactly)
// credit:   shown on the Build page. Most free models (CC BY) require naming the author.
//           { title, author, license, url }; null when there is no file yet.

export const PART_MODELS = {
  case: { file: '/models/case.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  motherboard: { file: '/models/motherboard.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  cpu: { file: '/models/cpu.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  cooler: { file: '/models/cooler.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  ram: { file: '/models/ram.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  gpu: { file: '/models/gpu.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  psu: { file: '/models/psu.glb', rotation: [0, 0, 0], scale: 1, credit: null },
  storage: { file: '/models/storage.glb', rotation: [0, 0, 0], scale: 1, credit: null },
};
