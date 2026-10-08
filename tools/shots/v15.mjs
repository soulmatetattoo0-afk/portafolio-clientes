import { chromium } from "playwright";
const out = process.argv[2], base = "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const p = await ctx.newPage();
const shot = async (name, full = false) => { const w = await p.evaluate(() => document.documentElement.scrollWidth); console.log(name, "scrollWidth", w); await p.screenshot({ path: `${out}/${name}.png`, fullPage: full }); };
await p.goto(base + "/", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
await shot("01-home-cover");
await p.evaluate(() => { const el = document.querySelector("[aria-roledescription=carousel] .snap-x, [aria-roledescription=carousel]"); const sc = [...document.querySelectorAll("*")].find(e => getComputedStyle(e).scrollSnapType.includes("x") && e.scrollWidth > e.clientWidth + 10); sc && sc.scrollTo({ left: sc.clientWidth * 2 }); });
await p.waitForTimeout(1500); await shot("02-home-story");
await p.evaluate(() => window.scrollTo(0, window.innerHeight)); await p.waitForTimeout(600); await shot("03-home-guests");
await ctx.addCookies([{ name: "city", value: "miami", url: base }]);
await p.goto(base + "/", { waitUntil: "networkidle" }); await p.evaluate(() => window.scrollTo(0, window.innerHeight)); await p.waitForTimeout(600); await shot("04-home-miami");
await p.goto(base + "/", { waitUntil: "networkidle" }); await shot("05-home-full", true);
for (const [n, q] of [["06-issue-cover", ""], ["07-issue-piece", "?p=piece-d7ca2da3"], ["08-issue-city", "?p=city-miami"], ["09-issue-world", "?p=world-2"], ["10-issue-new", "?p=new-in"], ["11-issue-colophon", "?p=colophon"]]) { await p.goto(base + "/issue/1" + q, { waitUntil: "networkidle" }); await p.waitForTimeout(900); await shot(n); }
await p.goto(base + "/issues", { waitUntil: "networkidle" }); await shot("12-issues");
await p.goto(base + "/camo#bio", { waitUntil: "networkidle" }); await p.waitForTimeout(800); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(900); await shot("13-camo-bio");
await b.close();
