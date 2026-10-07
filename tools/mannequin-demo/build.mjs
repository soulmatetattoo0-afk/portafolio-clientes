// Builds the standalone placement demo into OUT_DIR.
//   node tools/mannequin-demo/build.mjs OUT_DIR [--local]
// --local serves three.js from copied node_modules (offline testing);
// the default points the import map at jsDelivr.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
const local = process.argv.includes("--local");
if (!out) throw new Error("usage: build.mjs OUT_DIR [--local]");
fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: ["tools/mannequin-demo/main.ts"],
  bundle: true,
  format: "esm",
  target: "es2020",
  outfile: path.join(out, "demo.js"),
  external: ["three", "three/addons/*", "three-mesh-bvh"],
  legalComments: "none",
});

const cdn = {
  three: "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/",
  "three-mesh-bvh": "https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.15/build/index.module.js",
};
const offline = {
  three: "./vendor/three/build/three.module.js",
  "three/addons/": "./vendor/three/examples/jsm/",
  "three-mesh-bvh": "./vendor/three-mesh-bvh/build/index.module.js",
};
if (local) {
  fs.cpSync("node_modules/three/build", path.join(out, "vendor/three/build"), { recursive: true });
  fs.cpSync("node_modules/three/examples/jsm", path.join(out, "vendor/three/examples/jsm"), { recursive: true });
  fs.cpSync("node_modules/three-mesh-bvh/build", path.join(out, "vendor/three-mesh-bvh/build"), { recursive: true });
}
const html = fs
  .readFileSync("tools/mannequin-demo/index.html", "utf8")
  .replace("__IMPORTMAP__", JSON.stringify({ imports: local ? offline : cdn }));
fs.writeFileSync(path.join(out, "index.html"), html);
const embed = process.argv.includes("--embed");
for (const b of ["f", "m"]) {
  const glb = `public/mannequin/body-${b}.glb`;
  if (embed) fs.writeFileSync(path.join(out, `body-${b}.js`), `export default "${fs.readFileSync(glb).toString("base64")}";\n`);
  else fs.copyFileSync(glb, path.join(out, `body-${b}.glb`));
}
if (embed) fs.writeFileSync(path.join(out, "index.html"), fs.readFileSync(path.join(out, "index.html"), "utf8").replace("<script type=\"importmap\">", "<script>window.__EMBEDDED_MODELS__ = true;</script>\n<script type=\"importmap\">"));
console.log(`demo built in ${out}${local ? " (local vendor)" : ""}`);
