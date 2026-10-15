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

The old-cache clean-up in `app/sw.js` must only delete `qr-` caches. `tools/qr-verify/naming.mjs` checks this
(proved: MMSA's own `sw.js` fails it 0/6; the renamed one passes 6/6).
Storage keys such as `mm_disable_service_worker` stay as they are: storage belongs to one site address, so they
cannot clash, and keeping them keeps the shared scripts identical with MMSA.

## Never changes (shared with MMSA)

Firebase project `study-monitoring`, the Firestore Rules, the records/activity paths, unit keys and the four
person-id shapes (handover pack section 1). QR never edits or deploys the Rules and never makes a second database.

## Checks (from the repository root)

- `npm test`: the naming check, then every page at 390 and 1400 wide, Light and Night (loads, title, no page errors,
  no sideways scroll, own background). Link Playwright once: `ln -s /opt/node22/lib/node_modules node_modules`.
- `node tools/qr-verify/import-walk.mjs asma-study.html`: the scripts a page needs (run inside an MMSA checkout).

## Copy log (every copy from MMSA, newest first)

| When (Sydney) | MMSA commit | What was copied | QR job |
|---|---|---|---|
| (none yet: waiting for the PCA's commit after MMSA Builder round #878) | | | |
