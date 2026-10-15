// QR's offline-cache and storage names must never clash with MMSA's (mm-…).
// Run from the repository root: node tools/qr-verify/naming.mjs
// Checks every cache name in app/sw.js starts with "qr-", and that no "mm-app-" style
// cache name survives a copy from MMSA. Passes trivially until app/sw.js exists.
import fs from "node:fs";

// QR J01 R2: app/sw.js is QR's own worker (the Asma app), not a copy of MMSA's: it has the app cache and a Qur'an
// cache, and none of MMSA's font, SDK or Mushaf caches yet. So the check is on intent: every cache name it uses
// starts with "qr-", the app cache is qr-app-<version>, no MMSA (mm-) cache name appears, and the old-cache
// clean-up only ever matches qr-app- caches.
let pass = 0, fail = 0;
const check = (ok, what) => { ok ? pass++ : fail++; console.log(`${ok ? "ok  " : "FAIL"} ${what}`); };

const sw = "app/sw.js";
if (!fs.existsSync(sw)) {
  check(true, `${sw} not written yet (nothing to check)`);
} else {
  const src = fs.readFileSync(sw, "utf8");
  const mm = [...src.matchAll(/["'`](mm-[a-z-]+)/g)].map((m) => m[1]);
  check(mm.length === 0, `no MMSA cache names in ${sw}${mm.length ? ": " + mm.join(", ") : ""}`);
  check(/`qr-app-\$\{[^}]+\}`/.test(src), `${sw} names its app cache qr-app-<version>`);
  const names = [...src.matchAll(/(?:caches\.open|caches\.delete)\(\s*([A-Z_]+|["'`][^"'`]+["'`])/g)].map((m) => m[1]);
  const consts = Object.fromEntries([...src.matchAll(/const ([A-Z_]+) = (["'`])([^"'`]+)\2/g)].map((m) => [m[1], m[3]]));
  const literal = names.map((n) => consts[n] ?? n.replace(/^["'`]|["'`]$/g, "")).filter((n) => n !== "key");
  check(literal.length > 0 && literal.every((n) => n.startsWith("qr-")), `every cache ${sw} opens starts with qr- (${literal.join(", ")})`);
  const prefixes = [...src.matchAll(/startsWith\(\s*["'`]([a-z-]+)["'`]/g)].map((m) => m[1]).filter((p) => p.endsWith("-"));
  check(prefixes.length > 0 && prefixes.every((p) => p === "qr-app-"), `old-cache clean-up only touches qr-app- caches (${prefixes.join(", ") || "none"})`);
  check(/caches\.delete\(key\)/.test(src) && /key\.startsWith\("qr-app-"\) && key !== APP_CACHE/.test(src), `the clean-up keeps the current cache and deletes only other qr-app- ones`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
