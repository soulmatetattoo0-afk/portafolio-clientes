// The demo road a visitor walks on an artist with the showcase on: become a guest, send a request,
// the artist's stand-in answers, sends and edits the proposal, the visitor opens it, books with the
// simulated deposit, skips to the tattoo day, pays the rest; the real artist's studio never sees it.
//   CHROME=<chromium> node tools/shots/showcase.mjs <out> [base-url] [slug]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const slug = process.argv[4] ?? "soulmate-tattoo";
const local = base.includes("localhost");
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.setDefaultTimeout(30000);
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
let n = 0;
const shot = async (name, full = false) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 72, fullPage: full }); };
const wait = (ms) => p.waitForTimeout(ms);
const ok = (cond, label) => console.log(cond ? "OK  " : "FAIL", label);
const bar = () => p.locator("header").first();
const status = async () => (await bar().innerText()).replace(/\s+/g, " ");
const tap = async (loc) => { await loc.first().scrollIntoViewIfNeeded(); await loc.first().click(); };

// 1. A visitor without an account: a guest on their device, straight into the request.
await p.goto(`${base}/api/guest?${local ? "local=1&" : ""}next=${encodeURIComponent(`/${slug}/request`)}`, { waitUntil: "networkidle", timeout: 120000 });
await wait(2500);
await shot("wizard");
// Style, then colour.
await tap(p.locator("[role=radiogroup] [role=radio], button[role=radio]").filter({ hasNotText: /Negro|Color|Aún/ }));
await wait(700);
await tap(p.getByRole("radio", { name: /Negro y gris|Black/ }));
await wait(3500);
await shot("maniqui");
await tap(p.locator("summary").filter({ hasText: "Brazos" }));
await wait(400);
await tap(p.getByRole("button", { name: /Antebrazo interno derecho/ }));
await wait(3000);
await tap(p.getByRole("button", { name: "Continuar" }));
await wait(1200);
await p.locator("textarea").first().fill("Un tigre entre flores de cerezo, realista, con sombras suaves y mucho contraste en los ojos.");
await tap(p.getByRole("button", { name: "Continuar" }));
await wait(1200);
await tap(p.getByRole("radio", { name: /Aún no tengo fecha clara/ }));
const budget = p.locator("[role=radiogroup] .t-num");
if (await budget.count()) await tap(budget.nth(1));
await wait(300);
await shot("cuando");
await tap(p.getByRole("button", { name: "Continuar" }));
await wait(1500);
const box = p.locator("input[type=checkbox], [role=checkbox]");
if (await box.count()) await tap(box);
await shot("revision", true);
await tap(p.getByRole("button", { name: /Enviar mi cotización/ }));
await wait(4000);
await shot("tras-enviar");
await p.waitForURL(/\/c\//, { timeout: 40000 });
const chat = p.url().replace(base, "").split("?")[0];
await wait(800);
ok(/Demo/.test(await status()), `demo badge: ${await status()}`);
await shot("chat-enviado");

// 2. The stand-in answers on its own: hello, then the visitor writes, a piece of work, the proposal, the edit.
await p.waitForFunction(() => document.body.innerText.includes("Gracias por escribirme"), null, { timeout: 30000 });
ok(true, "the artist said hello");
await shot("hola");
await p.locator("#chat-input").fill("Me gusta con más contraste y sombra, ¡gracias!");
await p.getByRole("button", { name: /Enviar/ }).last().click();
await p.waitForFunction(() => document.querySelector("figure img") !== null, null, { timeout: 30000 });
ok(true, "the artist sent a piece of their work");
await shot("pieza");
await p.waitForFunction(() => document.body.innerText.includes("quedó editada y guardada"), null, { timeout: 45000 });
await wait(1500);
const st = await status();
ok(/Propuesta guardada/.test(st) && /Editada/i.test(st), `pinned proposal: ${st}`);
ok((await p.getByText(/Reemplazada|reemplaz/i).count()) > 0, "the first proposal shows as replaced");
await shot("propuesta-editada");

// 3. The saved proposal opens on the whole project.
await tap(p.getByRole("button", { name: /Ver proyecto/ }));
await wait(1000);
const sheet = (await p.locator('[role=dialog][aria-modal="true"]').innerText()).toLowerCase();
for (const w of ["Lo acordado", "Precio total", "Abono para reservar", "Servicio VANTA", "Pagas hoy", "Restante", "Imágenes del proyecto", "Lo que hablamos", "Cancelación"]) ok(sheet.includes(w.toLowerCase()), `project sheet: ${w}`);
await shot("proyecto");
await shot("proyecto-completo", true);
await tap(p.locator('[role=dialog][aria-modal="true"]').getByRole("link", { name: /Reservar|Tomar/ }));
await p.waitForURL(/\/q\//);
await wait(1200);
const pay = await p.locator("body").innerText();
ok(/simulado/.test(pay), "the deposit page says it is simulated");
await shot("pagar", true);
const radio = p.locator('input[name="slot"]:not([disabled])').first();
if (await radio.count()) await radio.check();
await p.locator('input[name="agree"]').check();
await p.locator('form button[type="submit"]').click();
await p.waitForURL(/\/c\//, { timeout: 40000 });
await wait(1500);
ok(/Reserva confirmada/.test(await status()), `booked: ${await status()}`);
await p.waitForFunction(() => document.body.innerText.includes("Recibí tu reserva"), null, { timeout: 30000 });
await shot("reservado");

// 4. Skip to the tattoo day, pay the rest; the goodbye.
await tap(p.getByRole("button", { name: /Avanzar al día del tatuaje/ }));
await p.waitForFunction(() => document.body.innerText.includes("Terminamos"), null, { timeout: 20000 });
await wait(800);
await shot("sesion");
await tap(p.locator("button.p-key, header button.bg-accent").filter({ hasText: /restante|Pagar/i }));
await p.waitForFunction(() => document.body.innerText.includes("Gracias por confiar en mí"), null, { timeout: 40000 });
await wait(1000);
ok(/Pago de la sesión confirmado/.test(await status()), `paid in full: ${await status()}`);
await shot("final");

// 5. The real artist's studio has none of it (local only: the dev member is the artist).
if (local) {
  const body = await (await p.request.get(`${base}/api/chat/pulse?t=${chat.split("/").pop()}`)).json();
  console.log("     pulse", JSON.stringify(body));
}
console.log("chat", chat);
console.log(errors.length ? `errors:\n${errors.join("\n")}` : "no errors");
await browser.close();
