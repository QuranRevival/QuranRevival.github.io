// QR J01 R1: draws the Asma app's icons from scratch (no calligraphy): a gold eight-point star on deep teal.
// Run from the repository root: node tools/qr-icons/make-asma-icons.mjs  (Playwright's Chromium draws the SVG)
// Writes app/img/asma-icon-192.png, asma-icon-512.png, asma-icon-maskable-512.png, asma-apple-touch-icon.png.
import { chromium } from "playwright";

const TEAL = "#0f4c4c", GOLD = "#d8b25a", DEEP = "#0b3a3a";
/** `scale` = the star's share of the canvas (a maskable icon keeps it inside the 80% safe circle). */
function svg(size, scale) {
  const c = size / 2, r = (size * scale) / 2, s = r * Math.SQRT1_2 * 1.0; // half-side of each square
  const sq = (rot) => `<rect x="${c - s}" y="${c - s}" width="${2 * s}" height="${2 * s}" transform="rotate(${rot} ${c} ${c})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${TEAL}"/>
    <g fill="${GOLD}">${sq(0)}${sq(45)}</g>
    <circle cx="${c}" cy="${c}" r="${s * 0.62}" fill="${DEEP}"/>
    <circle cx="${c}" cy="${c}" r="${s * 0.62}" fill="none" stroke="${GOLD}" stroke-width="${size * 0.012}"/>
    <g fill="${GOLD}" transform="translate(${c} ${c}) scale(${s * 0.0062})">
      <rect x="-40" y="-40" width="80" height="80"/><rect x="-40" y="-40" width="80" height="80" transform="rotate(45)"/>
    </g>
  </svg>`;
}
const OUT = [
  ["app/img/asma-icon-192.png", 192, 0.78],
  ["app/img/asma-icon-512.png", 512, 0.78],
  ["app/img/asma-icon-maskable-512.png", 512, 0.6],
  ["app/img/asma-apple-touch-icon.png", 180, 0.72],
];
const browser = await chromium.launch();
try {
  for (const [file, size, scale] of OUT) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<html><body style="margin:0">${svg(size, scale)}</body></html>`);
    await page.locator("svg").screenshot({ path: file });
    await page.close();
    console.log(file);
  }
} finally { await browser.close(); }
