// Real 3D models of the parts for the Build page (glTF binary .glb files in client/models).
// Each model replaces the shape drawn in code for its part. A part with file: null keeps the drawn
// shape, so the page always works and never asks for a file that is not there.
// How to get the files: client/models/README.md
//
// file:     the model's address, e.g. '/models/gpu.glb', or null to use the drawn shape
// rotation: degrees around x, y, z, applied first when a model comes facing another way.
//           In the scene the front of the case is to the left (-x), the glass side faces you (+z)
//           and up is +y; the graphics card stands upright with its fans facing the glass.
// scale:    a little bigger or smaller than the space of the part (1 = fits it exactly)
// credit:   shown on the Build page. Most free models (CC BY) require naming the author.
//           { title, author, license, url }; null when there is no file yet.

export const PART_MODELS = {
  case: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  motherboard: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  cpu: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  cooler: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  ram: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  gpu: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  psu: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
  storage: { file: null, rotation: [0, 0, 0], scale: 1, credit: null },
};
