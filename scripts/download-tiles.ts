#!/usr/bin/env tsx
/**
 * Download OpenStreetMap tiles for the Lagos demo area and cache them
 * locally in public/tiles/{z}/{x}/{y}.png
 *
 * Run once before the offline demo:
 *   npm run tiles:download
 *
 * The bounding box covers Lekki Phase 1 and surrounds at zooms 12–15.
 * ~400 tiles, ~12 MB total. Respects OSM tile usage policy with a
 * 200 ms delay between requests and a descriptive User-Agent.
 */

import fs from "fs";
import path from "path";

const TILE_DIR = path.join(process.cwd(), "public", "tiles");
const USER_AGENT = "GroundTruth/0.1 (Gemma4Good Hackathon; offline demo caching)";
const DELAY_MS = 200; // be polite to OSM tile servers

// Bounding box: Lekki / Victoria Island, Lagos
const BBOX = {
  minLat: 6.38,
  maxLat: 6.48,
  minLng: 3.38,
  maxLng: 3.54,
};

const ZOOM_LEVELS = [12, 13, 14, 15];

// ── Tile math ──────────────────────────────────────────────────────────────

function latLngToTile(lat: number, lng: number, zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return [x, y];
}

function getTileRange(zoom: number) {
  const [xMin, yMax] = latLngToTile(BBOX.minLat, BBOX.minLng, zoom);
  const [xMax, yMin] = latLngToTile(BBOX.maxLat, BBOX.maxLng, zoom);
  return { xMin, xMax, yMin, yMax };
}

// ── Download ───────────────────────────────────────────────────────────────

async function downloadTile(z: number, x: number, y: number): Promise<boolean> {
  const filePath = path.join(TILE_DIR, String(z), String(x), `${y}.png`);

  if (fs.existsSync(filePath)) return false; // already cached

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "image/png",
      },
    });

    if (!res.ok) {
      console.warn(`  HTTP ${res.status} for ${url}`);
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (err) {
    console.warn(`  Failed: ${url} — ${(err as Error).message}`);
    return false;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("GroundTruth — Offline Tile Downloader");
  console.log(`Saving to: ${TILE_DIR}\n`);

  let total = 0;
  let downloaded = 0;
  let skipped = 0;

  for (const zoom of ZOOM_LEVELS) {
    const { xMin, xMax, yMin, yMax } = getTileRange(zoom);
    const count = (xMax - xMin + 1) * (yMax - yMin + 1);
    console.log(`Zoom ${zoom}: x ${xMin}–${xMax}, y ${yMin}–${yMax} (${count} tiles)`);
    total += count;

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const wasNew = await downloadTile(zoom, x, y);
        if (wasNew) {
          downloaded++;
          process.stdout.write(".");
          await sleep(DELAY_MS);
        } else {
          skipped++;
          process.stdout.write("·");
        }
      }
    }
    console.log(); // newline after each zoom level
  }

  console.log(`\nDone. ${downloaded} downloaded, ${skipped} already cached, ${total} total.`);
  console.log('Set NEXT_PUBLIC_OFFLINE_TILES=true in .env.local to use cached tiles.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
