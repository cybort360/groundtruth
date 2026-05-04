/**
 * App settings — persisted to data/settings.json.
 * Readable and writable from the server side without a DB migration.
 */

import fs from "fs";
import path from "path";
import type { AppSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const next = { ...current, ...settings };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}
