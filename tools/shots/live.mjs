/**
 * Editing the page in place, shot on a phone-sized browser: the artist's own
 * copy of their page with its pencils; a line changed and shown at once; the
 * work with its pencils and "add photos"; the dates with "add city".
 *
 *   CHROME=<chromium> node tools/shots/live.mjs <out-dir> [base-url]
 */
import path from "node:path";

import { chromium } from "playwright";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const login = process.env.STUDIO_LOGIN ?? "Entrar al estudio de demostración";
const photo = path.resolve("public/demo/tattoo-05.webp");

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
const pencils = () => p.getByRole("button", { name: "Editar" });
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

await p.goto(`${base}/login`, { waitUntil: "networkidle" });
await tap(p.getByRole("button", { name: login }));
await wait(2500);

await step("perfil", async () => {
  await p.goto(`${base}/studio/profile`, { waitUntil: "networkidle" });
  await wait(2200);
  await shot("mi-pagina-con-lapices");
  console.log("pencils on screen", await pencils().count());
  // The header pencil: the name, the city, the line.
  await tap(pencils().nth(0));
  await wait(700);
  await shot("editar-tu");
  await p.keyboard.press("Escape");
  await wait(400);
  // The Obras pencil: pick the cover piece, change the line, save, see it.
  await tap(pencils().nth(1));
  await wait(700);
  await shot("editar-obras");
  const dialog = p.getByRole("dialog");
  await dialog.locator("input[type=text]").last().fill("Realismo con alma, en color y black & grey");
  await tap(dialog.locator("button[aria-pressed]").nth(2));
  await tap(dialog.getByRole("button", { name: "Guardar" }));
  await wait(3000);
  await shot("obras-cambiada");
  // The Reservar pencil.
  await tap(pencils().last());
  await wait(700);
  await shot("editar-reservar");
  await p.keyboard.press("Escape");
  await wait(400);
});

await step("obras", async () => {
  await tap(p.locator(".ed-tile").filter({ hasText: "Obras" }));
  await wait(1500);
  await tap(p.getByText("Todos los estilos"));
  await wait(900);
  await shot("obras-panel-lapices");
  await tap(pencils().last());
  await wait(700);
  await shot("editar-foto");
  const dialog = p.getByRole("dialog");
  await dialog.locator("input[type=text]").first().fill("Abuela y reloj de bolsillo");
  await tap(dialog.getByRole("button", { name: "Guardar" }));
  await wait(3000);
  await shot("foto-cambiada");
  await p.locator("input[type=file]").first().setInputFiles(photo);
  await wait(4000);
  await shot("foto-agregada-en-la-galeria", true);
});

await step("revista", async () => {
  await p.goto(`${base}/studio/profile`, { waitUntil: "networkidle" });
  await wait(2000);
  await tap(p.locator(".ed-tile").filter({ hasText: "Revista" }));
  await wait(2600);
  await shot("revista-botones");
  await tap(p.getByRole("button", { name: "Foto de portada" }));
  await wait(700);
  await shot("editar-portada");
  await p.keyboard.press("Escape");
});

await step("fechas", async () => {
  await p.goto(`${base}/studio/profile`, { waitUntil: "networkidle" });
  await wait(2000);
  await tap(p.locator(".ed-tile").filter({ hasText: "Fechas" }));
  await wait(1500);
  await shot("fechas-lapices");
  await tap(p.getByRole("button", { name: "Agregar ciudad" }));
  await wait(700);
  const dialog = p.getByRole("dialog");
  await dialog.locator("input[type=text]").nth(0).fill("Austin");
  await dialog.locator("input[type=text]").nth(1).fill("Lone Star Ink");
  const d = (k) => new Date(Date.now() + k * 86400000).toISOString().slice(0, 10);
  await dialog.locator("input[type=date]").nth(0).fill(d(60));
  await dialog.locator("input[type=date]").nth(1).fill(d(66));
  await shot("agregar-ciudad");
  await tap(dialog.getByRole("button", { name: "Guardar" }));
  await wait(3000);
  await shot("ciudad-agregada");
  await tap(p.getByRole("tab", { name: /Austin/ }));
  await wait(600);
  await tap(pencils().nth(0));
  await wait(600);
  await shot("editar-ciudad");
  await p.keyboard.press("Escape");
});

await browser.close();
