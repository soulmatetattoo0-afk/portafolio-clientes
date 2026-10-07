// Standalone phone demo of the placement step. Bundled with esbuild into
// one file; the Next.js app uses the same engine through a React wrapper.
import { GROUP_LABELS, PLACEMENTS, PLACEMENT_BY_SLUG, BODY_HEIGHT_CM, MIN_DESIGN_CM, maxSizeFor, sizeBand, type BodyType, type Locale, type PlacementGroup } from "../../src/mannequin/catalog";
import { MannequinEngine } from "../../src/mannequin/engine";

const copy = {
  es: {
    title: "¿Dónde va tu tatuaje?",
    lead: "Gira la figura y toca la zona. Después ajusta el tamaño en centímetros reales.",
    body: "Figura",
    f: "Femenina",
    m: "Masculina",
    height: "Tu estatura",
    zoneStep: "Zona",
    sizeStep: "Tamaño",
    pick: "Toca una zona en la figura o elígela de la lista.",
    full: "Cobertura completa: tu artista diseña para toda el área.",
    size: "Tamaño del diseño",
    shape: "Formato",
    vertical: "Vertical",
    square: "Cuadrado",
    horizontal: "Horizontal",
    rotate: "Rotación",
    tapToMove: "Toca dentro de la zona para mover el diseño.",
    next: "Elegir tamaño",
    back: "Cambiar zona",
    bands: { small: "Pequeño, como una moneda grande", medium: "Mediano, como la palma de tu mano", large: "Grande", xl: "Muy grande" },
    approx: "Medida aproximada. Tu artista la confirma antes de la cita.",
    front: "Frente",
    backView: "Espalda",
  },
  en: {
    title: "Where does your tattoo go?",
    lead: "Turn the figure and tap the area. Then set the size in real centimetres.",
    body: "Figure",
    f: "Female",
    m: "Male",
    height: "Your height",
    zoneStep: "Placement",
    sizeStep: "Size",
    pick: "Tap an area on the figure or choose it from the list.",
    full: "Full coverage: your artist designs for the whole area.",
    size: "Design size",
    shape: "Shape",
    vertical: "Tall",
    square: "Square",
    horizontal: "Wide",
    rotate: "Rotation",
    tapToMove: "Tap inside the area to move the design.",
    next: "Choose size",
    back: "Change placement",
    bands: { small: "Small, about a large coin", medium: "Medium, about your palm", large: "Large", xl: "Extra large" },
    approx: "Approximate size. Your artist confirms it before the session.",
    front: "Front",
    backView: "Back",
  },
};

