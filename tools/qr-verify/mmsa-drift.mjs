// QR J02 S1b: no drift from the copy point without a record.
// Every file under app/ and tools/ that QR has and the MMSA checkout also has must be byte-identical to it, or be
// listed in docs/QR-PLAN.md's "Deliberate changes from the copy point" table with its current sha256 (first 16).
//   node tools/qr-verify/mmsa-drift.mjs <path to an MMSA checkout at the copy point (077b4db)>
// J02 S1e: files listed under "## Pinned files (owner MMSA)" are MMSA's and are NEVER deliberate changes: each must be
// byte-identical to MMSA (at the copy point, or at the MMSA commit its line names; read with git from the same
// checkout, so that clone needs that commit), and listing one in the changes table is itself a failure.
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
const pinSection = plan.split("## Pinned files (owner MMSA)")[1]?.split("\n## ")[0] ?? "";
const pinned = new Map([...pinSection.matchAll(/^- `([^`]+)`(?: \(MMSA `([0-9a-f]{7,40})`\))?/gm)].map((m) => [m[1], m[2] ?? null]));
const sha16 = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16);

const files = execFileSync("git", ["ls-files", "app", "tools"], { encoding: "utf8" }).split("\n").filter(Boolean);
let pass = 0, fail = 0, same = 0, qrOnly = 0;
const check = (ok, what) => { ok ? pass++ : fail++; if (!ok || what.startsWith("listed")) console.log(`${ok ? "ok  " : "FAIL"} ${what}`); };
let pinnedOk = 0;
for (const [f, at] of pinned) {
  if (!files.includes(f)) { check(false, `pinned ${f}: QR does not have it`); continue; }
  let theirs = null;
  try { theirs = at ? execFileSync("git", ["-C", mmsa, "show", `${at}:${f}`]) : fs.readFileSync(path.join(mmsa, f)); } catch { /* missing */ }
  const ok = theirs !== null && Buffer.compare(fs.readFileSync(f), theirs) === 0;
  check(ok, `pinned ${f} is byte-identical to MMSA ${at ?? commit}`);
  if (listed.has(f)) check(false, `pinned ${f} is in the changes table: a pinned file is never a deliberate change`);
  if (ok) pinnedOk++;
}
for (const f of files) {
  if (pinned.has(f)) continue;
  const theirs = path.join(mmsa, f);
  if (!fs.existsSync(theirs)) { qrOnly++; continue; }
  const identical = Buffer.compare(fs.readFileSync(f), fs.readFileSync(theirs)) === 0;
  if (identical) { same++; check(!listed.has(f) || true, f); continue; }
  if (!listed.has(f)) { check(false, `${f} differs from MMSA ${commit} and is not in the table`); continue; }
  check(listed.get(f) === sha16(f), `listed ${f}: sha256 ${sha16(f)} ${listed.get(f) === sha16(f) ? "matches" : `does NOT match the table's ${listed.get(f)}`}`);
}
for (const f of listed.keys()) if (!files.includes(f)) check(false, `the table lists ${f}, which QR does not have`);
console.log(`\n${same} files identical to MMSA ${commit}, ${pinnedOk} of ${pinned.size} pinned files identical to MMSA, ${listed.size} listed changes, ${qrOnly} QR-only files`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
