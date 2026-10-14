const fs = require('fs/promises');
const path = require('path');

// The product pictures live in client/images/products and are served at /images/products/...
const IMAGES_DIR = path.join(__dirname, '..', '..', '..', 'client', 'images', 'products');
const PUBLIC_PATH = '/images/products';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

// The paths of every picture in the folder, by name, e.g. ['/images/products/amd-ryzen-5-7600x.jpg']
async function listProductImages() {
  const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `${PUBLIC_PATH}/${name}`);
}

module.exports = { listProductImages };
