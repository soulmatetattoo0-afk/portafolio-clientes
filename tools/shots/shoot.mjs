/**
 * iPhone screenshots of the issue reader and the artist magazine, for a look
 * before shipping. Usage: node tools/shots/shoot.mjs [base] [tag]
 * Writes to tools/shots/out/{tag}-{name}.png and fails if any page scrolls sideways.
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:3102";
const tag = process.argv[3] ?? "";
const only = process.argv[4];
const out = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const settle = async (ms = 1400) => page.waitForTimeout(ms);
const shot = async (name) => {
  const file = join(out, `${tag ? `${tag}-` : ""}${name}.png`);
  await page.screenshot({ path: file });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const inView = await page.evaluate(() => Array.from(document.querySelectorAll(".mag-ch.is-in")).length);
  console.log(`${file}  scrollWidth=${sw}  is-in=${inView}`);
  if (sw > 390) throw new Error(`${name}: page scrolls sideways (${sw}px)`);
  return { sw, inView };
};
const open = async (path) => {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await settle();
};
const arrow = async (n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("ArrowRight");
    await settle(900);
  }
};
const active = () => page.evaluate(() => document.querySelector(".mag-root")?.getAttribute("data-active") ?? new URL(location.href).searchParams.get("p"));
const scrollLeft = () => page.evaluate(() => document.querySelector(".mag-scroll")?.scrollLeft ?? -1);

const steps = {
  async camo() {
    await open("/camo#bio");
    const before = await scrollLeft();
    const r = await shot("camo-bio");
    if (r.inView < 1) throw new Error("camo#bio: no chapter revealed (.is-in)");
    await arrow(1);
    const after = await scrollLeft();
    console.log(`camo scrollLeft ${before} -> ${after}`);
    if (after <= before) throw new Error("camo#bio: ArrowRight did not page");
    await shot("camo-bio-2");
  },
  async issue() {
    await open("/issue/1");
    await shot("issue-cover");
    await arrow(3);
    console.log("after 3 arrows, p =", await active(), "url =", page.url());
    await shot("issue-piece");
    await arrow(1);
    await shot("issue-piece-2");
    await arrow(1);
    await shot("issue-ch-6");
  },
  async deep() {
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll(".mag-scroll > [data-key]")).map((s) => s.getAttribute("data-key")));
    console.log("chapter keys:", ids.join(", "));
    const world = ids.find((k) => k?.startsWith("world-")) ?? "world-1";
    const city = ids.find((k) => k?.startsWith("city-")) ?? "city-miami";
    await open(`/issue/1?p=${world}`);
    console.log("deep link p =", await active(), "scrollLeft =", await scrollLeft());
    await shot("issue-world");
    await open(`/issue/1?p=${city}`);
    await shot("issue-city");
    await open(`/issue/1?p=new-in`);
    await shot("issue-new-in");
    await open(`/issue/1?p=editorial`);
    await shot("issue-editorial");
    await open(`/issue/1?p=colophon`);
    await shot("issue-colophon");
    const last = ids.filter((k) => k?.startsWith("piece-"));
    for (const [i, k] of last.entries()) {
      await open(`/issue/1?p=${k}`);
      await shot(`issue-${String(i + 1).padStart(2, "0")}-${k}`);
    }
  },
  async issues() {
    await open("/issues");
    await shot("issues");
  },
};

for (const [name, fn] of Object.entries(steps)) {
  if (only && !only.split(",").includes(name)) continue;
  await fn();
}
if (errors.length) console.log("page errors:\n" + errors.join("\n"));
await browser.close();
