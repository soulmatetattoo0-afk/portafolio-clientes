"use client";

import { useEffect } from "react";

/** While the app is open and in view, tell the server every 40 s, so chat emails wait while you're here. */
export function Presence() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") void fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => undefined);
    };
    ping();
    const id = setInterval(ping, 40_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
