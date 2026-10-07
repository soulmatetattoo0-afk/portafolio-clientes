/**
 * Framework-agnostic three.js viewer for the statue mannequin.
 *
 * The body is one mesh whose vertices carry a `_zone` id. Highlighting is a
 * shader tint driven by a per-zone uniform array, so selecting a sleeve
 * (four zones) costs nothing. The design preview is a decal sized in real
 * centimetres: the whole figure is scaled to the client's height, so 1 world
 * unit stays 1 metre.
 */

import {
  ACESFilmicToneMapping,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshMatcapMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry as BG,
  type Intersection,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree, type MeshBVH } from "three-mesh-bvh";

import { BODY_HEIGHT_CM, PLACEMENT_BY_SLUG, ZONE_BY_ID, ZONE_BY_SLUG, type BodyType } from "./catalog";

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
  onZoneTap?: (zoneSlug: string) => void;
  onPlace?: (placement: DesignPlacement) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const MAX_ZONES = 32;
const GOLD = new Color("#c9a35f");

const vertexPatch = /* glsl */ `
attribute float _zone;
varying float vZone;
`;
const fragmentPatch = /* glsl */ `
uniform float uZoneState[${MAX_ZONES}];
uniform vec3 uGold;
uniform float uTime;
varying float vZone;
`;

