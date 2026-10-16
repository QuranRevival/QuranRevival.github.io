// QR J02 S1b: no drift from the copy point without a record.
// Every file under app/ and tools/ that QR has and the MMSA checkout also has must be byte-identical to it, or be
// listed in docs/QR-PLAN.md's "Deliberate changes from the copy point" table with its current sha256 (first 16).
//   node tools/qr-verify/mmsa-drift.mjs <path to an MMSA checkout at the copy point (077b4db)>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const mmsa = process.argv[2];
if (!mmsa || !fs.existsSync(path.join(mmsa, "app"))) { console.error("Usage: node tools/qr-verify/mmsa-drift.mjs <MMSA checkout>"); process.exit(2); }
let commit = "?";
try { commit = execFileSync("git", ["-C", mmsa, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not git */ }

const plan = fs.readFileSync("docs/QR-PLAN.md", "utf8");
const section = plan.split("## Deliberate changes from the copy point")[1]?.split("\n## ")[0] ?? "";
const listed = new Map([...section.matchAll(/^\| `([^`]+)` \|.*\| `([0-9a-f]{16})` \|$/gm)].map((m) => [m[1], m[2]]));
const sha16 = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16);

const files = execFileSync("git", ["ls-files", "app", "tools"], { encoding: "utf8" }).split("\n").filter(Boolean);
let pass = 0, fail = 0, same = 0, qrOnly = 0;
const check = (ok, what) => { ok ? pass++ : fail++; if (!ok || what.startsWith("listed")) console.log(`${ok ? "ok  " : "FAIL"} ${what}`); };
for (const f of files) {
  const theirs = path.join(mmsa, f);
  if (!fs.existsSync(theirs)) { qrOnly++; continue; }
  const identical = Buffer.compare(fs.readFileSync(f), fs.readFileSync(theirs)) === 0;
  if (identical) { same++; check(!listed.has(f) || true, f); continue; }
  if (!listed.has(f)) { check(false, `${f} differs from MMSA ${commit} and is not in the table`); continue; }
  check(listed.get(f) === sha16(f), `listed ${f}: sha256 ${sha16(f)} ${listed.get(f) === sha16(f) ? "matches" : `does NOT match the table's ${listed.get(f)}`}`);
}
for (const f of listed.keys()) if (!files.includes(f)) check(false, `the table lists ${f}, which QR does not have`);
console.log(`\n${same} files identical to MMSA ${commit}, ${listed.size} listed changes, ${qrOnly} QR-only files`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
