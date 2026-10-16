# QR build plan and layout (QR Architect)

Jobs live in the PCF (https://claude.ai/artifact/PhW1KKX28qrqj9dE7Ha8dZ): QR J01 (Asma), QR J02 (Quran Study + LDOG).

## Layout: the same paths as MMSA, so copied code runs unchanged

| Path | What | Comes from |
|---|---|---|
| `index.html` | QR's front page (coming-soon until QR J02 S3) | QR's own |
| `app/` | the pages, `app/js/`, `app/css/`, `app/sw.js` | MMSA `app/`, at the recorded commit |
| `tools/quran-data-pull/output/` | the Qur'an data (~56 MB). `quran-data.js` reads the ABSOLUTE path `/tools/quran-data-pull/output`, which works at this site's root | MMSA, same path |
| `tools/hadith-data-pull/output/` | only the parts the Āyah card and Asma cite | MMSA, same path |
| `tools/qr-verify/` | QR's own checks | QR's own |
| `serve.js` | local server (`node serve.js`, port 8080; `PORT=` for another) | QR's own |
| `.nojekyll` | GitHub Pages serves every file as is | QR's own |

## Offline-cache names (no clash with MMSA)

| MMSA | QR |
|---|---|
| `mm-app-<APP_VERSION>` | `qr-app-<APP_VERSION>` |
| `mm-qf-fonts-v1` | `qr-qf-fonts-v1` |
| `mm-ext-v1` | `qr-ext-v1` |
| `mm-mushaf-v1` | `qr-mushaf-v1` |

The old-cache clean-up in `app/sw.js` must only delete `qr-` caches. `tools/qr-verify/naming.mjs` checks this.
Storage keys such as `mm_disable_service_worker` stay as they are: storage belongs to one site address, so they
cannot clash, and keeping them keeps the shared scripts identical with MMSA.

## Offline (QR J01 R2): the Asma app

- **Worker:** `app/sw.js`, QR's own (not MMSA's copy), a CLASSIC worker so every browser with service workers runs it.
  Only `app/asma.html` registers it, through `app/js/qr-sw-register.js`, as `./sw.js?v=<APP_VERSION>`, scope `/app/`.
- **Version:** `app/js/qr-version.js` (`APP_VERSION`, QR numbering, allocated by the QR Architect; starts at `00.01`).
  The worker reads it from its own address. The page asks the network first for `qr-version.js`, so an online visit
  always learns of a new number.
- **Caches:**

  | Cache | What | Size | When |
  |---|---|---|---|
  | `qr-app-<APP_VERSION>` | the page, its 28 scripts, 2 stylesheets, 8 fonts, poster frame, manifest, icons, `asma-cited-hadith.json` (46 files) | 1.6 MB | saved when the worker installs |
  | `qr-quran-v1` | the 51 surah files the Names cite | 19.4 MB | each on first use, or all at once by the reader's "Save all āyāt for offline use (19 MB)" (progress shown) |

  Why not precache the surahs: 19 MB taken unasked on a first visit over a phone's data is unkind, and a large install
  fails more often. The Names, posters, groups and hadith work offline from the first visit; the āyāt a reader has
  opened are kept; one tap keeps them all. `qr-quran-v1` survives version changes, so a new version never downloads
  the 19 MB again.
- **Activate:** deletes every `qr-app-` cache except the current one, and nothing else (not `qr-quran-v1`, never `mm-`).
- **Updates:** a new worker WAITS. The page shows "A new version is ready · Reload"; only that tap swaps it in and
  reloads, back to the same view. Code never changes under a reader mid-visit.
- **Kill switches (as MMSA):** `?nosw` in the address, or `localStorage.mm_disable_service_worker = "1"`: the worker is
  unregistered and not registered again. `pages-browser.mjs` and `asma-browser.mjs` set the second;
  `asma-offline-browser.mjs` does not.

## The 🌙 screensaver (QR J01 R3)

