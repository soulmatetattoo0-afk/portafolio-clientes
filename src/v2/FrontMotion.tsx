"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * What moves on the artist's front. A door leans toward the thumb and, opened,
 * grows into a curtain that covers the phone until the next screen is there;
 * the work plays as a reel behind its door; the reserve key sinks before it
 * opens. Without script every door is still a plain link.
 */

/** Artists whose entrance already played in this visit: coming back, the front is simply there. */
const seen = new Set<string>();

/** The curtain lives outside React so it can outlast the screen that opened it. */
let curtain: { node: HTMLElement; at: number; timer: number } | null = null;

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function closeCurtain() {
  const c = curtain;
  if (!c) return;
  curtain = null;
  window.clearTimeout(c.timer);
  // Never a flash: the curtain holds a beat even when the next screen is already there.
  const wait = Math.max(0, 620 - (performance.now() - c.at));
  window.setTimeout(() => {
    c.node.dataset.out = "true";
    window.setTimeout(() => c.node.remove(), 380);
  }, wait);
}

function openCurtain(from: DOMRect, o: { n: string; title: string; image: string | null; tone: "ink" | "accent"; accent: string }) {
  closeCurtain();
  const node = document.createElement("div");
  node.className = "fr-curtain";
  node.dataset.tone = o.tone;
  node.setAttribute("aria-hidden", "true");
  if (o.accent) node.style.setProperty("--accent", o.accent);
  node.style.setProperty("--ct", `${Math.max(0, from.top)}px`);
  node.style.setProperty("--cr", `${Math.max(0, window.innerWidth - from.right)}px`);
  node.style.setProperty("--cb", `${Math.max(0, window.innerHeight - from.bottom)}px`);
  node.style.setProperty("--cl", `${Math.max(0, from.left)}px`);
  if (o.image) {
    const img = document.createElement("img");
    img.src = o.image;
    img.alt = "";
    node.append(img);
  }
  const word = document.createElement("div");
  word.className = "fr-curtain-word";
  const num = document.createElement("span");
  num.className = "fr-curtain-n";
  num.textContent = o.n;
  const title = document.createElement("span");
  title.className = "p-display";
  title.textContent = o.title;
  word.append(num, title);
  node.append(word);
  document.body.append(node);
  // If the next screen never comes (no signal), the curtain does not stay drawn.
  curtain = { node, at: performance.now(), timer: window.setTimeout(closeCurtain, 6000) };
}

/** Plays the entrance once per artist and draws the curtain back when the front leaves. */
export function FrontGate({ id, slug }: { id: string; slug: string }) {
  useLayoutEffect(() => {
    const root = document.getElementById(id);
    if (!root) return;
    if (seen.has(slug)) root.dataset.seen = "true";
    for (const el of root.querySelectorAll<HTMLElement>("[data-down],[data-press]")) {
      delete el.dataset.down;
      delete el.dataset.press;
    }
  }, [id, slug]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      seen.add(slug);
      document.getElementById(id)?.setAttribute("data-seen", "true");
    }, 1900);
    return () => {
      window.clearTimeout(timer);
      closeCurtain();
    };
  }, [id, slug]);
  return null;
}

