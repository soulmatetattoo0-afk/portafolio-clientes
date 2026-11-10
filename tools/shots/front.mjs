// The artist's front, one phone screen: how it arrives, how its doors answer the thumb, and that it
// never scrolls. Anonymous visitor, guest with the bar, a short phone, and a phone that asks for stillness.
//   CHROME=<chromium> node tools/shots/front.mjs <out> [base-url] [slug]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const slug = process.argv[4] ?? "soulmate-tattoo";
const local = base.includes("localhost");
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
let n = 0;
const ok = (cond, label) => console.log(cond ? "OK  " : "FAIL", label);
const open = async (o = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true, ...o });
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`console ${m.text()}`); });
  p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  return { ctx, p };
};
const shot = async (p, name) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 78 }); };
const fits = (p) => p.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
const count = (p) => p.locator(".fr-count b").first().innerText().catch(() => null);

// 1. A stranger arrives: the entrance, then the front at rest, with no bar.
{
  const { ctx, p } = await open();
  await p.goto(`${base}/${slug}`, { waitUntil: "commit", timeout: 120000 });
  await p.locator(".fr-d1").waitFor();
  await p.waitForTimeout(260);
  await shot(p, "entrada");
  await p.waitForTimeout(2800);
  await shot(p, "portada");
  ok(await fits(p), "anonymous: one screen, no scroll");
  // Local mode signs every visitor in as the seeded client, so the bar is only absent against a real deploy.
  if (!local) ok((await p.locator("nav").count()) === 0, "anonymous: no tab bar");

  // The reel moves on by itself, and under the thumb.
  const a = await count(p);
  if (a) {
    await p.waitForTimeout(5200);
    const b = await count(p);
    ok(a !== b, `reel advances alone (${a} → ${b})`);
    const box = await p.locator(".fr-reel").boundingBox();
    const y = box.y + box.height * 0.5;
    await p.mouse.move(box.x + box.width * 0.75, y);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.3, y, { steps: 6 });
    await p.mouse.up();
    await p.waitForTimeout(500);
    const c = await count(p);
    ok(b !== c, `reel follows a swipe (${b} → ${c})`);
    ok(new URL(p.url()).pathname === `/${slug}`, "a swipe does not open the door");
    await shot(p, "reel");
  }

  // A door, pressed: it leans; let go, the curtain grows from it and the next screen is there.
  const door = p.locator(".fr-d2");
  const d = await door.boundingBox();
  await p.mouse.move(d.x + d.width * 0.7, d.y + d.height * 0.6);
  await p.mouse.down();
  await p.waitForTimeout(260);
  await shot(p, "revista-presionada");
  await p.mouse.up();
  await p.waitForTimeout(200);
  await shot(p, "telon");
  await p.waitForURL(`**/${slug}/revista**`, { timeout: 30000 });
  await p.waitForTimeout(1400);
  ok((await p.locator(".fr-curtain").count()) === 0, "curtain is gone once the magazine is there");
  await shot(p, "revista");

  // Back: the front is simply there, no second entrance.
  await p.goBack();
  await p.waitForTimeout(350);
  ok(await p.evaluate(() => document.querySelector("[data-seen]")?.getAttribute("data-seen") === "true"), "back: no second entrance");

  // The key: it sinks, then opens the request.
  const key = p.locator(".fr-key");
  const k = await key.boundingBox();
  await p.mouse.move(k.x + k.width * 0.5, k.y + k.height * 0.5);
  await p.mouse.down();
  await p.waitForTimeout(160);
  await shot(p, "tecla-hundida");
  await p.mouse.up();
  await p.waitForTimeout(420);
  await shot(p, "telon-reserva");
  await p.waitForURL(`**/${slug}/request**`, { timeout: 30000 });
  ok(true, "key opens the request");
  await ctx.close();
}

// 2. A guest, with the bar at the thumb.
{
  const { ctx, p } = await open();
  await p.goto(`${base}/api/guest?${local ? "local=1&" : ""}next=${encodeURIComponent(`/${slug}`)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(3200);
  await shot(p, "portada-con-barra");
  ok(await fits(p), "guest: one screen, no scroll");
  await ctx.close();
}

// 3. A short phone.
{
  const { ctx, p } = await open({ viewport: { width: 375, height: 667 } });
  await p.goto(`${base}/${slug}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(3200);
  await shot(p, "telefono-corto");
  ok(await fits(p), "short phone: one screen, no scroll");
  await ctx.close();
}

// 4. A phone that asks for stillness: nothing plays, every door is a plain link.
{
  const { ctx, p } = await open({ reducedMotion: "reduce" });
  await p.goto(`${base}/${slug}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(900);
  await shot(p, "sin-movimiento");
  await p.locator(".fr-d3").click();
  await p.waitForURL(`**/${slug}/fechas**`, { timeout: 30000 });
  ok((await p.locator(".fr-curtain").count()) === 0, "reduced motion: no curtain, the link just opens");
  await ctx.close();
}

console.log(errors.length ? `ERRORS\n${errors.join("\n")}` : "no errors");
await browser.close();
