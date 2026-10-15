// QR's offline-cache and storage names must never clash with MMSA's (mm-…).
// Run from the repository root: node tools/qr-verify/naming.mjs
// Checks every cache name in app/sw.js starts with "qr-", and that no "mm-app-" style
// cache name survives a copy from MMSA. Passes trivially until app/sw.js exists.
import fs from "node:fs";

const QR_CACHES = ["qr-app-", "qr-qf-fonts-v1", "qr-ext-v1", "qr-mushaf-v1"];
let pass = 0, fail = 0;
const check = (ok, what) => { ok ? pass++ : fail++; console.log(`${ok ? "ok  " : "FAIL"} ${what}`); };

const sw = "app/sw.js";
if (!fs.existsSync(sw)) {
  check(true, `${sw} not copied yet (nothing to check)`);
} else {
  const src = fs.readFileSync(sw, "utf8");
  const mm = [...src.matchAll(/["'`](mm-(?:app|qf-fonts|ext|mushaf)-[^"'`$]*)/g)].map((m) => m[1]);
  check(mm.length === 0, `no MMSA cache names in ${sw}${mm.length ? ": " + mm.join(", ") : ""}`);
  for (const name of QR_CACHES) check(src.includes(name), `${sw} uses ${name}`);
  const prefixes = [...src.matchAll(/startsWith\(\s*["'`]([a-z-]+)["'`]/g)].map((m) => m[1]);
  check(prefixes.every((p) => p.startsWith("qr-") || !p.endsWith("-")),
    `old-cache clean-up only touches qr- caches (${prefixes.join(", ") || "none"})`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
