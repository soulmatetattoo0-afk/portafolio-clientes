import { VantaWord } from "@/components/brand/VantaLogo";
import { FONT_FAMILY, FONT_STYLE, type MagBox, type MagCover, type MagPage, type Placeholder } from "@/lib/magazine";

export type PlaceholderText = Record<Placeholder, string>;

const isVideo = (key: string | null | undefined) => Boolean(key && /\.(mp4|webm|mov)$/i.test(key));

const INK = "var(--color-ink, #0a0a0a)";
const BONE = "var(--color-bone, #e9e2d4)";
const colorOf = (c: MagBox["color"], tone: "ink" | "bone") => (c === "accent" ? "var(--accent)" : c === "ink" ? INK : c === "bone" ? BONE : tone === "ink" ? BONE : INK);

/** A photo or video filling its frame, pushed and scaled by the artist. */
export function Media({ src, url, zoom = 1, fx = 50, fy = 50, alt, empty }: { src: string | null | undefined; url?: string; zoom?: number; fx?: number; fy?: number; alt: string; empty?: React.ReactNode }) {
  if (!src || !url) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#161412]">
        <span aria-hidden className="mag-stripes absolute inset-0 opacity-25" />
        {empty}
      </div>
    );
  }
  const style: React.CSSProperties = { objectPosition: `${fx}% ${fy}%`, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: `${fx}% ${fy}%` };
  return isVideo(src) ? (
    <video src={url} autoPlay muted loop playsInline draggable={false} className="absolute inset-0 h-full w-full object-cover" style={style} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} draggable={false} loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={style} />
  );
}

/** A block of text as the artist set it: face, size, direction, angle and colour. Sizes are in percent of the page width. */
export function Words({ box, tone, ph }: { box: MagBox; tone: "ink" | "bone"; ph: PlaceholderText }) {
  const font = box.font ?? "sans";
  const empty = !box.text?.trim();
  const text = empty ? (box.ph ? ph[box.ph] : "") : box.text!;
  const vertical = box.dir === "v" || box.dir === "up";
  return (
    <div
      className="absolute inset-0 overflow-hidden whitespace-pre-wrap break-words"
      style={{
        ...FONT_STYLE[font],
        fontFamily: FONT_FAMILY[font],
        fontSize: `${box.size ?? 3.6}cqw`,
        textAlign: box.align ?? "left",
        color: colorOf(box.color, tone),
        writingMode: vertical ? "vertical-rl" : undefined,
        transform: box.dir === "up" ? "rotate(180deg)" : undefined,
        opacity: empty ? 0.55 : 1,
      }}
    >
      {text}
    </div>
  );
}

function Box({ box, tone, urls, ph }: { box: MagBox; tone: "ink" | "bone"; urls: Record<string, string>; ph: PlaceholderText }) {
  return box.kind === "media" ? (
    <div className="absolute inset-0 overflow-hidden">
      <Media src={box.src} url={box.src ? urls[box.src] : undefined} zoom={box.zoom} fx={box.fx} fy={box.fy} alt="" />
    </div>
  ) : (
    <Words box={box} tone={tone} ph={ph} />
  );
}

/** Where a box sits on the sheet, in percent; the angle turns it around its centre. */
export const boxStyle = (b: MagBox): React.CSSProperties => ({
  left: `${b.x}%`,
  top: `${b.y}%`,
  width: `${b.w}%`,
  height: `${b.h}%`,
  transform: b.kind === "text" && b.rotate ? `rotate(${b.rotate}deg)` : undefined,
});

/**
 * One 2:3 sheet of the artist's magazine. `wrap` lets the editor put its
 * handles around each box without the reader ever loading them.
 */
export function Sheet({
  transparent = false,
  page,
  urls,
  ph,
  className = "",
  wrap,
  children,
}: {
  page: MagPage;
  urls: Record<string, string>;
  ph: PlaceholderText;
  className?: string;
  wrap?: (box: MagBox, node: React.ReactNode) => React.ReactNode;
  children?: React.ReactNode;
  /** Over a poster cover: the boxes alone, no paper of their own. */
  transparent?: boolean;
}) {
  return (
    <div className={`relative aspect-[2/3] w-full overflow-hidden [container-type:inline-size] ${className}`} style={{ background: transparent ? "transparent" : page.tone === "ink" ? INK : BONE }}>
      {page.boxes.map((b) => {
        const node = <Box box={b} tone={page.tone} urls={urls} ph={ph} />;
        return wrap ? (
          wrap(b, node)
        ) : (
          <div key={b.id} className="absolute" style={boxStyle(b)}>
            {node}
          </div>
        );
      })}
      {children}
    </div>
  );
}

/** What the cover says besides the picture: the artist's city and styles, their line, the issue. */
export interface CoverMeta {
  city?: string | null;
  styles?: string[];
  /** The artist's one line (their cover quote or headline), as the secondary headline. */
  line?: string | null;
  accent?: string | null;
  number?: number;
  words: { tagline: string; issue: string; founding: string };
}

/**
 * The masthead: VANTA, the same on every cover (the collection's signature),
 * and the artist's name as the only shout. Fixed, whatever the artist does
 * below. On a composed cover the name sits under the masthead; on a poster
 * cover it goes at the foot, over the picture.
 */