type Shape = "vertical" | "square" | "horizontal";
const state = {
  locale: (navigator.language.startsWith("es") ? "es" : "en") as Locale,
  body: "f" as BodyType,
  height: BODY_HEIGHT_CM.f,
  step: "zone" as "zone" | "size",
  placement: null as string | null,
  size: 12,
  shape: "vertical" as Shape,
  rotation: 0,
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const stage = $("#stage");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const engine = new MannequinEngine(stage, {
  assetBase: (document.querySelector<HTMLElement>("[data-assets]")?.dataset.assets ?? ".").replace(/\/$/, ""),
  body: state.body,
  // Published artifacts can't serve .glb, so the build can embed models as base64 modules.
  loadModel: (window as unknown as { __EMBEDDED_MODELS__?: boolean }).__EMBEDDED_MODELS__
    ? async (b) => {
        const url = new URL(`./body-${b}.js`, import.meta.url).href;
        const mod = (await import(url)) as { default: string };
        return Uint8Array.from(atob(mod.default), (c) => c.charCodeAt(0)).buffer;
      }
    : undefined,
  reducedMotion: reduced,
  onReady: () => stage.classList.add("ready"),
  onError: (e) => {
    $("#status").textContent = e.message;
  },
  onZoneTap: (slug) => choose(slug),
  onPlace: () => render(),
});
engine.setMode("zone");

function dims(): [number, number] {
  const s = state.size;
  if (state.shape === "square") return [s, s];
  return state.shape === "vertical" ? [Math.round(s * 0.66), s] : [s, Math.round(s * 0.66)];
}

function choose(slug: string) {
  state.placement = slug;
  const max = maxSizeFor(slug);
  state.size = Math.min(state.size, max);
  engine.selectPlacement(slug);
  render();
}

function goSize() {
  if (!state.placement) return;
  const p = PLACEMENT_BY_SLUG.get(state.placement)!;
  state.step = "size";
  if (!p.fullCoverage) {
    engine.setMode("place");
    const [w, h] = dims();
    engine.setDesignSize(w, h, state.rotation);
    engine.placeAtCenter();
  }
  render();
}

function goZone() {
  state.step = "zone";
  engine.clearDesign();
  engine.setMode("zone");
  render();
}

function render() {
  const t = copy[state.locale];
  document.documentElement.lang = state.locale;
  $("#title").textContent = t.title;
  $("#lead").textContent = t.lead;
  $("#lang").textContent = state.locale === "es" ? "English" : "Español";
  $("#bodyLabel").textContent = t.body;
  $("#bf").textContent = t.f;
  $("#bm").textContent = t.m;
  $("#bf").setAttribute("aria-pressed", String(state.body === "f"));
  $("#bm").setAttribute("aria-pressed", String(state.body === "m"));
  $("#heightLabel").textContent = t.height;
  $("#heightOut").textContent = `${state.height} cm`;
  $<HTMLInputElement>("#height").value = String(state.height);
  $("#viewFront").textContent = t.front;
  $("#viewBack").textContent = t.backView;
  $("#stepZone").textContent = t.zoneStep;
  $("#stepSize").textContent = t.sizeStep;
  $("#stepZone").setAttribute("aria-current", String(state.step === "zone"));
  $("#stepSize").setAttribute("aria-current", String(state.step === "size"));

  const p = state.placement ? PLACEMENT_BY_SLUG.get(state.placement) : null;
  $("#chosen").textContent = p ? p.label[state.locale] : t.pick;
  $("#chosen").classList.toggle("muted", !p);

  // Zone list
  const zonePanel = $("#zonePanel");
  zonePanel.hidden = state.step !== "zone";
  const groups = Object.keys(GROUP_LABELS) as PlacementGroup[];
  $("#groups").innerHTML = groups
    .map((g) => {
      const items = PLACEMENTS.filter((pl) => pl.group === g)
        .map((pl) => `<button type="button" class="chip" data-slug="${pl.slug}" aria-pressed="${pl.slug === state.placement}">${pl.label[state.locale]}</button>`)
        .join("");
      return `<details ${p?.group === g ? "open" : ""}><summary>${GROUP_LABELS[g][state.locale]}</summary><div class="chips">${items}</div></details>`;
    })
    .join("");
  const next = $<HTMLButtonElement>("#next");
  next.textContent = t.next;
  next.disabled = !p;

  // Size panel
  const sizePanel = $("#sizePanel");
  sizePanel.hidden = state.step !== "size";
  $<HTMLButtonElement>("#back").textContent = t.back;
  if (state.step === "size" && p) {
    $("#full").hidden = !p.fullCoverage;
    $("#full").textContent = t.full;
    $("#sizeControls").hidden = p.fullCoverage;
    const max = maxSizeFor(p.slug);
    const range = $<HTMLInputElement>("#size");
    range.min = String(MIN_DESIGN_CM);
    range.max = String(max);
    range.value = String(state.size);
    const [w, h] = dims();
    $("#sizeLabel").textContent = t.size;
    $("#sizeOut").textContent = `${w} × ${h} cm`;
    $("#band").textContent = t.bands[sizeBand(state.size)];
    $("#shapeLabel").textContent = t.shape;
    (["vertical", "square", "horizontal"] as Shape[]).forEach((s) => {
      const b = $(`#shape-${s}`);
      b.textContent = t[s];
      b.setAttribute("aria-pressed", String(state.shape === s));
    });
    $("#rotLabel").textContent = t.rotate;
    $("#rotOut").textContent = `${state.rotation}°`;
    $("#hint").textContent = t.tapToMove;
    $("#approx").textContent = t.approx;
  }
}

$("#groups").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-slug]");
  if (b) choose(b.dataset.slug!);
});
$("#next").addEventListener("click", goSize);
$("#back").addEventListener("click", goZone);
$("#lang").addEventListener("click", () => {
  state.locale = state.locale === "es" ? "en" : "es";
  render();
});
for (const b of ["f", "m"] as BodyType[]) {
  $(`#b${b}`).addEventListener("click", () => {
    if (state.body === b) return;
    state.body = b;
    state.height = BODY_HEIGHT_CM[b];
    void engine.setBody(b).then(() => {
      if (state.placement) engine.selectPlacement(state.placement, false);
      if (state.step === "size") goSize();
    });
    render();
  });
}
$<HTMLInputElement>("#height").addEventListener("input", (e) => {
  state.height = Number((e.target as HTMLInputElement).value);
  engine.setHeight(state.height);
  if (state.step === "size") goSize();
  render();
});
let raf = 0;
const resize = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const [w, h] = dims();
    engine.setDesignSize(w, h, state.rotation);
  });
};
$<HTMLInputElement>("#size").addEventListener("input", (e) => {
  state.size = Number((e.target as HTMLInputElement).value);
  resize();
  render();
});
$<HTMLInputElement>("#rot").addEventListener("input", (e) => {
  state.rotation = Number((e.target as HTMLInputElement).value);
  resize();
  render();
});
for (const s of ["vertical", "square", "horizontal"] as Shape[]) {
  $(`#shape-${s}`).addEventListener("click", () => {
    state.shape = s;
    resize();
    render();
  });
}
$("#viewFront").addEventListener("click", () => engine.rotateTo("front"));
$("#viewBack").addEventListener("click", () => engine.rotateTo("back"));

render();
