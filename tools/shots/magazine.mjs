// Leaf through an artist's magazine as a reader, one shot per camera stop.
//   node tools/shots/magazine.mjs <out> <slug> [base-url]
import { chromium } from "playwright";
const [out, slug, base = "http://localhost:3000"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await p.goto(`${base}/${slug}/revista`, { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(2000);
const next = p.locator("button", { hasText: "›" });
for (let i = 0; i < 40; i++) {
  await p.screenshot({ path: `${out}/${String(i).padStart(2, "0")}.jpg`, type: "jpeg", quality: 72 });
  if (await next.isDisabled()) break;
  await next.click();
  await p.waitForTimeout(3400);
}
console.log(errors.length ? errors.join("\n") : "no errors");
await browser.close();
