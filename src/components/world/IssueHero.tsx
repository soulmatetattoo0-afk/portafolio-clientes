"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { fill } from "@/i18n";
import type { Story } from "@/lib/issue/types";

const DWELL = 7000;
const NOOP = () => () => {};

/** Whether the person asked for less motion; false on the server. */
function useReducedMotion() {
  const subscribe = useCallback((cb: () => void) => {
    if (typeof window === "undefined") return NOOP();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * The front page is the cover. One slide per story that has a photograph,
 * the cover first; the photograph of the story in view sits behind the
 * whole hero and cross-fades as you swipe, and the hero's accent follows
 * the story. Auto-advances like a story reel, stops under a finger, a
 * pointer or a focus, and never moves on its own for people who asked
 * for less motion.
 */
export function IssueHero({
  stories,
  issueHref,
  stamp,
  brand,
  coverLines,
  labels,
}: {
  stories: Story[];
  issueHref: string;
  /** "No. 01 · October 2026" */
  stamp: string;
  brand: string;
  coverLines: string[];
  labels: { read: string; open: string; story: string; cover: string; pause: string; play: string };
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reach, setReach] = useState(2);
  const [held, setHeld] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [cycle, setCycle] = useState(0);
  const reduced = useReducedMotion();
  const total = stories.length;
  const paused = held || stopped || reduced || total < 2;
  const story = stories[active] ?? stories[0];

  const go = useCallback(
    (i: number, smooth = true) => {
      const el = scroller.current;
      if (!el || total === 0) return;
      const n = ((i % total) + total) % total;
      el.scrollTo({ left: n * el.clientWidth, behavior: smooth && !reduced ? "smooth" : "auto" });
    },
    [total, reduced],
  );

  // Which slide is in view, and let the next one's photograph load ahead.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (!Number.isFinite(i)) continue;
          setActive(i);
          setReach((r) => Math.max(r, i + 2));
        }
      },
      { root: el, threshold: 0.6 },
    );
    for (const child of el.children) io.observe(child);
    return () => io.disconnect();
  }, [total]);

  // The reel: one dwell per story, restarted whenever the story or the pause changes.
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => go(active + 1), DWELL);
    return () => window.clearTimeout(id);
  }, [active, paused, cycle, go]);

  const resume = () => {
    setHeld(false);
    setCycle((c) => c + 1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    }
  };

  if (total === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={stamp}
      className="p-hero relative h-[calc(100dvh-4.2rem)] max-h-[760px] min-h-[560px] overflow-hidden bg-ink text-bone"
      style={{ "--accent": story.accent } as React.CSSProperties}
      onKeyDown={onKeyDown}
      onPointerDown={() => setHeld(true)}
      onPointerUp={resume}
      onPointerCancel={resume}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={resume}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume();
      }}
    >
      {/* The photograph behind everything: the story in view, cross-fading. */}
      <div aria-hidden className="absolute inset-0">
        {stories.map((s, i) =>
          i < reach && s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={s.image}
              alt=""
              fetchPriority={i === 0 ? "high" : undefined}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[600ms] ease-out ${s.pos === "top" ? "object-top" : "object-center"} ${i === active ? "opacity-100" : "opacity-0"}`}
            />
          ) : null,
        )}
        <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-ink/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-ink via-ink/80 to-transparent" />
        <div className="p-halftone opacity-[0.09]" />
      </div>

      {/* The reel's progress, one thin bar per story. */}
      <ol aria-hidden className="absolute inset-x-0 top-3 z-20 mx-auto flex max-w-[1280px] gap-1.5 px-4">
        {stories.map((s, i) => (
          <li key={s.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-bone/25">
            <span key={i === active ? cycle : undefined} className={`block h-full w-full origin-left bg-bone ${i < active ? "" : i === active ? "p-fill" : "scale-x-0"}`} data-paused={paused} />
          </li>
        ))}
      </ol>

      <p className="sr-only" aria-live="polite">
        {fill(labels.story, { n: active + 1, total })}
      </p>

      {/* The slides. */}
      <div ref={scroller} className="relative z-10 flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s, i) => {
          const isCover = s.kind === "cover";
          const href = isCover ? issueHref : `${issueHref}?p=${s.id}`;
          return (
            <div key={s.id} data-index={i} role="group" aria-roledescription="slide" aria-label={isCover ? labels.cover : fill(labels.story, { n: i + 1, total })} className="h-full w-full shrink-0 snap-center snap-always">
              <Link href={href} className="mx-auto flex h-full w-full max-w-[1280px] flex-col justify-between px-4 pt-9 pb-7 outline-none focus-visible:[&>*]:underline" draggable={false}>
                {isCover ? (
                  <>
                    <div>
                      <p className="p-display text-[clamp(5rem,40.5vw,13rem)] leading-[0.78] tracking-[-0.01em] text-bone">{brand}</p>
                      <p className="p-stamp mt-3 flex justify-between gap-4 border-t border-bone/50 pt-2 text-bone/85">
                        {stamp.split(" · ").map((part) => (
                          <span key={part}>{part}</span>
                        ))}
                      </p>
                    </div>
                    <div className="max-w-[34rem]">
                      {coverLines[0] && <p className="p-display text-[clamp(1.9rem,8.6vw,2.8rem)] leading-[0.92] text-bone">{coverLines[0]}</p>}
                      {coverLines.slice(1).map((line) => (
                        <p key={line} className="p-gothic mt-2 text-[clamp(1.15rem,5vw,1.5rem)] leading-tight text-accent transition-colors duration-[600ms]">
                          {line}
                        </p>
                      ))}
                      {s.line && <p className="p-stamp mt-5 text-bone/70">{s.line}</p>}
                      <span className="btn btn-primary mt-5">{labels.read}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="p-stamp text-bone/85">{stamp}</p>
                    <div className="max-w-[40rem]">
                      <p className="p-gothic text-[clamp(1.2rem,5.2vw,1.6rem)] text-accent transition-colors duration-[600ms]">{s.kicker}</p>
                      <h2 className="p-display mt-1 text-[clamp(2.4rem,11vw,4rem)] text-bone">{s.title}</h2>
                      {s.body && <p className="p-quote mt-3 line-clamp-2 text-[clamp(1.2rem,5vw,1.6rem)] text-bone/90">{s.body}</p>}
                      <p className="p-stamp mt-4 flex min-h-11 items-center text-bone">{labels.open} →</p>
                    </div>
                  </>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Where you are in the reel, and the one control. */}
      {total > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-7 z-20 mx-auto flex max-w-[1280px] items-center justify-end gap-1 px-4 text-bone/70">
          <span className="p-stamp tabular-nums" aria-hidden>
            {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          {!reduced && (
            <button type="button" onClick={() => setStopped((v) => !v)} aria-pressed={stopped} aria-label={stopped ? labels.play : labels.pause} title={stopped ? labels.play : labels.pause} className="pointer-events-auto -mr-3 inline-flex h-11 w-11 items-center justify-center rounded-full hover:text-bone">
              {stopped ? (
                <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
                  <path d="M2 1.5v9l8-4.5z" />
                </svg>
              ) : (
                <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
                  <path d="M2 1.5h3v9H2zM7 1.5h3v9H7z" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
