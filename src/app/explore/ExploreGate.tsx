"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Everything beyond one artist's page shows through a dark vignette on the
 * web. Installed as an app (home screen), the gate is gone.
 */
export function ExploreGate({
  labels,
  children,
}: {
  labels: { title: string; body: string; install: string; installing: string; later: string; back: { label: string; href: string } | null };
  children: React.ReactNode;
}) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true || new URLSearchParams(window.location.search).get("source") === "pwa";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } else {
      setHint(true);
    }
  };

  if (installed) return <>{children}</>;

  return (
    <div className="relative">
      {/* The world, dimmed: readable enough to want it, not enough to use it. */}
      <div aria-hidden={installed === false} className="pointer-events-none select-none [filter:brightness(0.42)_saturate(0.7)]">
        {children}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_70%_55%_at_50%_35%,transparent_30%,rgb(10_10_10/0.85)_100%)]" />

      <div className="fixed inset-x-0 bottom-0 z-30 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="p-sheet mx-auto max-w-md rounded-[22px] border border-line bg-ink/95 p-5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur">
          <p className="p-display text-[1.9rem] leading-[0.95] text-bone">{labels.title}</p>
          <p className="mt-2 text-[0.92rem] text-bone/80">{labels.body}</p>
          {hint && <p className="mt-3 rounded-[12px] border border-line px-3 py-2 text-[0.85rem] text-bone-dim">{labels.installing}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-accent" onClick={install}>
              {labels.install}
            </button>
            {labels.back ? (
              <Link href={labels.back.href} className="btn btn-secondary">
                {labels.back.label}
              </Link>
            ) : (
              <Link href="/" className="btn btn-secondary">
                {labels.later}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
