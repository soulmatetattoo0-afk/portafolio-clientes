// Every door of the front, opened with motion: what is on screen 1 s, 3 s and 8 s after the tap.
//   CHROME=<chromium> node tools/shots/doors.mjs <out> [base-url] [slug]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const slug = process.argv[4] ?? "soulmate-tattoo";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
for (const [name, sel] of [["obras", ".fr-d1"], ["revista", ".fr-d2"], ["fechas", ".fr-d3"], ["reservar", ".fr-key"]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`console ${m.text().slice(0, 300)}`); });
  p.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}/${slug}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.locator(sel).tap();
  for (const ms of [1000, 2000, 5000]) {
    await p.waitForTimeout(ms);
    const at = ms === 1000 ? 1 : ms === 2000 ? 3 : 8;
    await p.screenshot({ path: `${out}/${name}-${at}s.jpg`, type: "jpeg", quality: 70 });
    const s = await p.evaluate(() => ({ path: location.pathname + location.search, curtain: document.querySelectorAll(".fr-curtain").length, imgs: document.images.length, broken: [...document.images].filter((i) => i.complete && !i.naturalWidth).length, h: document.documentElement.scrollHeight, text: document.body.innerText.replace(/\s+/g, " ").slice(0, 160) }));
    console.log(name, `${at}s`, JSON.stringify(s));
  }
  console.log(name, errors.length ? `ERRORS ${[...new Set(errors)].join(" | ")}` : "no errors");
  await ctx.close();
}
await browser.close();
