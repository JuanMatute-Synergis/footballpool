/**
 * Generates the PWA / home screen icon set into src/assets/icons/.
 *
 * Draws the icon procedurally (white football on the app's blue) so there are no
 * image-tooling dependencies -- only Node's built-in zlib for PNG compression.
 * Run with `npm run icons`. The output PNGs are committed to the repo; the Docker
 * build just copies them, it does not run this script.
 *
 * To swap in real artwork later, replace this script's drawing code (or delete it
 * and drop hand-made PNGs of the same names into src/assets/icons/).
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'icons');

// Tailwind primary-600 (#2563eb) -- the blue already used for buttons and links.
const BG = [0x25, 0x63, 0xeb];
const FG = [0xff, 0xff, 0xff];

const SS = 4; // supersampling factor, for antialiased edges

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

/** @param {Uint8Array} rgba packed RGBA, size*size*4 */
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // bytes 10-12: compression / filter / interlace, all 0

  // Raw scanlines, each prefixed with filter type 0 (None).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * A football is a lens (vesica): the intersection of two circles, which gives
 * the pointed ends an ellipse can't. For half-length `a` and half-width `b`,
 * both arcs have radius R = (a² + b²) / 2b, centred at y = ±(R - b).
 */
function makeFootball(a, b) {
  const R = (a * a + b * b) / (2 * b);
  const cy = R - b;
  return (x, y) =>
    Math.hypot(x, y - cy) <= R && Math.hypot(x, y + cy) <= R;
}

/** Axis-aligned rounded bar centred at the origin, half-extents hx/hy. */
function inBar(x, y, cx, cy, hx, hy) {
  return Math.abs(x - cx) <= hx && Math.abs(y - cy) <= hy;
}

/**
 * Renders one icon.
 * @param {number} size    output edge length in px
 * @param {number} scale   logo size relative to the canvas (maskable icons use less)
 */
function render(size, scale) {
  const S = size * SS;
  const buf = new Uint8Array(S * S * 4);

  // Football geometry, in canvas units, before rotation.
  const a = 0.34 * S * scale; // half-length
  const b = 0.205 * S * scale; // half-width
  const inFootball = makeFootball(a, b);

  const seamHx = 0.175 * S * scale;
  const seamHy = 0.011 * S * scale;
  const laceHx = 0.011 * S * scale;
  const laceHy = 0.048 * S * scale;
  const laceXs = [-0.078, -0.026, 0.026, 0.078].map((f) => f * S * scale);

  // Tilt the ball -30deg, the way a football is normally drawn.
  const theta = (-30 * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const c = S / 2;

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      // Pixel centre, relative to canvas centre, rotated into ball-local space.
      const dx = px + 0.5 - c;
      const dy = py + 0.5 - c;
      const x = dx * cos + dy * sin;
      const y = -dx * sin + dy * cos;

      let colour = BG;
      if (inFootball(x, y)) {
        colour = FG;
        // Seam and laces are punched back out in the background blue.
        const onSeam = inBar(x, y, 0, 0, seamHx, seamHy);
        const onLace = laceXs.some((lx) => inBar(x, y, lx, 0, laceHx, laceHy));
        if (onSeam || onLace) colour = BG;
      }

      const i = (py * S + px) * 4;
      buf[i] = colour[0];
      buf[i + 1] = colour[1];
      buf[i + 2] = colour[2];
      buf[i + 3] = 255;
    }
  }

  return downsample(buf, S, size);
}

/** Box-filter SSxSS blocks down to the target size. */
function downsample(src, srcSize, dstSize) {
  const out = new Uint8Array(dstSize * dstSize * 4);
  const n = SS * SS;
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * srcSize + (x * SS + sx)) * 4;
          r += src[i];
          g += src[i + 1];
          bl += src[i + 2];
        }
      }
      const o = (y * dstSize + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(bl / n);
      out[o + 3] = 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

// Every icon is full-bleed square: iOS rounds the apple-touch-icon itself, and
// Android masks the maskable one -- which is why that variant draws smaller, to
// stay inside the 80% safe zone.
const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-512-maskable.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 1 },
  { file: 'favicon-32.png', size: 32, scale: 1 },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, size, scale } of ICONS) {
  const png = encodePng(render(size, scale), size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log(`\nWrote ${ICONS.length} icons to ${OUT_DIR}`);