export function Masthead({ name, tone, foot = false, meta }: { name: string; tone: "ink" | "bone"; foot?: boolean; meta?: CoverMeta }) {
  const fg = tone === "ink" ? BONE : INK;
  const lines = name.length > 12 && name.includes(" ") ? splitName(name) : [name];
  const longest = Math.max(...lines.map((l) => l.length));
  // The name fills 70–86% of the width; a long one breaks in two, never squeezes.
  const size = Math.min(22, 170 / Math.max(6, longest));
  // One line, never broken: the city and up to three styles, fewer when the city is long.
  const kicker = [meta?.city, ...(meta?.styles ?? []).slice(0, (meta?.city?.length ?? 0) > 9 ? 2 : 3)].filter(Boolean).join(" · ");
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-[6cqw] pt-[5.2cqw]" style={{ color: fg }}>
        <VantaWord className="mx-auto block h-auto w-[88cqw]" />
        {meta && (
          <div className="mt-[2.4cqw] flex items-start justify-between gap-[3cqw]">
            <span className="p-stamp text-[1.9cqw] tracking-[0.3em] uppercase opacity-80">{meta.words.tagline}</span>
            <span className="grid justify-items-end text-right">
              <span className="font-serif text-[3.2cqw] leading-none tracking-[0.08em]">{meta.words.issue.replace("{n}", String(meta.number ?? 1).padStart(3, "0"))}</span>
              <span className="my-[1.2cqw] h-px w-[18cqw]" style={{ background: "currentColor", opacity: 0.4 }} />
              <span className="p-stamp text-[1.9cqw] tracking-[0.3em] uppercase opacity-80">{meta.words.founding}</span>
            </span>
          </div>
        )}
        {!foot && (
          <p className="p-display mt-[3cqw] text-center leading-[0.86] uppercase" style={{ fontSize: `${Math.min(14, size)}cqw` }}>
            {name}
          </p>
        )}
      </div>
      {foot && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-[6cqw] pb-[7cqw]" style={{ color: fg }}>
          {meta?.line && (
            <p className="absolute right-[6cqw] bottom-[52cqw] flex w-[26cqw] gap-[1.5cqw] font-serif text-[3.6cqw] leading-[1.15]" style={{ color: fg }}>
              <span className="mt-[2cqw] h-px w-[5cqw] shrink-0" style={{ background: "currentColor" }} />
              <span className="line-clamp-4">{meta.line}</span>
            </p>
          )}
          {/* The artist's colour, in one place only: the rule over the name. */}
          <span className="mb-[2.4cqw] block h-[0.6cqw] w-[14cqw]" style={{ background: meta?.accent ?? "var(--accent, #d8552f)" }} />
          <p className="p-display leading-[0.86] uppercase" style={{ fontSize: `${size}cqw` }}>
            {lines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
          {kicker && <p className="mt-[2cqw] truncate text-[2.5cqw] font-semibold tracking-[0.32em] uppercase">{kicker}</p>}
        </div>
      )}
    </>
  );
}

/** "Camo Contreras" → two lines; a three-word name breaks after its first word. */
function splitName(name: string): string[] {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts : [parts[0], parts.slice(1).join(" ")];
}

/** Registration crosses: three, where the art direction puts them. */
function Marks({ color }: { color: string }) {
  const at: [number, number][] = [
    [6, 24],
    [94, 44],
    [6, 60],
  ];
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden>
      {at.map(([x, y]) => (
        <g key={`${x}${y}`} stroke={color} strokeOpacity="0.35" strokeWidth="0.25" vectorEffect="non-scaling-stroke">
          <line x1={x - 2} y1={y} x2={x + 2} y2={y} />
          <line x1={x} y1={y - 2} x2={x} y2={y + 2} />
        </g>
      ))}
    </svg>
  );
}

/** The cover: either the artist's layout under our masthead, or their finished image with the masthead stamped on it. */
export function CoverSheet({
  cover,
  name,
  urls,
  ph,
  meta,
  className = "",
  wrap,
  children,
}: {
  cover: MagCover;
  name: string;
  urls: Record<string, string>;
  ph: PlaceholderText;
  /** City, styles, the artist's line and the issue: the words around the picture. */
  meta?: CoverMeta;
  className?: string;
  wrap?: (box: MagBox, node: React.ReactNode) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const poster = cover.mode === "poster";
  return (
    <div className={`relative aspect-[2/3] w-full overflow-hidden [container-type:inline-size] ${className}`} style={{ background: cover.tone === "ink" ? INK : BONE }}>
      {poster ? (
        <>
          {/* The portrait treatment: the artist as a work, in black and white, with hard light on ink. */}
          <div className="absolute inset-0" style={{ filter: "grayscale(1) contrast(1.22) brightness(0.92) sepia(0.08)" }}>
            <Media src={cover.poster} url={cover.poster ? urls[cover.poster] : undefined} zoom={cover.zoom} fx={cover.fx} fy={cover.fy} alt={name} />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: "radial-gradient(ellipse at 50% 35%, transparent 45%, rgb(10 10 10 / 0.7) 100%)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(180deg, rgb(10 10 10 / 0.45) 0%, transparent 22%, transparent 58%, rgb(10 10 10 / 0.92) 92%)" }} />
          <div aria-hidden className="p-grain pointer-events-none absolute inset-0 z-10" style={{ opacity: 0.14 }} />
          <Marks color={BONE} />
          {/* Words and pictures the artist laid over the poster. */}
          {(cover.boxes.length > 0 || wrap) && <Sheet page={{ id: "cover", tone: "ink", boxes: cover.boxes }} urls={urls} ph={ph} wrap={wrap} transparent className="absolute! inset-0 z-[15] aspect-auto! h-full" />}
        </>
      ) : (
        <Sheet page={{ id: "cover", tone: cover.tone, boxes: cover.boxes }} urls={urls} ph={ph} wrap={wrap} className="absolute! inset-0 aspect-auto! h-full" />
      )}
      <Masthead name={name} tone={poster ? "ink" : cover.tone} foot={poster} meta={meta} />
      {children}
    </div>
  );
}
