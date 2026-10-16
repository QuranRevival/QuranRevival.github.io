// QR J02 S3b: a real phone moves from the Asma app as it may first go live (qr/r4-store-ready, 76d3736: a CLASSIC
// worker registered as ./sw.js?v=00.03, caches qr-app-00.03 and qr-quran-v1) to this branch (one MODULE worker at
// /app/sw.js for every QR page). Same address, same browser profile, the site's files swapped underneath.
// At 390 and 1400:
//   old site: ticks Studied on 3 Names, sets the screensaver, chooses a description, saves every āyah for offline;
//   new site: the reader sees at most ONE "new version" note, taps Reload, and ends with exactly one registration,
//   /app/sw.js at the new version, nothing waiting; their ticks and settings are there; qr-quran-v1 still holds the
//   51 surah files (not one fetched again) and qr-app-00.03 is gone; offline, Asma and its āyāt still work.
// Then the reverse: a first visit to Quran Study after the upgrade gets one registration, shared by Asma.
//
//   node tools/qr-verify/upgrade-browser.mjs [--width=390] [--mutate=quran]
//       --mutate=quran   the new worker's activate also deletes qr-quran-v1; the suite must FAIL
//
// The 76d3736 tree is exported with `git archive` into a scratch folder (QR_OLD_TREE, default a temp folder); that
// branch is never touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const WIDTHS = arg("width") ? [Number(arg("width"))] : [390, 1400];
const MUTATE = arg("mutate") ?? null;
const OLD_COMMIT = "76d3736";
const PORT = Number(process.env.PORT) || 8100;
const NEW = process.cwd();
const OLD = process.env.QR_OLD_TREE || fs.mkdtempSync(path.join(os.tmpdir(), "qr-old-"));
if (!fs.existsSync(path.join(OLD, "app/asma.html"))) execSync(`git archive ${OLD_COMMIT} | tar -x -C "${OLD}"`, { stdio: "inherit", shell: "/bin/bash" });
const NEW_V = fs.readFileSync("app/js/qr-version.js", "utf8").match(/APP_VERSION = "([\d.]+)"/)[1];

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
let ROOT = OLD;
const hits = []; // every path the server answered, with which tree
let server;
const sockets = new Set();
function startServer() {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    hits.push({ tree: ROOT === OLD ? "old" : "new", p });
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      let body = data;
      if (MUTATE === "quran" && ROOT === NEW && p === "/app/sw.js") {
        body = data.toString("utf8").replace('if (key.startsWith("qr-app-") && key !== APP_CACHE) await caches.delete(key);', 'if ((key.startsWith("qr-app-") && key !== APP_CACHE) || key === QURAN_CACHE) await caches.delete(key);');
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(body);
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  return new Promise((r) => server.listen(PORT, r));
}
function stopServer() { for (const s of sockets) s.destroy(); return new Promise((r) => server.close(() => r())); }
const base = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const check = (ok, what) => {
  if (ok instanceof Promise) throw new Error(`check() was handed a promise: ${what}`);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};

// Counts every time the Asma "new version" note becomes visible, across reloads (sessionStorage), for "at most one".
const NOTE_WATCH = () => {
  try {
    if (!localStorage.getItem("mm_disable_screensaver")) localStorage.setItem("mm_disable_screensaver", "1");
    const watch = () => {
      const el = document.querySelector("[data-qa-update]");
      if (!el) return;
      let shown = !el.hidden;
      if (shown) sessionStorage.setItem("qr-notes", String(Number(sessionStorage.getItem("qr-notes") || 0) + 1));
      new MutationObserver(() => {
        if (!el.hidden && !shown) sessionStorage.setItem("qr-notes", String(Number(sessionStorage.getItem("qr-notes") || 0) + 1));
        shown = !el.hidden;
      }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
  } catch { /* storage blocked */ }
};

async function profile(dir, width) {
  const ctx = await chromium.launchPersistentContext(dir, { viewport: { width, height: width < 600 ? 844 : 900 } });
  await ctx.addInitScript(NOTE_WATCH);
  return ctx;
}
async function workerVersion(page, which = "controller") {
  return page.evaluate(async (w) => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sw = w === "controller" ? navigator.serviceWorker.controller : reg?.[w];
    if (!sw) return null;
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data);
      sw.postMessage({ type: "GET_VERSION" }, [ch.port2]);
      setTimeout(() => resolve(null), 3000);
    });
  }, which);
}
const regs = (page) => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => ({ active: r.active?.scriptURL ?? null, waiting: r.waiting?.scriptURL ?? null, installing: r.installing?.scriptURL ?? null })));
const cacheReport = (page) => page.evaluate(async () => { const o = {}; for (const k of await caches.keys()) o[k] = (await (await caches.open(k)).keys()).length; return o; });