/** A door of the front: a tile that leans to the touch, or the reserve key that sinks. */
export function Door({ href, n, title, variant = "tile", closed = false, className = "", children }: { href: string; n: string; title: string; variant?: "tile" | "key"; closed?: boolean; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const going = useRef(false);

  const aim = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", clamp(((x - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--ty", clamp(((y - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const rest = (el: HTMLElement) => {
    delete el.dataset.press;
    if (!going.current) delete el.dataset.down;
    el.style.setProperty("--tx", "0");
    el.style.setProperty("--ty", "0");
  };

  return (
    <Link
      href={href}
      className={className}
      draggable={false}
      data-closed={closed || undefined}
      onPointerDown={(e) => {
        const el = e.currentTarget;
        el.dataset.press = "true";
        if (variant === "key") el.dataset.down = "true";
        else aim(el, e.clientX, e.clientY);
        router.prefetch(href);
      }}
      onPointerMove={(e) => {
        if (variant === "tile" && (e.pointerType === "mouse" || e.currentTarget.dataset.press)) aim(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerUp={(e) => rest(e.currentTarget)}
      onPointerLeave={(e) => rest(e.currentTarget)}
      onPointerCancel={(e) => rest(e.currentTarget)}
      onClick={(e) => {
        // A new tab, a reduced-motion phone: the link is just a link.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || still()) return;
        e.preventDefault();
        if (going.current) return;
        going.current = true;
        const el = e.currentTarget;
        navigator.vibrate?.(8);
        const open = () => {
          openCurtain(el.getBoundingClientRect(), {
            n,
            title,
            image: el.querySelector<HTMLImageElement>("img[data-curtain]")?.currentSrc || null,
            tone: variant === "key" && !el.dataset.closed ? "accent" : "ink",
            accent: getComputedStyle(el).getPropertyValue("--accent").trim(),
          });
          window.setTimeout(() => router.push(href), 340);
        };
        if (variant === "key") {
          // The key is seen all the way down before the screen changes.
          el.dataset.down = "true";
          window.setTimeout(open, 170);
        } else open();
        window.setTimeout(() => {
          going.current = false;
          delete el.dataset.down;
        }, 2600);
      }}
    >
      {children}
    </Link>
  );
}

export type Slide = { url: string; fx: number; fy: number; zoom: number };

/** The work behind its door: each piece drifts and gives way to the next; the thumb swipes or holds one still. */
export function Reel({ slides }: { slides: Slide[] }) {
  const n = slides.length;
  const [at, setAt] = useState<{ i: number; prev: number | null }>({ i: 0, prev: null });
  const [hold, setHold] = useState(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const step = (d: number) => setAt((s) => ({ i: (s.i + d + n) % n, prev: s.i }));

  // The next piece is already in the phone when its turn comes.
  useEffect(() => {
    if (n < 2) return;
    const img = new Image();
    img.src = slides[(at.i + 1) % n].url;
  }, [at.i, n, slides]);

  const picture = (i: number, role: "in" | "out" | "first") => {
    const s = slides[i];
    return (
      <span key={i} className={`fr-slide ${role === "first" ? "" : `fr-slide-${role}`}`} data-drift={i % 2 ? "b" : "a"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.url}
          alt=""
          draggable={false}
          data-curtain={role === "out" ? undefined : ""}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: s.fx !== 50 || s.fy !== 50 || s.zoom !== 1 ? `translate(${s.fx - 50}%, ${s.fy - 50}%) scale(${s.zoom})` : undefined }}
        />
      </span>
    );
  };

  return (
    <span
      className="fr-reel"
      data-hold={hold || undefined}
      onPointerDown={(e) => {
        from.current = { x: e.clientX, y: e.clientY };
        setHold(true);
      }}
      onPointerUp={(e) => {
        const a = from.current;
        from.current = null;
        setHold(false);
        if (!a || n < 2) return;
        const dx = e.clientX - a.x;
        if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(e.clientY - a.y)) return;
        step(dx < 0 ? 1 : -1);
        // A swipe is not a tap: the click that may follow does not open the door.
        swiped.current = true;
        window.setTimeout(() => (swiped.current = false), 350);
      }}
      onPointerLeave={() => {
        from.current = null;
        setHold(false);
      }}
      onPointerCancel={() => {
        from.current = null;
        setHold(false);
      }}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <span className="fr-par">
        {at.prev !== null && at.prev !== at.i && picture(at.prev, "out")}
        {picture(at.i, at.prev === null ? "first" : "in")}
      </span>
      <span className="fr-shade" aria-hidden />
      {n > 1 && (
        <span className="fr-hud" aria-hidden>
          <span className="fr-count">
            <b>{String(at.i + 1).padStart(2, "0")}</b> / {String(n).padStart(2, "0")}
          </span>
          <span className="fr-ticks">
            {slides.map((s, i) => (
              <span key={s.url} className="fr-tick" data-done={i < at.i || undefined}>
                {i === at.i && <span key={`${at.i}-${at.prev}`} className="fr-tick-fill" onAnimationEnd={() => step(1)} />}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
