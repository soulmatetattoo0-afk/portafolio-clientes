// The chats on a phone: the list, a new request with its letter opened, a booked chat, the client's side. CHROME=<chromium> node tools/shots/chat.mjs <out> [base-url]
import { chromium } from "playwright";
const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "es-CL", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
p.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 72 }); };
await p.goto(`${base}/studio/chats`, { waitUntil: "load", timeout: 90000 });
await shot("list");
const hrefs = await p.$$eval('a[href^="/studio/chats/"]', (as) => as.map((a) => a.getAttribute("href")));
// A pending request (first in the pending tab) and an open one.
await p.goto(`${base}/studio/chats?tab=pending`, { waitUntil: "load" });
const pend = await p.$$eval('a[href^="/studio/chats/"]', (as) => as.map((a) => a.getAttribute("href")));
const target = pend[0] ?? hrefs[0];
await p.goto(`${base}${target}`, { waitUntil: "load" });
await shot("new-1");
await p.locator('button[aria-haspopup="dialog"]').first().click();
await shot("letter-1");
await p.evaluate(() => document.querySelector("dialog[open]")?.scrollBy(0, 700));
await shot("letter-2");
await p.keyboard.press("Escape");
await p.goto(`${base}/studio/chats?tab=accepted`, { waitUntil: "load" });
const acc = await p.$$eval('a[href^="/studio/chats/"]', (as) => as.map((a) => a.getAttribute("href")));
if (acc[0]) {
  await p.goto(`${base}${acc[0]}`, { waitUntil: "load" });
  await shot("open-1");
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot("open-2");
}
await p.goto(`${base}/me`, { waitUntil: "load" });
const chats = await p.$$eval('a[href^="/c/"]', (as) => as.map((a) => a.getAttribute("href")));
if (chats[0]) {
  await p.goto(`${base}${chats[0]}`, { waitUntil: "load" });
  await shot("client-1");
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot("client-2");
}
console.log("errors", errors.length, errors.slice(0, 5).join("\n"));
await browser.close();
