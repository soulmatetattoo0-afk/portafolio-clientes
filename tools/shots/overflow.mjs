// Every screen at phone width: does anything spill past the right edge?
//   CHROME=<chromium> node tools/shots/overflow.mjs [base-url]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const p = await b.newPage({ viewport: { width: 375, height: 812 }, locale: "es-CL", isMobile: true, hasTouch: true });
const errors = [];
p.on("pageerror", (e) => errors.push(`${p.url()} ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
await p.goto(`${base}/studio/pagina`, { waitUntil: "load", timeout: 120000 });
const slug = await p.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")).find((h) => /^\/[a-z0-9-]+$/.test(h) && !["/studio", "/me", "/login"].includes(h))) ?? "camo";
await p.goto(`${base}/me`, { waitUntil: "load" });
const chat = await p.evaluate(() => document.querySelector('a[href^="/c/"]')?.getAttribute("href"));
await p.goto(`${base}/studio/chats`, { waitUntil: "load" });
const studioChat = await p.evaluate(() => document.querySelector('a[href^="/studio/chats/"]')?.getAttribute("href"));
const pages = [
  `/${slug}`, `/${slug}/obras`, `/${slug}/revista`, `/${slug}/fechas`, "/terminos", "/privacidad", "/login",
  "/studio/pagina", "/studio/pagina/obras", "/studio/pagina/fechas", "/studio/obras", "/studio/revista", "/studio/chats", studioChat,
  "/studio/sala", "/studio/sala/caja", "/studio/sala/precios", "/studio/sala/estilos", "/studio/sala/cuidados", "/studio/sala/stripe", "/studio/sala/avisos", "/studio/ajustes",
  "/me", "/me/artistas", "/me/perfil", chat,
].filter(Boolean);
for (const path of pages) {
  await p.goto(base + path, { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((el) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.right <= w + 1) return false;
      // Things that are meant to slide sideways or sit off-screen.
      for (let a = el; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.position === "fixed") return false;
      }
      return true;
    });
    return { scroll: document.documentElement.scrollWidth - w, sample: wide.slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`) };
  });
  console.log(`${r.scroll > 1 || r.sample.length ? "WIDE" : "ok  "} ${path}${r.scroll > 1 ? ` (+${r.scroll}px)` : ""} ${r.sample.join(" | ")}`);
}
console.log("errors", errors.length, errors.slice(0, 6).join("\n"));
await b.close();
