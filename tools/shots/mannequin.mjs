// Every placement on the mannequin bench (/lab/maniqui), one still each, laid out as contact sheets.
//   CHROME=<chromium> node tools/shots/mannequin.mjs <out> [body] [base-url] [slug,slug…]
import { chromium } from "playwright";
import fs from "node:fs";
const [out, body = "m", base = "http://localhost:3000", only = ""] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto(`${base}/lab/maniqui`, { waitUntil: "networkidle", timeout: 120000 });
await p.waitForFunction(() => Boolean(window.__mannequin?.body), null, { timeout: 60000 });
if (body === "f") { await p.getByRole("button", { name: /^body:/ }).click(); await p.waitForTimeout(2500); }
await p.waitForTimeout(2600);
const slugs = only ? only.split(",") : ["", ...(await p.locator("button[data-slug]").evaluateAll((els) => els.map((e) => e.dataset.slug)))];
const stage = p.locator("#stage");
const seen = [];
for (const slug of slugs) {
  if (slug) await p.locator(`button[data-slug="${slug}"]`).click();
  else await p.getByRole("button", { name: "rest" }).click();
  await p.waitForTimeout(2600);
  await stage.screenshot({ path: `${out}/${body}-${slug || "rest"}.jpg`, type: "jpeg", quality: 80 });
  // How much of the chosen area the camera really sees, for tuning the shots.
  if (slug) seen.push(`${slug} ${Math.round((await p.evaluate(() => window.__mannequin.visibleShare?.() ?? 0)) * 100)}%`);
}
console.log(seen.join("  "));
console.log(errors.length ? [...new Set(errors)].join("\n") : "no errors", slugs.length, "shots");
await browser.close();
