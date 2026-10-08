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
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshMatcapMaterial,
  PerspectiveCamera,
  Ray,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry as BG,
  type Intersection,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree, type MeshBVH } from "three-mesh-bvh";

import { BODY_HEIGHT_CM, MIN_DESIGN_CM, PAIN_COLORS, PLACEMENT_BY_SLUG, ZONES, ZONE_BY_ID, ZONE_BY_SLUG, maxSizeFor, patchZoneIds, type BodyType } from "./catalog";

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
uniform float uDesignMask[${MAX_ZONES}];
uniform vec3 uAccent;
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
// Cast wax: ivory with a warm bone drift over a hand's width, and a fine
// even grain like a matte surface, never lines.
vec3 wax(vec3 p) {
  float drift = wNoise(p * 7.0) * 0.6 + wNoise(p * 19.0) * 0.4;
  float fine = (wNoise(p * 260.0) - 0.5) * 0.045 + (wNoise(p * 90.0) - 0.5) * 0.03;
  vec3 ivory = vec3(0.955, 0.915, 0.835);
  vec3 bone = vec3(0.90, 0.835, 0.72);
  return mix(ivory, bone, drift * 0.8) + fine;
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
      const shade = 0.2 + diffuse * 0.8;
      // Shadows go warm and a little rosy (light scattered inside the wax), the light stays neutral.
      const warmth = 1 - diffuse;
      const r = shade + warmFill * 1.08 + rim * 1.0 + sheen;
      const g = shade * (1 - 0.06 * warmth) + warmFill * 0.94 + rim * 0.82 + sheen;
      const b = shade * (1 - 0.16 * warmth) + warmFill * 0.76 + rim * 0.6 + sheen;
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
  kind: "drag" | "pinch";
  ids: number[];
  /** Last hit point in figure space while dragging. */
  last?: Vector3;
  startDist?: number;
  startAngle?: number;
  startW?: number;
  startH?: number;
  startRot?: number;
  moved: boolean;
}

