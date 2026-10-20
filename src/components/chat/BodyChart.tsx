import { PLACEMENT_BY_SLUG, type BodyType } from "@/mannequin/catalog";

/**
 * The request's body, drawn as an engraved anatomy plate: a figure in ink
 * line with crosshatched shade, front and back, and the client's chosen
 * area laid in the artist's colour. The zones are rough shapes clipped by
 * the smooth outline, so the drawing stays clean whatever is marked. Left
 * and right are the client's own: on the front their left is the viewer's
 * right, on the back it is the viewer's left.
 */

type Pt = [number, number];
type View = "front" | "back";

const W = 160;
const H = 380;
const C = W / 2;

/** The viewer's right half of the outline, from the crown round the arm and the leg to the crotch. */
const HALF: Pt[] = [
  [80, 10], [90, 12.5], [95, 21], [96.5, 32], [94, 44], [88, 53.5],
  [89, 60], [91, 66], [101, 70], [112, 73.5], [120, 80], [124.5, 92],
  [127, 112], [129, 134], [132.5, 158], [136, 183], [140, 199], [142.5, 219], [140, 237], [134.5, 241], [131, 231], [128.5, 214], [126.5, 199],
  [121.5, 176], [117, 152], [114, 128], [111.5, 106], [108.5, 99],
  [107.5, 112], [105, 130], [102.5, 148], [104.5, 165], [108, 180], [108.5, 196],
  [108, 216], [106, 240], [103.5, 266], [103.5, 286], [104.5, 306], [100.5, 336], [97.5, 354], [101.5, 364], [99.5, 371], [86.5, 371.5], [85.5, 360],
  [86, 340], [85, 310], [84, 286], [84, 262], [83, 232], [82, 208], [80, 198],
];

/** How much wider or narrower each height of the figure sits for the female body. */
function femaleScale(y: number) {
  const knots: [number, number][] = [[0, 0.96], [60, 0.95], [110, 0.92], [150, 0.95], [185, 1.06], [230, 1.03], [300, 1], [380, 1]];
  for (let i = 1; i < knots.length; i++) {
    const [y0, s0] = knots[i - 1];
    const [y1, s1] = knots[i];
    if (y <= y1) return s0 + ((s1 - s0) * (y - y0)) / (y1 - y0);
  }
  return 1;
}

function outline(body: BodyType): Pt[] {
  const right = HALF.map(([x, y]): Pt => (body === "f" ? [C + (x - C) * femaleScale(y), y] : [x, y]));
  const left = right.slice(1, -1).reverse().map(([x, y]): Pt => [W - x, y]);
  return [...right, ...left];
}

/** A closed Catmull-Rom curve through the points, as cubic Béziers. */
function smooth(pts: Pt[]) {
  const n = pts.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const OUTLINE: Record<BodyType, string> = { m: smooth(outline("m")), f: smooth(outline("f")) };

/** Zone shapes on the viewer's left half (x < 80); centre zones span both halves. */
const SIDE: Record<string, Pt[]> = {
  shoulder: [[62, 62], [0, 62], [0, 102], [50, 102], [54, 84], [60, 74]],
  upper_arm: [[50, 102], [0, 102], [0, 150], [46, 150]],
  forearm: [[46, 150], [0, 150], [0, 199], [38, 199]],
  hand: [[38, 199], [0, 199], [0, 252], [44, 252]],
  chest: [[74, 68], [61.2, 68], [60, 74], [54, 84], [50, 102], [52, 112], [74, 112]],
  ribs: [[67, 112], [50, 112], [50, 158], [66, 158]],
  hip: [[66, 158], [48, 158], [48, 192], [69, 192]],
  thigh_front: [[80, 192], [45, 192], [45, 268], [80, 268]],
  thigh_back: [[80, 201], [45, 201], [45, 268], [80, 268]],
  lower_leg: [[80, 268], [45, 268], [45, 352], [80, 352]],
  foot: [[80, 352], [45, 352], [45, 380], [80, 380]],
};
const CENTRE: Record<string, Pt[]> = {
  neck: [[60, 52], [100, 52], [100, 68], [60, 68]],
  chest_center: [[74, 68], [86, 68], [86, 112], [74, 112]],
  stomach: [[67, 112], [93, 112], [95, 178], [65, 178]],
  back_upper: [[61.2, 68], [60, 74], [54, 84], [50, 102], [50, 135], [110, 135], [110, 102], [106, 84], [100, 74], [98.8, 68]],
  back_lower: [[50, 135], [110, 135], [113, 186], [47, 186]],
};

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [W - x, y]);
const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;

