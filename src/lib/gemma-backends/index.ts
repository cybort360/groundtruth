/**
 * Backend resolver — returns the active GemmaBackend instance.
 *
 * Auto mode:
 *   1. Try Ollama (localhost:11434) — full offline-capable
 *   2. Fall back to Google Gemma API — works for anyone with a key
 *
 * The resolved backend is cached for the lifetime of the process
 * so every request doesn't re-probe Ollama.
 */

import { OllamaBackend } from "./ollama";
import { GoogleGemmaBackend } from "./google";
import { loadSettings } from "./settings";
import type { GemmaBackend } from "./types";

let _cachedBackend: GemmaBackend | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 30_000; // re-probe every 30 s

export async function getBackend(): Promise<GemmaBackend> {
  if (_cachedBackend && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cachedBackend;
  }

  const settings = loadSettings();

  if (settings.backend === "ollama") {
    _cachedBackend = new OllamaBackend(settings.ollamaBaseUrl, settings.ollamaModel);
  } else if (settings.backend === "google") {
    _cachedBackend = new GoogleGemmaBackend(settings.googleApiKey, settings.googleModel);
  } else {
    // Auto: try Ollama first
    const ollama = new OllamaBackend(settings.ollamaBaseUrl, settings.ollamaModel);
    const ollamaUp = await ollama.isAvailable();
    if (ollamaUp) {
      _cachedBackend = ollama;
    } else if (settings.googleApiKey) {
      _cachedBackend = new GoogleGemmaBackend(settings.googleApiKey, settings.googleModel);
    } else {
      // No backend available — return Ollama so callers get a meaningful error
      _cachedBackend = ollama;
    }
  }

  _cachedAt = Date.now();
  return _cachedBackend;
}

/** Force re-probe on next call (call after settings change). */
export function invalidateBackendCache(): void {
  _cachedBackend = null;
  _cachedAt = 0;
}

export type { GemmaBackend, AppSettings, BackendType } from "./types";