export class MannequinEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(28, 1, 0.05, 30);
  private controls: OrbitControls;
  private root = new Group();
  private body: Mesh | null = null;
  private bodyType: BodyType;
  private heightCm: number;
  private material: MeshMatcapMaterial;
  private zoneState = new Float32Array(MAX_ZONES);
  private zoneColor: Vector3[] = [];
  /** 1 for the zones a design may spread over (its placement's body region). */
  private designMask = new Float32Array(MAX_ZONES);
  private hoverZone = 0;
  private mode: ViewerMode = "view";
  private placement: string | null = null;
  private design = { point: null as Vector3 | null, normal: null as Vector3 | null, widthCm: 10, heightCm: 10, rotationDeg: 0 };
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
      shader.uniforms.uDesignMask = { value: this.designMask };
      shader.uniforms.uAccent = { value: srgb(this.accent) };
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
  // 1 = hover, 2 = selected (pulses gently), 3 = dimmed (other zones while placing), 4 = the area under a design
  float hover = step(0.5, st) * step(st, 1.5);
  float sel = step(1.5, st) * step(st, 2.5);
  float dim = step(2.5, st) * step(st, 3.5);
  float area = step(3.5, st);
  float pulse = 0.86 + 0.14 * sin(uTime * 2.2);
  // Zone borders are feathered: the tint eases in over the first centimetres
  // from a border, but only where the zone across it is drawn differently, so
  // two dimmed zones never show a seam.
  float feather = smoothstep(0.0, 1.0, vEdge);
  float wash = mix(0.12 + 0.88 * feather, 1.0, step(abs(st - so), 0.5));
  // Cast wax: the matcap carries the light, the wax function the colour.
  gl_FragColor.rgb = wax(vObj) * gl_FragColor.rgb * 1.12;
  float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  // The pain colour is laid on like paint: it keeps the wax's shading.
  vec3 paint = zc * (0.5 + lum * 0.62);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, paint, (hover * 0.45 + sel * 0.84 * pulse + area * 0.4) * wash);
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
    vec3 ink = vec3(0.13, 0.11, 0.105) * (0.75 + lum * 0.5);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, ink, inside * (0.22 + 0.34 * soft) * mask);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uAccent, line * mask);
    // A small cross at the centre, so the middle reads even on a tiny patch.
    float mark = (1.0 - smoothstep(lineW * 0.5, lineW * 1.2, min(abs(uv.x), abs(uv.y)))) * (1.0 - smoothstep(0.006, 0.0085, max(abs(uv.x), abs(uv.y))));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uAccent, mark * mask * 0.9);
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
    const dir = this.clearestView(target, dist);
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
    const geom = this.body!.geometry as BufferGeometry;
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
    const center = this.design.point.clone().multiplyScalar(s);
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const half = Math.tan(Math.min(vfov, hfov) / 2);
    const size = Math.max(this.design.widthCm, this.design.heightCm) / 100;
    const dist = Math.max(0.45 / half, (size / half) * 1.6);
    const dir = this.design.normal.clone();
    dir.y *= 0.35;
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
    this.updateDesign();
    this.refreshZoneState();
  }

  /** Put the design at the middle of the selected single-area placement. */
  placeAtCenter() {
    if (!this.body || !this.placement) return;
    const anchor = this.placementAnchor(this.placement);
    if (!anchor) return;
    const origin = anchor.center.clone().add(anchor.normal.clone().multiplyScalar(0.5));
    this.raycaster.set(origin, anchor.normal.clone().negate());
    const hit = this.raycaster.intersectObject(this.body, false)[0];
    if (hit) this.placeFromHit(hit, true);
  }

  /** Restore a saved design position (figure space, as returned by getPlacement). */
  placeAt(point: [number, number, number], normal: [number, number, number]) {
    if (!this.body) return;
    this.design.point = new Vector3(...point);
    this.design.normal = new Vector3(...normal).normalize();
    this.updateDesign();
    this.refreshZoneState();
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
        // Positions and normals arrive as quantised int16; widen them to float
        // before baking the node transform, or the metre values would overflow.
        geometry = new BufferGeometry();
        for (const name of ["position", "normal", "_zone"]) {
          const src = mesh.geometry.getAttribute(name);
          if (!src) continue;
          const out = new Float32Array(src.count * src.itemSize);
          for (let i = 0; i < src.count; i++) {
            for (let k = 0; k < src.itemSize; k++) out[i * src.itemSize + k] = src.getComponent(i, k);
          }
          geometry.setAttribute(name, new BufferAttribute(out, src.itemSize));
        }
        geometry.setIndex(mesh.geometry.getIndex());
        geometry.applyMatrix4(nodeMatrix);
        addBorderAttributes(geometry);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (geometry as any).computeBoundsTree();
        this.cache.set(body, geometry);
      }
      if (this.disposed) return;
      if (this.body) this.root.remove(this.body);
      this.body = new Mesh(geometry, this.material);
      this.root.add(this.body);
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
    if (this.pointers.size === 1) {
      const hit = this.pick(e);
      if (hit && this.onPatch(hit)) {
        // Grab the patch: the orbit never starts.
        e.stopImmediatePropagation();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
        this.gesture = { kind: "drag", ids: [e.pointerId], last: this.toFigure(hit.point), moved: false };
        el.style.cursor = "grabbing";
      }
    } else if (this.pointers.size === 2) {
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
      if (g.kind === "drag") this.dragTo(e, g);
      else this.pinch(g);
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

  /** Is this hit on the design patch (with a finger's margin), facing it? */
  private onPatch(hit: Intersection): boolean {
    if (!this.design.point || !hit.face) return false;
    const p = this.toFigure(hit.point).sub(this.design.point);
    const margin = 0.015 / this.root.scale.x;
    const u = Math.abs(p.dot(this.frame.x));
    const v = Math.abs(p.dot(this.frame.y));
    return u < this.frame.halfW + margin && v < this.frame.halfH + margin && hit.face.normal.dot(this.frame.n) > 0;
  }

  private dragTo(e: PointerEvent, g: Gesture) {
    const hit = this.pick(e);
    if (!hit || !hit.face || !g.last) return;
    const here = this.toFigure(hit.point);
    const delta = here.clone().sub(g.last);
    g.last = here;
    if (delta.lengthSq() < 1e-10) return;
    // Slide the centre by the finger's travel over the skin, then settle it
    // back onto the surface along the patch's normal. If it would leave the
    // chosen area, it stays put.
    if (!this.design.point || !this.design.normal) return;
    const next = this.design.point.clone().add(delta);
    const settled = this.settle(next, this.design.normal);
    if (!settled || !this.zoneAllowed(settled.zone)) return;
    this.design.point = settled.point;
    this.design.normal.lerp(settled.normal, 0.6).normalize();
    g.moved = true;
    this.updateDesign();
  }

  /** Project a figure-space point onto the skin along a normal. */
  private settle(point: Vector3, normal: Vector3): { point: Vector3; normal: Vector3; zone: number } | null {
    if (!this.body) return null;
    this.root.updateMatrixWorld(true);
    const origin = this.root.localToWorld(point.clone().addScaledVector(normal, 0.25));
    this.raycaster.set(origin, normal.clone().negate().transformDirection(this.root.matrixWorld));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.raycaster as any).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.body, false)[0];
    if (!hit || !hit.face) return null;
    return { point: this.toFigure(hit.point), normal: hit.face.normal.clone().normalize(), zone: this.zoneOf(hit) };
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
    return this.raycaster.intersectObject(this.body, false)[0] ?? null;
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
    // Design state lives in figure space (the body's own metres), so it survives
    // the intro turn, camera moves and rescaling of the root.
    this.design.point = this.toFigure(hit.point);
    this.design.normal = hit.face.normal.clone().normalize();
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
    const up = limb ? (this.placementAnchor(zoneSlug)?.axis ?? new Vector3(0, 1, 0)) : new Vector3(0, 1, 0);
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

  private placementAnchor(slug: string) {
    if (!this.body) return null;
    const placement = PLACEMENT_BY_SLUG.get(slug);
    if (!placement) return null;
    const ids = new Set(placement.zones.map((z) => ZONE_BY_SLUG.get(z)?.id ?? -1));
    const geom = this.body.geometry as BufferGeometry;
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
      const damping = this.controls.update();
      const pulsing = this.zoneState.some((s) => s === ST_SELECTED);
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
