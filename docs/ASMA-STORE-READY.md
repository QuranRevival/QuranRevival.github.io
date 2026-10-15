# Asma ul Husna: ready for a store? (QR J01 R4)

A short tick list for the owner. Nothing here was created outside this repository: no store, no account, no money.

## Ready now

- [x] **App name:** Asma ul Husna (short name on a phone's home screen: Asma).
- [x] **Icon:** a gold eight-point star on deep teal, 192 and 512 px, plus a "maskable" one whose star stays inside the
      safe middle circle (checked on its pixels: the furthest gold is 30% from the centre; the limit is 40%).
- [x] **Installable:** Chromium's own check finds no problem with the app (`asma-store-browser.mjs`).
- [x] **Works offline** after the first visit; the āyāt can all be saved with one tap (19 MB).
- [x] **Screenshots from the real app:** 2 phone (390 × 844) and 2 computer (1400 × 900), in `app/img/screens/`.
- [x] **Privacy page:** https://quranrevival.github.io/app/asma-about.html (English and Bangla). It says the app
      collects nothing, has no sign-in, no ads and no tracking, and that ticks and settings stay on the device.
- [x] **Credits** for the posters, the Qur'an text and translations, the hadith (OpenITI, CC BY-NC-SA 4.0) and the fonts,
      on the same page.
- [x] **Short description (80 characters at most), draft:**
      The 99 Names of Allah: meanings, posters, ayat and hadith. Offline. No ads.
- [x] **Long description (4000 characters at most), draft:**

      Asma ul Husna shows the 99 Names of Allah, one by one, with care.

      For each Name you see its Arabic, its meaning in English or Bangla, and its poster. Below it, the āyāt of the
      Qur'an the Name is mentioned in are written out, word by word: tap a word to see its meaning. The hadith that
      name it are written out too, in Arabic with a translation.

      The Names are also gathered into groups by theme, shown on a wheel, so you can study them together.

      Mark a Name as studied when you have learned it. Your ticks stay on your own phone.

      A calm screensaver can show the posters one after another, at the speed and in the order you choose.

      Read in English or Bangla, in a Night or Light look. Once opened, the app works without the internet, and one
      tap saves every āyah for offline reading.

      No sign-in. No ads. No tracking. Nothing you do leaves your device.

      Part of QuranRevival: Quran Study, Asma ul Husna and Learn Deen On-the-Go.

- [x] **Content rating notes:** religious and educational reference. No violence, no adult content, no gambling, no
      user-made content, no chat, no sharing between users, no purchases, no ads, no data collected. Suitable for all
      ages.
- [x] **Category:** Education (also Books / Reference).

## Left for later, only with the owner's yes

- [ ] **A store account and its fee.** Google Play asks a one-time registration fee; Apple's developer programme a
      yearly one (check the amounts on their sites before paying). Nothing is paid without the owner's yes.
- [ ] **Wrapping the web app for the Play Store** as a Trusted Web Activity, with Bubblewrap or PWABuilder (both free
      tools). This makes an Android package that opens this same site full screen.
- [ ] **Digital Asset Links:** a small file at `https://quranrevival.github.io/.well-known/assetlinks.json` that proves
      the Android package and this site belong together. It needs the package's signing key, so it comes after the
      store account.
- [ ] **Apple App Store:** needs its own wrapper (PWABuilder can make one) and an Apple account; decide later.
- [ ] **Which store first:** the owner chooses (PCA J61: build first, the store is chosen later).
- [ ] **Store listing text in Bangla:** the drafts above can be translated once the store is chosen.
