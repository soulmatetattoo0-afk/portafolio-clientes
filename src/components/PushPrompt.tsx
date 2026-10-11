"use client";

import { useEffect, useState } from "react";

import { savePushSubscription } from "@/app/actions/push";

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type State = "unsupported" | "ask" | "on" | "denied" | "ios";

/**
 * The switch for notifications with the app closed. Registers the service
 * worker, asks the browser's permission on a tap (never by itself) and keeps
 * the subscription on the server. On an iPhone the app has to be on the home
 * screen first; then it says so instead of offering a switch that can't work.
 */
export function PushPrompt({ vapidKey, labels, className = "" }: { vapidKey: string; labels: { title: string; body: string; enable: string; on: string; denied: string; ios: string }; className?: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(ios && !standalone ? "ios" : "unsupported");
      return;
    }
    void navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") setState("denied");
      else if (sub && Notification.permission === "granted") {
        // Keep the server's copy fresh (the person may have signed in with another account).
        void savePushSubscription(sub.toJSON());
        setState("on");
      } else setState("ask");
    });
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "ask");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidKey) }));
      const res = await savePushSubscription(sub.toJSON());
      setState(res.ok ? "on" : "ask");
    } finally {
      setBusy(false);
    }
  };

  if (!state || state === "unsupported" || state === "on") return null;
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-niche px-4 py-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-semibold">{labels.title}</p>
        <p className="text-[0.85rem] text-ash">{state === "denied" ? labels.denied : state === "ios" ? labels.ios : labels.body}</p>
      </div>
      {state === "ask" && (
        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={enable} disabled={busy} aria-busy={busy}>
          {labels.enable}
        </button>
      )}
    </div>
  );
}
