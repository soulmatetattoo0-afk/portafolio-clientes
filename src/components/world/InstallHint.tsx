"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "vanta-install-dismissed";

/** One line, dismissable: put Vanta on the home screen. Gone once installed or once waved away. */
export function InstallHint({ labels }: { labels: { text: string; add: string; how: string; dismiss: string } }) {
  const [show, setShow] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [how, setHow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true || new URLSearchParams(window.location.search).get("source") === "pwa";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!dismissed && !standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };

  const add = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setShow(false);
    } else setHow((v) => !v);
  };

  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border border-line bg-ink-2 py-1.5 pr-1.5 pl-4 text-[0.85rem] text-bone/85">
      <span className="min-w-0 flex-1">{how ? labels.how : labels.text}</span>
      <span className="flex items-center">
        <button type="button" className="btn btn-ghost btn-sm text-bone" onClick={add}>
          {labels.add}
        </button>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-bone-dim hover:text-bone" onClick={dismiss} aria-label={labels.dismiss} title={labels.dismiss}>
          <span aria-hidden className="text-[1.1rem] leading-none">×</span>
        </button>
      </span>
    </div>
  );
}
