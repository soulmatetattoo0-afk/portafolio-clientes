// The Sala creativa and its Caja on a phone, screen by screen; adds an expense. CHROME=<chromium> node tools/shots/sala.mjs <out> [base-url]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
const screens = async (name) => {
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0, i = 1; y < h; y += 700, i++) {
    await p.evaluate((top) => window.scrollTo(0, top), y);
    await p.waitForTimeout(350);
    await p.screenshot({ path: `${out}/${name}-${i}.jpg`, type: "jpeg", quality: 72 });
  }
};
await p.goto(`${base}/studio/sala`, { waitUntil: "load", timeout: 90000 });
await p.waitForTimeout(2000);
await screens("sala");
await p.goto(`${base}/studio/sala/caja`, { waitUntil: "load", timeout: 90000 });
await p.waitForTimeout(1500);
await p.getByRole("button", { name: /\+ Gasto/ }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Insumos" }).click();
await p.getByPlaceholder(/cartuchos/).fill("Cartuchos 0.30 RL");
await p.locator("input[type=number]").fill("85");
await p.screenshot({ path: `${out}/caja-gasto.jpg`, type: "jpeg", quality: 72 });
await p.getByRole("button", { name: "Guardar gasto" }).click();
await p.waitForTimeout(2000);
console.log((await p.locator("body").innerText()).includes("Cartuchos 0.30 RL") ? "OK   expense saved" : "MISS expense");
await screens("caja");
// Leave the demo as it was.
const del = p.getByRole("button", { name: "Quitar gasto" });
while (await del.count()) { await del.first().click(); await p.waitForTimeout(1200); }
console.log("errors", errors.length, errors.slice(0, 5).join("\n"));
await browser.close();
