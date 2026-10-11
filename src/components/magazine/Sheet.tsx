import { VantaMark, VantaWord } from "@/components/brand/VantaLogo";
import { COVER_TOP, FONT_FAMILY, FONT_STYLE, type MagBox, type MagCover, type MagPage, type Placeholder } from "@/lib/magazine";

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
}) {
  return (
    <div className={`relative aspect-[2/3] w-full overflow-hidden [container-type:inline-size] ${className}`} style={{ background: page.tone === "ink" ? INK : BONE }}>
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

/** The masthead: the artist's name as the title, and VANTA under it as the publisher's line. Fixed on every cover, whatever the artist does below. */
export function Masthead({ name, tone }: { name: string; tone: "ink" | "bone" }) {
  const fg = tone === "ink" ? BONE : INK;
  // The title fills the width: shorter names set larger.
  const size = Math.min(24, 150 / Math.max(4, name.length));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-[4cqw] pt-[3.5cqw]" style={{ height: `${COVER_TOP}%`, color: fg }}>
      <p className="p-display w-full text-center leading-[0.85] whitespace-nowrap" style={{ fontSize: `${size}cqw`, letterSpacing: "0.01em" }}>
        {name}
      </p>
      <div className="mt-[2.6cqw] flex w-full items-center gap-[2.4cqw]">
        <span className="h-px flex-1" style={{ background: "currentColor", opacity: 0.6 }} />
        <VantaMark className="h-[4.2cqw] w-auto" />
        <VantaWord className="h-[1.7cqw] w-auto" />
        <span className="h-px flex-1" style={{ background: "currentColor", opacity: 0.6 }} />
      </div>
    </div>
  );
}

/** The cover: either the artist's layout under our masthead, or their finished image with the masthead stamped on it. */
export function CoverSheet({
  cover,
  name,
  urls,
  ph,
  className = "",
  wrap,
  children,
}: {
  cover: MagCover;
  name: string;
  urls: Record<string, string>;
  ph: PlaceholderText;
  className?: string;
  wrap?: (box: MagBox, node: React.ReactNode) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const poster = cover.mode === "poster";
  return (
    <div className={`relative aspect-[2/3] w-full overflow-hidden [container-type:inline-size] ${className}`} style={{ background: cover.tone === "ink" ? INK : BONE }}>
      {poster ? (
        <>
          <Media src={cover.poster} url={cover.poster ? urls[cover.poster] : undefined} zoom={cover.zoom} fx={cover.fx} fy={cover.fy} alt={name} />
          {/* a little shade under the masthead so it reads on any photo */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[30%] bg-gradient-to-b from-black/55 to-transparent" />
        </>
      ) : (
        <Sheet page={{ id: "cover", tone: cover.tone, boxes: cover.boxes }} urls={urls} ph={ph} wrap={wrap} className="absolute! inset-0 aspect-auto! h-full" />
      )}
      <Masthead name={name} tone={poster ? "ink" : cover.tone} />
      {children}
    </div>
  );
}
