/**
 * App settings — persisted to data/settings.json (or /tmp on Vercel).
 *
 * Priority order:
 *   1. Environment variables   — highest (useful for Vercel / CI deployments)
 *   2. settings.json on disk   — set via the Settings UI
 *   3. DEFAULT_SETTINGS        — fallback
 */

import fs from "fs";
import path from "path";
import type { AppSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

// Vercel's /var/task is read-only; /tmp is the only writable directory.
const SETTINGS_PATH = process.env.VERCEL
  ? path.join("/tmp", "settings.json")
  : path.join(process.cwd(), "data", "settings.json");

/** Read env-var overrides so Vercel deployments work without a settings file. */
function getEnvOverrides(): Partial<AppSettings> {
  const overrides: Partial<AppSettings> = {};
  if (process.env.GOOGLE_API_KEY) overrides.googleApiKey = process.env.GOOGLE_API_KEY;
  if (process.env.GOOGLE_MODEL)   overrides.googleModel   = process.env.GOOGLE_MODEL;
  if (process.env.OLLAMA_BASE_URL) overrides.ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
  if (process.env.OLLAMA_MODEL)   overrides.ollamaModel   = process.env.OLLAMA_MODEL;
  // If a Google key is present and no explicit backend is set, prefer Google
  // (Ollama won't be reachable in serverless environments).
  if (process.env.GOOGLE_API_KEY && !process.env.BACKEND) overrides.backend = "google";
  if (process.env.BACKEND) overrides.backend = process.env.BACKEND as AppSettings["backend"];
  return overrides;
}

export function loadSettings(): AppSettings {
  let fileSettings: Partial<AppSettings> = {};
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    fileSettings = JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    // No file or parse error — fall through to defaults + env vars.
  }
  // env vars win over the file so deployments can be configured without a UI
  return { ...DEFAULT_SETTINGS, ...fileSettings, ...getEnvOverrides() };
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const next = { ...current, ...settings };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}
