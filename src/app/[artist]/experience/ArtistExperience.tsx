"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Cover } from "./Cover";
import { Deck } from "./Deck";
import { Panel } from "./Panel";
import { Bio } from "./panels/Bio";
import { Book } from "./panels/Book";
import { Flash } from "./panels/Flash";
import { Gallery } from "./panels/Gallery";
import { Spots } from "./panels/Spots";
import { PANELS, accentOf, type ExperienceData, type PanelId } from "./types";

type View = "cover" | "deck" | PanelId;

const isPanel = (v: string): v is PanelId => (PANELS as string[]).includes(v);

/**
 * The public artist page as a staged experience: cover → deck → one panel at a
 * time. The stage lives in the URL hash so links like /{artist}#book land
 * straight on a panel and the back button walks out again.
 */
export function ArtistExperience({ data }: { data: ExperienceData }) {
  const seenKey = `cover-seen:${data.artist.slug}`;
  const [view, setView] = useState<View>("cover");
  const [last, setLast] = useState<PanelId>("bio");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);
  const pushed = useRef(0);

  const fromHash = useCallback((): View => {
    const h = window.location.hash.replace("#", "");
    if (isPanel(h)) return h;
    if (h === "deck") return "deck";
    try {
      if (sessionStorage.getItem(seenKey)) return "deck";
    } catch {}
    return "cover";
  }, [seenKey]);

  useEffect(() => {
    const v = fromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(v);
    if (isPanel(v)) setLast(v);
    setReady(true);
    const onPop = () => {
      const next = fromHash();
      setFrom(null);
      setView(next);
      if (isPanel(next)) setLast(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [fromHash]);

  const enter = useCallback(() => {
    try {
      sessionStorage.setItem(seenKey, "1");
    } catch {}
    history.replaceState(null, "", "#deck");
    setView("deck");
  }, [seenKey]);

  const open = useCallback((id: PanelId, rect: DOMRect | null) => {
    setFrom(rect);
    setLast(id);
    history.pushState(null, "", `#${id}`);
    pushed.current += 1;
    setView(id);
  }, []);

  const go = useCallback((id: PanelId) => {
    setFrom(null);
    setLast(id);
    history.replaceState(null, "", `#${id}`);
    setView(id);
  }, []);

  const back = useCallback(() => {
    if (pushed.current > 0) {
      pushed.current -= 1;
      history.back();
    } else {
      history.replaceState(null, "", "#deck");
      setFrom(null);
      setView("deck");
    }
  }, []);

  return (
    <div className="poster relative min-h-dvh" style={{ ["--accent" as string]: accentOf(data.artist) }}>
      {!ready ? null : view === "cover" ? (
        <Cover data={data} onEnter={enter} />
      ) : (
        <Deck data={data} initial={last} active={!isPanel(view)} onOpen={open} />
      )}
      {isPanel(view) && (
        <Panel id={view} data={data} from={from} onBack={back} onGo={go}>
          {view === "bio" && <Bio data={data} />}
          {view === "work" && <Gallery data={data} />}
          {view === "flash" && <Flash data={data} />}
          {view === "book" && <Book data={data} onGo={go} />}
          {view === "spots" && <Spots data={data} />}
        </Panel>
      )}
    </div>
  );
}
