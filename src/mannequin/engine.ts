/**
 * Framework-agnostic three.js viewer for the statue mannequin.
 *
 * The body is one mesh whose vertices carry a `_zone` id. Highlighting is a
 * shader tint driven by a per-zone uniform array, so selecting a sleeve
 * (four zones) costs nothing. The design footprint is drawn by the same
 * shader as a feathered patch projected onto the skin, sized in real
 * centimetres: the whole figure is scaled to the client's height, so 1 world
 * unit stays 1 metre. The patch can be dragged along the skin, pinched to
 * scale and turned with two fingers.
 */

import {
  ACESFilmicToneMapping,
  Bone,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshMatcapMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Raycaster,
  Scene,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type BufferGeometry as BG,
  type Intersection,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree, type MeshBVH } from "three-mesh-bvh";

import { BODY_HEIGHT_CM, MIN_DESIGN_CM, PAIN_COLORS, PLACEMENT_BY_SLUG, ZONES, ZONE_BY_ID, ZONE_BY_SLUG, maxSizeFor, painFor, patchZoneIds, type BodyType } from "./catalog";
import { poseFor, viewFor, type PoseSpec } from "./poses";

/* eslint-disable @typescript-eslint/no-explicit-any */
(BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type ViewerMode = "view" | "zone" | "place";

export interface DesignPlacement {
  body: BodyType;
  heightCm: number;
  placement: string | null;
  /** Point on the skin, in metres, figure space (y up, facing +z). */
  point: [number, number, number] | null;
  normal: [number, number, number] | null;
  widthCm: number;
  heightCmDesign: number;
  rotationDeg: number;
}

export interface EngineOptions {
  assetBase: string;
  /** Optional custom loader (e.g. models embedded in the page) instead of fetching `assetBase`. */
  loadModel?: (body: BodyType) => Promise<ArrayBuffer>;
  body: BodyType;
  heightCm?: number;
  reducedMotion?: boolean;
  /** Outline colour of the design patch: the artist's accent on public pages, gilt in the studio. */
  accent?: string;
  onZoneTap?: (zoneSlug: string) => void;
  /** Fired when the client moves, scales or turns the design on the figure. */
  onPlace?: (placement: DesignPlacement) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const MAX_ZONES = 32;

/** Zone states for the shader. */
const ST_HOVER = 1;
const ST_SELECTED = 2;
const ST_DIM = 3;
const ST_ACTIVE = 4; // the chosen area while a design sits on it: a soft wash, no pulse

const vertexPatch = /* glsl */ `
attribute float _zone;
attribute float _edge;
attribute float _other;
varying float vZone;
varying float vEdge;
flat varying float vOther;
varying vec3 vObj;
varying vec3 vNrm;
`;
const fragmentPatch = /* glsl */ `
uniform float uZoneState[${MAX_ZONES}];
uniform vec3 uZoneColor[${MAX_ZONES}];
uniform float uTime;
uniform float uDesignOn;
uniform vec3 uDesignCenter;
uniform vec3 uDesignX;
uniform vec3 uDesignY;
uniform vec3 uDesignN;
uniform vec2 uDesignHalf;
uniform float uDesignDepth;
uniform vec3 uDesignColor;
uniform float uDesignMask[${MAX_ZONES}];
uniform vec3 uAccent;
uniform float uPainMap;
uniform sampler2D uInkFront;
uniform sampler2D uInkBack;
uniform vec4 uInkBox;
uniform float uInkOn;
varying float vZone;
varying float vEdge;
flat varying float vOther;
varying vec3 vObj;
varying vec3 vNrm;

float wHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float wNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z);
}
// Glazed porcelain: a cool white with the faintest drift where the glaze
// pooled, and no grain: the glaze is glass.
vec3 wax(vec3 p) {
  float drift = wNoise(p * 6.0) * 0.6 + wNoise(p * 17.0) * 0.4;
  vec3 glaze = vec3(0.985, 0.985, 0.99);
  vec3 pool = vec3(0.93, 0.945, 0.97);
  return mix(glaze, pool, drift * 0.55);
}
// The flash painted on the porcelain: a front sheet and a back sheet seen
// straight on, faded out where the surface turns sideways to them.
float ink(vec3 p, vec3 n) {
  if (uInkOn < 0.5) return 0.0;
  float u = (p.x - uInkBox.x) / (uInkBox.y - uInkBox.x);
  float v = (uInkBox.w - p.y) / (uInkBox.w - uInkBox.z);
  vec4 f = texture2D(uInkFront, vec2(u, v));
  vec4 b = texture2D(uInkBack, vec2(1.0 - u, v));
  float inkF = f.a * (1.0 - dot(f.rgb, vec3(0.3333)));
  float inkB = b.a * (1.0 - dot(b.rgb, vec3(0.3333)));
  return inkF * smoothstep(0.12, 0.45, n.z) + inkB * smoothstep(0.12, 0.45, -n.z);
}
`;

/** Feather width, in figure metres: how far from a zone border the highlight takes to reach full strength. */
const FEATHER_M = 0.03;

/**
 * Per-vertex distance to the nearest zone border (`_edge`, 0 at the border, 1 at
 * FEATHER_M and beyond) and the zone across that border (`_other`). The GLB
 * only carries `_zone`; borders are where vertices of different zones share a
 * position, and distances spread from them along mesh edges.
 */
function addBorderAttributes(geometry: BufferGeometry) {
  const pos = geometry.getAttribute("position");
  const zone = geometry.getAttribute("_zone");
  const index = geometry.getIndex();
  const n = pos.count;
  const edge = new Float32Array(n).fill(1);
  const other = new Float32Array(n);
  for (let i = 0; i < n; i++) other[i] = zone ? zone.getX(i) : 0;
  if (!zone || !index) {
    geometry.setAttribute("_edge", new BufferAttribute(edge, 1));
    geometry.setAttribute("_other", new BufferAttribute(other, 1));
    return;
  }
  // Vertices sharing a position with a vertex of another zone sit on a border.
  const dist = new Float32Array(n).fill(Infinity);
  const byPos = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    const list = byPos.get(key);
    if (list) list.push(i);
    else byPos.set(key, [i]);
  }
  for (const list of byPos.values()) {
    if (list.length < 2) continue;
    for (const i of list) {
      const zi = Math.round(zone.getX(i));
      for (const j of list) {
        const zj = Math.round(zone.getX(j));
        if (zj !== zi) {
          dist[i] = 0;
          other[i] = zj;
          break;
        }
      }
    }
  }
  // Relax along triangle edges: a few passes cover the feather width.
  const idx = index.array as ArrayLike<number>;
  const len = (a: number, b: number) => Math.hypot(pos.getX(a) - pos.getX(b), pos.getY(a) - pos.getY(b), pos.getZ(a) - pos.getZ(b));
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = idx[t + k];
        const b = idx[t + ((k + 1) % 3)];
        if (dist[a] >= FEATHER_M && dist[b] >= FEATHER_M) continue;
        const l = len(a, b);
        if (dist[a] + l < dist[b]) {
          dist[b] = dist[a] + l;
          other[b] = other[a];
          changed = true;
        } else if (dist[b] + l < dist[a]) {
          dist[a] = dist[b] + l;
          other[a] = other[b];
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (let i = 0; i < n; i++) edge[i] = Math.min(1, dist[i] / FEATHER_M);
  geometry.setAttribute("_edge", new BufferAttribute(edge, 1));
  geometry.setAttribute("_other", new BufferAttribute(other, 1));
}

function makeMatcap(): CanvasTexture {
  // Studio light for cast wax: a soft key from above left with wrapped
  // falloff (light creeps round the form), a warm fill from below, a warm
  // rim where light passes through the edge of the material, and a broad
  // satin sheen instead of a lacquer highlight. The wax colour itself is
  // applied in the fragment shader, so this map is close to greyscale.
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const key = new Vector3(-0.5, 0.65, 0.6).normalize();
  const fill = new Vector3(0.55, -0.35, 0.75).normalize();
  const back = new Vector3(0.6, 0.25, -0.75).normalize();
  const half = new Vector3().copy(key).add(new Vector3(0, 0, 1)).normalize();
  const n = new Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = 1 - (y / (size - 1)) * 2;
      const r2 = nx * nx + ny * ny;
      const i = (y * size + x) * 4;
      if (r2 > 1) {
        img.data[i + 3] = 255;
        continue;
      }
      n.set(nx, ny, Math.sqrt(1 - r2));
      const wrap = Math.max(0, (n.dot(key) + 0.4) / 1.4); // wrapped diffuse: wax never goes black
      const diffuse = Math.pow(wrap, 1.6);
      const warmFill = Math.max(n.dot(fill), 0) * 0.14;
      const fresnel = Math.pow(1 - n.z, 2.0);
      const rim = Math.max(n.dot(back) * 0.5 + 0.5, 0) * fresnel * 0.55; // light through the edge of the wax
      const sheen = Math.pow(Math.max(n.dot(half), 0), 9) * 0.2; // satin, wide and faint
      const shade = 0.26 + diffuse * 0.74;
      // Glazed porcelain: cool, clean shadows, a hard window highlight from the key
      // and a second small one from the fill, the way a glaze mirrors a studio.
      const gloss = Math.pow(Math.max(n.dot(half), 0), 70) * 0.95;
      const half2 = new Vector3().copy(fill).add(new Vector3(0, 0, 1)).normalize();
      const gloss2 = Math.pow(Math.max(n.dot(half2), 0), 120) * 0.45;
      const cool = 1 - diffuse;
      const r = shade * (1 - 0.05 * cool) + warmFill * 0.5 + rim * 0.8 + sheen + gloss + gloss2;
      const g = shade * (1 - 0.03 * cool) + warmFill * 0.5 + rim * 0.85 + sheen + gloss + gloss2;
      const b = shade + warmFill * 0.55 + rim * 0.95 + sheen + gloss + gloss2;
      img.data[i] = Math.min(255, r * 255);
      img.data[i + 1] = Math.min(255, g * 255);
      img.data[i + 2] = Math.min(255, b * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A CSS colour as raw sRGB components, for tints applied after tone mapping. */
function srgb(css: string): Vector3 {
  const c = new Color();
  c.setStyle(css, SRGBColorSpace);
  // Back to the sRGB encoding the shader output is in.
  const enc = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  return new Vector3(enc(c.r), enc(c.g), enc(c.b));
}

interface Gesture {
  kind: "pinch";
  ids: number[];
  startDist?: number;
  startAngle?: number;
  startW?: number;
  startH?: number;
  startRot?: number;
  moved: boolean;
}

/** A triangle of the skin (vertex indices) and barycentric weights of a point inside it. */
type Tri = { a: number; b: number; c: number; u: number; v: number; w: number };

export class MannequinEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(28, 1, 0.05, 30);
  private controls: OrbitControls;
  private root = new Group();
  private body: Mesh | null = null;
  /** The statue's skeleton, when the body shipped with one: the limbs can then be posed. */
  private skeleton: Skeleton | null = null;
  private boneOrder: Bone[] = [];
  private restLocal = new Map<Bone, Quaternion>();
  private restWorld = new Map<Bone, Quaternion>();
  /** Each bone's anatomical frame at rest: Y up along the bone, Z the figure's front, so X is the hinge. */
  private boneFrame = new Map<Bone, Quaternion>();
  private poseTarget = new Map<Bone, Quaternion>();
  private poseAnim: { from: Map<Bone, Quaternion>; start: number; dur: number } | null = null;
  private poseKey = "";
  /** The skin as it is posed right now, for picking; the drawn mesh keeps the bind pose and lets the GPU move it. */
  private posedGeom: BufferGeometry | null = null;
  private pickMesh: Mesh | null = null;
  /** The bind pose, for settling the patch along the skin: the design lives in that space. */
  private bindMesh: Mesh | null = null;
  private bodyType: BodyType;
  private heightCm: number;
  private material: MeshMatcapMaterial;
  private zoneState = new Float32Array(MAX_ZONES);
  private zoneColor: Vector3[] = [];
  /** The patch's one colour: the pain of the chosen placement. */
  private designColor = new Vector3(0.8, 0.8, 0.8);
  /** 1 for the zones a design may spread over (its placement's body region). */
  private designMask = new Float32Array(MAX_ZONES);
  private hoverZone = 0;
  private mode: ViewerMode = "view";
  private painMap = false;
  private placement: string | null = null;
  private design = { point: null as Vector3 | null, normal: null as Vector3 | null, widthCm: 10, heightCm: 10, rotationDeg: 0 };
  /** The triangle the design's centre sits on and where in it, so the posed centre can be found again. */
  private designTri: Tri | null = null;
  /** Tangent frame of the design in figure space, kept for hit tests. */
  private frame = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), n: new Vector3(0, 0, 1), halfW: 0, halfH: 0 };
  private uniforms: Record<string, { value: unknown }> | null = null;
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: Gesture | null = null;
  private downAt: { x: number; y: number; t: number } | null = null;
  private frameId = 0;
  private dirty = true;
  private flight: { from: [Vector3, Vector3]; to: [Vector3, Vector3]; start: number; dur: number } | null = null;
  private intro: { start: number } | null = null;
  private visible = true;
  private disposed = false;
  private observer: ResizeObserver;
  private io: IntersectionObserver;
  private loader: GLTFLoader;
  private cache = new Map<BodyType, BG>();
  private rigCache = new Map<BodyType, { bones: Bone[]; inverses: Matrix4[] }>();
  /** The painted flash per body: front and back sheets, drawn once from their SVGs. */
  private inkCache = new Map<BodyType, Promise<{ front: CanvasTexture; back: CanvasTexture } | null>>();
  private ink: { front: CanvasTexture | null; back: CanvasTexture | null; box: Vector4 } = { front: null, back: null, box: new Vector4(-1, 1, -1, 1) };
  private inkBlank = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return new CanvasTexture(c);
  })();
  private startTime = performance.now();
  private accent: string;

  constructor(
    private container: HTMLElement,
    private opts: EngineOptions,
  ) {
    this.bodyType = opts.body;
    this.heightCm = opts.heightCm ?? BODY_HEIGHT_CM[opts.body];
    this.accent = opts.accent || "#c9a35f";
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);

    // Pain colour per zone id, for the shader. The tint is mixed in after tone
    // mapping, in sRGB, so the chart colours stay exactly what the legend shows.
    for (let i = 0; i < MAX_ZONES; i++) this.zoneColor.push(new Vector3(0.8, 0.8, 0.8));
    for (const zone of ZONES) this.zoneColor[zone.id].copy(srgb(PAIN_COLORS[zone.pain]));

    this.material = new MeshMatcapMaterial({ matcap: makeMatcap() });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uZoneState = { value: this.zoneState };
      shader.uniforms.uZoneColor = { value: this.zoneColor };
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uDesignOn = { value: 0 };
      shader.uniforms.uDesignCenter = { value: new Vector3() };
      shader.uniforms.uDesignX = { value: new Vector3(1, 0, 0) };
      shader.uniforms.uDesignY = { value: new Vector3(0, 1, 0) };
      shader.uniforms.uDesignN = { value: new Vector3(0, 0, 1) };
      shader.uniforms.uDesignHalf = { value: new Vector2(0.05, 0.05) };
      shader.uniforms.uDesignDepth = { value: 0.05 };
      shader.uniforms.uDesignColor = { value: this.designColor };
      shader.uniforms.uDesignMask = { value: this.designMask };
      shader.uniforms.uAccent = { value: srgb(this.accent) };
      shader.uniforms.uPainMap = { value: this.painMap ? 1 : 0 };
      shader.uniforms.uInkFront = { value: this.ink.front ?? this.inkBlank };
      shader.uniforms.uInkBack = { value: this.ink.back ?? this.inkBlank };
      shader.uniforms.uInkBox = { value: this.ink.box };
      shader.uniforms.uInkOn = { value: this.ink.front ? 1 : 0 };
      this.uniforms = shader.uniforms;
      this.syncDesignUniforms();
      shader.vertexShader =
        vertexPatch +
        shader.vertexShader
          .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n  vNrm = objectNormal;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vZone = _zone;\n  vEdge = _edge;\n  vOther = _other;\n  vObj = position;");
      shader.fragmentShader =
        fragmentPatch +
        shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          /* glsl */ `#include <dithering_fragment>
  int zi = int(vZone + 0.5);
  int oi = int(vOther + 0.5);
  float st = 0.0;
  float so = 0.0;
  vec3 zc = vec3(0.8);
  float onRegion = 0.0;
  for (int k = 0; k < ${MAX_ZONES}; k++) { if (k == zi) { st = uZoneState[k]; zc = uZoneColor[k]; onRegion = uDesignMask[k]; } if (k == oi) so = uZoneState[k]; }
  // The bicep is its inner face: the front of the upper arm and the side toward the body.
  // The outer half of zones 5 and 6 stays plain porcelain whatever the state.
  if (zi == 5 || zi == 6) {
    vec3 inward = normalize(vec3(-sign(vObj.x) * 0.75, 0.0, 0.66));
    float inner = smoothstep(-0.12, 0.12, dot(normalize(vNrm), inward));
    st *= step(0.5, inner);
    so *= step(0.5, inner);
  }
  // 1 = hover, 2 = selected (pulses gently), 3 = dimmed (other zones while placing), 4 = the area under a design
  float hover = step(0.5, st) * step(st, 1.5);
  float sel = step(1.5, st) * step(st, 2.5);
  float dim = step(2.5, st) * step(st, 3.5);
  float area = step(3.5, st);
  // Zones nobody has touched show their usual pain as a quiet wash when the pain map is on.
  float idle = (1.0 - step(0.5, st)) * uPainMap;
  // Zone borders are feathered: the tint eases in over the first centimetres
  // from a border, but only where the zone across it is drawn differently, so
  // two dimmed zones never show a seam.
  float feather = smoothstep(0.0, 1.0, vEdge);
  float wash = mix(0.12 + 0.88 * feather, 1.0, step(abs(st - so), 0.5));
  // Porcelain: the matcap carries the light and the glaze's highlights, the glaze function the colour.
  gl_FragColor.rgb = wax(vObj) * gl_FragColor.rgb * 1.08;
  float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  // Cobalt under the glaze: the ink takes the light like the porcelain around it.
  // The chosen area shows no painting: it reads clean, the selection over everything.
  float inked = ink(vObj, normalize(vNrm)) * (1.0 - sel) * (1.0 - area);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.10, 0.22, 0.52) * (0.55 + lum * 0.55), inked * 0.95);
  // The pain colour is laid on like paint: it keeps the wax's shading.
  vec3 paint = zc * (0.5 + lum * 0.62);
  // Under a design the area takes no tint of its own: the patch is the one shape on the skin.
  gl_FragColor.rgb = mix(gl_FragColor.rgb, paint, (hover * 0.5 + area * 0.14 * (1.0 - uDesignOn) + idle * 0.24) * wash);
  // The selection reads like a laser scan: the whole area filled edge to edge,
  // a bright rim along its border, fine scan lines and a band that sweeps up it.
  if (sel > 0.5) {
    float rim = (1.0 - feather) * step(0.5, abs(st - so));
    float lines = smoothstep(0.55, 1.0, sin(vObj.y * 900.0)) * 0.22;
    float band = exp(-pow((fract(vObj.y * 1.4 - uTime * 0.45) - 0.5) * 9.0, 2.0)) * 0.55;
    // the grid and the scan take the area's pain colour
    vec3 laser = min(zc * 1.35 + 0.08, vec3(1.0));
    float grid = smoothstep(0.82, 1.0, sin(vObj.x * 520.0)) * 0.5 + smoothstep(0.82, 1.0, sin(vObj.y * 520.0)) * 0.5;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, paint, 0.42);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, laser, clamp(grid * 0.75 + lines + band * 0.55 + rim * 0.9, 0.0, 1.0));
  }
  gl_FragColor.rgb *= 1.0 - dim * 0.38 * wash;
  // The design footprint: a feathered ink patch projected onto the skin,
  // outlined in the accent. Only skin facing the patch and within its depth
  // takes it, so it never wraps through a limb.
  if (uDesignOn > 0.5) {
    vec3 d = vObj - uDesignCenter;
    float dn = dot(d, uDesignN);
    vec2 uv = vec2(dot(d, uDesignX), dot(d, uDesignY));
    // Skin that has turned away from the patch's plane is further along the
    // surface than its projection says: stretch the coordinates by the arc
    // (theta / sin theta), so the footprint keeps its true size round a limb.
    float cosT = clamp(dot(normalize(vNrm), uDesignN), -1.0, 1.0);
    float theta = acos(cosT);
    float arc = theta > 0.02 ? theta / sin(theta) : 1.0;
    uv *= min(arc, 3.0);
    float r = min(uDesignHalf.x, uDesignHalf.y) * 0.22;
    vec2 q = abs(uv) - uDesignHalf + r;
    float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float facing = smoothstep(-0.12, 0.12, cosT);
    float depthOk = 1.0 - smoothstep(uDesignDepth * 0.75, uDesignDepth, abs(dn));
    float mask = facing * depthOk * onRegion;
    float aa = max(fwidth(sdf) * 1.2, 0.0006);
    float inside = 1.0 - smoothstep(-aa, aa, sdf);
    float soft = 1.0 - smoothstep(-min(0.012, min(uDesignHalf.x, uDesignHalf.y) * 0.5), 0.0, sdf);
    float lineW = max(fwidth(sdf) * 1.5, 0.0012);
    float line = 1.0 - smoothstep(lineW * 0.6, lineW * 1.6, abs(sdf));
    // The patch is the chosen area itself: the same laser scan as the selection,
    // in one colour (the placement's pain), even where it spills onto a
    // neighbouring zone of another pain, cut to the size the client set.
    vec3 laserP = min(uDesignColor * 1.35 + 0.08, vec3(1.0));
    vec3 paintP = uDesignColor * (0.5 + lum * 0.62);
    float gridP = smoothstep(0.82, 1.0, sin(vObj.x * 520.0)) * 0.5 + smoothstep(0.82, 1.0, sin(vObj.y * 520.0)) * 0.5;
    float linesP = smoothstep(0.55, 1.0, sin(vObj.y * 900.0)) * 0.22;
    float bandP = exp(-pow((fract(vObj.y * 1.4 - uTime * 0.45) - 0.5) * 9.0, 2.0)) * 0.55;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, paintP, inside * (0.42 + 0.16 * soft) * mask);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, laserP, clamp(inside * (gridP * 0.75 + linesP + bandP * 0.55) + line * 0.95, 0.0, 1.0) * mask);
    // A small cross at the centre, so the middle reads even on a tiny patch.
    float mark = (1.0 - smoothstep(lineW * 0.5, lineW * 1.2, min(abs(uv.x), abs(uv.y)))) * (1.0 - smoothstep(0.006, 0.0085, max(abs(uv.x), abs(uv.y))));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, laserP, mark * mask * 0.9);
  }`,
        );
    };

    this.scene.add(this.root);

    // Our pointer handlers are registered before OrbitControls' so a drag or
    // a pinch on the design can stop the orbit from ever starting.
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.maxPolarAngle = Math.PI * 0.82;
    this.controls.minDistance = 0.45;
    this.controls.maxDistance = 6;
    this.controls.rotateSpeed = 0.75;
    this.controls.addEventListener("change", () => (this.dirty = true));
    this.controls.addEventListener("start", () => {
      this.flight = null;
      this.intro = null;
    });

    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.io = new IntersectionObserver((entries) => {
      // Records can arrive batched (a viewport change delivers leave + enter together): the last one is current.
      this.visible = entries[entries.length - 1].isIntersecting;
      if (this.visible) this.loop();
    });
    this.io.observe(container);
    this.resize();
    void this.loadBody(this.bodyType, true);
  }

  /* ---------------------------------------------------------------- public */

  async setBody(body: BodyType) {
    if (body === this.bodyType && this.body) return;
    const defaultHeight = this.heightCm === BODY_HEIGHT_CM[this.bodyType];
    this.bodyType = body;
    if (defaultHeight) this.heightCm = BODY_HEIGHT_CM[body];
    this.clearDesign();
    await this.loadBody(body, false);
  }

  setHeight(cm: number) {
    this.heightCm = Math.min(205, Math.max(145, cm));
    this.applyScale();
    if (this.design.point) {
      this.clearDesign();
    }
    this.frameAll(false);
  }

  private loadInk(body: BodyType) {
    let pending = this.inkCache.get(body);
    if (!pending) {
      const sheet = async (side: "front" | "back") => {
        const img = new Image();
        img.decoding = "async";
        img.src = `${this.opts.assetBase}/ink-${body}-${side}.svg`;
        await img.decode();
        const canvas = document.createElement("canvas");
        const w = 1536;
        canvas.width = w;
        canvas.height = Math.round((w * img.naturalHeight) / img.naturalWidth);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const tex = new CanvasTexture(canvas);
        tex.flipY = false;
        tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        return tex;
      };
      pending = Promise.all([sheet("front"), sheet("back")])
        .then(([front, back]) => ({ front, back }))
        .catch(() => null);
      this.inkCache.set(body, pending);
    }
    return pending;
  }

  /** Lay the body's painted sheets over it, framed on its own bounding box. */
  private async applyInk(body: BodyType, geometry: BG) {
    const ink = await this.loadInk(body);
    if (this.disposed || this.bodyType !== body) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    // Kept on the engine too: the shader may compile after the sheets arrive.
    this.ink.front = ink?.front ?? null;
    this.ink.back = ink?.back ?? null;
    this.ink.box.set(bb.min.x, bb.max.x, bb.min.y, bb.max.y);
    const u = this.uniforms;
    if (u) {
      u.uInkFront.value = this.ink.front ?? this.inkBlank;
      u.uInkBack.value = this.ink.back ?? this.inkBlank;
      u.uInkOn.value = this.ink.front ? 1 : 0;
    }
    this.invalidate();
  }

  /** Show every zone's usual pain while the client chooses. */
  setPainMap(on: boolean) {
    this.painMap = on;
    if (this.uniforms) this.uniforms.uPainMap.value = on ? 1 : 0;
    this.invalidate();
  }

  setMode(mode: ViewerMode) {
    this.mode = mode;
    this.hoverZone = 0;
    this.endGesture(false);
    this.refreshZoneState();
  }

  /** Highlight a placement (atomic zone or composite) and fly the camera to it. */
  selectPlacement(slug: string | null, fly = true) {
    this.placement = slug;
    this.refreshZoneState();
    // The figure turns to show the area (an arm comes forward, bends, turns its palm), then the camera closes in.
    this.setPose(slug ? poseFor(slug) : null, !this.opts.reducedMotion);
    if (slug && fly) this.focusPlacement(slug);
    if (!slug) this.frameAll(true);
  }

  focusPlacement(slug: string, animate = true) {
    const target = this.placementAnchor(slug);
    if (!target) return;
    const { center, radius } = target;
    // Fit the zone's bounding sphere inside the narrower of the two FOVs with
    // room around it, and never so close that the area loses its context.
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const half = Math.tan(Math.min(vfov, hfov) / 2);
    const dist = Math.max(0.45 / half, (radius / half) * 1.45);
    const hint = viewFor(slug);
    const dir = hint ? new Vector3(...hint).normalize() : this.clearestView(target, dist);
    const eye = center.clone().add(dir.multiplyScalar(dist));
    eye.y += radius * 0.25;
    if (animate) this.flyTo(eye, center);
    else this.jumpTo(eye, center);
  }

  /**
   * Direction to look at a placement from: close to its mean normal, but
   * chosen among candidate directions by how much of the area is actually in
   * sight (an inner forearm faces the body, so its mean normal would put the
   * camera inside the torso). Level, front-facing views win ties.
   */
  private clearestView(anchor: { center: Vector3; normal: Vector3; samples: Vector3[] }, dist: number): Vector3 {
    const geom = this.skinGeometry()!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bvh = (geom as any).boundsTree as MeshBVH | undefined;
    const base = anchor.normal.clone().normalize();
    if (!bvh || !anchor.samples.length) return base;
    const s = this.root.scale.x;
    const centre = anchor.center.clone().divideScalar(s);
    const az0 = Math.atan2(base.x, base.z);
    const el0 = Math.asin(Math.max(-1, Math.min(1, base.y)));
    const ray = new Ray();
    const eye = new Vector3();
    const dir = new Vector3();
    let best = base;
    let bestScore = -Infinity;
    for (let k = -8; k < 8; k++) {
      const az = az0 + (k * Math.PI) / 8;
      for (const el of [el0, 0.35, 0, -0.35, -0.7]) {
        dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
        eye.copy(centre).addScaledVector(dir, dist / s);
        let seen = 0;
        for (const p of anchor.samples) {
          ray.origin.copy(eye);
          ray.direction.copy(p).sub(eye);
          const d = ray.direction.length();
          ray.direction.divideScalar(d);
          const hit = bvh.raycastFirst(ray, 2 /* DoubleSide */);
          if (hit && Math.abs(hit.distance - d) < 0.012) seen++;
        }
        const turn = Math.acos(Math.max(-1, Math.min(1, dir.dot(base))));
        const score = seen / anchor.samples.length - 0.06 * turn - 0.12 * Math.abs(el) + 0.16 * dir.z;
        if (score > bestScore) {
          bestScore = score;
          best = dir.clone();
        }
      }
    }
    return best;
  }

  private jumpTo(eye: Vector3, target: Vector3) {
    this.flight = null;
    this.intro = null;
    this.root.rotation.y = 0;
    this.camera.position.copy(eye);
    this.controls.target.copy(target);
    this.controls.update();
    this.dirty = true;
  }

  /** PNG framed on the chosen placement, for the artist's brief. Restores the view afterwards. */
  async snapshotPlacement(): Promise<Blob | null> {
    if (!this.placement) return this.snapshot();
    const eye = this.camera.position.clone();
    const target = this.controls.target.clone();
    const zoneState = Float32Array.from(this.zoneState);
    // The area reads as a soft wash under a design, as a full fill without one.
    const ids = (PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? []).map((z) => ZONE_BY_SLUG.get(z)?.id ?? 0);
    this.zoneState.fill(0);
    for (const id of ids) this.zoneState[id] = this.design.point ? ST_ACTIVE : ST_SELECTED;
    if (this.design.point) this.focusDesign(false);
    else this.focusPlacement(this.placement, false);
    if (this.uniforms) this.uniforms.uTime.value = 0;
    const blob = await this.snapshot();
    this.zoneState.set(zoneState);
    this.jumpTo(eye, target);
    return blob;
  }

  /** Frame the design itself: the patch large and centred, seen along its normal. */
  focusDesign(animate = true) {
    if (!this.design.point || !this.design.normal) return;
    const s = this.root.scale.x;
    const center = this.posedPoint(this.design.point).multiplyScalar(s);
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const half = Math.tan(Math.min(vfov, hfov) / 2);
    const size = Math.max(this.design.widthCm, this.design.heightCm) / 100;
    const dist = Math.max(0.5 / half, (size / half) * 1.7);
    // Look from where the whole area is in sight (an inner forearm faces the
    // body: its own normal would put the eye between arm and torso).
    const anchor = this.placement ? this.placementAnchor(this.placement) : null;
    // Without an area to measure, look along the design's own normal, carried to where the limb is now.
    const dir = anchor ? this.clearestView(anchor, dist) : this.design.normal.clone().applyQuaternion(this.designTri ? this.boneTurn(this.designTri.a) : new Quaternion());
    if (!anchor) dir.y *= 0.35;
    dir.normalize();
    const eye = center.clone().addScaledVector(dir, dist);
    if (animate) this.flyTo(eye, center);
    else this.jumpTo(eye, center);
  }

  frameAll(animate = true) {
    const h = this.heightCm / 100;
    // Aim a little below the middle so the feet clear the view buttons at the bottom.
    const target = new Vector3(0, h * 0.44, 0);
    const eye = new Vector3(0.0, h * 0.52, h * 2.55);
    if (animate) this.flyTo(eye, target);
    else {
      this.camera.position.copy(eye);
      this.controls.target.copy(target);
      this.controls.update();
      this.dirty = true;
    }
  }

  rotateTo(view: "front" | "back" | "left" | "right") {
    const t = this.controls.target.clone();
    const d = this.camera.position.distanceTo(t);
    const dir = { front: new Vector3(0, 0.12, 1), back: new Vector3(0, 0.12, -1), left: new Vector3(1, 0.12, 0), right: new Vector3(-1, 0.12, 0) }[view].normalize();
    this.flyTo(t.clone().add(dir.multiplyScalar(d)), t);
  }

  setDesignSize(widthCm: number, heightCm: number, rotationDeg = this.design.rotationDeg) {
    this.design.widthCm = widthCm;
    this.design.heightCm = heightCm;
    this.design.rotationDeg = rotationDeg;
    this.updateDesign();
  }

  clearDesign() {
    this.design.point = null;
    this.design.normal = null;
    this.designTri = null;
    this.updateDesign();
    this.refreshZoneState();
  }

  /** Put the design at the middle of the selected single-area placement. */
  placeAtCenter() {
    if (!this.body || !this.placement) return;
    const anchor = this.placementAnchor(this.placement);
    if (!anchor) return;
    // Anchors are in root space scaled to metres; the ray is cast in world space.
    this.root.updateMatrixWorld(true);
    const s = this.root.scale.x;
    const origin = this.root.localToWorld(anchor.center.clone().divideScalar(s).addScaledVector(anchor.normal, 0.5 / s));
    this.raycaster.set(origin, anchor.normal.clone().negate().transformDirection(this.root.matrixWorld));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.raycaster as any).firstHitOnly = false;
    // The ray may cross another part first (a posed forearm sits in front of the chest): take the area itself.
    const ids = new Set((PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? []).map((z) => ZONE_BY_SLUG.get(z)?.id ?? -1));
    const hits = this.raycaster.intersectObject(this.pickMesh ?? this.body, false);
    const hit = hits.find((h) => ids.has(this.zoneOf(h))) ?? hits[0];
    if (hit) this.placeFromHit(hit, true);
  }

  /** Restore a saved design position (figure space, as returned by getPlacement). */
  placeAt(point: [number, number, number], normal: [number, number, number]) {
    if (!this.body) return;
    this.design.point = new Vector3(...point);
    this.design.normal = new Vector3(...normal).normalize();
    const settled = this.settle(this.design.point, this.design.normal);
    this.designTri = settled?.tri ?? null;
    this.updateDesign();
    this.refreshZoneState();
  }

  /**
   * Move the design a step across the skin, in the direction it looks to go on
   * screen: up and down follow the camera's up, left and right its right,
   * both laid flat on the skin under the patch. It never leaves the area.
   */
  nudge(dir: "up" | "down" | "left" | "right", cm = 0.5) {
    if (!this.body || !this.design.point || !this.design.normal) return;
    const n = this.design.normal;
    const cam = new Vector3();
    if (dir === "up" || dir === "down") cam.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    else cam.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    if (dir === "down" || dir === "left") cam.negate();
    // Into the bind pose the design lives in (the limb may be turned), then flatten it onto the skin.
    this.worldDirToBind(cam);
    const along = cam.addScaledVector(n, -cam.dot(n));
    if (along.lengthSq() < 1e-8) return;
    along.normalize();
    const step = cm / 100 / this.root.scale.x;
    const settled = this.settle(this.design.point.clone().addScaledVector(along, step), n);
    if (!settled || !this.zoneAllowed(settled.zone)) return;
    this.design.point = settled.point;
    this.design.normal.lerp(settled.normal, 0.6).normalize();
    this.designTri = settled.tri;
    this.updateDesign();
    this.opts.onPlace?.(this.getPlacement());
  }

  getPlacement(): DesignPlacement {
    const round = (v: Vector3 | null, k: number) => (v ? (v.toArray().map((n) => Math.round(n * k) / k) as [number, number, number]) : null);
    return {
      body: this.bodyType,
      heightCm: this.heightCm,
      placement: this.placement,
      point: round(this.design.point, 10000),
      normal: round(this.design.normal, 1000),
      widthCm: this.design.widthCm,
      heightCmDesign: this.design.heightCm,
      rotationDeg: this.design.rotationDeg,
    };
  }

  /** PNG of the current view, for the artist's brief card. */
  snapshot(): Promise<Blob | null> {
    this.render();
    return new Promise((resolve) => this.renderer.domElement.toBlob((b) => resolve(b), "image/png"));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    this.posedGeom?.dispose();
    this.cache.forEach((g) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g as any).disposeBoundsTree?.();
      g.dispose();
    });
    this.material.matcap?.dispose();
    this.material.dispose();
    this.renderer.dispose();
    el.remove();
  }

  /* --------------------------------------------------------------- loading */

  private async loadBody(body: BodyType, first: boolean) {
    try {
      let geometry = this.cache.get(body);
      let nodeMatrix = new Matrix4();
      if (!geometry) {
        const gltf = this.opts.loadModel
          ? await this.loader.parseAsync(await this.opts.loadModel(body), "")
          : await this.loader.loadAsync(`${this.opts.assetBase}/body-${body}.glb`);
        let found: Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!found && (o as Mesh).isMesh) found = o as Mesh;
        });
        if (!found) throw new Error("Mannequin mesh missing");
        const mesh = found as Mesh;
        gltf.scene.updateMatrixWorld(true);
        nodeMatrix = mesh.matrixWorld.clone();
        const skinnedSrc = (mesh as SkinnedMesh).isSkinnedMesh ? (mesh as SkinnedMesh) : null;
        // Positions and normals arrive as quantised int16; widen them to float
        // before baking the node transform, or the metre values would overflow.
        geometry = new BufferGeometry();
        for (const name of ["position", "normal", "_zone", "skinIndex", "skinWeight"]) {
          const src = mesh.geometry.getAttribute(name);
          if (!src) continue;
          const out = new Float32Array(src.count * src.itemSize);
          for (let i = 0; i < src.count; i++) {
            for (let k = 0; k < src.itemSize; k++) out[i * src.itemSize + k] = src.getComponent(i, k);
          }
          geometry.setAttribute(name, new BufferAttribute(out, src.itemSize));
        }
        geometry.setIndex(mesh.geometry.getIndex());
        let inverses: Matrix4[] = [];
        if (skinnedSrc) {
          // A compressed skin keeps its vertices in a quantised box and undoes the box through the
          // inverse bind matrices. Bake that box back into the vertices (at rest, any bone's world
          // matrix times its inverse bind matrix is exactly the box) so the bind pose is in figure
          // space again, and take the box out of the matrices in turn.
          const sk = skinnedSrc.skeleton;
          const box = sk.bones[0].matrixWorld.clone().multiply(sk.boneInverses[0]);
          geometry.applyMatrix4(box);
          const unbox = box.clone().invert();
          inverses = sk.boneInverses.map((m) => m.clone().multiply(unbox));
        } else geometry.applyMatrix4(nodeMatrix);
        addBorderAttributes(geometry);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (geometry as any).computeBoundsTree();
        this.cache.set(body, geometry);
        if (skinnedSrc) this.rigCache.set(body, { bones: skinnedSrc.skeleton.bones, inverses });
      }
      if (this.disposed) return;
      this.unloadBody();
      const rig = this.rigCache.get(body);
      if (rig) {
        // The bones hang from the figure's root (so height and the intro turn carry them); the skinned
        // mesh sits at the scene's origin and lets the bones bring it into place.
        const bones = rig.bones.map((b) => b.clone(false));
        rig.bones.forEach((src, i) => {
          const p = src.parent;
          const pi = p ? rig.bones.indexOf(p as Bone) : -1;
          if (pi >= 0) bones[pi].add(bones[i]);
          else this.root.add(bones[i]);
        });
        this.skeleton = new Skeleton(bones, rig.inverses.map((m) => m.clone()));
        const skinned = new SkinnedMesh(geometry, this.material);
        skinned.frustumCulled = false;
        this.root.updateMatrixWorld(true);
        skinned.bind(this.skeleton, new Matrix4());
        this.scene.add(skinned);
        this.body = skinned;
        this.captureRest();
        this.bindMesh = new Mesh(geometry);
        this.bindMesh.visible = false;
        this.root.add(this.bindMesh);
        this.posedGeom = new BufferGeometry();
        // Its own copy of the index: each bounds tree sorts the triangles of the index it is built on.
        const index = geometry.getIndex()!;
        this.posedGeom.setIndex(new BufferAttribute(index.array.slice(), 1));
        this.posedGeom.setAttribute("_zone", geometry.getAttribute("_zone"));
        this.posedGeom.setAttribute("position", new BufferAttribute(new Float32Array(geometry.getAttribute("position").array), 3));
        this.posedGeom.setAttribute("normal", new BufferAttribute(new Float32Array(geometry.getAttribute("normal").array), 3));
        this.pickMesh = new Mesh(this.posedGeom);
        this.pickMesh.visible = false;
        this.root.add(this.pickMesh);
        this.refreshPosed();
        if (this.placement) this.setPose(poseFor(this.placement), false);
      } else {
        this.body = new Mesh(geometry, this.material);
        this.root.add(this.body);
      }
      void this.applyInk(body, geometry);
      this.applyScale();
      this.refreshZoneState();
      if (first) {
        this.frameAll(false);
        if (!this.opts.reducedMotion) this.intro = { start: performance.now() };
      }
      this.dirty = true;
      this.loop();
      this.opts.onReady?.();
    } catch (e) {
      this.opts.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private applyScale() {
    const s = this.heightCm / BODY_HEIGHT_CM[this.bodyType];
    this.root.scale.setScalar(s);
    this.root.updateMatrixWorld(true);
    this.updateDesign();
  }

  /* ----------------------------------------------------------- interaction */

  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (this.mode !== "place" || !this.design.point) return;
    const el = this.renderer.domElement;
    // One finger always turns the figure; a tap moves the patch; the arrows nudge
    // it. Nothing is picked up by holding, so a slow start never freezes the orbit.
    if (this.pointers.size === 2) {
      // A second finger: pinch to scale, turn to rotate. Freeze the orbit for
      // as long as any finger stays down.
      e.stopImmediatePropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      const [a, b] = [...this.pointers.values()];
      this.controls.enabled = false;
      this.gesture = {
        kind: "pinch",
        ids: [...this.pointers.keys()],
        startDist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        startAngle: Math.atan2(b.y - a.y, b.x - a.x),
        startW: this.design.widthCm,
        startH: this.design.heightCm,
        startRot: this.design.rotationDeg,
        moved: false,
      };
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }
    const g = this.gesture;
    if (g && g.ids.includes(e.pointerId)) {
      if (g.kind === "pinch") this.pinch(g);
      return;
    }
    if (e.pointerType !== "mouse" || this.downAt || this.mode !== "zone") return;
    const hit = this.pick(e);
    const zone = hit ? this.zoneOf(hit) : 0;
    if (zone !== this.hoverZone) {
      this.hoverZone = zone;
      this.renderer.domElement.style.cursor = zone ? "pointer" : "grab";
      this.refreshZoneState();
    }
  };

  private onPointerLeave = () => {
    if (this.hoverZone) {
      this.hoverZone = 0;
      this.refreshZoneState();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g && g.ids.includes(e.pointerId)) {
      // A pinch ends when either finger lifts; the remaining finger does not
      // turn into a drag, so nothing jumps.
      this.endGesture(g.moved);
      if (this.pointers.size === 0) this.controls.enabled = true;
      this.downAt = null;
      return;
    }
    if (this.pointers.size === 0) this.controls.enabled = true;
    const d = this.downAt;
    this.downAt = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 8 || performance.now() - d.t > 600) return; // that was an orbit, not a tap
    const hit = this.pick(e);
    if (!hit) return;
    if (this.mode === "zone") {
      const zone = ZONE_BY_ID.get(this.zoneOf(hit));
      if (zone) this.opts.onZoneTap?.(zone.slug);
    } else if (this.mode === "place") {
      if (this.zoneAllowed(this.zoneOf(hit))) this.placeFromHit(hit, true);
    }
  };

  private endGesture(notify: boolean) {
    const g = this.gesture;
    this.gesture = null;
    this.renderer.domElement.style.cursor = "";
    if (g && notify) this.opts.onPlace?.(this.getPlacement());
    if (this.pointers.size === 0) this.controls.enabled = true;
  }

  private zoneAllowed(zoneId: number) {
    const slug = ZONE_BY_ID.get(zoneId)?.slug;
    const allowed = this.placement ? (PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? []) : [];
    return Boolean(slug && allowed.includes(slug));
  }

  /** Project a figure-space point onto the skin along a normal. */
  private settle(point: Vector3, normal: Vector3): { point: Vector3; normal: Vector3; zone: number; tri: Tri } | null {
    if (!this.body) return null;
    this.root.updateMatrixWorld(true);
    const origin = this.root.localToWorld(point.clone().addScaledVector(normal, 0.25));
    this.raycaster.set(origin, normal.clone().negate().transformDirection(this.root.matrixWorld));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.raycaster as any).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.bindMesh ?? this.body, false)[0];
    if (!hit || !hit.face) return null;
    const p = this.toFigure(hit.point);
    const bary = this.barycentric(this.body.geometry as BufferGeometry, hit.face, p);
    return { point: p, normal: hit.face.normal.clone().normalize(), zone: this.zoneOf(hit), tri: { a: hit.face.a, b: hit.face.b, c: hit.face.c, ...bary } };
  }

  /* ---------------------------------------------------------------- posing */

  /** Rest orientation of every bone, local and relative to the figure's root, in hierarchy order. */
  private captureRest() {
    this.boneOrder = [];
    this.restLocal.clear();
    this.restWorld.clear();
    this.boneFrame.clear();
    this.poseTarget.clear();
    const walk = (o: Object3D, parentWorld: Quaternion) => {
      if ((o as Bone).isBone) {
        const b = o as Bone;
        const local = b.quaternion.clone();
        const world = parentWorld.clone().multiply(local);
        this.boneOrder.push(b);
        this.restLocal.set(b, local);
        this.restWorld.set(b, world);
        this.poseTarget.set(b, local.clone());
        // The bone runs along its local Y; the smallest turn that hangs the figure's Y down it is its frame.
        const along = new Vector3(0, 1, 0).applyQuaternion(world).normalize();
        this.boneFrame.set(b, new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), along));
        for (const c of b.children) walk(c, world);
      }
    };
    for (const c of this.root.children) walk(c, new Quaternion());
  }

  /**
   * Turn the figure into a pose: each named bone gets rotations about its own
   * anatomical axes at rest (X the hinge, Y a twist along the bone, Z toward
   * the front), carried along by its parent's turn. Unnamed bones follow their
   * parents. The drawn skin tweens there; the skin used for picking jumps ahead.
   */
  private setPose(spec: PoseSpec | null, animate: boolean) {
    if (!this.skeleton) return;
    const key = JSON.stringify(spec ?? {});
    if (key === this.poseKey) return;
    this.poseKey = key;
    const extra = new Map<Bone, Quaternion>();
    const world = new Map<Bone, Quaternion>();
    const from = new Map<Bone, Quaternion>();
    for (const b of this.boneOrder) {
      const parent = (b.parent as Bone)?.isBone ? (b.parent as Bone) : null;
      const e = parent ? extra.get(parent)!.clone() : new Quaternion();
      const steps = spec?.[b.name];
      if (steps) {
        const q = new Quaternion();
        const frame = this.boneFrame.get(b)!;
        for (const [axis, deg] of steps) {
          const v = (axis === "x" ? new Vector3(1, 0, 0) : axis === "y" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)).applyQuaternion(frame);
          q.premultiply(new Quaternion().setFromAxisAngle(v, (deg * Math.PI) / 180));
        }
        e.multiply(q);
      }
      extra.set(b, e);
      const w = e.clone().multiply(this.restWorld.get(b)!);
      world.set(b, w);
      const pw = parent ? world.get(parent)! : new Quaternion();
      from.set(b, b.quaternion.clone());
      this.poseTarget.set(b, pw.clone().invert().multiply(w));
    }
    // The picking skin takes the final pose right away, so the camera and taps aim where the limb will be.
    for (const b of this.boneOrder) b.quaternion.copy(this.poseTarget.get(b)!);
    this.refreshPosed();
    if (animate) {
      for (const b of this.boneOrder) b.quaternion.copy(from.get(b)!);
      this.poseAnim = { from, start: performance.now(), dur: 750 };
    } else this.poseAnim = null;
    this.invalidate();
  }

  /** Move the drawn skeleton one step along its tween; true while still moving. */
  private stepPose(now: number): boolean {
    const a = this.poseAnim;
    if (!a) return false;
    const t = Math.min(1, (now - a.start) / a.dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    for (const b of this.boneOrder) b.quaternion.slerpQuaternions(a.from.get(b)!, this.poseTarget.get(b)!, e);
    if (t >= 1) this.poseAnim = null;
    return t < 1;
  }

  /** Skin the bind geometry on the CPU into the posed copy used for picking and anchors. */
  private refreshPosed() {
    if (!this.skeleton || !this.posedGeom || !this.body) return;
    this.root.updateMatrixWorld(true);
    const bind = this.body.geometry as BufferGeometry;
    const pos = bind.getAttribute("position");
    const nor = bind.getAttribute("normal");
    const ji = bind.getAttribute("skinIndex");
    const jw = bind.getAttribute("skinWeight");
    const outP = this.posedGeom.getAttribute("position") as BufferAttribute;
    const outN = this.posedGeom.getAttribute("normal") as BufferAttribute;
    const rootInv = this.root.matrixWorld.clone().invert();
    const mats = this.skeleton.bones.map((b, i) => rootInv.clone().multiply(b.matrixWorld).multiply(this.skeleton!.boneInverses[i]).elements);
    const p = new Vector3();
    const n = new Vector3();
    const acc = new Vector3();
    const accN = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      acc.set(0, 0, 0);
      accN.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = jw.getComponent(i, k);
        if (w <= 0) continue;
        const m = mats[ji.getComponent(i, k)];
        acc.x += w * (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]);
        acc.y += w * (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]);
        acc.z += w * (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]);
        accN.x += w * (m[0] * n.x + m[4] * n.y + m[8] * n.z);
        accN.y += w * (m[1] * n.x + m[5] * n.y + m[9] * n.z);
        accN.z += w * (m[2] * n.x + m[6] * n.y + m[10] * n.z);
      }
      outP.setXYZ(i, acc.x, acc.y, acc.z);
      accN.normalize();
      outN.setXYZ(i, accN.x, accN.y, accN.z);
    }
    outP.needsUpdate = true;
    outN.needsUpdate = true;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (this.posedGeom as any).disposeBoundsTree?.();
    (this.posedGeom as any).computeBoundsTree();
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  /** The skin used for anchors and visibility: posed when there is a skeleton, the body itself otherwise. */
  private skinGeometry(): BufferGeometry | null {
    return this.posedGeom ?? ((this.body?.geometry as BufferGeometry) ?? null);
  }

  /** Where a bind-space point is on the posed skin, in root space: through the triangle it sits on. */
  private posedPoint(bind: Vector3): Vector3 {
    const tri = this.designTri;
    if (!this.posedGeom || !tri) return bind.clone();
    const pos = this.posedGeom.getAttribute("position");
    const bindPos = (this.body!.geometry as BufferGeometry).getAttribute("position");
    const out = new Vector3();
    const v = new Vector3();
    for (const [idx, w] of [[tri.a, tri.u], [tri.b, tri.v], [tri.c, tri.w]] as const) out.addScaledVector(v.fromBufferAttribute(pos, idx), w);
    // Plus the offset the point had from the triangle, carried by the dominant bone's turn.
    const off = bind.clone().sub(v.set(0, 0, 0).addScaledVector(new Vector3().fromBufferAttribute(bindPos, tri.a), tri.u).addScaledVector(new Vector3().fromBufferAttribute(bindPos, tri.b), tri.v).addScaledVector(new Vector3().fromBufferAttribute(bindPos, tri.c), tri.w));
    return out.add(off.applyQuaternion(this.boneTurn(tri.a)));
  }

  /** The turn the skin took at a vertex: its heaviest bone's current rotation over its rest. */
  private boneTurn(vertex: number): Quaternion {
    if (!this.skeleton || !this.body) return new Quaternion();
    const g = this.body.geometry as BufferGeometry;
    const ji = g.getAttribute("skinIndex");
    const jw = g.getAttribute("skinWeight");
    let best = 0;
    let bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = jw.getComponent(vertex, k);
      if (w > bw) {
        bw = w;
        best = ji.getComponent(vertex, k);
      }
    }
    const bone = this.skeleton.bones[best];
    const rootInv = this.root.matrixWorld.clone().invert();
    const m = rootInv.multiply(bone.matrixWorld).multiply(this.skeleton.boneInverses[best]);
    return new Quaternion().setFromRotationMatrix(m);
  }

  /** A world direction, as the design (bind space) sees it: undo the root and the limb's turn at the design. */
  private worldDirToBind(dir: Vector3) {
    dir.transformDirection(this.root.matrixWorld.clone().invert());
    if (this.designTri) dir.applyQuaternion(this.boneTurn(this.designTri.a).invert());
    return dir;
  }

  /** Barycentric weights of a point (figure space) in a triangle of a geometry. */
  private barycentric(geom: BufferGeometry, face: { a: number; b: number; c: number }, p: Vector3) {
    const pos = geom.getAttribute("position");
    const A = new Vector3().fromBufferAttribute(pos, face.a);
    const B = new Vector3().fromBufferAttribute(pos, face.b);
    const C = new Vector3().fromBufferAttribute(pos, face.c);
    const v0 = B.clone().sub(A);
    const v1 = C.clone().sub(A);
    const v2 = p.clone().sub(A);
    const d00 = v0.dot(v0), d01 = v0.dot(v1), d11 = v1.dot(v1), d20 = v2.dot(v0), d21 = v2.dot(v1);
    const den = d00 * d11 - d01 * d01 || 1e-12;
    const v = (d11 * d20 - d01 * d21) / den;
    const w = (d00 * d21 - d01 * d20) / den;
    return { u: 1 - v - w, v, w };
  }

  /** A hit on the posed skin, carried back to the bind pose the design lives in. */
  private hitToBind(hit: Intersection): { point: Vector3; normal: Vector3; tri: Tri } {
    const face = hit.face!;
    const bind = this.body!.geometry as BufferGeometry;
    if (!this.posedGeom) {
      const p = this.toFigure(hit.point);
      return { point: p, normal: face.normal.clone().normalize(), tri: { a: face.a, b: face.b, c: face.c, ...this.barycentric(bind, face, p) } };
    }
    const local = this.root.worldToLocal(hit.point.clone());
    const bary = this.barycentric(this.posedGeom, face, local);
    const pos = bind.getAttribute("position");
    const A = new Vector3().fromBufferAttribute(pos, face.a);
    const B = new Vector3().fromBufferAttribute(pos, face.b);
    const C = new Vector3().fromBufferAttribute(pos, face.c);
    const point = A.clone().multiplyScalar(bary.u).addScaledVector(B, bary.v).addScaledVector(C, bary.w);
    const normal = new Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A)).normalize();
    return { point, normal, tri: { a: face.a, b: face.b, c: face.c, ...bary } };
  }

  /** Take the current body (and its bones) out of the scene before another arrives. */
  private unloadBody() {
    if (this.body) (this.body.parent ?? this.root).remove(this.body);
    if (this.pickMesh) this.root.remove(this.pickMesh);
    if (this.bindMesh) this.root.remove(this.bindMesh);
    for (const b of [...this.root.children]) if ((b as Bone).isBone) this.root.remove(b);
    this.posedGeom?.dispose();
    this.posedGeom = null;
    this.pickMesh = null;
    this.bindMesh = null;
    this.skeleton = null;
    this.boneOrder = [];
    this.poseAnim = null;
    this.poseKey = "";
  }

  private pinch(g: Gesture) {
    const pts = g.ids.map((id) => this.pointers.get(id)).filter(Boolean) as { x: number; y: number }[];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const scale = dist / (g.startDist ?? dist);
    const max = this.placement ? maxSizeFor(this.placement) : 40;
    const long = Math.max(g.startW ?? 10, g.startH ?? 10);
    const k = Math.min(max / long, Math.max(MIN_DESIGN_CM / long, scale));
    this.design.widthCm = (g.startW ?? 10) * k;
    this.design.heightCm = (g.startH ?? 10) * k;
    let rot = (g.startRot ?? 0) + ((angle - (g.startAngle ?? angle)) * 180) / Math.PI;
    rot = ((rot + 180) % 360) - 180;
    this.design.rotationDeg = Math.max(-90, Math.min(90, rot));
    g.moved = true;
    this.updateDesign();
  }

  private pick(e: PointerEvent): Intersection | null {
    if (!this.body) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.raycaster as any).firstHitOnly = true;
    return this.raycaster.intersectObject(this.pickMesh ?? this.body, false)[0] ?? null;
  }

  private zoneOf(hit: Intersection): number {
    const attr = (this.body!.geometry as BufferGeometry).getAttribute("_zone");
    if (!attr || !hit.face) return 0;
    return Math.round(attr.getX(hit.face.a));
  }

  private toFigure(world: Vector3): Vector3 {
    this.root.updateMatrixWorld(true);
    return this.root.worldToLocal(world.clone());
  }

  private placeFromHit(hit: Intersection, notify: boolean) {
    if (!hit.face) return;
    // Design state lives in figure space (the body's own metres, bind pose), so it
    // survives the intro turn, camera moves, rescaling of the root and the poses.
    const b = this.hitToBind(hit);
    this.design.point = b.point;
    this.design.normal = b.normal;
    this.designTri = b.tri;
    this.updateDesign();
    this.refreshZoneState();
    if (notify) this.opts.onPlace?.(this.getPlacement());
  }

  /* ---------------------------------------------------------------- design */

  /** Recompute the patch's tangent frame and push it to the shader. */
  private updateDesign() {
    const p = this.design.point;
    const n = this.design.normal;
    if (!this.body || !p || !n) {
      if (this.uniforms) this.uniforms.uDesignOn.value = 0;
      this.invalidate();
      return;
    }
    // Real centimetres in figure units: the root's scale turns them back into true size.
    const s = this.root.scale.x;
    const w = this.design.widthCm / 100 / s;
    const h = this.design.heightCm / 100 / s;
    const zoneSlug = this.placement ?? "";
    const limb = ZONE_BY_SLUG.get(zoneSlug)?.limb ?? false;
    // The facing test keeps the patch off the far side of a limb; depth only has to cover the
    // curvature of the area itself, not reach a neighbouring limb.
    const depth = limb ? Math.min(0.06, 0.03 + Math.max(w, h) * 0.3) : Math.min(0.11, 0.04 + Math.max(w, h) * 0.3);

    // Orient the frame upright along the body (along the limb on arms and legs),
    // then apply the client's rotation.
    const up = limb ? (this.placementAnchor(zoneSlug, "bind")?.axis ?? new Vector3(0, 1, 0)) : new Vector3(0, 1, 0);
    let tangentY = up.clone().sub(n.clone().multiplyScalar(up.dot(n)));
    if (tangentY.lengthSq() < 1e-4) tangentY = new Vector3(0, 0, 1).sub(n.clone().multiplyScalar(n.z));
    tangentY.normalize();
    const tangentX = new Vector3().crossVectors(tangentY, n).normalize();
    const a = (this.design.rotationDeg * Math.PI) / 180;
    const rx = tangentX.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangentY, Math.sin(a));
    const ry = tangentY.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangentX, -Math.sin(a));
    this.frame = { x: rx, y: ry, n: n.clone(), halfW: w / 2, halfH: h / 2 };
    this.designMask.fill(0);
    for (const id of patchZoneIds(zoneSlug)) this.designMask[id] = 1;
    this.designColor.copy(srgb(PAIN_COLORS[painFor(zoneSlug)]));
    this.syncDesignUniforms(depth);
    this.invalidate();
  }

  private syncDesignUniforms(depth?: number) {
    const u = this.uniforms;
    if (!u) return;
    const on = Boolean(this.design.point && this.design.normal);
    u.uDesignOn.value = on ? 1 : 0;
    if (!on) return;
    (u.uDesignCenter.value as Vector3).copy(this.design.point!);
    (u.uDesignX.value as Vector3).copy(this.frame.x);
    (u.uDesignY.value as Vector3).copy(this.frame.y);
    (u.uDesignN.value as Vector3).copy(this.frame.n);
    (u.uDesignHalf.value as Vector2).set(this.frame.halfW, this.frame.halfH);
    if (depth !== undefined) u.uDesignDepth.value = depth;
  }

  /* ---------------------------------------------------------------- render */

  /**
   * Centre, facing, main axis and a sample of points of a placement, measured on
   * the skin as posed (for the camera) or in the bind pose (for the design).
   */
  private placementAnchor(slug: string, space: "posed" | "bind" = "posed") {
    if (!this.body) return null;
    const placement = PLACEMENT_BY_SLUG.get(slug);
    if (!placement) return null;
    const ids = new Set(placement.zones.map((z) => ZONE_BY_SLUG.get(z)?.id ?? -1));
    const geom = space === "bind" ? (this.body.geometry as BufferGeometry) : this.skinGeometry()!;
    const zone = geom.getAttribute("_zone");
    const pos = geom.getAttribute("position");
    const nor = geom.getAttribute("normal");
    const center = new Vector3();
    const normal = new Vector3();
    const box = new Box3();
    const v = new Vector3();
    let count = 0;
    const members: number[] = [];
    for (let i = 0; i < zone.count; i++) {
      if (!ids.has(Math.round(zone.getX(i)))) continue;
      v.fromBufferAttribute(pos, i);
      center.add(v);
      box.expandByPoint(v);
      normal.x += nor.getX(i);
      normal.y += nor.getY(i);
      normal.z += nor.getZ(i);
      members.push(i);
      count++;
    }
    if (!count) return null;
    const step = Math.max(1, Math.floor(members.length / 48));
    const samples: Vector3[] = [];
    for (let k = 0; k < members.length; k += step) {
      const i = members[k];
      // Nudged off the skin along its normal so the visibility ray can reach it.
      samples.push(new Vector3().fromBufferAttribute(pos, i).addScaledVector(new Vector3(nor.getX(i), nor.getY(i), nor.getZ(i)), 0.002));
    }
    const s = this.root.scale.x;
    center.divideScalar(count).multiplyScalar(s);
    normal.y *= 0.3;
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
    normal.normalize();
    const size = new Vector3();
    box.getSize(size);
    // Principal axis of the zone: limbs get a frame that follows the arm or leg.
    const local = center.clone().divideScalar(s);
    let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0;
    for (let i = 0; i < zone.count; i++) {
      if (!ids.has(Math.round(zone.getX(i)))) continue;
      v.fromBufferAttribute(pos, i).sub(local);
      cxx += v.x * v.x; cxy += v.x * v.y; cxz += v.x * v.z;
      cyy += v.y * v.y; cyz += v.y * v.z; czz += v.z * v.z;
    }
    const axis = new Vector3(0, 1, 0);
    for (let k = 0; k < 12; k++) {
      axis.set(cxx * axis.x + cxy * axis.y + cxz * axis.z, cxy * axis.x + cyy * axis.y + cyz * axis.z, cxz * axis.x + cyz * axis.y + czz * axis.z).normalize();
    }
    if (axis.y < 0) axis.negate();
    return { center, normal, axis, samples, radius: (size.length() * s) / 2 };
  }

  private refreshZoneState() {
    this.zoneState.fill(0);
    const selected = this.placement ? (PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? []) : [];
    const selectedIds = selected.map((s) => ZONE_BY_SLUG.get(s)?.id ?? 0);
    const placing = this.mode === "place" && selectedIds.length > 0;
    if (placing) {
      for (let i = 1; i < MAX_ZONES; i++) this.zoneState[i] = ST_DIM;
    }
    if (this.hoverZone) this.zoneState[this.hoverZone] = ST_HOVER;
    // Under a design the area is a soft wash so the patch stays the subject.
    const withDesign = this.mode !== "zone" && Boolean(this.design.point);
    for (const id of selectedIds) this.zoneState[id] = placing || withDesign ? ST_ACTIVE : ST_SELECTED;
    this.invalidate();
  }

  private flyTo(eye: Vector3, target: Vector3) {
    if (this.opts.reducedMotion) {
      this.camera.position.copy(eye);
      this.controls.target.copy(target);
      this.controls.update();
      this.dirty = true;
      return;
    }
    this.flight = {
      from: [this.camera.position.clone(), this.controls.target.clone()],
      to: [eye, target],
      start: performance.now(),
      dur: 850,
    };
    this.loop();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    // Keep the whole figure in view on narrow portrait screens.
    this.camera.fov = w / h < 0.75 ? 34 : 28;
    this.camera.updateProjectionMatrix();
    // setSize clears the drawing buffer: draw again at once so a viewport change
    // (the phone's address bar sliding away) never shows an empty frame.
    if (this.body) this.render();
    this.dirty = true;
    this.loop();
  }

  private loop = () => {
    cancelAnimationFrame(this.frameId);
    // Off screen, a change still gets one frame (so the canvas is never stale when it returns); animation waits.
    if (this.disposed || (!this.visible && !this.dirty)) return;
    this.frameId = requestAnimationFrame(() => {
      const now = performance.now();
      let animating = false;
      if (this.flight) {
        const t = Math.min(1, (now - this.flight.start) / this.flight.dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(this.flight.from[0], this.flight.to[0], e);
        this.controls.target.lerpVectors(this.flight.from[1], this.flight.to[1], e);
        if (t >= 1) this.flight = null;
        animating = true;
        this.dirty = true;
      }
      if (this.intro) {
        // One slow quarter turn when the statue first appears.
        const t = Math.min(1, (now - this.intro.start) / 2200);
        const e = 1 - Math.pow(1 - t, 3);
        this.root.rotation.y = (1 - e) * -0.9;
        if (t >= 1) this.intro = null;
        animating = true;
        this.dirty = true;
      }
      if (this.stepPose(now)) {
        animating = true;
        this.dirty = true;
      }
      const damping = this.controls.update();
      const pulsing = this.zoneState.some((s) => s === ST_SELECTED) || (this.mode === "place" && Boolean(this.design.point));
      if (this.uniforms) this.uniforms.uTime.value = (now - this.startTime) / 1000;
      if (this.dirty || pulsing) this.render();
      this.dirty = false;
      if ((animating || damping || pulsing) && this.visible) this.loop();
    });
  };

  /** Something changed: draw a frame (the loop idles between changes). */
  private invalidate() {
    this.dirty = true;
    this.loop();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }
}
