const fs = require('fs/promises');
const path = require('path');

// The product pictures live in client/images/products and are served at /images/products/...
const IMAGES_DIR = path.join(__dirname, '..', '..', '..', 'client', 'images', 'products');
const PUBLIC_PATH = '/images/products';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// The paths of every picture in the folder, by name, e.g. ['/images/products/amd-ryzen-5-7600x.jpg']
async function listProductImages() {
  const entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `${PUBLIC_PATH}/${name}`);
}

// ---------- Upload ----------

// The file type is read from the first bytes of the file, not from its name or the browser's
// claim, so a renamed file that is not a picture is refused. SVG is not accepted for upload
// because it can contain scripts.
function detectImageType(buffer) {
  const text = (start, end) => buffer.subarray(start, end).toString('latin1');

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (text(0, 8) === '\x89PNG\r\n\x1a\n') return '.png';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return '.webp';
  if (text(0, 4) === 'GIF8') return '.gif';
  if (text(4, 8) === 'ftyp' && ['avif', 'avis'].includes(text(8, 12))) return '.avif';
  return null;
}

// "ASUS Dual RTX 4060.JPG" -> "asus-dual-rtx-4060"
function cleanBaseName(originalName) {
  // Runs of other characters become one "-", so at most one "-" is left at each end
  const base = path.parse(String(originalName || '').slice(0, 200)).name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return base || 'image';
}

// Saves an uploaded picture in the folder and returns its path. A picture with the same name
// is never replaced: "-2", "-3"... is added instead.
// Returns { path } or { error } (an error the admin can fix).
async function saveProductImage(originalName, buffer) {
  // The body is only bytes when the request was sent as image/*; anything else is not a picture
  const extension = Buffer.isBuffer(buffer) ? detectImageType(buffer) : null;
  if (!extension) {
    return { error: 'The file must be a JPG, PNG, WebP, AVIF or GIF picture' };
  }

  const base = cleanBaseName(originalName);
  for (let copy = 1; copy < 1000; copy += 1) {
    const name = copy === 1 ? `${base}${extension}` : `${base}-${copy}${extension}`;
    try {
      // 'wx' fails if the file already exists, so two uploads can never overwrite each other
      await fs.writeFile(path.join(IMAGES_DIR, name), buffer, { flag: 'wx' });
      return { path: `${PUBLIC_PATH}/${name}` };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  return { error: 'Too many pictures with this name' };
}

module.exports = { listProductImages, saveProductImage, MAX_UPLOAD_BYTES };
