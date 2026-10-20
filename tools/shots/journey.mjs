/**
 * The client's walk through an artist's app, shot on a phone-sized browser:
 * the front, the chat button, the work, the magazine, the dates, a quote
 * request on the mannequin and the chat it opens.
 *
 *   node tools/shots/journey.mjs <out-dir> [base-url] [artist-slug]
 *
 * Local mode signs every visitor in as the demo client, so no account is needed.
 */
import { chromium } from "playwright";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const slug = process.argv[4] ?? "camo";
const only = process.env.PART ?? "all";

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
let n = Number(process.env.START ?? 0);
const shot = async (name, full = false) => {
  n++;
  const file = `${out}/${String(n).padStart(2, "0")}-${name}.jpg`;
  await p.screenshot({ path: file, type: "jpeg", quality: 74, fullPage: full });
  console.log("shot", file);
};
const wait = (ms) => p.waitForTimeout(ms);
const tap = async (locator) => {
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().click();
};
const front = async () => {
  await p.goto(`${base}/${slug}`, { waitUntil: "networkidle" });
  await wait(1800);
};

const part = (name) => only === "all" || only.split(",").includes(name);
const tile = (text) => p.locator(".ed-tile").filter({ hasText: text });

if (part("front")) {
  await front();
  await shot("perfil");
}

if (part("work")) {
  n = Number(process.env.WORK_START ?? n);
  // 01 Obras: the styles carousel, a style's gallery, a picture full screen, every style together.
  await front();
  await tap(tile(/Obras|Diseños/));
  await wait(1500);
  await shot("obras-estilos");
  await p.evaluate(() => {
    const sc = [...document.querySelectorAll("*")].find((e) => getComputedStyle(e).scrollSnapType.includes("x") && e.scrollWidth > e.clientWidth + 10);
    sc?.scrollBy({ left: sc.clientWidth * 0.8 });
  });
  await wait(900);
  await shot("obras-deslizar");
  await tap(p.getByRole("button", { name: /Ver galería/ }));
  await wait(900);
  await shot("obras-galeria-estilo");
  await tap(p.locator("ul.grid-flow-row-dense button"));
  await wait(900);
  await shot("obras-foto-completa");
  await p.keyboard.press("Escape");
  await wait(400);
  await tap(p.getByText(/Estilos$/));
  await wait(500);
  await tap(p.getByText("Todos los estilos"));
  await wait(900);
  await shot("obras-todos-los-estilos");
}

if (part("mag")) {
  await front();
  await tap(tile("Revista"));
  await wait(2400);
  await shot("revista-portada");
  await p.keyboard.press("ArrowRight");
  await wait(1200);
  await shot("revista-pagina");
}

if (part("dates")) {
  await front();
  await tap(tile("Fechas"));
  await wait(1500);
  await shot("fechas-calendario");
  await shot("fechas-completo", true);
}

if (part("chat")) {
  await front();
  await tap(p.getByRole("button", { name: /Tus chats/ }));
  await wait(2500);
  await shot("chat-con-el-artista");
  await tap(p.getByRole("button", { name: /Toca para ver todo/ }));
  await wait(900);
  await shot("chat-carta-cotizacion");
}

if (part("quote")) {
  // A request from an artist the client has not written to yet: the locked chat, then the mannequin.
  const other = process.env.OTHER ?? "kenji-okada";
  await p.goto(`${base}/${other}`, { waitUntil: "networkidle" });
  await wait(1800);
  await shot("otro-artista");
  await tap(p.getByRole("button", { name: /Tus chats/ }));
  await wait(700);
  await shot("chat-bloqueado");
  await tap(p.getByRole("dialog").getByRole("link", { name: /Pedir cotización/ }));
  await p.waitForURL(/request/);
  await wait(2500);
  await shot("cotizar-estilo");
  await tap(p.locator("[role=radiogroup] [role=radio], button[role=radio]").filter({ hasNotText: /Negro|Color|Aún/ }));
  await wait(700);
  await shot("cotizar-estilo-elegido");
  await tap(p.getByRole("radio", { name: /Negro y gris|Black/ }));
  await wait(3500);
  await shot("cotizar-maniqui");
  await tap(p.locator("summary").filter({ hasText: "Brazos" }));
  await wait(400);
  await tap(p.getByRole("button", { name: /Antebrazo interno derecho/ }));
  await wait(3500);
  await shot("cotizar-maniqui-zona");
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1200);
  await p.locator("textarea").first().fill("Una rosa en black and grey con una frase pequeña debajo, línea fina y sombras suaves.");
  await shot("cotizar-idea");
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1200);
  await tap(p.getByRole("radio", { name: /Aún no tengo fecha clara/ }));
  await tap(p.locator("[role=radiogroup] .t-num").nth(1));
  await wait(300);
  await shot("cotizar-cuando");
  await shot("cotizar-cuando-completo", true);
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1500);
  await shot("cotizar-revision");
  await shot("cotizar-revision-pagina", true);
  await tap(p.locator("input[type=checkbox], [role=checkbox]"));
  await shot("cotizar-revision-final", true);
  await tap(p.getByRole("button", { name: /Enviar/ }));
  await p.waitForURL(/\/c\//, { timeout: 30000 });
  await wait(2500);
  await shot("cotizacion-enviada-chat");
  await tap(p.getByRole("link", { name: /Volver|perfil/i }));
  await wait(2500);
  await shot("perfil-con-chat");
}

