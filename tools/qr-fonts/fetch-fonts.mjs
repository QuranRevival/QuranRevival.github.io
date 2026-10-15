// QR J01 R1: self-hosts the few web fonts the Asma app needs, so the page makes NO request to
// fonts.googleapis.com / fonts.gstatic.com (or any other Google host) when a reader opens it.
// Run once from the repository root, with network: node tools/qr-fonts/fetch-fonts.mjs
// Writes app/fonts/*.woff2 and app/css/qr-fonts.css (the @font-face rules, unicode-range kept, so a
// browser downloads a file only when a character in its range is on screen).
// Licences: Amiri, Noto Naskh Arabic and Noto Sans Bengali are SIL Open Font Licence 1.1; Tinos is
// Apache 2.0. Both allow self-hosting and redistribution with the font files unchanged.
import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
// family query -> the subsets to keep (Google labels each @font-face block with a /* subset */ comment)
const WANT = [
  ["Amiri:wght@400;700", ["arabic", "latin"]],
  ["Noto+Naskh+Arabic:wght@700", ["arabic"]],
  ["Tinos", ["latin", "latin-ext"]],
  ["Noto+Sans+Bengali:wght@400;700", ["bengali"]],
];
const OUT_FONTS = "app/fonts";
const OUT_CSS = "app/css/qr-fonts.css";
fs.mkdirSync(OUT_FONTS, { recursive: true });
fs.mkdirSync(path.dirname(OUT_CSS), { recursive: true });

let css = `/* Self-hosted web fonts for QR (tools/qr-fonts/fetch-fonts.mjs writes this file; do not edit by hand).
   Amiri, Noto Naskh Arabic, Noto Sans Bengali: SIL Open Font Licence 1.1. Tinos: Apache Licence 2.0. */\n`;
let total = 0;
const byHash = new Map(); // a variable font comes back once per weight: keep one file
const { createHash } = await import("node:crypto");
for (const [family, subsets] of WANT) {
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${family}: HTTP ${res.status}`);
  const text = await res.text();
  for (const m of text.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)) {
    const [, subset, block] = m;
    if (!subsets.includes(subset)) continue;
    const fam = block.match(/font-family:\s*'([^']+)'/)[1];
    const weight = block.match(/font-weight:\s*(\d+)/)[1];
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)[1];
    const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex");
    let file = byHash.get(hash);
    if (!file) {
      file = `${fam.replace(/\s+/g, "")}-${weight}-${subset}.woff2`;
      byHash.set(hash, file);
      fs.writeFileSync(path.join(OUT_FONTS, file), buf);
      total += buf.length;
    }
    css += block.replace(url, `../fonts/${file}`) + "\n";
    console.log(`${file} ${buf.length} bytes`);
  }
}
fs.writeFileSync(OUT_CSS, css);
console.log(`${OUT_CSS} written; fonts ${total} bytes in all`);
