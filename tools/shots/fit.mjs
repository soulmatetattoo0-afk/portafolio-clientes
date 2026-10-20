/**
 * Does the artist's page fit the phone? For each phone size (SE, 13, 15 Pro, Pro Max), with the home
 * indicator simulated: the Reservar band must sit fully above the bar and the magazine too, with no scroll.
 *
 *   CHROME=<chromium> node tools/shots/fit.mjs [base-url] [out-dir]
 */
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3];
const sizes = [
  ["se", 375, 667],
  ["13", 390, 844],
  ["15pro", 393, 852],
  ["promax", 430, 932],
];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [name, width, height] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  for (const path of ["/studio/pagina", "/camo"]) {
    await p.goto(`${base}${path}`, { waitUntil: "load" });
    // A fake home indicator: iPhones report 34px; headless Chromium reports 0.
    await p.addStyleTag({ content: ":root{--v2-bar:calc(3.9rem + 34px)}" });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const book = document.querySelector(".ed-book").getBoundingClientRect();
      const bar = document.querySelector(".v2-tabs").getBoundingClientRect();
      const doors = [...document.querySelectorAll(".ed-tile")].map((e) => Math.round(e.getBoundingClientRect().height));
      return { bookBottom: Math.round(book.bottom), bookH: Math.round(book.height), barTop: Math.round(bar.top), barH: Math.round(bar.height), scrollH: document.documentElement.scrollHeight, vh: innerHeight, doors };
    });
    const ok = r.bookBottom <= r.barTop + 1;
    console.log(name, `${width}x${height}`, path, ok ? "OK" : "CUT", JSON.stringify(r));
    if (out) await p.screenshot({ path: `${out}/${name}-${path.replace(/\//g, "_")}.jpg`, type: "jpeg", quality: 70 });
  }
  await p.goto(`${base}/camo/revista`, { waitUntil: "load" });
  await p.addStyleTag({ content: ":root{--v2-bar:calc(3.9rem + 34px)}" });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const root = document.querySelector(".mag-root").getBoundingClientRect();
    const wrap = document.querySelector(".v2-page").getBoundingClientRect();
    const bar = document.querySelector(".v2-tabs").getBoundingClientRect();
    return { pad: getComputedStyle(document.querySelector(".v2-page")).paddingBottom, magTop: Math.round(root.top), magBottom: Math.round(root.bottom), wrapBottom: Math.round(wrap.bottom), barTop: Math.round(bar.top), scrollH: document.documentElement.scrollHeight, vh: innerHeight };
  });
  console.log(name, "revista", m.magBottom <= m.barTop + 1 ? "OK" : "CUT", JSON.stringify(m));
  if (out) await p.screenshot({ path: `${out}/${name}-revista.jpg`, type: "jpeg", quality: 70 });
  await ctx.close();
}
await browser.close();
