// The Sala's engine-room pages and the framing editor, on a phone. CHROME=<chromium> node tools/shots/rooms.mjs <out> [base-url]
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
const go = async (href) => { await p.goto(`${base}${href}`, { waitUntil: "load", timeout: 90000 }); await p.waitForTimeout(1500); };
for (const room of ["precios", "estilos", "cuidados", "stripe", "avisos"]) {
  await go(`/studio/sala/${room}`);
  await p.screenshot({ path: `${out}/room-${room}.jpg`, type: "jpeg", quality: 72 });
}
// A new own style.
await go("/studio/sala/estilos");
await p.getByPlaceholder("Nombre de tu nuevo estilo").fill("Sombras de mármol");
await p.getByRole("button", { name: "+ Crear" }).click();
await p.waitForTimeout(2000);
console.log((await p.locator("body").innerText()).includes("SOMBRAS DE MÁRMOL") || (await p.locator("body").innerText()).includes("Sombras de mármol") ? "OK   own style created" : "MISS own style");
await p.screenshot({ path: `${out}/room-estilos-creado.jpg`, type: "jpeg", quality: 72 });
// The Sala itself, top to bottom.
await go("/studio/sala");
const h = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0, i = 1; y < h; y += 700, i++) {
  await p.evaluate((top) => window.scrollTo(0, top), y);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/sala-${i}.jpg`, type: "jpeg", quality: 70 });
}
// Framing: open the first piece, drag with one finger, pinch smaller with two.
await go("/studio/obras");
await p.locator("ul button").filter({ hasText: /Realismo|Realism/ }).first().click();
await p.waitForTimeout(700);
await p.locator("ul button").first().click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Editar encuadre" }).click();
await p.waitForTimeout(500);
const box = await p.locator(".ring-accent").first().boundingBox();
const cdp = await ctx.newCDPSession(p);
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
await touch("touchStart", [[cx, cy]]);
for (let k = 1; k <= 8; k++) { await touch("touchMove", [[cx + k * 6, cy + k * 4]]); await p.waitForTimeout(16); }
await touch("touchEnd", []);
await touch("touchStart", [[cx - 80, cy], [cx + 80, cy]]);
for (let k = 1; k <= 8; k++) { await touch("touchMove", [[cx - 80 + k * 6, cy], [cx + 80 - k * 6, cy]]); await p.waitForTimeout(16); }
await touch("touchEnd", []);
await p.waitForTimeout(400);
const label = await p.locator("label.v2-field span").first().innerText();
console.log("zoom after pinch:", label);
await p.screenshot({ path: `${out}/encuadre.jpg`, type: "jpeg", quality: 72 });
// Leave no test styles behind.
await go("/studio/sala/estilos");
for (let k = 0; k < 10 && (await p.getByRole("button", { name: "Quitar" }).count()); k++) {
  await p.getByRole("button", { name: "Quitar" }).first().click();
  await p.waitForTimeout(1500);
}
console.log("errors", errors.length, errors.slice(0, 5).join("\n"));
await browser.close();
