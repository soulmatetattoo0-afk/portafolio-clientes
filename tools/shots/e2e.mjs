// The whole circuit as production runs it (payments made straight to the artist, no demo):
// the artist accepts and evaluates a new request, the client asks to book, the artist confirms
// the deposit, finishes the session, collects the rest; the Caja and the calendar follow.
//   CHROME=<chromium> node tools/shots/e2e.mjs <out> [base-url]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.setDefaultTimeout(25000);
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
let n = 0;
const shot = async (name) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 70 }); };
const go = async (href) => { await p.goto(`${base}${href}`, { waitUntil: "networkidle", timeout: 120000 }); await p.waitForTimeout(1200); };
const bar = () => p.locator(".sticky").first();
const key = () => bar().locator("button.bg-accent, a.bg-accent").first();
const status = async () => (await bar().innerText()).replace(/\s+/g, " ");
const ok = (cond, label) => console.log(cond ? "OK  " : "FAIL", label);
const twice = async () => { await key().click(); await p.waitForTimeout(400); await key().click(); };

// 1. Artist: the new request, accept from the pinned bar.
await go("/studio/chats?tab=pending");
await p.locator('a[href^="/studio/chats/"]').first().click();
await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
const chatUrl = p.url().replace(base, "");
ok((await status()).includes("Cotización nueva"), `bar says new quote: ${await status()}`);
await shot("artist-new");
await key().click();
await p.getByRole("button", { name: "Enviar mensaje" }).click();
await p.waitForTimeout(2500);
ok((await status()).includes("Chat abierto"), "accepted: chat open");
// 2. Evaluate the quote from the bar.
await key().click();
await p.waitForTimeout(600);
const asked = await p.getByText(/Fecha que pidió/).count();
console.log("     asked date shown:", asked > 0);
if (!asked) await p.locator('form input[type="date"]').first().fill(new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10));
await p.locator("form label", { hasText: /PRECIO POR SESIÓN|Precio por sesión/i }).locator("input").fill("900");
await shot("evaluate");
await p.getByRole("button", { name: /Enviar cotización/ }).click();
await p.waitForTimeout(2500);
ok((await status()).includes("Cotización enviada"), `quote sent: ${await status()}`);
const html = await (await p.request.get(`${base}${chatUrl}`)).text();
const token = /chatToken\\?":\\?"([a-f0-9]{20,})/.exec(html)?.[1] ?? /\/c\/([a-f0-9]{20,})/.exec(html)?.[1];
ok(Boolean(token), "found the client's chat link");

// 3. Client: the quote in the chat, book from the bar.
await go(`/c/${token}`);
ok((await status()).includes("Cotización recibida"), `client bar: ${await status()}`);
await shot("client-offer");
await key().click();
await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200);
await shot("client-book-page");
const radio = p.locator('input[name="slot"]:not([disabled])').first();
if (await radio.count()) await radio.check();
await p.locator('input[name="agree"]').check();
await p.locator('form button[type="submit"]').click();
await p.waitForURL(/\/c\//, { timeout: 30000 }); await p.waitForTimeout(1500);
ok((await status()).includes("Reserva solicitada"), `client asked to book: ${await status()}`);
ok((await p.locator("body").innerText()).includes("RESERVA SOLICITADA") || (await p.locator("body").innerText()).includes("Reserva solicitada"), "request notice in the chat");
await shot("client-requested");

// 4. Artist confirms the deposit from the bar.
await go(chatUrl);
ok((await status()).includes("Reserva solicitada"), `artist sees the request: ${await status()}`);
await twice(); await p.waitForTimeout(3000);
ok((await status()).includes("Reserva confirmada"), `booked: ${await status()}`);
ok((await p.locator("body").innerText()).toUpperCase().includes("RESERVA CONFIRMADA"), "booking banner in the chat");
await shot("artist-booked");
// 5. The session is done: collect the rest, then mark it received.
await twice(); await p.waitForTimeout(3000);
ok((await status()).includes("Cobro de"), `charge sent: ${await status()}`);
await twice(); await p.waitForTimeout(3000);
ok((await status()).includes("Pago de la sesión confirmado"), `paid: ${await status()}`);
await shot("artist-paid");
// 6. The client sees it; the Caja has it; the date sits in the calendar.
await go(`/c/${token}`);
ok((await status()).includes("Pago de la sesión confirmado"), `client bar paid: ${await status()}`);
await shot("client-paid");
await go("/studio/sala/caja");
const caja = (await p.locator("main").innerText()).replace(/\s+/g, " ");
ok(/\$1[,.]?000|\$900/.test(caja) || caja.includes("Jordan"), `caja: ${caja.slice(0, 160)}`);
await shot("caja");
console.log("errors", errors.length, errors.slice(0, 8).join("\n"));
await browser.close();