if (part("deposit")) {
  // The artist offered a date: the client books it with the deposit (simulated in demo mode).
  await front();
  await tap(p.getByRole("button", { name: /Tus chats/ }));
  await wait(2500);
  await tap(p.getByRole("button", { name: /Reservar esta fecha/i }).or(p.getByRole("link", { name: /Reservar esta fecha/i })));
  await wait(3000);
  console.log("url", p.url());
  await shot("deposito-pago");
  await shot("deposito-pago-completo", true);
  await tap(p.getByRole("checkbox"));
  await tap(p.getByRole("button", { name: /Pagar depósito/ }));
  await wait(5000);
  console.log("url", p.url());
  await shot("deposito-reservado");
  await tap(p.getByRole("link", { name: "Volver al chat" }).first());
  await wait(3000);
  await shot("chat-despues-de-reservar", true);
}

if (part("fix")) {
  // After the corrections: the front, the magazine cover, the quote's calendar step and the inner forearm.
  await front();
  await shot("perfil");
  await tap(tile("Revista"));
  await wait(2600);
  await shot("portada");
  await p.goto(`${base}/${slug}/request?ref=screen`, { waitUntil: "networkidle" });
  await wait(2000);
  await shot("estilos-con-otro");
  await tap(p.getByRole("radio", { name: /Realismo|Blackwork|Japon/ }).first());
  await wait(500);
  await tap(p.getByRole("radio", { name: /Negro y gris|Black/ }));
  await wait(3500);
  await tap(p.locator("summary").filter({ hasText: "Brazos" }));
  await wait(400);
  await tap(p.getByRole("button", { name: /Antebrazo interno izquierdo/ }));
  await wait(3500);
  await shot("antebrazo-interno-izq");
  await tap(p.getByRole("button", { name: /Bícep derecho/ }));
  await wait(3500);
  await shot("bicep-derecho");
  await tap(p.getByRole("button", { name: /Media manga superior.*izquierda/ }));
  await wait(3500);
  await shot("media-manga-superior");
  await tap(p.getByRole("button", { name: /Media manga inferior.*derecha/ }));
  await wait(3500);
  await shot("media-manga-inferior");
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1200);
  await p.locator("textarea").first().fill("Una rosa en black and grey con una frase pequeña debajo.");
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1500);
  await shot("cuando-calendario");
  await shot("cuando-calendario-completo", true);
  const free = p.locator("button.t-num:not([disabled])").filter({ hasText: /^\d+$/ });
  await tap(free.nth(3));
  await wait(500);
  await tap(p.locator("[role=radiogroup] .t-num").nth(1));
  await shot("cuando-dia-elegido", true);
  await tap(p.getByRole("button", { name: "Continuar" }));
  await wait(1500);
  await shot("revision-enviar-cotizacion", true);
}

if (part("artist")) {
  // The artist's side: the letter with accept under it, the figure inside it, the booking confirmation, the agenda.
  const who = process.env.ARTIST_LOGIN ?? "Entrar como TATTOO BY SOVA";
  await p.goto(`${base}/login`, { waitUntil: "networkidle" });
  await tap(p.getByRole("button", { name: who }));
  await wait(2500);
  await p.goto(`${base}/studio`, { waitUntil: "networkidle" });
  await wait(1500);
  await shot("artista-solicitudes");
  await tap(p.getByText("Daniel Reyes").first());
  await wait(2500);
  await shot("artista-carta-y-botones");
  await shot("artista-carta-y-botones-completo", true);
  await tap(p.getByRole("button", { name: /Toca para ver todo/ }).first());
  await wait(3500);
  await shot("artista-carta-con-figura");
  await p.keyboard.press("Escape");
  await wait(500);
  await tap(p.getByRole("button", { name: "Aceptar solicitud" }));
  await wait(800);
  await shot("artista-aceptar");
  await tap(p.getByRole("button", { name: "Aceptar y enviar" }));
  await wait(3000);
  await shot("artista-chat-abierto", true);
  await tap(p.getByRole("button", { name: /Enviar confirmación de reserva/ }));
  await wait(800);
  const d = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  await p.locator("input[type=date]").fill(d);
  await p.locator("input[type=number].t-num").first().fill("800");
  await p.locator("textarea").last().fill("Daniel, me encanta la idea. Te confirmo el día y la hora que hablamos.");
  await shot("artista-confirmacion-form", true);
  await tap(p.getByRole("button", { name: "Enviar confirmación" }));
  await wait(3500);
  await shot("artista-confirmacion-enviada", true);

  // Back as the client: the confirmation letter in their chat, and the deposit.
  await ctx.clearCookies();
  await p.goto(`${base}/${process.env.OTHER ?? "sova"}`, { waitUntil: "networkidle" });
  await wait(1800);
  await tap(p.getByRole("button", { name: /Tus chats/ }));
  await wait(3000);
  await shot("cliente-confirmacion", true);
  await tap(p.getByRole("link", { name: /Reservar y pagar el abono/ }));
  await wait(3000);
  await shot("cliente-pago-abono", true);
  await tap(p.getByRole("checkbox"));
  await tap(p.getByRole("button", { name: /Pagar depósito/ }));
  await wait(5000);
  await shot("cliente-reservado");

  // The artist's agenda: the day is taken, and it opens the client's whole project.
  await p.goto(`${base}/login`, { waitUntil: "networkidle" });
  await tap(p.getByRole("button", { name: who }));
  await wait(2000);
  await p.goto(`${base}/studio/agenda?m=${d.slice(0, 7)}`, { waitUntil: "networkidle" });
  await wait(1500);
  await shot("artista-agenda");
  await tap(p.getByRole("button", { name: new RegExp(`^${d}:`) }));
  await wait(1200);
  await shot("artista-agenda-dia");
  await tap(p.getByRole("button", { name: /Toca para ver todo/ }).last());
  await wait(3500);
  await shot("artista-agenda-proyecto");
  await ctx.clearCookies();
}

await browser.close();
