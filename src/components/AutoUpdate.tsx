"use client";
import { useEffect } from "react";

// The home-screen app keeps the old version in memory. When it comes back to the
// foreground, check whether a newer deployment is live and reload if so.
const BUILT = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null;

export function AutoUpdate() {
  useEffect(() => {
    if (!BUILT) return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 60000) return;
      last = Date.now();
      try {
        const { v } = await (await fetch("/api/version", { cache: "no-store" })).json();
        if (v && v !== BUILT) window.location.reload();
      } catch {}
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return null;
}
