"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the browser has no WAN connectivity.
 * Uses navigator.onLine as the primary signal, then verifies with a
 * lightweight fetch to the Ollama health endpoint (which is always
 * localhost — if that's reachable, Gemma can still run even offline).
 */
export function useOffline(): { isOffline: boolean; ollamaReachable: boolean } {
  // Start with false (SSR-safe) — corrected in first useEffect tick
  const [isOffline, setIsOffline] = useState(false);
  const [ollamaReachable, setOllamaReachable] = useState(true);

  useEffect(() => {
    // Sync with real navigator state after hydration
    setIsOffline(!navigator.onLine);

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const checkOllama = async () => {
      try {
        const res = await fetch("/api/health/ollama", { signal: AbortSignal.timeout(3000) });
        setOllamaReachable(res.ok);
      } catch {
        setOllamaReachable(false);
      }
    };

    void checkOllama();
    const id = setInterval(checkOllama, 15_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(id);
    };
  }, []);

  return { isOffline, ollamaReachable };
}