- **Same experience as MMSA** (`asma-screensaver.js` + `screensaver-idle.js`, 077b4db): the Names' posters one after
  another, with MMSA's settings and defaults (start by itself after 3 minutes, 15 seconds a poster, template and photo
  posters, all Names, carry on, fade, clock, dim at night, keep the screen on), kept on this device only
  (localStorage `mm_screensaver`). "Ones I'm studying" uses this device's Studied ticks; "A group or list" the
  owner's groups (group 19 shown as "Other Names").
- **Files:** `screensaver-idle.js` and `asma-posters.js` copied byte-identical. `asma-screensaver.js` could NOT be
  kept identical (it imports `session-context.js`, so Firebase): `app/js/asma-screensaver-qr.js` is GENERATED from it
  by `tools/qr-asma/make-screensaver.mjs <MMSA checkout>` with 10 listed edits (no Firebase; the Names come from the
  app; "Open this Name" opens it here; ⚙ restarts through QR's watcher; a tap or key closes it; no "Where it may
  start" row; R4: the bar's "Open" fits one line, full words as its label). `--check` proves the file is exactly that. `app/js/qr-screensaver.js` is QR's watcher (MMSA's
  `armScreensaver` logic, loading the QR copy); nothing loads until it first starts.
- **Opening and closing:** 🌙 beside the tabs, and "Screensaver settings" in the footer. A tap on the poster or any
  key (except ← → space) closes it; the page under it never changed, so the reader is exactly where they were.
- **Kill switches (as MMSA):** `mm_disable_screensaver = "1"` or `?noscreensaver` stop it starting by itself
  (🌙 still opens it). The browser suites set the first.
