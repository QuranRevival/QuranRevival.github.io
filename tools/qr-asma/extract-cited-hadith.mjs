// QR J01 R1: the hadith the Asma ul Husna Names cite, pre-extracted into ONE small static file, so QR does not
// have to carry MMSA's whole Hadith library (OpenITI 114 MB + translations 64 MB) for 14 passages.
//
// It runs the very same code the MMSA page runs when a Name is opened (app/js/asma-cited-hadith.js's
// loadCitedHadith(), with POSTER_HADITH from app/js/asma-poster.js, both copied unchanged), only reading the
// library from a local MMSA checkout instead of over the network. So the passage joining (Muslim's page breaks),
// the standard-number concordance and the English/Bangla translations come out exactly as MMSA shows them.
//
//   node tools/qr-asma/extract-cited-hadith.mjs <path to an MMSA checkout>
//
// Writes tools/hadith-data-pull/output/asma-cited-hadith.json (the same output folder MMSA uses; app/asma.html
// reads it). Re-run after copying a newer MMSA commit; record that commit in docs/QR-PLAN.md's Copy log.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { POSTER_HADITH } from "../../app/js/asma-poster.js";
import { loadCitedHadith } from "../../app/js/asma-cited-hadith.js";
import { loadOpenitiBookIndex, loadOpenitiChapter, loadOpenitiConcordance, OPENITI_LICENCE, OPENITI_CREDIT_URL } from "../../app/js/openiti-corpus.js";
import { loadHadithTranslation } from "../../app/js/hadith-translations.js";

const mmsa = process.argv[2];
if (!mmsa || !fs.existsSync(path.join(mmsa, "tools/hadith-data-pull/output"))) {
  console.error("Usage: node tools/qr-asma/extract-cited-hadith.mjs <path to an MMSA checkout>");
  process.exit(2);
}
const out = path.join(mmsa, "tools/hadith-data-pull/output");
// A fetch() that reads the checkout's files: the loaders only use ok, status and json().
const fetchImpl = async (file) => {
  try { const body = fs.readFileSync(file, "utf8"); return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
  catch { return { ok: false, status: 404, json: async () => null }; }
};
const lib = { fetchImpl, baseUrl: `${out}/openiti-release/` };
const deps = {
  loadIndex: (v) => loadOpenitiBookIndex(v, lib),
  loadChapter: (v, ch) => loadOpenitiChapter(v, ch, lib),
  loadConcordance: (v) => loadOpenitiConcordance(v, { fetchImpl, baseUrl: `${out}/concordance/` }),
  loadTranslation: (v, std, lang) => loadHadithTranslation(v, std, lang, { fetchImpl, baseUrl: `${out}/translations/` }),
};

let commit = "unknown";
try { commit = execFileSync("git", ["-C", mmsa, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }

const items = {};
for (const [key, link] of Object.entries(POSTER_HADITH)) {
  const loaded = await loadCitedHadith(link, deps);
  items[key] = loaded;
  const tr = Object.entries(loaded.translations).filter(([, v]) => v).map(([l]) => l).join("+") || "none";
  console.log(`${key}: ${loaded.arabic.length} Arabic chars, translations ${tr}`);
}
const file = "tools/hadith-data-pull/output/asma-cited-hadith.json";
fs.mkdirSync(path.dirname(file), { recursive: true });
const doc = {
  about: "The hadith the Asma ul Husna Names cite, extracted by tools/qr-asma/extract-cited-hadith.mjs from MMSA's Hadith library. Keyed as POSTER_HADITH in app/js/asma-poster.js.",
  mmsaCommit: commit,
  arabicSource: { name: "OpenITI", licence: OPENITI_LICENCE, url: OPENITI_CREDIT_URL },
  items,
};
fs.writeFileSync(file, JSON.stringify(doc) + "\n");
console.log(`${file}: ${Object.keys(items).length} passages, ${fs.statSync(file).size} bytes (MMSA ${commit})`);
