// QR J01 R1: the Asma ul Husna app (app/asma.html), checked in a real browser on a phone (390 wide) and a computer
// (1400 wide), in English and Bangla. No sign-in, and NO request to any Firebase / Google host.
//
//   node tools/qr-verify/asma-browser.mjs                 (serves itself on PORT, default 8092)
//   QR_BASE=http://localhost:8080 node tools/qr-verify/asma-browser.mjs
//   --width=390 --lang=bn                                  (one width / one language only)
//   --mutate=<name>                                        (breaks one thing in the page as served; the suite must FAIL)
//       nav       ‹ › do nothing
//       firebase  the page imports the Firebase SDK from www.gstatic.com
//       studied   "Studied" is not kept (localStorage is not written)
//       back      the poster's ← Back does nothing
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const WIDTHS = arg("width") ? [Number(arg("width"))] : [390, 1400];
const LANGS = arg("lang") ? [arg("lang")] : ["en", "bn"];
const MUTATE = arg("mutate") ?? null;
const FORBIDDEN = /(^|\.)(gstatic\.com|googleapis\.com|firebaseapp\.com|firebaseio\.com|firebase\.google\.com|firebasestorage\.app|web\.app)$/i;
const PORT = Number(process.env.PORT) || 8092;
let base = process.env.QR_BASE, server;
if (!base) {
  server = spawn(process.execPath, ["serve.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  base = `http://localhost:${PORT}`;
  await new Promise((r) => setTimeout(r, 400));
}

let pass = 0, fail = 0;
const check = (ok, what) => {
  if (ok instanceof Promise) throw new Error(`check() was handed a promise: ${what}`);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};

// ---- 1. Static: the page's import closure carries no Firebase (walks app/asma.html like import-walk.mjs). ----
{
  const re = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+\.js|https?:\/\/[^"']+)["']/g;
  const seen = new Set(), remote = [];
  const walk = (file) => {
    if (seen.has(file)) return; seen.add(file);
    for (const m of fs.readFileSync(file, "utf8").matchAll(re)) {
      if (/^https?:/.test(m[1])) { remote.push(`${file} -> ${m[1]}`); continue; }
      const p = path.normalize(path.join(path.dirname(file), m[1]));
      if (fs.existsSync(p)) walk(p);
    }
  };
  walk("app/asma.html");
  check(seen.size > 10, `static: app/asma.html reaches ${seen.size - 1} scripts`);
  check(remote.length === 0, `static: no script in the closure imports from another site${remote.length ? ": " + remote.join(", ") : ""}`);
  const named = [...seen].filter((f) => /firebase-init\.js|asma-collections\.js$|sw-register\.js/.test(f));
  check(named.length === 0, `static: no firebase-init.js, asma-collections.js or sw-register.js in the closure${named.length ? ": " + named.join(", ") : ""}`);
}

// ---- 2. The manifest and its icons. ----
const browser = await chromium.launch();
const outsideHosts = new Map(); // host -> count, every width/lang
try {
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.goto(`${base}/app/asma.webmanifest`);
    check(res.ok(), `manifest loads (${res.status()})`);
    const m = JSON.parse(await res.text());
    check(m.name === "Asma ul Husna" && m.short_name === "Asma", `manifest name "${m.name}", short_name "${m.short_name}"`);
    check(m.start_url === "./asma.html" && m.scope === "./" && m.display === "standalone", "manifest start_url ./asma.html, scope ./, display standalone");
    check(/^#/.test(m.theme_color ?? "") && /^#/.test(m.background_color ?? ""), "manifest theme and background colours");
    for (const want of [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]]) {
      const icon = m.icons.find((i) => i.sizes === want[0] && i.purpose === want[1]);
      const r = icon && await page.goto(`${base}/app/${icon.src}`);
      const size = r && await page.evaluate(() => { const i = document.querySelector("img"); return i ? `${i.naturalWidth}x${i.naturalHeight}` : ""; });
      check(!!r && r.ok() && size === want[0], `icon ${want[0]} ${want[1]} loads at its size (${size})`);
    }
    await page.goto(`${base}/app/asma.html`);
    const links = await page.evaluate(() => ({ manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"), apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") }));
    check(links.manifest === "./asma.webmanifest" && !!links.apple, "asma.html links the manifest and an apple-touch-icon");
    const apple = await page.goto(`${base}/app/${links.apple.replace("./", "")}`);
    check(apple.ok(), `apple-touch-icon loads (${apple.status()})`);
    const sw = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.() ?? []).length);
    check(sw === 0, "no service worker registered (that is R2)");
    await ctx.close();
  }

  // ---- 3. In the browser: each width, each language. ----
  for (const width of WIDTHS) for (const lang of LANGS) {
    try { await runOne(width, lang); } catch (err) { check(false, `@${width} ${lang} stopped early: ${String(err.message).split("\n")[0]}`); }
  }
  async function runOne(width, lang) {
    const tag = `@${width} ${lang}`;
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
    await ctx.addInitScript((l) => {
      if (!sessionStorage.getItem("qr-test-seeded")) {
        localStorage.clear();
        localStorage.setItem("mm_app_lang", l);
        localStorage.setItem("mm_disable_service_worker", "1");
        sessionStorage.setItem("qr-test-seeded", "1");
      }
    }, lang);
    if (MUTATE) await mutate(ctx, MUTATE);
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errors = [], requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(`${base}/app/asma.html`, { waitUntil: "load" });
    await page.waitForSelector("[data-qa-grid] .qa-card");

    // 99 Names
    const cards = await page.locator(".qa-card").count();
    check(cards === 99, `${tag} the grid shows 99 Names (${cards})`);
    const first = await page.locator('.qa-card[data-qa-name="1"]').innerText();
    check(first.includes("الرَّحْمَٰن"), `${tag} Name 1's card shows its Arabic`);
    if (lang === "bn") {
      check(first.includes("আর-রহমান") && first.includes("১"), `${tag} Name 1's card is in Bangla (name and digits)`);
      check((await page.locator('[data-qa-tab="names"]').innerText()).includes("৯৯"), `${tag} the tabs are in Bangla`);
    } else {
      check(first.includes("Ar-Rahman") && first.includes("The Most Merciful"), `${tag} Name 1's card is in English`);
    }
    await noSideways(page, `${tag} grid`);

    // Night and Light
    const nightBg = await bodyBg(page);
    check(await page.evaluate(() => document.documentElement.dataset.cardLook) === "night", `${tag} starts in Night`);
    await page.click('[data-qa-look="light"]');
    const lightBg = await bodyBg(page);
    check(lightBg !== nightBg && await page.evaluate(() => document.documentElement.dataset.cardLook) === "light", `${tag} Light changes the look (${nightBg} -> ${lightBg})`);
    await page.click('[data-qa-look="night"]');
    check(await bodyBg(page) === nightBg, `${tag} Night brings it back`);

    // The group wheel
    await page.click('[data-qa-tab="groups"]');
    await page.waitForSelector("[data-qa-wheel] svg.mastery-wheel");
    const slices = await page.locator("[data-qa-wheel] .wheel-seg").count();
    const rows = await page.locator("[data-qa-group]").count();
    check(slices === 19 && rows === 19, `${tag} the wheel of groups renders 19 slices and 19 rows (${slices}, ${rows})`);
    const wheelBox = await page.locator("[data-qa-wheel] svg").boundingBox();
    check(wheelBox && wheelBox.width >= 250 && wheelBox.x >= 0 && wheelBox.x + wheelBox.width <= width, `${tag} the wheel fits the screen (${Math.round(wheelBox?.width ?? 0)}px wide)`);
    await noSideways(page, `${tag} groups`);
    await page.locator("[data-qa-wheel] .wheel-seg").first().dispatchEvent("click");
    await page.waitForSelector("[data-qa-wheel] .wheel-seg-label-ar");
    const groupNames = await page.locator("[data-qa-wheel] .wheel-seg").count();
    check(groupNames === 4 && /v=group/.test(page.url()), `${tag} a slice opens its group's own wheel of Names (${groupNames})`);
    await page.click("[data-qa-back]");
    await page.waitForSelector("[data-qa-group]");
    check(/v=groups/.test(page.url()), `${tag} ← Back returns to the groups`);

    // Name 1
    await page.click('[data-qa-tab="names"]');
    await page.locator('.qa-card[data-qa-name="1"]').click();
    await page.waitForSelector('[data-qa-detail="1"]');
    check((await page.locator("[data-qa-arabic]").innerText()).trim() === "الرَّحْمَٰن", `${tag} Name 1 opens with its Arabic`);
    const meaning = (await page.locator("[data-qa-meaning]").innerText()).trim();
    check(lang === "bn" ? /[ঀ-৿]/.test(meaning) : meaning === "The Most Merciful", `${tag} Name 1's meaning shows ("${meaning}")`);
    await page.waitForSelector("#qaCitedAyat .asmax-cited-ayah .asmax-cited-words", { timeout: 15000 }).catch(() => {});
    const ayat = await page.locator("#qaCitedAyat .asmax-cited-ayah").count();
    const ayahText = ayat ? (await page.locator("#qaCitedAyat .asmax-cited-words").first().innerText()).trim() : "";
    const ayahTr = ayat ? (await page.locator("#qaCitedAyat .asmax-cited-tr").first().innerText()).trim() : "";
    check(ayat >= 1 && /[؀-ۿ]/.test(ayahText) && ayahTr.length > 20, `${tag} Name 1's cited āyāt are written out (${ayat}, translation ${ayahTr.length} chars)`);
    if (lang === "bn") check(/[ঀ-৿]/.test(ayahTr), `${tag} the āyah's translation is Bangla`);
    await page.locator("#qaCitedAyat .asmax-cited-word").first().click();
    check((await page.locator("#qaCitedAyat .qa-gloss").first().innerText().catch(() => "")).includes("—"), `${tag} tapping a word shows its meaning`);
    await noSideways(page, `${tag} Name 1`);
    await tapTargets(page, `${tag} Name 1`);

    // ‹ ›
    await page.click("[data-qa-next]");
    await page.waitForSelector('[data-qa-detail="2"]', { timeout: 3000 }).catch(() => {});
    check(await page.locator('[data-qa-detail="2"]').count() === 1 && (await page.locator("[data-qa-arabic]").innerText()).trim() === "الرَّحِيم", `${tag} › goes to Name 2`);
    await page.click("[data-qa-prev]");
    await page.waitForSelector('[data-qa-detail="1"]', { timeout: 3000 }).catch(() => {});
    check(await page.locator('[data-qa-detail="1"]').count() === 1, `${tag} ‹ comes back to Name 1`);
    check(await page.locator("[data-qa-prev]").isDisabled(), `${tag} ‹ is off on the first Name`);

    // The poster, full size, and its way back
    await page.click("[data-qa-poster]");
    await page.waitForSelector("#qaPosterOverlay:not([hidden]) .ahp[data-asma-poster='1']", { timeout: 5000 }).catch(() => {});
    check(await page.locator("#qaPosterOverlay:not([hidden]) .ahp[data-asma-poster='1']").count() === 1 && /v=poster/.test(page.url()), `${tag} the full poster opens`);
    const desc = (await page.locator("#qaPosterMount [data-poster-desc]").innerText().catch(() => "")).trim();
    check(desc.length > 40, `${tag} the poster shows Name 1's description (${desc.length} chars)`);
    check(await page.locator("#qaPosterMount [data-asma-desc-strip] [data-asma-desc-src]").count() === 3, `${tag} the description strip offers its sources`);
    await page.click('#qaPosterMount [data-asma-desc-src="suggested"]');
    check(await page.evaluate(() => localStorage.getItem("mmsa.asmaDescriptionSource")) === "suggested", `${tag} the description choice is kept on this device`);
    await page.click('#qaPosterMount [data-asma-desc-src="poster"]');
    const backBtn = page.locator("#qaPosterBack");
    check(await backBtn.isVisible() && (await backBtn.innerText()).startsWith("←"), `${tag} the poster shows a visible ← Back`);
    const pb = await backBtn.boundingBox();
    check(pb && pb.height >= 40, `${tag} ← Back is finger-sized (${Math.round(pb?.height ?? 0)}px)`);
    const posterBox = await page.locator("#qaPosterMount .ahp").boundingBox();
    check(posterBox && posterBox.x >= 0 && posterBox.x + posterBox.width <= width + 1, `${tag} the poster fits the screen (${Math.round(posterBox?.width ?? 0)}px)`);
    await backBtn.click();
    await page.waitForSelector("#qaPosterOverlay[hidden]", { state: "attached", timeout: 3000 }).catch(() => {});
    check(await page.locator("#qaPosterOverlay[hidden]").count() === 1 && await page.locator('[data-qa-detail="1"]').count() === 1 && /v=name&n=1/.test(page.url()), `${tag} ← Back returns to the same Name`);

    // Studied, kept on this device
    await page.click("[data-qa-studied]");
    check(await page.getAttribute("[data-qa-studied]", "aria-pressed") === "true", `${tag} Studied ticks`);
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[data-qa-detail="1"]');
    check(await page.getAttribute("[data-qa-studied]", "aria-pressed") === "true", `${tag} Studied survives a reload`);
    await page.click("[data-qa-back]");
    await page.waitForSelector("[data-qa-grid]");
    check(await page.locator('.qa-card[data-qa-name="1"] .qa-card-tick').count() === 1, `${tag} the grid marks Name 1 studied`);
    const inView = await page.locator('.qa-card[data-qa-name="1"]').evaluate((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    check(inView, `${tag} ← Back from a Name lands on its card`);

    // A Name with a cited hadith
    await page.goto(`${base}/app/asma.html#v=name&n=20`, { waitUntil: "load" });
    await page.waitForSelector("#qaCitedHadith .asmax-cited-hadith-ar", { timeout: 15000 }).catch(() => {});
    const had = (await page.locator("#qaCitedHadith .asmax-cited-hadith-ar").first().innerText().catch(() => "")).trim();
    check(/[؀-ۿ]{20}/.test(had.replace(/\s/g, "")), `${tag} Name 20's cited hadith is written out (${had.length} chars)`);
    const open = page.locator("#qaCitedHadith a[data-asmax-hadith-open]").first();
    const href = await open.getAttribute("href").catch(() => "");
    check(href?.startsWith("https://madrasatul-muslimeen.github.io/app/hadith-collections.html?openiti=") && await open.getAttribute("target") === "_blank", `${tag} "Open in Hadith ↗" goes to MMSA's Hadith library in a new tab`);
    const hadTr = (await page.locator("#qaCitedHadith [data-asmax-hadith-tr]").first().getAttribute("data-asmax-hadith-tr").catch(() => ""));
    check(hadTr === lang, `${tag} the hadith's translation is in the reader's language (${hadTr})`);
    await noSideways(page, `${tag} Name 20`);

    check(errors.length === 0, `${tag} no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
    const bad = requests.filter((u) => { try { return FORBIDDEN.test(new URL(u).hostname); } catch { return false; } });
    check(bad.length === 0, `${tag} ZERO requests to Firebase/Google hosts (${requests.length} requests in all)${bad.length ? ": " + bad.join(", ") : ""}`);
    for (const u of requests) { try { const h = new URL(u).host; if (!h.startsWith("localhost")) outsideHosts.set(h, (outsideHosts.get(h) ?? 0) + 1); } catch {} }
    await ctx.close();
  }

  // ---- 4. The poster shown straight away (POSTER_INLINE = true), as the owner may choose. ----
  if (!MUTATE) for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
    await ctx.route("**/app/js/asma-app.js", async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()).replace("export const POSTER_INLINE = false;", "export const POSTER_INLINE = true;") });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/app/asma.html#v=name&n=7`, { waitUntil: "load" });
    await page.waitForSelector('[data-qa-detail="7"]');
    check(await page.locator(".qa-namecard .qa-poster-inline .ahp").count() === 1, `@${width} POSTER_INLINE=true: the poster shows on the Name straight away`);
    await page.click(".qa-poster-inline");
    await page.waitForSelector("#qaPosterOverlay:not([hidden]) .ahp", { timeout: 3000 }).catch(() => {});
    check(await page.locator("#qaPosterOverlay:not([hidden]) .ahp").count() === 1, `@${width} POSTER_INLINE=true: a tap opens it full size`);
    await noSideways(page, `@${width} POSTER_INLINE=true`);
    check(errors.length === 0, `@${width} POSTER_INLINE=true: no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server?.kill();
}

const hosts = [...outsideHosts].map(([h, n]) => `${h} (${n})`).join(", ");
console.log(`\nOther sites the page asked for: ${hosts || "none"}${outsideHosts.has("archive.org") ? " (archive.org is unreachable in this sandbox; not a failure)" : ""}`);
console.log(`${pass} passed, ${fail} failed${MUTATE ? ` (mutation: ${MUTATE})` : ""}`);
process.exit(fail ? 1 : 0);

// ---- helpers ----
async function bodyBg(page) { return page.evaluate(() => getComputedStyle(document.body).backgroundColor); }
async function noSideways(page, what) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(sw <= cw, `${what}: no sideways scroll (${sw} <= ${cw})`);
}
/** Every button and link a finger presses is at least 40px tall (the cited words and chips included). */
async function tapTargets(page, what) {
  const small = await page.evaluate(() => [...document.querySelectorAll("button, a")]
    .filter((el) => el.offsetParent !== null && !el.closest(".qa-foot") && !el.closest(".ahp"))
    .map((el) => ({ h: el.getBoundingClientRect().height, t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30) }))
    .filter((x) => x.h < 39.5));
  check(small.length === 0, `${what}: every control is at least 40px tall${small.length ? ": " + small.map((x) => `${x.t} ${Math.round(x.h)}px`).join(", ") : ""}`);
}
/** The page as served, with one thing broken (the files on disk are never touched). */
async function mutate(ctx, name) {
  const edits = {
    nav: [/nav\(\{ v: "name", n: (next|prev), g: groupId \}, \{ replace: true \}\)/g, "void 0"],
    firebase: [/^/, 'import "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";\n'],
    studied: [/localStorage\.setItem\(STUDIED_KEY,[^;]+;/, "void 0;"],
    back: [/overlayBack\.onclick = \(\) => backTo\(\{ v: "name", n, g: groupId \}\);/, "overlayBack.onclick = () => {};"],
  };
  if (!edits[name]) throw new Error(`Unknown mutation "${name}"`);
  await ctx.route("**/app/js/asma-app.js", async (route) => {
    const res = await route.fetch();
    const text = await res.text();
    const out = text.replace(edits[name][0], edits[name][1]);
    if (out === text) throw new Error(`Mutation "${name}" did not apply`);
    await route.fulfill({ response: res, body: out });
  });
}
