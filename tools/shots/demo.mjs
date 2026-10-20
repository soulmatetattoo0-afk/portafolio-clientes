// Phone shots of the demo screens: node demo.mjs <out> [base]
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const uid = (n) => { const h = createHash("sha1").update(`vanta-demo:${n}`).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const tok = (n) => createHash("sha256").update(`vanta-chat:${n}`).digest("hex");
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const only = process.env.ONLY?.split(",");
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
let n = 0;
const shot = async (name, full = false) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 74, fullPage: full }); };
const go = async (href, ms = 1500) => { await p.goto(`${base}${href}`, { waitUntil: "load" }); await p.waitForTimeout(ms); };
const wait = (ms) => p.waitForTimeout(ms);
const step = async (name, fn) => { if (only && !only.includes(name)) return; try { await fn(); } catch (e) { console.log("FAIL", name, String(e.message ?? e).split("\n")[0]); await shot(`${name}-FAIL`).catch(() => {}); } };
const swipe = async (x1, x2, y) => { // a thumb drag with the CDP touch events
  const cdp = await ctx.newCDPSession(p);
  const at = (x) => ({ x, y });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(x1)] });
  const steps = 8;
  for (let k = 1; k <= steps; k++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(x1 + ((x2 - x1) * k) / steps)] }); await wait(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
};

await step("obras", async () => {
  await go("/camo/obras", 2000);
  await shot("obras-carrusel");
  await swipe(300, 80, 300);
  await wait(900);
  await shot("obras-carrusel-girado");
  await p.locator(".p-ring-card").filter({ hasNot: p.locator("[aria-hidden=true]") }).first();
  await p.locator("button.p-ring-card").nth(1).click({ force: true }).catch(() => {});
  await wait(800);
  await shot("obras-estilo");
});
await step("revista", async () => {
  await go("/camo/revista", 2500);
  await shot("revista-portada");
  await swipe(330, 60, 400);
  await wait(900);
  await shot("revista-pagina-1");
  await swipe(330, 60, 400);
  await wait(900);
  await shot("revista-pagina-2");
  await swipe(330, 60, 400);
  await wait(900);
  await shot("revista-pagina-3");
});
await step("chats", async () => {
  await go("/studio/chats", 1500);
  await shot("chats-todos");
  await go("/studio/chats?tab=pending", 1200);
  await shot("chats-pendientes");
  await go(`/studio/chats/${uid("brief:sofia")}`, 2000);
  await shot("chat-sofia-pendiente", true);
  await go(`/studio/chats/${uid("brief:daniel")}`, 2000);
  await shot("chat-daniel-completo", true);
  await go(`/studio/chats/${uid("brief:chloe")}`, 2000);
  await shot("chat-chloe-reservada", true);
  await go(`/c/${tok("daniel")}`, 2000);
  await shot("cliente-daniel-completo", true);
});
await step("fechas", async () => {
  await go("/studio/pagina/fechas", 1800);
  await shot("fechas");
  await p.locator("button.t-num").filter({ hasText: /^21$/ }).first().click();
  await wait(900);
  await shot("fechas-21", true);
  await p.keyboard.press("Escape");
  await go("/studio/pagina/fechas", 1200);
  await p.locator("button.t-num").filter({ hasText: /^25$/ }).first().click();
  await wait(900);
  await shot("fechas-25", true);
  await p.keyboard.press("Escape");
  await go("/studio/pagina/fechas", 1200);
  await p.locator("button.t-num").filter({ hasText: /^23$/ }).first().click();
  await wait(900);
  await shot("fechas-23-libre");
});
await step("sala", async () => {
  await go("/studio/sala", 1800);
  await shot("sala", true);
  await go("/studio/ajustes", 1200);
  await shot("ajustes", true);
});
console.log("errors", errors.length, errors.slice(0, 8).join("\n"));
await browser.close();
