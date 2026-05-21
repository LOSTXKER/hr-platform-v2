"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // skip dev (Turbopack reload)

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[pwa] SW register failed:", err));
  }, []);

  return null;
}
