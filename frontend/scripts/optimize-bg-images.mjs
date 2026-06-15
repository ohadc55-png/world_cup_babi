// Convert heavy background PNGs to WebP @ q=80, max-width 1920.
// One-shot script — run manually after replacing source PNGs.
//
// Usage:
//   node scripts/optimize-bg-images.mjs
//
// Output: writes login.webp / game.webp / wc7.webp alongside originals in public/img/.
// Originals are NOT touched — delete by hand after visual validation.

import sharp from "sharp";
import { stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = resolve(__dirname, "..", "public", "img");

const TARGETS = ["login", "game", "wc7"];
const QUALITY = 80;
const MAX_WIDTH = 1920;

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function convert(name) {
  const inPath = resolve(IMG_DIR, `${name}.png`);
  const outPath = resolve(IMG_DIR, `${name}.webp`);

  const inStat = await stat(inPath);
  await sharp(inPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(outPath);
  const outStat = await stat(outPath);

  const savedPct = ((1 - outStat.size / inStat.size) * 100).toFixed(1);
  console.log(`${name}.png ${fmtKB(inStat.size)}  ->  ${name}.webp ${fmtKB(outStat.size)}   (-${savedPct}%)`);
}

for (const t of TARGETS) {
  try {
    await convert(t);
  } catch (e) {
    console.error(`failed: ${t} -- ${e.message}`);
    process.exitCode = 1;
  }
}
