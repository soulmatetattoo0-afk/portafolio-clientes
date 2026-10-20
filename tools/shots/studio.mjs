/**
 * The artist's walk through their studio, shot on a phone-sized browser:
 * requests, the agenda (a session, a closed day, days off), cities (a guest
 * spot), the magazine (a text, a picture), the portfolio (add and remove a
 * piece), the profile, the settings, the screen and the launch page.
 *
 *   CHROME=<chromium> node tools/shots/studio.mjs <out-dir> [base-url]
 *
 * Local mode only: it signs in through the demo studio button on /login.
 */
import path from "node:path";

import { chromium } from "playwright";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const login = process.env.STUDIO_LOGIN ?? "Entrar al estudio de demostración";
const slug = process.env.SLUG ?? "camo";
const photo = path.resolve("public/demo/tattoo-03.webp");

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
let n = 0;
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
const go = async (href) => {
  await p.goto(`${base}${href}`, { waitUntil: "networkidle" });
  await wait(1200);
};
/** One step at a time: a failure is logged and the walk goes on. */
const only = process.env.ONLY?.split(",");
const step = async (name, fn) => {
  if (only && !only.includes(name)) return;
  try {
    await fn();
  } catch (e) {
    console.log("FAIL", name, String(e.message ?? e).split("\n")[0]);
    await shot(`${name}-FAIL`).catch(() => {});
  }
};
const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);

await go("/login");
await tap(p.getByRole("button", { name: login }));
await wait(2500);

await step("solicitudes", async () => {
  await go("/studio");
  await shot("solicitudes");
});

await step("agenda", async () => {
  const day = iso(12);
  await go(`/studio/agenda`);
  await shot("agenda-papel");
  // The paper sheet: tap the day by its number (next month if the day falls there).
  const next = day.slice(0, 7) !== iso(0).slice(0, 7);
  if (next) await tap(p.locator("[data-next]"));
  await wait(400);
  await tap(p.locator("button.t-num").filter({ hasText: new RegExp(`^${Number(day.slice(8))}$`) }));
  await wait(800);
  await shot("agenda-dia");
  await tap(p.getByRole("button", { name: "Agregar sesión" }));
  await wait(500);
  await p.locator("input[name=client]").fill("Valentina Soto");
  await tap(p.getByRole("button", { name: "Guardar" }));
  await wait(2000);
  await shot("agenda-sesion-agregada");
  await p.keyboard.press("Escape");
  await wait(600);
  if (next) await tap(p.locator("[data-next]"));
  await wait(400);
  await tap(p.locator("button.t-num").filter({ hasText: new RegExp(`^${Number(iso(13).slice(8))}$`) }));
  await wait(800);
  await tap(p.getByRole("button", { name: "Cerrar este día" }));
  await wait(2000);
  await p.keyboard.press("Escape");
  await wait(600);
  if (next) await tap(p.locator("[data-next]"));
  await wait(400);
  await shot("agenda-con-sesion-y-cerrado");
  await shot("agenda-completa", true);
});

await step("ciudades", async () => {
  await go("/studio/cities");
  await shot("ciudades");
  await tap(p.getByRole("button", { name: "Agregar ciudad" }));
  await wait(500);
  await p.locator("input[name=city]").fill("Miami");
  await p.locator("input[name=country]").fill("Estados Unidos");
  await p.locator("input[name=studio_name]").fill("Ocean Drive Ink");
  await p.locator("select[name=status]").selectOption("booking");
  await p.locator("input[name=starts_on]").fill(iso(40));
  await p.locator("input[name=ends_on]").fill(iso(46));
  await shot("ciudades-formulario", true);
  await tap(p.getByRole("button", { name: "Guardar ciudad" }));
  await wait(2500);
  await shot("ciudades-agregada", true);
  await go(`/${slug}`);
  await wait(1500);
  await tap(p.locator(".ed-tile").filter({ hasText: "Fechas" }));
  await wait(1500);
  await tap(p.getByRole("tab", { name: /Miami/ }));
  await wait(800);
  await shot("ciudades-publico-miami");
});

await step("revista", async () => {
  await go("/studio/magazine");
  await shot("revista-editor");
  // The second thumbnail is page 1; the cover is the first.
  await tap(p.locator("button.group.grid.w-\\[64px\\]").nth(1));
  await wait(600);
  await tap(p.getByRole("button", { name: "Agregar texto" }));
  await wait(600);
  await p.locator("textarea").last().fill("Tatuar es escuchar antes de dibujar.");
  await wait(400);
  await shot("revista-texto");
  await tap(p.getByRole("button", { name: "Agregar viñeta" }));
  await wait(600);
  await p.locator("input[type=file]").last().setInputFiles(photo);
  await wait(3500);
  await shot("revista-foto");
  await tap(p.getByRole("button", { name: "Guardar revista" }));
  await wait(2500);
  await shot("revista-guardada");
  await go(`/${slug}`);
  await tap(p.locator(".ed-tile").filter({ hasText: "Revista" }));
  await wait(2500);
  await p.keyboard.press("ArrowRight");
  await wait(1200);
  await shot("revista-publicada-pagina-1");
});

await step("portafolio", async () => {
  await go("/studio/portfolio");
  await shot("portafolio");
  const before = await p.locator("input.input[maxlength='120']").count();
  await p.locator("input[type=file]").first().setInputFiles(photo);
  await wait(4000);
  await shot("portafolio-foto-agregada");
  const after = await p.locator("input.input[maxlength='120']").count();
  console.log("portfolio pieces", before, "->", after);
  // Remove the piece just added: the last "Eliminar" in the list, then confirm.
  await tap(p.getByRole("button", { name: "Eliminar foto" }).last());
  await wait(400);
  await shot("portafolio-confirmar-borrar");
  await tap(p.getByRole("button", { name: "Eliminar foto" }).last());
  await wait(2500);
  console.log("portfolio pieces after delete", await p.locator("input.input[maxlength='120']").count());
});

if (!only || only.includes("paginas")) for (const [name, href] of [
  ["perfil", "/studio/profile"],
  ["ajustes", "/studio/settings"],
  ["flash", "/studio/flash"],
  ["pantalla", "/studio/screen"],
  ["lanzar", "/studio/launch"],
  ["mas", "/studio/more"],
]) {
  await step("paginas", async () => {
    await go(href);
    await shot(name, true);
  });
}

await browser.close();
