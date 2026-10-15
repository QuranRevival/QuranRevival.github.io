// QR J01 R4: the store / install screenshots in app/asma.webmanifest, taken from the real app (not mock-ups).
// Run from the repository root: node tools/qr-icons/make-asma-screens.mjs   (serves itself on PORT, default 8095)
// Writes app/img/screens/: two narrow (390x844, a phone) and two wide (1400x900, a computer), English, Night.
import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

export const SHOTS = [
  ["narrow-names.png", 390, 844, "#v=names", "The 99 Names of Allah"],
  ["narrow-name.png", 390, 844, "#v=name&n=1", "A Name with its poster"],
  ["wide-groups.png", 1400, 900, "#v=groups", "The owner's groups on a wheel"],
  ["wide-name.png", 1400, 900, "#v=name&n=20", "A Name with its ayat and hadith"],
];
const PORT = Number(process.env.PORT) || 8095;
const server = spawn(process.execPath, ["serve.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 400));
fs.mkdirSync("app/img/screens", { recursive: true });
const browser = await chromium.launch();
try {
  for (const [file, width, height, hash] of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      localStorage.setItem("mm_disable_service_worker", "1");
      localStorage.setItem("mm_disable_screensaver", "1");
      localStorage.setItem("mm_app_lang", "en");
      localStorage.setItem("mm_card_look", "night");
    });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/app/asma.html${hash}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `app/img/screens/${file}` });
    console.log(`app/img/screens/${file} ${width}x${height} ${fs.statSync(`app/img/screens/${file}`).size} bytes`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
