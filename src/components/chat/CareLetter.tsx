"use client";

import { useState } from "react";

import { VantaMark } from "@/components/brand/VantaLogo";

/**
 * The care sheet as a letter on paper: the title in Cinzel, the artist's
 * words in Cormorant, a rule in their colour and the house mark at the foot.
 * "Descargar la carta" draws the same letter on a canvas and saves it as a
 * picture the client keeps on their phone.
 */
export function CareLetter({ stage, body, artist, labels, mine = false }: { stage: "pre" | "post"; body: string; artist: string; labels: { download: string; from: string }; mine?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [title, ...rest] = body.split("\n");
  const text = rest.join("\n").trim();
  const download = async () => {
    setBusy(true);
    try {
      const css = getComputedStyle(document.documentElement);
      const family = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
      const fonts = { cinzel: family("--font-cinzel", "Cinzel, serif"), cormorant: family("--font-cormorant", '"Cormorant Garamond", serif'), sans: family("--font-instrument", '"Instrument Sans", sans-serif') };
      await Promise.all([document.fonts.load(`700 64px ${fonts.cinzel}`), document.fonts.load(`italic 400 40px ${fonts.cormorant}`), document.fonts.load(`600 22px ${fonts.sans}`)]).catch(() => undefined);
      const url = drawLetter({ title, text, artist, from: labels.from, accent: css.getPropertyValue("--accent").trim() || "#c8231e", fonts });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${stage === "pre" ? "antes" : "despues"}-del-tatuaje.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <figure className="relative w-[min(92%,400px)] overflow-hidden rounded-[6px] bg-[#f1ebdd] px-6 pt-7 pb-6 text-[#2b2420] shadow-[0_24px_40px_-18px_rgb(0_0_0/0.8)]">
        <span className="p-grain" aria-hidden style={{ opacity: 0.35 }} />
        <span aria-hidden className="absolute inset-x-6 top-0 h-[3px]" style={{ background: "var(--accent)" }} />
        <div className="relative">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#2b2420]/60">{labels.from.replace("{artist}", artist)}</p>
          <h3 className="mt-2 font-[family-name:var(--font-cinzel)] text-[1.55rem] leading-[1.05] font-bold uppercase tracking-[0.02em]">{title}</h3>
          <span aria-hidden className="mt-3 block h-px w-12" style={{ background: "var(--accent)" }} />
          <p className="mt-4 font-[family-name:var(--font-cormorant)] text-[1.2rem] leading-[1.45] italic whitespace-pre-line">{text}</p>
          <div className="mt-6 flex items-end justify-between gap-3">
            <button type="button" onClick={download} disabled={busy} className="rounded-full border-[1.5px] border-[#2b2420] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] disabled:opacity-50">
              {labels.download}
            </button>
            <VantaMark className="h-7 w-auto text-[#2b2420]/70" />
          </div>
        </div>
      </figure>
    </li>
  );
}

/** The letter at 1080 × 1350, drawn by hand: paper, the colour rule, the title, the wrapped words, the foot. */
function drawLetter(o: { title: string; text: string; artist: string; from: string; accent: string; fonts: { cinzel: string; cormorant: string; sans: string } }) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f1ebdd";
  g.fillRect(0, 0, W, H);
  // A faint grain.
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(43,36,32,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.fillStyle = o.accent;
  g.fillRect(90, 0, W - 180, 8);
  const ink = "#2b2420";
  g.fillStyle = "rgba(43,36,32,0.6)";
  g.font = `600 22px ${o.fonts.sans}`;
  spaced(g, o.from.replace("{artist}", o.artist).toUpperCase(), 90, 120, 7);
  g.fillStyle = ink;
  g.font = `700 64px ${o.fonts.cinzel}`;
  let y = wrap(g, o.title.toUpperCase(), 90, 210, W - 180, 72);
  g.fillStyle = o.accent;
  g.fillRect(90, y + 10, 110, 3);
  g.fillStyle = ink;
  g.font = `italic 400 40px ${o.fonts.cormorant}`;
  y = wrap(g, o.text, 90, y + 90, W - 180, 54);
  // The foot: the artist's name and the house mark.
  g.fillStyle = "rgba(43,36,32,0.7)";
  g.font = `600 20px ${o.fonts.sans}`;
  spaced(g, o.artist.toUpperCase(), 90, H - 100, 6);
  g.strokeStyle = "rgba(43,36,32,0.7)";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(W - 150, H - 110, 34, 0, Math.PI * 2);
  g.stroke();
  g.font = `700 34px ${o.fonts.cinzel}`;
  g.fillStyle = "rgba(43,36,32,0.8)";
  g.textAlign = "center";
  g.fillText("V", W - 150, H - 98);
  g.textAlign = "left";
  return c.toDataURL("image/png");
}

function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number) {
  let cx = x;
  for (const ch of text) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + gap;
  }
}

/** Word-wrapped text; returns the y after the last line. */
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number) {
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (g.measureText(next).width > width && cur) {
        g.fillText(cur, x, y);
        y += line;
        cur = w;
      } else cur = next;
    }
    if (cur) {
      g.fillText(cur, x, y);
      y += line;
    }
    y += line * 0.4;
  }
  return y;
}