await startServer();
const browser = { };
try {
  for (const width of WIDTHS) {
    try { await upgrade(width); } catch (err) { check(false, `@${width} stopped early: ${String(err.message).split("\n")[0]}`); if (!server.listening) await startServer(); }
  }
  try { await reverse(); } catch (err) { check(false, `reverse stopped early: ${String(err.message).split("\n")[0]}`); }
  try { await noModuleWorkers(); } catch (err) { check(false, `no-module browser stopped early: ${String(err.message).split("\n")[0]}`); if (!server.listening) await startServer(); }
} finally {
  if (server.listening) await stopServer();
  if (!process.env.QR_OLD_TREE) fs.rmSync(OLD, { recursive: true, force: true });
}
void browser;
console.log(`\n${pass} passed, ${fail} failed${MUTATE ? ` (mutation: ${MUTATE})` : ""}`);
process.exit(fail ? 1 : 0);

async function upgrade(width) {
  const tag = `@${width}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-phone-"));
  try {
    // ---- The old site (76d3736). ----
    ROOT = OLD;
    let ctx = await profile(dir, width);
    let page = ctx.pages()[0] ?? await ctx.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/app/asma.html`, { waitUntil: "load" });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 });
    const oldSw = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
    check(/\/app\/sw\.js\?v=00\.03$/.test(oldSw), `${tag} old site: its classic worker runs (${oldSw.replace(base, "")})`);
    for (const n of [1, 2, 3]) {
      await page.goto(`${base}/app/asma.html#v=name&n=${n}`, { waitUntil: "load" });
      await page.waitForSelector(`[data-qa-detail="${n}"]`);
      if (await page.getAttribute("[data-qa-studied]", "aria-pressed") !== "true") await page.click("[data-qa-studied]");
    }
    await page.click("[data-qa-saver-settings]");
    await page.waitForSelector("#mmSaverSettings");
    await page.click('#mmSaverSettings [data-k="eachSec"] [data-v="5"]');
    await page.click('#mmSaverSettings [data-k="order"] [data-v="seq"]');
    await page.click('#mmSaverSettings [data-mmss="close"]');
    await page.click(".qa-poster-inline");
    await page.waitForSelector('#qaPosterMount [data-asma-desc-src="suggested"]');
    await page.click('#qaPosterMount [data-asma-desc-src="suggested"]');
    await page.click("#qaPosterBack");
    await page.click("[data-qa-offline-save]");
    await page.waitForFunction(() => /✓/.test(document.querySelector("[data-qa-offline-note]")?.textContent ?? ""), null, { timeout: 120000 });
    const before = await page.evaluate(() => ({ studied: localStorage.getItem("qr_asma_studied_v1"), saver: localStorage.getItem("mm_screensaver"), desc: localStorage.getItem("mmsa.asmaDescriptionSource") }));
    const c0 = await cacheReport(page);
    check(c0["qr-quran-v1"] === 51 && c0["qr-app-00.03"] > 0, `${tag} old site: all 51 surah files saved, qr-app-00.03 in use`);
    await ctx.close();

    // ---- The new site, same address, same profile. ----
    ROOT = NEW;
    const from = hits.length;
    ctx = await profile(dir, width);
    page = ctx.pages()[0] ?? await ctx.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/app/asma.html`, { waitUntil: "load" });
    await page.waitForSelector("[data-qa-update]:not([hidden])", { timeout: 60000 }).catch(() => {});
    check(await page.locator("[data-qa-update]").isVisible(), `${tag} new site: the reader sees "A new version is ready · Reload"`);
    await Promise.all([page.waitForEvent("load", { timeout: 60000 }), page.click("[data-qa-update] button")]).catch(() => {});
    // Settle: the new page registers the module worker; nothing should wait or ask again.
    let v = null, r = [];
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      r = await regs(page);
      v = await workerVersion(page);
      if (r.length === 1 && r[0].active === `${base}/app/sw.js` && !r[0].waiting && !r[0].installing && v === NEW_V) break;
    }
    check(r.length === 1 && r[0].active === `${base}/app/sw.js` && !r[0].waiting && !r[0].installing, `${tag} new site: one registration, /app/sw.js active, nothing waiting (${JSON.stringify(r).replaceAll(base, "")})`);
    check(v === NEW_V, `${tag} new site: the page runs version ${v} (expected ${NEW_V})`);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3000);
    const notes = await page.evaluate(() => Number(sessionStorage.getItem("qr-notes") || 0));
    check(notes === 1 && await page.locator("[data-qa-update]").isHidden(), `${tag} new site: the "new version" note was shown once in all (${notes}), and not again`);
    const after = await page.evaluate(() => ({ studied: localStorage.getItem("qr_asma_studied_v1"), saver: localStorage.getItem("mm_screensaver"), desc: localStorage.getItem("mmsa.asmaDescriptionSource") }));
    check(after.studied === before.studied && JSON.parse(after.studied ?? "[]").join() === "1,2,3", `${tag} the Studied ticks survive (${after.studied})`);
    check(after.saver === before.saver && JSON.parse(after.saver ?? "{}").eachSec === 5, `${tag} the screensaver settings survive`);
    check(after.desc === "suggested", `${tag} the description choice survives (${after.desc})`);
    const c1 = await cacheReport(page);
    check(c1["qr-quran-v1"] === 51, `${tag} qr-quran-v1 still holds the 51 surah files (${c1["qr-quran-v1"]})`);
    const refetched = hits.slice(from).filter((h) => h.p.startsWith("/tools/quran-data-pull/output/surahs/")).length;
    check(refetched === 0, `${tag} no surah file was downloaded again (${refetched})`);
    check(!("qr-app-00.03" in c1) && (c1[`qr-app-${NEW_V}`] ?? 0) > 200, `${tag} qr-app-00.03 deleted, qr-app-${NEW_V} in use (${Object.keys(c1).join(", ")})`);

    // ---- Offline after the upgrade. ----
    await ctx.setOffline(true);
    await stopServer();
    await page.goto(`${base}/app/asma.html#v=name&n=1`, { waitUntil: "load" }).catch(() => {});
    await page.waitForSelector('[data-qa-detail="1"]', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector("#qaCitedAyat .asmax-cited-words", { timeout: 15000 }).catch(() => {});
    const off = await page.evaluate(() => ({ detail: !!document.querySelector('[data-qa-detail="1"]'), ayah: document.querySelector("#qaCitedAyat .asmax-cited-words")?.textContent ?? "", tick: document.querySelector("[data-qa-studied]")?.getAttribute("aria-pressed") }));
    check(off.detail && /[؀-ۿ]/.test(off.ayah) && off.tick === "true", `${tag} offline after the upgrade: Name 1, its saved āyāt, its tick`);
    check(errors.length === 0, `${tag} no page errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
    await ctx.setOffline(false);
    await startServer();
    await ctx.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function reverse() {
  ROOT = NEW;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-phone-"));
  try {
    const ctx = await profile(dir, 390);
    const page = ctx.pages()[0] ?? await ctx.newPage();
    await page.route("**/archive.org/**", (r) => r.abort());
    await page.goto(`${base}/app/quranrevival.html`, { waitUntil: "load" });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(() => {});
    await page.goto(`${base}/app/asma.html`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    const r = await regs(page);
    check(r.length === 1 && r[0].active === `${base}/app/sw.js` && !r[0].waiting && !r[0].installing, `reverse: Quran Study first, then Asma: one registration, nothing waiting (${JSON.stringify(r).replaceAll(base, "")})`);
    check(await page.locator("[data-qa-update]").isHidden(), "reverse: no \"new version\" note");
    await ctx.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A browser that cannot run module service workers (register with type "module" throws a TypeError, as such
 *  browsers do): Asma still gets the worker, as a classic one, and works offline. */
async function noModuleWorkers() {
  ROOT = NEW;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-phone-"));
  try {
    const ctx = await profile(dir, 390);
    await ctx.addInitScript(() => {
      const real = navigator.serviceWorker?.register?.bind(navigator.serviceWorker);
      if (real) navigator.serviceWorker.register = (url, opts = {}) => (opts.type === "module" ? Promise.reject(new TypeError("module service workers are not supported")) : real(url, opts));
    });
    const page = ctx.pages()[0] ?? await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/app/asma.html`, { waitUntil: "load" });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 }).catch(() => {});
    const r = await regs(page);
    const v = await workerVersion(page);
    check(r.length === 1 && r[0].active === `${base}/app/sw.js` && v === NEW_V, `no-module browser: Asma's worker runs as a classic one (${JSON.stringify(r).replaceAll(base, "")}, version ${v})`);
    await ctx.setOffline(true);
    await stopServer();
    await page.reload({ waitUntil: "load" }).catch(() => {});
    await page.waitForSelector("[data-qa-grid] .qa-card", { timeout: 15000 }).catch(() => {});
    check(await page.locator(".qa-card").count() === 99, "no-module browser: offline, the 99 Names");
    check(errors.length === 0, `no-module browser: no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
    await ctx.setOffline(false);
    await startServer();
    await ctx.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
