// QR J02 S1c: the hadith-library chapter files the Āyah card's "Related hadith" can reach, derived (never
// hand-picked) from tools/hadith-data-pull/output/ayah-hadith/ and the books' index.json files.
//
// The Āyah card shows, for each āyah, the hits pickHits() keeps (app/js/ayah-hadith.js, at most 12), and
// describeHit() reads each hit's book index and then that passage's chapter file(s): without the chapter file the
// row loses its book title too. So the list is: for every āyah, every kept hit, the shard files of the chapter
// holding that passage.
//
//   node tools/qr-hadith/ayah-hadith-chapters.mjs <MMSA checkout>            prints the list and its size
//   node tools/qr-hadith/ayah-hadith-chapters.mjs <MMSA checkout> --copy     also copies them into QR, same paths
import fs from "node:fs";
import path from "node:path";
import { pickHits } from "../../app/js/ayah-hadith.js";

const mmsa = process.argv[2];
if (!mmsa) { console.error("Usage: node tools/qr-hadith/ayah-hadith-chapters.mjs <MMSA checkout> [--copy]"); process.exit(2); }
const OUT = "tools/hadith-data-pull/output";
const src = (p) => path.join(mmsa, OUT, p);

const indexes = {};
const need = new Set();
let ayat = 0, hits = 0;
for (let s = 1; s <= 114; s++) {
  const file = JSON.parse(fs.readFileSync(src(`ayah-hadith/${s}.json`), "utf8"));
  for (const all of Object.values(file)) {
    ayat++;
    for (const h of pickHits(all).shown) {
      hits++;
      indexes[h.book] ??= JSON.parse(fs.readFileSync(src(`openiti-release/split/${h.book}/index.json`), "utf8"));
      const chapter = indexes[h.book].chapters.find((c) => (c.hadithPositions ?? []).includes(h.n));
      for (const f of chapter?.shardFiles ?? []) need.add(`openiti-release/split/${h.book}/${f}`);
    }
  }
}
const list = [...need].sort();
const bytes = list.reduce((n, f) => n + fs.statSync(src(f)).size, 0);
if (process.argv.includes("--copy")) {
  let copied = 0, same = 0;
  for (const f of list) {
    const to = path.join(OUT, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(to) && Buffer.compare(fs.readFileSync(to), fs.readFileSync(src(f))) === 0) { same++; continue; }
    fs.copyFileSync(src(f), to);
    copied++;
  }
  console.log(`copied ${copied}, already identical ${same}`);
} else {
  console.log(list.join("\n"));
}
console.log(`${ayat} āyāt with hits, ${hits} hits shown, ${Object.keys(indexes).length} books, ${list.length} chapter files, ${(bytes / 1e6).toFixed(2)} MB`);
