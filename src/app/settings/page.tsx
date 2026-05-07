"use client";

/**
 * Settings page — configure inference backend (Ollama vs Google Gemma API).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, SUPPORTED_LOCALES, type LocaleCode } from "@/lib/i18n";

type BackendType = "auto" | "ollama" | "google";

interface SettingsState {
  backend: BackendType;
  googleApiKey: string;
  googleModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

type TestResult = { ok: boolean; message: string } | null;

// SVG icons for backend options — rendered inline so no emoji font rendering differences
const BackendIcons: Record<BackendType, React.ReactNode> = {
  auto: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  ),
  ollama: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="3" width="16" height="11" rx="1.5" />
      <path d="M6 17h8M10 14v3" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17.5 10.5a5.5 5.5 0 1 0-5.5 5.5" />
      <path d="M14 13l3.5 3.5M17.5 13l-3.5 3.5" />
    </svg>
  ),
};

const BACKEND_OPTIONS: { value: BackendType; label: string; desc: string }[] = [
  {
    value: "auto",
    label: "Auto",
    desc: "Try Ollama first, fall back to Google API. Best default.",
  },
  {
    value: "ollama",
    label: "Ollama (Local)",
    desc: "100% offline. Requires Ollama running locally with gemma4:e4b pulled.",
  },
  {
    value: "google",
    label: "Google Gemma API",
    desc: "Works on any device with internet. Requires a free Google AI Studio key.",
  },
];

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslations();
  const [settings, setSettings] = useState<SettingsState>({
    backend: "auto",
    googleApiKey: "",
    googleModel: "gemma-4-27b-it",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "gemma4:e4b",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [error, setError] = useState<string | null>(null);

  // GDACS sync state
  const [gdacsStatus, setGdacsStatus] = useState<{
    lastSync: string | null;
    totalEvents: number;
    syncCount: number;
  } | null>(null);
  const [gdacsSyncing, setGdacsSyncing] = useState(false);
  const [gdacsSyncResult, setGdacsSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsState) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/gdacs/sync")
      .then((r) => r.json())
      .then(setGdacsStatus)
      .catch(() => null);
  }, []);

  async function handleGDACSSync() {
    setGdacsSyncing(true);
    setGdacsSyncResult(null);
    try {
      const res = await fetch("/api/gdacs/sync", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string; inserted?: number };
      setGdacsSyncResult({
        ok: data.ok,
        message: data.ok
          ? (data.message ?? `Synced ${data.inserted ?? 0} events.`)
          : (data.error ?? "Sync failed."),
      });
      if (data.ok) {
        const status = await fetch("/api/gdacs/sync").then((r) => r.json()) as typeof gdacsStatus;
        setGdacsStatus(status);
      }
    } catch {
      setGdacsSyncResult({ ok: false, message: "Network error — check your connection." });
    } finally {
      setGdacsSyncing(false);
    }
  }

  function update(patch: Partial<SettingsState>) {
    setSaved(false);
    setTestResult(null);
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (settings.backend === "ollama" || settings.backend === "auto") {
        const r = await fetch("/api/health/ollama");
        const d = (await r.json()) as { available: boolean };
        if (d.available) {
          setTestResult({ ok: true, message: "Ollama is reachable ✓" });
        } else if (settings.backend === "ollama") {
          setTestResult({ ok: false, message: "Ollama not reachable. Is it running?" });
        } else {
          if (settings.googleApiKey && !settings.googleApiKey.startsWith("••••")) {
            setTestResult({ ok: true, message: "Ollama offline → will use Google Gemma API ✓" });
          } else {
            setTestResult({
              ok: false,
              message: "Ollama offline and no Google API key set. Add a key for fallback.",
            });
          }
        }
      } else {
        if (!settings.googleApiKey || settings.googleApiKey.startsWith("••••")) {
          setTestResult({ ok: false, message: "Please enter your Google API key first." });
        } else {
          setTestResult({ ok: true, message: "Google API key saved. Connection will be verified on first inference call." });
        }
      }
    } catch {
      setTestResult({ ok: false, message: "Connection test failed." });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header — matches dashboard style */}
      <header className="bg-teal-700 text-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
              strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight">Settings</h1>
            <p className="text-[11px] text-teal-200 leading-tight">Inference backend &amp; connectivity</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-10 space-y-4">

        {/* Language selector */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t.settings.language}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.settings.languageDesc}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code as LocaleCode)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition-colors ${
                  locale === l.code
                    ? "border-teal-500 bg-teal-50 text-teal-800"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="font-semibold text-xs leading-tight flex-1 min-w-0">
                  {l.nativeLabel}
                </span>
                {locale === l.code && (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-teal-600 flex-shrink-0">
                    <path d="M13.5 3.5L6 11 2.5 7.5l-1 1L6 13l8.5-8.5z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Backend selector */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Inference Backend</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              GroundTruth uses Gemma 4 for all AI reasoning. Choose how to reach it.
            </p>
          </div>

          <div className="space-y-2.5">
            {BACKEND_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  settings.backend === opt.value
                    ? "border-teal-500 bg-teal-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="backend"
                  value={opt.value}
                  checked={settings.backend === opt.value}
                  onChange={() => update({ backend: opt.value })}
                  className="mt-0.5 accent-teal-600"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className={settings.backend === opt.value ? "text-teal-600" : "text-slate-400"}>
                      {BackendIcons[opt.value]}
                    </span>
                    {opt.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Ollama config */}
        {(settings.backend === "ollama" || settings.backend === "auto") && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
                <rect x="2" y="3" width="16" height="11" rx="1.5" />
                <path d="M6 17h8M10 14v3" />
              </svg>
              Ollama Configuration
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Base URL</label>
                <input
                  type="url"
                  value={settings.ollamaBaseUrl}
                  onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Default: http://localhost:11434. Change if Ollama runs on another machine.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model</label>
                <input
                  type="text"
                  value={settings.ollamaModel}
                  onChange={(e) => update({ ollamaModel: e.target.value })}
                  placeholder="gemma4:e4b"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Run{" "}
                  <code className="bg-slate-100 text-slate-600 px-1 rounded">ollama pull gemma4:e4b</code>{" "}
                  to download.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Google API config */}
        {(settings.backend === "google" || settings.backend === "auto") && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
                <path d="M3 10a7 7 0 1 0 14 0A7 7 0 0 0 3 10z" />
                <path d="M3 10h14M10 3a10 10 0 0 1 0 14M10 3a10 10 0 0 0 0 14" />
              </svg>
              Google Gemma API
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={settings.googleApiKey}
                  onChange={(e) => update({ googleApiKey: e.target.value })}
                  placeholder="AIza…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Get a free key at{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    aistudio.google.com
                  </a>
                  . Stored locally in data/settings.json — never sent anywhere else.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model</label>
                <input
                  type="text"
                  value={settings.googleModel}
                  onChange={(e) => update({ googleModel: e.target.value })}
                  placeholder="gemma-4-27b-it"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Use <code className="bg-slate-100 text-slate-600 px-1 rounded">gemma-4-27b-it</code> (recommended).
                  Switch to <code className="bg-slate-100 text-slate-600 px-1 rounded">gemma-4-9b-it</code> for faster responses.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Test / status results */}
        {testResult && (
          <div className={`rounded-2xl px-4 py-3.5 text-sm font-medium border ${
            testResult.ok
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            {testResult.message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl px-4 py-3.5 text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200">
            Error: {error}
          </div>
        )}

        {saved && !error && (
          <div className="rounded-2xl px-4 py-3.5 text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            ✓ Settings saved
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {/* GDACS Historical Data */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
                <circle cx="10" cy="10" r="8" />
                <path d="M10 5v5l3 3" />
              </svg>
              Historical Disaster Data
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Syncs verified disaster records from{" "}
              <a href="https://gdacs.org" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                GDACS
              </a>{" "}
              — the EU/UN Global Disaster Alert and Coordination System. Gemma uses this to
              ground its reasoning in real incident history, not simulation.
            </p>
          </div>

          {gdacsStatus && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Events cached</p>
                <p className="text-sm font-bold text-slate-700 mt-0.5">
                  {gdacsStatus.totalEvents.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last sync</p>
                <p className="text-sm font-bold text-slate-700 mt-0.5">
                  {gdacsStatus.lastSync
                    ? new Date(gdacsStatus.lastSync).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : "Never"}
                </p>
              </div>
            </div>
          )}

          {gdacsSyncResult && (
            <div className={`rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
              gdacsSyncResult.ok
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}>
              {gdacsSyncResult.message}
            </div>
          )}

          <button
            onClick={() => void handleGDACSSync()}
            disabled={gdacsSyncing}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {gdacsSyncing ? "Fetching from GDACS…" : "Sync Historical Data"}
          </button>
          <p className="text-xs text-slate-400">
            Fetches 3 years of Red + Orange alert events globally. Takes ~10 seconds.
            Results are cached offline — sync once, use forever.
          </p>
        </section>

        {/* PWA install hint */}
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <rect x="5" y="1" width="10" height="18" rx="2" />
              <path d="M10 15h.01" />
            </svg>
            Install as offline app
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            GroundTruth is a Progressive Web App. In Chrome or Safari, tap{" "}
            <strong>Share → Add to Home Screen</strong> (iOS) or the install icon in the address
            bar (desktop/Android). Once installed, the app and map tiles work without internet.
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">
            AI inference still requires Ollama running locally <em>or</em> a Google API key.
          </p>
        </section>
      </div>
    </div>
  );
}
