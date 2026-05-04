"use client";

import { useEffect } from "react";

/**
 * Registers the GroundTruth service worker on first load.
 * The SW caches OSM map tiles so the map works in Airplane Mode after
 * the user has browsed the area at least once.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[sw] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[sw] Registration failed:", err);
        });
    }
  }, []);

  return null;
}
