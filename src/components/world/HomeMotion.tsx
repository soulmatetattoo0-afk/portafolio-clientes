"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * The front page's motion, in one place: anything marked `data-reveal` rises
 * into view as it scrolls in, the children of a `data-reveal-group` one
 * after another, and `data-parallax` words drift slower than the page.
 * People who asked for less motion see everything in place.
 */
export function HomeMotion() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
        const kids = Array.from(group.children);
        if (!kids.length) return;
        gsap.fromTo(kids, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: "power3.out", scrollTrigger: { trigger: group, start: "top 88%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        gsap.to(el, { yPercent: -22, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true } });
      });
    });
    return () => mm.revert();
  }, []);
  return null;
}
