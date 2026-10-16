// QR J02 S4 (QR-only): links in the pages copied from MMSA that point at pages QR does not hold (the other study
// modules, the teaching pages, the Hadith library...). Copied files stay unchanged: app/sw.js adds one line that
// loads this file to each copied page as it serves it, and the site's 404.html uses it for anything still missed.
//
// THE ONE SWITCH (the owner's QR J02 Q1):
//   "mmsa"  such a link opens the same page in the full Madrasah (https://madrasatul-muslimeen.github.io/app/<page>)
//   "hide"  such a link is hidden (and a menu group or the Continue strip left with nothing in it is hidden too)
export const QR_OTHER_SUBJECTS = "mmsa";

export const MMSA_ORIGIN = "https://madrasatul-muslimeen.github.io";

/** Every page QR holds under app/ (tools/qr-verify/links-browser.mjs checks this list against the files). */
export const QR_PAGES = Object.freeze([
  "about.html", "accept-invite.html", "asma-about.html", "asma.html", "bookmarks.html", "import-notes.html", "index.html",
  "journey-map.html", "ldog-study.html", "monitor.html", "notes.html", "onboarding.html", "quranrevival.html", "records.html",
]);

/** MMSA pages whose subject QR has its own page for: such a link opens QR's page (in either mode). */
export const SAME_IN_QR = Object.freeze({ "asma-study.html": "asma.html" });

/** True for an address on this site, under /app/, naming a page QR does not hold. */
export function notInQr(url) {
  let u;
  try { u = new URL(url, location.href); } catch { return false; }
  if (u.origin !== location.origin) return false;
  const m = u.pathname.match(/^\/app\/([^/]+\.html)$/);
  return !!m && !QR_PAGES.includes(m[1]);
}

/** QR's own page for an MMSA page whose subject QR has (SAME_IN_QR), with its ?query and #place; else null. */
export function sameInQr(url) {
  const u = new URL(url, location.href);
  const own = notInQr(u.href) ? SAME_IN_QR[u.pathname.split("/").pop()] : null;
  return own ? `/app/${own}${u.search}${u.hash}` : null;
}

/** The same page, with its ?query and #place, in the full Madrasah. */
export function mmsaUrl(url) {
  const u = new URL(url, location.href);
  return `${MMSA_ORIGIN}${u.pathname}${u.search}${u.hash}`;
}

const HIDDEN = "data-qr-hidden";
// A container that only exists to hold links: hidden when every link in it is.
const HOLDERS = ".nav-cat-group, .nav-cat, .continue-strip";

function visibleControls(el) {
  return [...el.querySelectorAll("a[href], button, select, input")].filter((c) => !c.closest(`[${HIDDEN}]`) && !c.closest("summary"));
}

function fixLink(a, mode) {
  const href = a.getAttribute("href") ?? "";
  if (!notInQr(href)) return;
  const own = sameInQr(href);
  if (own) { a.setAttribute("href", own); a.dataset.qrOwn = ""; return; }
  if (mode === "hide") {
    if (a.hasAttribute(HIDDEN)) return;
    a.setAttribute(HIDDEN, "");
    for (let h = a.parentElement?.closest(HOLDERS); h; h = h.parentElement?.closest(HOLDERS)) {
      if (!h.hasAttribute(HIDDEN) && visibleControls(h).length === 0) h.setAttribute(HIDDEN, "");
    }
  } else {
    a.href = mmsaUrl(href);
    a.dataset.qrMmsa = "";
    if (!a.title) a.title = "madrasatul-muslimeen.github.io";
  }
}

/** Fixes every link in `root` (an element or the document). Returns how many links it changed or hid. */
export function fixLinks(root = document, mode = QR_OTHER_SUBJECTS) {
  const links = root.matches?.("a[href]") ? [root] : [...root.querySelectorAll("a[href]")];
  let n = 0;
  for (const a of links) if (notInQr(a.getAttribute("href") ?? "")) { fixLink(a, mode); n++; }
  return n;
}

let started = false;
/** Fixes the page now and every link the page draws later (menus, the Continue strip, lists drawn after sign-in). */
export function startQrLinks(mode = QR_OTHER_SUBJECTS) {
  if (started) return;
  started = true;
  const style = document.createElement("style");
  style.textContent = `[${HIDDEN}]{display:none!important}`;
  document.head.appendChild(style);
  fixLinks(document, mode);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") { if (r.target.matches?.("a[href]")) fixLinks(r.target, mode); continue; }
      for (const node of r.addedNodes) if (node.nodeType === 1) fixLinks(node, mode);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
}
