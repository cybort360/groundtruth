/**
 * Settings API — GET returns current settings, POST saves and reloads backend.
 *
 * The Google API key is redacted in GET responses (show only last 4 chars)
 * so it never leaks into client-side state in plaintext.
 */

import { NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/gemma-backends/settings";
import { invalidateBackendCache } from "@/lib/gemma-backends";
import type { AppSettings } from "@/lib/gemma-backends/types";

export async function GET() {
  const settings = loadSettings();
  // Redact API key — only reveal last 4 chars so the UI can show "••••••••abcd"
  const redacted = {
    ...settings,
    googleApiKey: settings.googleApiKey
      ? "••••••••" + settings.googleApiKey.slice(-4)
      : "",
  };
  return NextResponse.json(redacted);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AppSettings>;

  // If the client sends a redacted placeholder (starts with bullets) don't overwrite the real key
  if (body.googleApiKey?.startsWith("••••")) {
    const current = loadSettings();
    body.googleApiKey = current.googleApiKey;
  }

  const saved = saveSettings(body);
  invalidateBackendCache(); // force re-probe on next inference call

  return NextResponse.json({
    ok: true,
    backend: saved.backend,
    googleModel: saved.googleModel,
    ollamaBaseUrl: saved.ollamaBaseUrl,
    ollamaModel: saved.ollamaModel,
    googleApiKeySet: !!saved.googleApiKey,
  });
}
