// QR J01 R2 (QR-only): the offline worker for the Asma app (app/asma.html). A CLASSIC worker (works in every browser
// that has service workers), registered only by app/js/qr-sw-register.js as ./sw.js?v=<APP_VERSION>, scope /app/.
//
// Caches (QR names only; MMSA's mm- caches live on another site and are never touched):
//   qr-app-<version>  everything the Asma page needs, saved when the worker installs (about 1.6 MB). A new version
//                     saves a fresh copy; on activate every OTHER qr-app- cache is deleted, and nothing else.
//   qr-quran-v1       the Qur'an surah files (51 of them, 19 MB in all), saved one by one as a Name that cites them
//                     is opened, or all at once by "Save for offline" on the page. Kept across versions.
// A new worker WAITS: the page shows "A new version is ready · Reload" and only the reader's tap swaps it in.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const APP_CACHE = `qr-app-${VERSION}`;
const QURAN_CACHE = "qr-quran-v1";
const SURAH_PATH = "/tools/quran-data-pull/output/surahs/";

// Relative to this file (/app/). tools/qr-verify/asma-offline-browser.mjs checks this list covers every script the
// page reaches, every font, image, stylesheet and data file it uses.
const PRECACHE = [
  "asma.html",
  "asma.webmanifest",
  "css/asma.css",
  "css/qr-fonts.css",
  "fonts/Amiri-400-arabic.woff2",
  "fonts/Amiri-400-latin.woff2",
  "fonts/Amiri-700-arabic.woff2",
  "fonts/Amiri-700-latin.woff2",
  "fonts/NotoNaskhArabic-700-arabic.woff2",
  "fonts/NotoSansBengali-400-bengali.woff2",
  "fonts/Tinos-400-latin-ext.woff2",
  "fonts/Tinos-400-latin.woff2",
  "img/asma-poster-frame.webp",
  "img/asma-icon-192.png",
  "img/asma-icon-512.png",
  "img/asma-icon-maskable-512.png",
  "img/asma-apple-touch-icon.png",
  "js/asma-app-strings.js",
  "js/asma-app.js",
  "js/asma-cited-ayat.js",
  "js/asma-cited-hadith.js",
  "js/asma-collections-data.js",
  "js/asma-data.js",
  "js/asma-descriptions.js",
  "js/asma-local.js",
  "js/asma-poster-data.js",
  "js/asma-poster.js",
  "js/asma-ref-parser.js",
  "js/asma-renderer.js",
  "js/asma-wheel-fit.js",
  "js/hadith-translations.js",
  "js/i18n.js",
  "js/i18n/asma-names-bn.js",
  "js/i18n/bn.js",
  "js/i18n/surah-names-bn.js",
  "js/labels.js",
  "js/lang.js",
  "js/mastery-wheel.js",
  "js/openiti-corpus.js",
  "js/prefs.js",
  "js/quran-data.js",
  "js/quran-word-identity.js",
  "js/qr-sw-register.js",
  "js/qr-version.js",
  "js/unit-keys.js",
  "../tools/hadith-data-pull/output/asma-cited-hadith.json",
];

self.addEventListener("install", (event) => {
  // Straight from the network (not the browser's HTTP cache), so a new version never saves an old file.
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("qr-app-") && key !== APP_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); // only ever sent when the reader taps Reload
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // other sites: the browser as usual
  if (url.pathname.startsWith(SURAH_PATH)) { event.respondWith(quranFile(req)); return; }
  // The version file asks the network first, so an online visit always learns of a new version.
  if (url.pathname.endsWith("/js/qr-version.js")) { event.respondWith(networkFirst(req)); return; }
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
  return hit || fetch(req);
}

async function networkFirst(req) {
  try {
    const res = await Promise.race([fetch(req, { cache: "no-store" }), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]);
    if (res.ok) return res;
  } catch { /* offline or slow: the saved copy */ }
  return (await caches.open(APP_CACHE)).match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req));
}

async function quranFile(req) {
  const cache = await caches.open(QURAN_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}
