// Lists every script a page reaches through its imports (from the MMSA handover pack, section 6).
// Run from the root of a checkout: node tools/qr-verify/import-walk.mjs asma-study.html ldog-study.html
import fs from "node:fs"; import path from "node:path";
const re = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+\.js)["']/g;
function walk(file, seen) {
  if (seen.has(file)) return; seen.add(file);
  for (const m of fs.readFileSync(file, "utf8").matchAll(re)) {
    const p = path.normalize(path.join(path.dirname(file), m[1])); if (fs.existsSync(p)) walk(p, seen);
  }
}
for (const page of process.argv.slice(2)) { const s = new Set(); walk(`app/${page}`, s); console.log(page, s.size - 1, "scripts\n" + [...s].sort().join("\n")); }