- **Photo posters** come from archive.org (MMSA's set): online only; offline, the template posters show.

## Store-ready check (QR J01 R4)

- `app/asma-about.html` ("About and privacy", EN and BN, linked from the app's footer, saved for offline): what the
  app is, that it collects nothing, how to clear what it keeps, the credits, the contact.
- The manifest has every field a store or an install needs, 4 screenshots from the real app
  (`tools/qr-icons/make-asma-screens.mjs` writes `app/img/screens/`), and 2 shortcuts.
- `tools/qr-verify/asma-store-browser.mjs` checks the manifest and its files, the maskable icon's safe zone on its
  pixels, Chromium's own installability verdict, and the About page (also offline). The verdict needs the FULL
  Chromium (`channel: "chromium"`, a real profile): Playwright's default headless shell says "no errors" for any page.
- The owner's tick list for a store: `docs/ASMA-STORE-READY.md`.
- The way back from another page (About, the Hadith library) now returns to the same place even while a Name's āyāt
  are still loading (the place is kept in sessionStorage and set again as each part arrives).

## Versions

Every change to a file the worker saves bumps `APP_VERSION` in `app/js/qr-version.js` (standing rule, QR Architect).
00.01 = R2 (offline); 00.02 = R3 (screensaver); 00.03 = R4 (About and privacy page, manifest screenshots).
00.04 = R5b (Asma-only follow-up from 76d3736): the poster data's fixes from QR J01 R5 (MMSA 7861b96's 112 guard,
the 13 spelling and grammar fixes, Al-Malik's photo caption) and 132's meaning line "The Grand Name" (the owner's Q8,
default A; `MEANING_132` in `tools/asma-poster/build-poster-data.mjs`, one line for B "{The Grand Name}" or C "The
Proper Name"). The R2 classic worker and its `?v=` scheme are unchanged, so a phone on 00.03 updates the usual way.
Checks: `tools/qr-verify/asma-poster-data-check.mjs` (generated; no shared description; 112 its own word; 132's
line; no two Names share a poster Arabic unless the Name list does; `--mutate=dup112` must fail).

## Never changes (shared with MMSA)

Firebase project `study-monitoring`, the Firestore Rules, the records/activity paths, unit keys and the four
person-id shapes (handover pack section 1). QR never edits or deploys the Rules and never makes a second database.

## R1 design note (measured on MMSA 077b4db, 16 Oct 8:17 am; re-measure on the commit the PCA gives)

Asma without sign-in (QR J01, owner's J61 Q5 = A) gets its OWN page, `app/asma.html`, rather than a switched-off
`asma-study.html`. The reading core needs no Firebase at all:

| Module | Scripts it reaches | Firebase? |
|---|---|---|
| `asma-renderer.js` | 12 | no |
| `asma-descriptions.js`, `asma-cited-ayat.js`, `asma-cited-hadith.js`, `asma-wheel-text.js` | 8, 1, 5, 5 | no |
| `asma-data.js`, `asma-poster.js`, `asma-posters.js`, `i18n.js`, `prefs.js`, `lang.js` | 0 to 5 | no |
| `asma-study.js` (the signed-in page) | 44 | YES (records, activity, bookmarks, collections) |
| `asma-screensaver.js` | 24 | YES (through `asma-collections.js`, `session-context.js`) |

So `app/asma.html` imports only the first three rows, makes no network call to Firebase, and keeps "Studied" on
the phone. The screensaver (R3) needs a phone-only path for its collections. `asma-study.html` stays as it is for
the signed-in QR (QR J02).

## Checks (from the repository root)

- `npm test`: the naming check, then every page at 390 and 1400 wide, Light and Night (loads, title, no page errors,
  no sideways scroll, own background). Link Playwright once: `ln -s /opt/node22/lib/node_modules node_modules`.
- `node tools/qr-verify/import-walk.mjs asma-study.html`: the scripts a page needs (run inside an MMSA checkout; in QR, `asma.html`).
- `node tools/qr-verify/asma-browser.mjs`: the Asma app at 390 and 1400, English and Bangla, and ZERO requests to any
  Firebase or Google host. `--mutate=nav|firebase|studied|back` breaks one thing as served; the suite must fail.
- `node tools/qr-verify/asma-offline-browser.mjs`: at 390 and 1400, online visit, worker active, "Save for offline",
  then the browser offline AND the server stopped: 99 Names, groups wheel, Name 1 with poster and āyāt, Name 20's
  hadith, ‹ ›, Bangla; then a version bump (note, Reload, new cache, old qr-app- cache deleted only) and both kill
  switches. `--mutate=precache|cleanup|skipwaiting` must fail.
- `node tools/qr-verify/asma-screensaver-browser.mjs`: the screensaver at 390/1400, EN/BN, Night/Light (settings kept,
  speed, group order, tap/key closes to the same place). `--mutate=tapclose|persist|speed` must fail.
- `node tools/qr-verify/asma-store-browser.mjs`: manifest, icons, screenshots, installability (full Chromium), the About
  page at 390/1400, EN/BN, and offline. `--mutate=maskable|noicon|browser|aboutoffline` must fail.
- `node tools/qr-asma/make-screensaver.mjs <MMSA checkout> --check`: the QR screensaver is MMSA's plus the 8 edits.
- `node tools/qr-verify/asma-local-sync.mjs <MMSA checkout>`: `app/js/asma-local.js` still matches MMSA, function by function.

## Copy log (every copy from MMSA, newest first)

| When (Sydney) | MMSA commit | What was copied | QR job |
|---|---|---|---|
| 16 Oct 2026, 8:37 am | `077b4db` | **74 files, 20.3 MB, all byte-identical:** 22 scripts in `app/js/` (0.74 MB: `asma-renderer`, `asma-poster`, `asma-poster-data`, `asma-ref-parser`, `asma-descriptions`, `asma-cited-ayat`, `asma-cited-hadith`, `asma-collections-data`, `asma-data`, `mastery-wheel`, `unit-keys`, `labels`, `lang`, `prefs`, `i18n`, `i18n/bn`, `i18n/surah-names-bn`, `i18n/asma-names-bn`, `quran-data`, `quran-word-identity`, `openiti-corpus`, `hadith-translations`); `app/img/asma-poster-frame.webp` (0.2 MB); the 51 surah files the Names cite, `tools/quran-data-pull/output/surahs/` (19.4 MB). **Derived, not copied as files:** `app/js/asma-local.js` (12 pure functions of `asma-collections.js`, byte-identical, checked by `tools/qr-verify/asma-local-sync.mjs`); `tools/hadith-data-pull/output/asma-cited-hadith.json` (the 14 cited passages and their translations, 66 KB, written by `tools/qr-asma/extract-cited-hadith.mjs` from MMSA's 114 MB library). No copied file was changed. | QR J01 R1 |