function makeMatcap(): CanvasTexture {
  // Patinated bronze lit from above, with a warm gilt rim: the statue look.
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const key = new Vector3(-0.45, 0.65, 0.62).normalize();
  const fill = new Vector3(0.6, -0.1, 0.8).normalize();
  const rim = new Vector3(0.7, 0.35, -0.6).normalize();
  const base = new Color("#3a332c");
  const lit = new Color("#a89580");
  const gilt = new Color("#d9b678");
  const n = new Vector3();
  const c = new Color();
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
      const diffuse = Math.max(n.dot(key), 0);
      const soft = Math.max(n.dot(fill), 0) * 0.25;
      const fresnel = Math.pow(1 - n.z, 2.6);
      const spec = Math.pow(Math.max(n.dot(new Vector3().copy(key).add(new Vector3(0, 0, 1)).normalize()), 0), 28) * 0.35;
      const rimAmt = Math.max(n.dot(rim) * 0.5 + 0.5, 0) * fresnel;
      c.copy(base).lerp(lit, Math.min(diffuse * 0.85 + soft, 1));
      c.r += spec + gilt.r * rimAmt * 0.9;
      c.g += spec + gilt.g * rimAmt * 0.9;
      c.b += spec + gilt.b * rimAmt * 0.9;
      img.data[i] = Math.min(255, c.r * 255);
      img.data[i + 1] = Math.min(255, c.g * 255);
      img.data[i + 2] = Math.min(255, c.b * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeDecalTexture(): CanvasTexture {
  // A gilt frame with corner ticks: reads as "the design goes here", not as a fake tattoo.
  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = "rgba(201,163,95,0.16)";
  ctx.fillRect(8, 8, s - 16, s - 16);
  ctx.strokeStyle = "rgba(233,207,150,0.95)";
  ctx.lineWidth = 10;
  ctx.setLineDash([26, 18]);
  ctx.strokeRect(14, 14, s - 28, s - 28);
  ctx.setLineDash([]);
  ctx.lineWidth = 16;
  const t = 70;
  for (const [x, y, dx, dy] of [
    [10, 10, 1, 1],
    [s - 10, 10, -1, 1],
    [10, s - 10, 1, -1],
    [s - 10, s - 10, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * t);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * t, y);
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(s / 2 - 34, s / 2);
  ctx.lineTo(s / 2 + 34, s / 2);
  ctx.moveTo(s / 2, s / 2 - 34);
  ctx.lineTo(s / 2, s / 2 + 34);
  ctx.stroke();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
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
  private hoverZone = 0;
  private decal: Mesh | null = null;
  private decalTex: CanvasTexture;
  private mode: ViewerMode = "view";
  private placement: string | null = null;
  private design = { point: null as Vector3 | null, normal: null as Vector3 | null, widthCm: 10, heightCm: 10, rotationDeg: 0 };
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private downAt: { x: number; y: number; t: number } | null = null;
  private frame = 0;
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

  constructor(
    private container: HTMLElement,
    private opts: EngineOptions,
  ) {
    this.bodyType = opts.body;
    this.heightCm = opts.heightCm ?? BODY_HEIGHT_CM[opts.body];
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);

    this.material = new MeshMatcapMaterial({ matcap: makeMatcap() });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uZoneState = { value: this.zoneState };
      shader.uniforms.uGold = { value: GOLD };
      shader.uniforms.uTime = { value: 0 };
      this.material.userData.shader = shader;
      shader.vertexShader = vertexPatch + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vZone = _zone;");
      shader.fragmentShader =
        fragmentPatch +
        shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          /* glsl */ `#include <dithering_fragment>
  int zi = int(vZone + 0.5);
  float st = 0.0;
  for (int k = 0; k < ${MAX_ZONES}; k++) { if (k == zi) st = uZoneState[k]; }
  // 1 = hover, 2 = selected (pulses gently), 3 = dimmed (other zones while placing)
  float hover = step(0.5, st) * step(st, 1.5);
  float sel = step(1.5, st) * step(st, 2.5);
  float dim = step(2.5, st);
  float pulse = 0.82 + 0.18 * sin(uTime * 2.2);
  vec3 lum = vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uGold * (0.75 + lum * 1.5), hover * 0.4 + sel * 0.78 * pulse);
  gl_FragColor.rgb *= 1.0 - dim * 0.35;`,
        );
    };

    this.decalTex = makeDecalTexture();
    this.scene.add(this.root);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
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

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
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
    const { center, normal, radius } = target;
    // Fit the zone's bounding sphere inside the narrower of the two FOVs.
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = Math.max(0.75, (radius / Math.tan(Math.min(vfov, hfov) / 2)) * 1.3);
    const eye = center.clone().add(normal.clone().multiplyScalar(dist));
    eye.y += radius * 0.3;
    if (animate) this.flyTo(eye, center);
    else this.jumpTo(eye, center);
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
    if (this.mode !== "place") {
      const ids = (PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? []).map((z) => ZONE_BY_SLUG.get(z)?.id ?? 0);
      this.zoneState.fill(0);
      for (const id of ids) this.zoneState[id] = 2;
    }
    this.focusPlacement(this.placement, false);
    const shader = this.material.userData.shader;
    if (shader) shader.uniforms.uTime.value = 0;
    const blob = await this.snapshot();
    this.zoneState.set(zoneState);
    this.jumpTo(eye, target);
    return blob;
  }

  frameAll(animate = true) {
    const h = this.heightCm / 100;
    const target = new Vector3(0, h * 0.55, 0);
    const eye = new Vector3(0.0, h * 0.62, h * 2.25);
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
    this.rebuildDecal();
  }

  clearDesign() {
    this.design.point = null;
    this.design.normal = null;
    this.removeDecal();
  }

  /** Put the design at the middle of the selected single-area placement. */
  placeAtCenter() {
    if (!this.body || !this.placement) return;
    const anchor = this.placementAnchor(this.placement);
    if (!anchor) return;
    const origin = anchor.center.clone().add(anchor.normal.clone().multiplyScalar(0.5));
    this.raycaster.set(origin, anchor.normal.clone().negate());
    const hit = this.raycaster.intersectObject(this.body, false)[0];
    if (hit) this.placeFromHit(hit);
  }

  /** Restore a saved design position (figure space, as returned by getPlacement). */
  placeAt(point: [number, number, number], normal: [number, number, number]) {
    if (!this.body) return;
    this.root.updateMatrixWorld(true);
    this.design.point = this.root.localToWorld(new Vector3(...point));
    this.design.normal = new Vector3(...normal).applyQuaternion(this.root.quaternion).normalize();
    this.rebuildDecal();
  }

  getPlacement(): DesignPlacement {
    this.root.updateMatrixWorld(true);
    const inv = this.root.quaternion.clone().invert();
    const round = (v: Vector3, k: number) => v.toArray().map((n) => Math.round(n * k) / k) as [number, number, number];
    const toFigure = (v: Vector3 | null) => (v ? round(this.root.worldToLocal(v.clone()), 10000) : null);
    return {
      body: this.bodyType,
      heightCm: this.heightCm,
      placement: this.placement,
      point: toFigure(this.design.point),
      normal: this.design.normal ? round(this.design.normal.clone().applyQuaternion(inv), 1000) : null,
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
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    this.removeDecal();
    this.cache.forEach((g) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g as any).disposeBoundsTree?.();
      g.dispose();
    });
    this.material.matcap?.dispose();
    this.material.dispose();
    this.decalTex.dispose();
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
    this.dirty = true;
  }

  /* ----------------------------------------------------------- interaction */

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onPointerMove = (e: PointerEvent) => {
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
      const zoneSlug = ZONE_BY_ID.get(this.zoneOf(hit))?.slug;
      const allowed = this.placement ? PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? [] : [];
      if (zoneSlug && allowed.includes(zoneSlug)) this.placeFromHit(hit);
    }
  };

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

  private placeFromHit(hit: Intersection) {
    if (!hit.face) return;
    const n = hit.face.normal.clone().transformDirection(this.body!.matrixWorld);
    this.design.point = hit.point.clone();
    this.design.normal = n;
    this.rebuildDecal();
    this.opts.onPlace?.(this.getPlacement());
  }

  /* ----------------------------------------------------------------- decal */

  private removeDecal() {
    if (this.decal) {
      this.scene.remove(this.decal);
      this.decal.geometry.dispose();
      (this.decal.material as MeshMatcapMaterial).dispose();
      this.decal = null;
      this.dirty = true;
    }
  }

  private rebuildDecal() {
    if (!this.body || !this.design.point || !this.design.normal) return;
    this.removeDecal();
    const p = this.design.point;
    const n = this.design.normal;
    const w = this.design.widthCm / 100;
    const h = this.design.heightCm / 100;
    const zoneSlug = this.placement ?? "";
    const limb = ZONE_BY_SLUG.get(zoneSlug)?.limb ?? false;
    const depth = limb ? Math.min(0.07, Math.max(w, h) * 0.6 + 0.02) : Math.min(0.16, Math.max(w, h) * 0.7 + 0.03);

    // Orient the frame upright along the body (along the limb on arms and legs),
    // then apply the client's rotation.
    const up = limb ? (this.placementAnchor(zoneSlug)?.axis ?? new Vector3(0, 1, 0)) : new Vector3(0, 1, 0);
    let tangentY = up.clone().sub(n.clone().multiplyScalar(up.dot(n)));
    if (tangentY.lengthSq() < 1e-4) tangentY = new Vector3(0, 0, 1);
    tangentY.normalize();
    const tangentX = new Vector3().crossVectors(tangentY, n).normalize();
    const basis = new Matrix4().makeBasis(tangentX, tangentY, n);
    basis.multiply(new Matrix4().makeRotationZ((this.design.rotationDeg * Math.PI) / 180));
    const orientation = new Euler().setFromRotationMatrix(basis);

    // Only feed DecalGeometry the triangles near the design: ~100x faster on phones.
    const local = this.nearbyMesh(p, Math.hypot(w, h, depth) * 0.75);
    const geometry = new DecalGeometry(local, p, orientation, new Vector3(w, h, depth));
    local.geometry.dispose();
    const mat = new MeshMatcapMaterial({
      map: this.decalTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    mat.matcap = null;
    mat.color = new Color("#ffffff");
    this.decal = new Mesh(geometry, mat);
    this.decal.renderOrder = 2;
    this.scene.add(this.decal);
    this.dirty = true;
  }

  private nearbyMesh(center: Vector3, radius: number): Mesh {
    const body = this.body!;
    const geom = body.geometry as BufferGeometry;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bvh = (geom as any).boundsTree as MeshBVH;
    const inv = new Matrix4().copy(body.matrixWorld).invert();
    const s = this.root.scale.x;
    const sphere = new Sphere(center.clone().applyMatrix4(inv), radius / s);
    const pos = geom.getAttribute("position");
    const nor = geom.getAttribute("normal");
    const index = geom.getIndex()!;
    const tris: number[] = [];
    bvh.shapecast({
      intersectsBounds: (box: Box3) => sphere.intersectsBox(box),
      intersectsTriangle: (_tri: unknown, triIndex: number) => {
        tris.push(triIndex);
        return false;
      },
    });
    const positions = new Float32Array(tris.length * 9);
    const normals = new Float32Array(tris.length * 9);
    let o = 0;
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const vi = index.getX(t * 3 + k);
        positions[o] = pos.getX(vi);
        positions[o + 1] = pos.getY(vi);
        positions[o + 2] = pos.getZ(vi);
        normals[o] = nor.getX(vi);
        normals[o + 1] = nor.getY(vi);
        normals[o + 2] = nor.getZ(vi);
        o += 3;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("normal", new BufferAttribute(normals, 3));
    const m = new Mesh(g);
    m.matrixWorld.copy(body.matrixWorld);
    return m;
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
    for (let i = 0; i < zone.count; i++) {
      if (!ids.has(Math.round(zone.getX(i)))) continue;
      v.fromBufferAttribute(pos, i);
      center.add(v);
      box.expandByPoint(v);
      normal.x += nor.getX(i);
      normal.y += nor.getY(i);
      normal.z += nor.getZ(i);
      count++;
    }
    if (!count) return null;
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
    return { center, normal, axis, radius: (size.length() * s) / 2 };
  }

  private refreshZoneState() {
    this.zoneState.fill(0);
    const selected = this.placement ? PLACEMENT_BY_SLUG.get(this.placement)?.zones ?? [] : [];
    const selectedIds = selected.map((s) => ZONE_BY_SLUG.get(s)?.id ?? 0);
    if (this.mode === "place" && selectedIds.length) {
      for (let i = 1; i < MAX_ZONES; i++) this.zoneState[i] = 3;
    }
    if (this.hoverZone) this.zoneState[this.hoverZone] = 1;
    for (const id of selectedIds) this.zoneState[id] = this.mode === "place" ? 0 : 2;
    this.dirty = true;
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
    cancelAnimationFrame(this.frame);
    if (this.disposed || !this.visible) return;
    this.frame = requestAnimationFrame(() => {
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
      const shader = this.material.userData.shader;
      const pulsing = this.zoneState.some((s) => s === 2);
      if (shader) shader.uniforms.uTime.value = (now - this.startTime) / 1000;
      if (this.dirty || pulsing) this.render();
      this.dirty = false;
      if (animating || damping || pulsing) this.loop();
    });
  };

  private render() {
    this.renderer.render(this.scene, this.camera);
  }
}
