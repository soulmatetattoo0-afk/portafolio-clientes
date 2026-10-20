// The Sala creativa on a phone: full page. CHROME=<chromium> node tools/shots/sala.mjs <out> [base-url]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
await p.goto(`${base}/studio/sala`, { waitUntil: "load", timeout: 120000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/sala-arriba.jpg`, type: "jpeg", quality: 74 });
await p.getByPlaceholder("Anota una idea…").fill("Boceto: polilla con reloj para Sofía");
await p.getByRole("button", { name: "Anotar" }).click();
await p.waitForTimeout(2000);
// Screen by screen, the way a thumb reads it (full-page captures blank out the scroll-driven blocks).
const h = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0, i = 1; y < h; y += 700, i++) {
  await p.evaluate((top) => window.scrollTo(0, top), y);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/sala-${String(i).padStart(2, "0")}.jpg`, type: "jpeg", quality: 70 });
}
console.log("errors", errors.length, errors.slice(0, 5).join("\n"));
await browser.close();
