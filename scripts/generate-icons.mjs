// Generates the PWA icon set + favicon from one SVG source (the spine motif).
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS = resolve(root, "public/icons");
const PUBLIC = resolve(root, "public");

/** The Runbook mark: a vertical progress spine with nodes + step ticks. */
function buildSvg(variant /* "any" | "maskable" | "apple" */) {
  const rounded = variant === "any";
  const scale = variant === "maskable" ? 0.74 : 1;

  const bg = rounded
    ? `<rect width="512" height="512" rx="112" fill="url(#bg)"/>`
    : `<rect width="512" height="512" fill="url(#bg)"/>`;

  const art = `
    <rect x="190" y="150" width="16" height="110" rx="8" fill="#3a424c"/>
    <rect x="190" y="256" width="16" height="112" rx="8" fill="#2dd4bf"/>
    <circle cx="198" cy="150" r="19" fill="#14171c" stroke="#4a515b" stroke-width="7"/>
    <circle cx="198" cy="258" r="22" fill="#2dd4bf"/>
    <circle cx="198" cy="366" r="22" fill="#2dd4bf"/>
    <rect x="242" y="143" width="86" height="14" rx="7" fill="#474e58"/>
    <rect x="242" y="250" width="128" height="16" rx="8" fill="#828e9b"/>
    <rect x="242" y="358" width="104" height="16" rx="8" fill="#828e9b"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c1f26"/>
      <stop offset="1" stop-color="#111317"/>
    </linearGradient>
  </defs>
  ${bg}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}</g>
</svg>`;
}

async function main() {
  await mkdir(ICONS, { recursive: true });

  const anySvg = Buffer.from(buildSvg("any"));
  const maskSvg = Buffer.from(buildSvg("maskable"));
  const appleSvg = Buffer.from(buildSvg("apple"));

  await sharp(anySvg).resize(192, 192).png().toFile(resolve(ICONS, "icon-192.png"));
  await sharp(anySvg).resize(512, 512).png().toFile(resolve(ICONS, "icon-512.png"));
  await sharp(maskSvg)
    .resize(512, 512)
    .png()
    .toFile(resolve(ICONS, "icon-maskable-512.png"));
  await sharp(appleSvg)
    .resize(180, 180)
    .png()
    .toFile(resolve(ICONS, "apple-touch-icon.png"));

  await writeFile(resolve(PUBLIC, "favicon.svg"), buildSvg("any"), "utf8");

  console.log("Icons written to public/icons + public/favicon.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
