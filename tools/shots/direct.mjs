// A real deployment without Stripe: the client books, pays the artist directly, the artist confirms; then the rest.
//   CHROME=<chromium> node tools/shots/direct.mjs <out> [base-url]
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const uid = (n) => { const h = createHash("sha1").update(`vanta-demo:${n}`).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
let n = 0;
const shot = async (name, full = false) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 72, fullPage: full }); };
const go = async (href, ms = 1500) => { await p.goto(`${base}${href}`, { waitUntil: "load", timeout: 90000 }); await p.waitForTimeout(ms); };
const wait = (ms) => p.waitForTimeout(ms);
const tap = async (loc) => { await loc.first().scrollIntoViewIfNeeded(); await loc.first().click(); };
const expect = async (text, label) => { const body = await p.locator("body").innerText(); console.log(body.includes(text) ? "OK  " : "MISS", label); };

const chat = `/studio/chats/${uid("brief:sofia")}`;
// The artist accepts and evaluates.
await go(chat, 2000);
await tap(p.getByRole("button", { name: "Aceptar y abrir chat" }));
await wait(400);
await tap(p.getByRole("button", { name: "Enviar mensaje" }));
await wait(2500);
await expect("Estoy evaluando", "no canned reply outside the demo (should be MISS)");
await tap(p.getByRole("button", { name: "Evaluar cotización" }));
await wait(400);
await p.locator("input[type=date]").fill(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
const nums = p.locator("input[type=number]");
await nums.nth(1).fill("900");
await nums.nth(2).fill("1");
await nums.nth(3).fill("100");
await tap(p.getByRole("button", { name: "Enviar cotización al cliente" }));
await wait(2500);
await shot("artista-cotizacion-enviada", true);
// The client asks to book.
const token = await p.evaluate(async (url) => {
  const html = await (await fetch(url)).text();
  return html.match(/\/c\/([a-f0-9]{64})/)?.[1] ?? null;
}, `${base}/me`);
const clientChat = `/c/${createHash("sha256").update("vanta-chat:sofia").digest("hex")}`;
await go(clientChat, 2000);
await shot("cliente-cotizacion", true);
await tap(p.getByRole("link", { name: /Reservar mi proyecto/ }));
await wait(2000);
await shot("cliente-pagina-reserva", true);
await tap(p.getByRole("checkbox"));
await tap(p.getByRole("button", { name: /Pedir mi reserva/ }));
await p.waitForURL(/\/c\//, { timeout: 30000 });
await wait(2000);
await shot("cliente-pidio-reservar", true);
await expect("¿Cómo te pago la reservación", "client's booking request in the chat");
// The artist confirms the money arrived.
await go(chat, 2000);
await shot("artista-confirma-reserva", true);
await tap(p.getByRole("button", { name: /Recibí la reservación/ }));
await wait(3000);
await expect("Pago de reserva realizado", "booking confirmed");
await shot("artista-reserva-confirmada", true);
// Session finished, the rest paid directly.
await tap(p.getByRole("button", { name: /Sesión terminada/ }));
await wait(2500);
await go(clientChat, 2000);
await expect("Restante a pagar", "client sees what's left to pay the artist");
await shot("cliente-restante", true);
await go(chat, 2000);
await tap(p.getByRole("button", { name: /Recibí el restante/ }));
await wait(3000);
await expect("Tatuaje pagado", "tattoo paid");
await shot("artista-pagado", true);
await go("/studio/sala", 2500);
await expect("$900", "Caja shows $900 (100 + 800)");
await shot("sala-caja");
console.log("token", token ? "found" : "-", "errors", errors.length, errors.slice(0, 6).join("\n"));
await browser.close();
