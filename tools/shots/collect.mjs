// The demo the artist will run: three booked chats, each collected to the end, the sum landing in Caja.
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const uid = (n) => { const h = createHash("sha1").update(`vanta-demo:${n}`).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
let n = 0;
const shot = async (name, full = false) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 74, fullPage: full }); };
const go = async (href, ms = 1500) => { await p.goto(`${base}${href}`, { waitUntil: "load", timeout: 90000 }); await p.waitForTimeout(ms); };
const wait = (ms) => p.waitForTimeout(ms);
const tap = async (loc) => { await loc.first().scrollIntoViewIfNeeded(); await loc.first().click(); };

await go("/studio/sala", 2500);
await shot("sala-antes");
let first = true;
for (const key of ["chloe", "tomas", "valeria"]) {
  await go(`/studio/chats/${uid(`brief:${key}`)}`, 2000);
  if (first) await shot(`chat-${key}`, true);
  await tap(p.getByRole("button", { name: "Ver proyecto" }));
  await wait(800);
  if (first) await shot(`proyecto-${key}`, true);
  // Inside the project sheet (the chat behind it has its own "Trabajo finalizado" button).
  const sheet = p.getByRole("dialog", { name: "El proyecto" });
  await tap(sheet.getByRole("button", { name: /Sesión terminada/ }));
  await wait(2500);
  if (first) await shot(`proyecto-${key}-link-enviado`);
  await tap(sheet.getByRole("link", { name: /Abrir el chat como el cliente/ }));
  await p.waitForURL(/\/c\//, { timeout: 30000 });
  await wait(2500);
  if (first) await shot(`cliente-${key}-link`, true);
  await tap(p.getByRole("button", { name: /Pagar mi tatuaje/ }));
  await wait(4000);
  if (first) await shot(`cliente-${key}-pagado`, true);
  await go(`/studio/chats/${uid(`brief:${key}`)}`, 2000);
  if (first) await shot(`chat-${key}-cobrado`, true);
  first = false;
}
await go("/studio/sala", 2500);
await shot("sala-despues", true);
console.log("errors", errors.length, errors.slice(0, 8).join("\n"));
await browser.close();
