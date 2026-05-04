/**
 * Generates PWA icons for GroundTruth.
 * Run: node scripts/generate-icons.mjs
 *
 * Produces:
 *   public/icons/icon-192.png  (192×192)
 *   public/icons/icon-512.png  (512×512)
 *
 * Uses only Node built-ins — no extra deps needed.
 * The icons are simple SVG→PNG via the Canvas API via a tiny pure-JS encoder
 * OR we just write valid SVG files and rely on browsers to accept SVG icons
 * (all modern browsers do for PWA manifests).
 *
 * For maximum compatibility we write proper PNG files using a hand-rolled
 * minimal PNG encoder so there's zero dependency on canvas/sharp/jimp.
 */

import { createWriteStream } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Minimal PNG encoder ────────────────────────────────────────────────────

function crc32(buf) {
  const table = crc32.table ?? (crc32.table = buildTable());
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}
function buildTable() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function encodePNG(width, height, getPixel) {
  // RGBA rows
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      raw.push(r, g, b, a);
    }
  }
  const compressed = deflateSync(Buffer.from(raw));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB  — change to 6 for RGBA
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Icon design ────────────────────────────────────────────────────────────
// Dark blue square, white radar/signal rings, "GT" text implied by geometry.

function makeIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const bg = [29, 78, 216, 255];   // blue-700
  const ring = [255, 255, 255, 180];
  const dot = [255, 255, 255, 255];

  // Outer ring radius, inner rings
  const rings = [
    size * 0.42,
    size * 0.30,
    size * 0.18,
  ];
  const ringWidth = size * 0.025;
  const dotR = size * 0.07;

  return encodePNG(size, size, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Rounded-square mask (background)
    const radius = size * 0.22;
    const inRoundedSquare =
      Math.abs(dx) <= cx - radius + radius * Math.exp(-Math.max(0, Math.abs(dx) - (cx - radius)) / (radius * 0.5)) &&
      Math.abs(dy) <= cy - radius + radius * Math.exp(-Math.max(0, Math.abs(dy) - (cy - radius)) / (radius * 0.5));

    // Simpler: just use a rounded corner test
    const rx = Math.max(Math.abs(dx) - (cx - radius), 0);
    const ry = Math.max(Math.abs(dy) - (cy - radius), 0);
    const inBg = rx * rx + ry * ry <= radius * radius;

    if (!inBg) return [0, 0, 0, 0]; // transparent outside

    // Dot (center)
    if (dist <= dotR) return dot;

    // Rings
    for (const r of rings) {
      if (Math.abs(dist - r) <= ringWidth) {
        // Only upper-right half for a "signal" look
        if (dx >= -size * 0.02 || dy <= size * 0.02) return ring;
      }
    }

    return bg;
  });
}

// ── Write files ────────────────────────────────────────────────────────────

for (const size of [192, 512]) {
  const buf = makeIcon(size);
  const outPath = join(ROOT, "public", "icons", `icon-${size}.png`);
  const ws = createWriteStream(outPath);
  ws.write(buf);
  ws.end();
  console.log(`✓ ${outPath} (${buf.length} bytes)`);
}
