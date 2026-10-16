// QR J02 S1d: the hadith data's home is MMSA (PCA J71), so QR's pages read it from
// https://madrasatul-muslimeen.github.io/tools/hadith-data-pull/output/. In QR's browser checks those requests are
// answered from a LOCAL MMSA checkout instead (the copy point, 077b4db), with the same CORS header GitHub Pages sends
// (access-control-allow-origin: *), so no check depends on the network.
//
//   QR_MMSA_DIR=<MMSA checkout at 077b4db> npm test
//
// A check that uses this stops with a clear message when QR_MMSA_DIR is not set.
import fs from "node:fs";
import path from "node:path";

export const MMSA_HADITH = "https://madrasatul-muslimeen.github.io/tools/hadith-data-pull/output/";

export function mmsaDir() {
  const dir = process.env.QR_MMSA_DIR;
  if (!dir || !fs.existsSync(path.join(dir, "tools/hadith-data-pull/output"))) {
    throw new Error("Set QR_MMSA_DIR to an MMSA checkout (077b4db): QR's checks read MMSA's hadith data from it, not the network.");
  }
  return dir;
}

/** Answers every request for MMSA's hadith data in `ctx` (a Playwright context) from the local checkout. Register it
 *  AFTER any catch-all route for madrasatul-muslimeen.github.io (the newest route wins). Returns the hit counter. */
export async function routeMmsaHadith(ctx) {
  const dir = mmsaDir();
  const hits = { served: 0, missing: 0 };
  await ctx.route(`${MMSA_HADITH}**`, (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = path.join(dir, rel);
    const headers = { "access-control-allow-origin": "*", "cache-control": "max-age=600" };
    if (!file.startsWith(path.join(dir, "tools/hadith-data-pull/output") + path.sep) || !fs.existsSync(file)) {
      hits.missing++;
      return route.fulfill({ status: 404, headers, contentType: "text/plain", body: "Not found" });
    }
    hits.served++;
    return route.fulfill({ status: 200, headers, contentType: "application/json; charset=utf-8", body: fs.readFileSync(file) });
  });
  return hits;
}
