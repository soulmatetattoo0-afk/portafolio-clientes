/**
 * The v2 app, screen by screen, on a phone-sized browser: the client's side
 * (the artist's page, Obras, Revista, Fechas, Mensajes, Perfil) and the
 * artist's (Mi página and its doors with the edit buttons, the editors,
 * Chats with a quote confirmed, Ajustes).
 *
 *   CHROME=<chromium> node tools/shots/v2.mjs <out-dir> [base-url]
 */
import { chromium } from "playwright";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const only = process.env.ONLY?.split(",");

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
let n = 0;
const shot = async (name, full = false) => {
  n++;
  const file = `${out}/${String(n).padStart(2, "0")}-${name}.jpg`;
  await p.screenshot({ path: file, type: "jpeg", quality: 74, fullPage: full });
  console.log("shot", file);
};
const wait = (ms) => p.waitForTimeout(ms);
const tap = async (loc) => {
  await loc.first().scrollIntoViewIfNeeded();
  await loc.first().click();
};
const go = async (href, ms = 1500) => {
  await p.goto(`${base}${href}`, { waitUntil: "networkidle" });
  await wait(ms);
};
const step = async (name, fn) => {
  if (only && !only.includes(name)) return;
  try {
    await fn();
  } catch (e) {
    console.log("FAIL", name, String(e.message ?? e).split("\n")[0]);
    await shot(`${name}-FAIL`).catch(() => {});
  }
};

await step("cliente", async () => {
  await go("/camo", 2000);
  await shot("c-perfil-artista");
  await go("/camo/obras");
  await shot("c-obras");
  await tap(p.locator("ul button").first());
  await wait(800);
  await shot("c-obras-estilo");
  await tap(p.locator("ul button").first());
  await wait(800);
  await shot("c-obras-foto");
  await p.keyboard.press("Escape");
  await go("/camo/revista", 2500);
  await shot("c-revista");
  await go("/camo/fechas");
  await shot("c-fechas");
  await tap(p.locator("button.t-num").filter({ hasText: /^2[0-9]$/ }).nth(2));
  await wait(600);
  await shot("c-fechas-dia");
  await p.keyboard.press("Escape");
  await go("/me");
  await shot("c-mensajes");
  await go("/me/perfil");
  await shot("c-perfil");
});

await step("artista", async () => {
  await go("/studio", 2000);
  await shot("a-mi-pagina");
  await go("/studio/pagina/obras");
  await shot("a-obras-con-boton");
  await go("/studio/obras");
  await shot("a-editor-obras");
  await tap(p.locator("ul button").first());
  await wait(600);
  await shot("a-editor-obras-estilo");
  await tap(p.locator("ul button").first());
  await wait(600);
  await shot("a-editor-obras-foto");
  await tap(p.getByRole("button", { name: "Editar encuadre" }));
  await wait(400);
  await shot("a-editor-encuadre");
  await go("/studio/pagina/revista", 2500);
  await shot("a-revista-con-boton");
  await go("/studio/revista");
  await shot("a-editor-revista");
  await tap(p.locator("ul button").nth(1));
  await wait(600);
  await shot("a-editor-pagina");
  await tap(p.getByRole("button", { name: /Agregar texto/ }));
  await wait(500);
  await shot("a-editor-texto");
  await go("/studio/pagina/fechas?edit=1");
  await shot("a-fechas-edicion");
  await tap(p.locator("button.t-num").filter({ hasText: /^2[0-9]$/ }).nth(2));
  await wait(700);
  await shot("a-fechas-dia", true);
  await p.keyboard.press("Escape");
  await go("/studio/chats");
  await shot("a-chats");
  await tap(p.locator("ul a").first());
  await wait(2000);
  await shot("a-chat-carta");
  await shot("a-chat-carta-completo", true);
  await go("/studio/ajustes");
  await shot("a-ajustes");
  await shot("a-ajustes-completo", true);
});

await step("flujo", async () => {
  // The client sends a quote to Camo.
  await go("/camo/request?ref=screen", 2500);
  await tap(p.getByRole("radio", { name: /Realismo|Surrealismo/ }).first());
  await wait(500);
  await tap(p.getByRole("radio", { name: /Negro y gris|Black/ }));
  await wait(3500);
  await tap(p.locator("summary").filter({ hasText: "Brazos" }));
  await wait(400);
  await tap(p.getByRole("button", { name: /Antebrazo interno derecho/ }));
  await wait(3000);
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1200);
  await p.locator("textarea").first().fill("Una brújula antigua con una rosa, black and grey, línea fina.");
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1200);
  await tap(p.getByRole("radio", { name: /Aún no tengo fecha clara/ }));
  await tap(p.locator("[role=radiogroup] .t-num").nth(1));
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1500);
  await tap(p.locator("input[type=checkbox], [role=checkbox]"));
  await tap(p.getByRole("button", { name: /Enviar mi cotización/ }));
  await p.waitForURL(/\/c\//, { timeout: 30000 });
  await wait(2500);
  const chatUrl = p.url();
  await shot("f-cotizacion-enviada");

  // The artist accepts and confirms the quote: date, total, deposit.
  await go("/studio/chats?tab=pending");
  await shot("f-chats-pendientes");
  await tap(p.locator("ul a").filter({ hasText: "Daniel Reyes" }).first());
  await wait(2000);
  await tap(p.getByRole("button", { name: "Aceptar y abrir chat" }));
  await wait(600);
  await tap(p.getByRole("button", { name: "Enviar mensaje" }));
  await wait(3000);
  await shot("f-chat-aceptado");
  await tap(p.getByRole("button", { name: "Evaluar cotización" }));
  await wait(600);
  const d = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);
  await p.locator("input[type=date]").fill(d);
  const nums = p.locator("input[type=number]");
  await nums.nth(1).fill("1000");
  await nums.nth(2).fill("1");
  await nums.nth(3).fill("100");
  await wait(300);
  await shot("f-confirmar-cotizacion", true);
  await tap(p.getByRole("button", { name: "Enviar cotización al cliente" }));
  await wait(3000);
  await shot("f-link-enviado", true);

  // The client pays the deposit; the pre-care sheet lands in the chat.
  await p.goto(chatUrl, { waitUntil: "networkidle" });
  await wait(2500);
  await shot("f-cliente-confirmacion", true);
  await tap(p.getByRole("link", { name: /Reservar mi proyecto/ }));
  await wait(3000);
  await tap(p.getByRole("checkbox"));
  await tap(p.getByRole("button", { name: /Pagar (mi )?reservación/ }));
  await wait(5000);
  await p.goto(chatUrl, { waitUntil: "networkidle" });
  await wait(2500);
  await shot("f-cliente-reservado-precuidados", true);

  // The artist sees the booked day with the client's name, finishes the tattoo (cash), the after-care goes out.
  await go("/studio/pagina/fechas");
  await shot("f-fechas-reservado");
  await go("/studio/chats");
  await tap(p.locator("ul a").filter({ hasText: "Daniel Reyes" }).first());
  await wait(2000);
  await shot("f-chat-reservado", true);
  await tap(p.getByRole("button", { name: /Sesión terminada/ }));
  await wait(3000);
  await shot("f-chat-terminado", true);
  await p.goto(chatUrl, { waitUntil: "networkidle" });
  await wait(2500);
  await shot("f-cliente-postcuidados", true);
});

console.log("errors", errors.length, errors.slice(0, 8).join("\n"));
await browser.close();