/** Where each atomic zone is drawn on each view: [shape, viewer side]. */
function zoneShapes(slug: string, view: View): Pt[][] {
  const m = /^(.*)_([LR])$/.exec(slug);
  const base = m ? m[1] : slug;
  const side = m ? m[2] : null;
  // Front: the client's right is on the viewer's left; back: their left is on the viewer's left.
  const onLeft = side === (view === "front" ? "R" : "L");
  const sided = (key: string) => [onLeft ? SIDE[key] : mirror(SIDE[key])];
  const front = view === "front";
  switch (base) {
    case "neck":
      return front ? [CENTRE.neck] : [];
    case "nape":
      return front ? [] : [CENTRE.neck];
    case "shoulder":
      return sided("shoulder");
    case "upper_arm":
      return sided("upper_arm");
    case "forearm_inner":
      return front ? sided("forearm") : [];
    case "forearm_outer":
      return front ? [] : sided("forearm");
    case "hand":
      return sided("hand");
    case "chest":
      return front ? sided("chest") : [];
    case "chest_center":
      return front ? [CENTRE.chest_center] : [];
    case "stomach":
      return front ? [CENTRE.stomach] : [];
    case "ribs":
      return front ? sided("ribs") : [];
    case "hip":
      return front ? sided("hip") : [];
    case "back_upper":
      return front ? [] : [CENTRE.back_upper];
    case "back_lower":
      return front ? [] : [CENTRE.back_lower];
    case "thigh":
      return sided(front ? "thigh_front" : "thigh_back");
    case "shin":
      return front ? sided("lower_leg") : [];
    case "calf":
      return front ? [] : sided("lower_leg");
    case "foot":
      return front ? sided("foot") : [];
    default:
      return [];
  }
}

/** The engraver's marks inside the figure: collarbones, chest, navel, knees; the spine and blades behind. */
const DETAIL: Record<View, string> = {
  front:
    "M67 70Q74 73.5 79 71.5M93 70Q86 73.5 81 71.5M58 99Q67 109 77.5 104.5M102 99Q93 109 82.5 104.5M80 76V102M80 116V140M63 167Q72 181 79.5 192M97 167Q88 181 80.5 192M64.5 271Q70 277.5 76 271.5M95.5 271Q90 277.5 84 271.5M47.5 140Q50 145 54.5 146M112.5 140Q110 145 105.5 146",
  back: "M80 70V182M60.5 84Q64 104 74.5 111M99.5 84Q96 104 85.5 111M80 186V199M53.5 197Q66 207 78.5 199.5M106.5 197Q94 207 81.5 199.5M64 276H76M84 276H96M47 140Q51 144 55 144M113 140Q109 144 105 144",
};

/** Which views carry the placement: the back only for back pieces, both for limbs that wrap. */
export function chartViews(placement: string): View[] {
  const zones = PLACEMENT_BY_SLUG.get(placement)?.zones ?? [placement];
  const on = (v: View) => zones.some((z) => zoneShapes(z, v).length > 0);
  return (["front", "back"] as View[]).filter(on);
}

export function BodyChart({ placement, body = "m", views, labels, className = "" }: { placement: string; body?: BodyType; views?: View[]; labels?: { front: string; back: string }; className?: string }) {
  const zones = PLACEMENT_BY_SLUG.get(placement)?.zones ?? [placement];
  const shown = views ?? (["front", "back"] as View[]);
  const id = `bc-${body}`;
  return (
    <span className={`flex items-end justify-center gap-3 ${className}`}>
      {shown.map((view) => {
        const marked = zones.flatMap((z) => zoneShapes(z, view));
        return (
          <span key={view} className="flex min-w-0 flex-1 flex-col items-center">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={labels?.[view]}>
              <defs>
                <clipPath id={`${id}-clip`}>
                  <path d={OUTLINE[body]} />
                </clipPath>
                <pattern id={`${id}-hatch`} width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
                  <line x1="0" y1="0" x2="0" y2="2.6" stroke="#2b2420" strokeWidth="0.42" />
                </pattern>
                <pattern id={`${id}-cross`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
                  <line x1="0" y1="0" x2="0" y2="3.2" stroke="#2b2420" strokeWidth="0.55" />
                </pattern>
                {/* The light comes from the left: shade gathers on the figure's far side. */}
                <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0.46" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.9" stopColor="#fff" stopOpacity="0.75" />
                </linearGradient>
                <mask id={`${id}-shade-mask`}>
                  <rect width={W} height={H} fill={`url(#${id}-shade)`} />
                </mask>
              </defs>
              {/* A soft ground shadow under the feet. */}
              <ellipse cx={C} cy={H - 6} rx="34" ry="3.2" fill="#2b2420" opacity="0.12" />
              <g clipPath={`url(#${id}-clip)`}>
                <rect width={W} height={H} fill="#f7f1e4" />
                <rect width={W} height={H} fill={`url(#${id}-hatch)`} mask={`url(#${id}-shade-mask)`} opacity="0.8" />
                {marked.map((pts, i) => (
                  <path key={i} d={poly(pts)} fill="var(--accent, #c8231e)" opacity="0.92" />
                ))}
                {marked.map((pts, i) => (
                  <path key={`x${i}`} d={poly(pts)} fill={`url(#${id}-cross)`} stroke="#2b2420" strokeWidth="0.8" strokeOpacity="0.85" opacity="0.4" />
                ))}
                <path d={DETAIL[view]} fill="none" stroke="#2b2420" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
              </g>
              <path d={OUTLINE[body]} fill="none" stroke="#2b2420" strokeWidth="1.25" strokeLinejoin="round" />
            </svg>
            {labels && <span className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-[#2b2420]/55">{labels[view]}</span>}
          </span>
        );
      })}
    </span>
  );
}
