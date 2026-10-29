# 3D models of the parts

The Build page shows a real 3D model for each part that has a file here (and is set in
`client/js/pcModels.js`). A part without a file is drawn in code instead, so the page works with any
number of files (even none).

## Files

| file              | part                         |
|-------------------|------------------------------|
| `case.glb`        | PC case (mid tower, glass side) |
| `motherboard.glb` | ATX motherboard              |
| `cpu.glb`         | CPU                          |
| `cooler.glb`      | tower air cooler             |
| `ram.glb`         | RAM (a kit of 2 or 4 sticks) |
| `gpu.glb`         | graphics card                |
| `psu.glb`         | power supply                 |
| `storage.glb`     | SSD (M.2 or 2.5")            |

## What to look for

- **Format**: glTF binary, `.glb` (one file). On Sketchfab: Download 3D model, then "glTF" or "GLB".
- **License**: **CC0** (free, no conditions) or **CC BY** (free, but the author must be named).
  Not "NonCommercial" (NC) or "NoDerivatives" (ND): the site is public.
- **Size**: under 5 MB per file if possible (under 10 MB at most), and under about 100k triangles,
  so the page loads fast on phones.
- **One object per file**: the part alone, without a table, floor or other parts around it.
- Good searches: "pc case glass", "graphics card rtx", "cpu tower cooler", "ddr5 ram", "atx motherboard",
  "atx power supply", "nvme ssd".

## After adding a file

1. Put it here with the name from the table.
2. In `client/js/pcModels.js`, set the part's `file` (e.g. `file: '/models/gpu.glb'`; it is `null` until then, so the page never asks for a missing file), and fill its `credit` in `client/js/pcModels.js` (title, author, license, link). The Build page lists
   the credits under the case; CC BY requires it.
3. Open the Build page. The model is scaled and placed in its part's space by itself. If it is turned
   the wrong way, change its `rotation` in `pcModels.js` (degrees around x, y, z).
