"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QRPayload } from "./QRShare";

type ScanState = "idle" | "scanning" | "detected" | "importing" | "done" | "error";

interface ImportedSignal {
  id: string;
  locationName: string;
  claim: string;
  credibilityScore: number;
  severity: number;
}

function isValidPayload(obj: unknown): obj is QRPayload {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    p.v === 1 &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    typeof p.ts === "number" &&
    (p.type === "text" || p.type === "photo" || p.type === "voice")
  );
}

export default function QRScanner() {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);

  const [scanState, setScanState]         = useState<ScanState>("idle");
  const [payload, setPayload]             = useState<QRPayload | null>(null);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [importedSignal, setImportedSignal] = useState<ImportedSignal | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(() => void scanFrame());
      return;
    }
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Use BarcodeDetector if available (Chrome/Edge/Android), fall back to jsQR
    let result: string | null = null;
    if ("BarcodeDetector" in window) {
      try {
        // @ts-expect-error — BarcodeDetector not in lib.dom yet
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const codes = await detector.detect(canvas) as Array<{ rawValue: string }>;
        if (codes.length > 0) result = codes[0].rawValue;
      } catch {
        // fall through to jsQR
      }
    }

    if (!result) {
      const { default: jsQR } = await import("jsqr");
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) result = code.data;
    }

    if (result) {
      try {
        const parsed: unknown = JSON.parse(result);
        if (isValidPayload(parsed)) {
          stopCamera();
          setPayload(parsed);
          setScanState("detected");
          return;
        }
      } catch {
        // not a GroundTruth QR — keep scanning
      }
    }

    rafRef.current = requestAnimationFrame(() => void scanFrame());
  }, [stopCamera]);

  async function startCamera() {
    setScanState("scanning");
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(() => void scanFrame());
    } catch {
      setScanState("error");
      setErrorMsg("Camera access denied. Allow camera permission and try again.");
    }
  }

  function cancel() {
    stopCamera();
    setScanState("idle");
    setPayload(null);
    setImportedSignal(null);
    setErrorMsg(null);
  }

  async function importReport() {
    if (!payload) return;
    setScanState("importing");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: payload.type,
          content: payload.content ?? "",
          latitude: payload.lat,
          longitude: payload.lng,
        }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = (await res.json()) as { signal: ImportedSignal };
      setImportedSignal(data.signal);
      setScanState("done");
    } catch (err) {
      setScanState("error");
      setErrorMsg(err instanceof Error ? err.message : "Import failed. Try again.");
    }
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (scanState === "idle") {
    return (
      <button
        onClick={() => void startCamera()}
        className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-left hover:border-teal-300 transition-colors group"
      >
        {/* QR icon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round"
          className="w-5 h-5 text-teal-500 flex-shrink-0 group-hover:scale-110 transition-transform">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h2v2h-2z" /><path d="M18 14h3" /><path d="M14 18v3" /><path d="M20 18v3" /><path d="M18 20h3" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Scan a report from another device</p>
          <p className="text-xs text-slate-500 mt-0.5">Import a report shared via QR code — no internet needed.</p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-4 h-4 text-slate-400 flex-shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    );
  }

  if (scanState === "scanning") {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="relative bg-black aspect-square max-h-64 w-full overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            aria-label="Camera viewfinder"
          />
          <canvas ref={canvasRef} className="hidden" />
          {/* Corner finder marks */}
          <div className="absolute inset-6 pointer-events-none">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-teal-400 rounded-tl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-teal-400 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-teal-400 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-teal-400 rounded-br" />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-slate-500">Point at a GroundTruth QR code</p>
          <button onClick={cancel} className="text-xs font-semibold text-slate-500 hover:text-rose-500 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (scanState === "detected" && payload) {
    const typeLabel =
      payload.type === "photo" ? "Photo report" :
      payload.type === "voice" ? "Voice report" : "Text report";

    return (
      <div className="bg-white border border-teal-200 rounded-2xl overflow-hidden">
        <div className="bg-teal-50 px-4 py-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-teal-600 flex-shrink-0">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold text-teal-800">Report detected</p>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Type</span>
            <span className="font-medium text-slate-700">{typeLabel}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Location</span>
            <span className="font-medium text-slate-700 font-mono">
              {payload.lat.toFixed(4)}, {payload.lng.toFixed(4)}
            </span>
          </div>
          {payload.content && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-600 italic leading-relaxed">
                &ldquo;{payload.content.slice(0, 120)}{payload.content.length > 120 ? "…" : ""}&rdquo;
              </p>
            </div>
          )}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={cancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void importReport()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Save to this device
          </button>
        </div>
      </div>
    );
  }

  if (scanState === "importing") {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-5 flex items-center gap-3">
        <svg className="animate-spin h-4 w-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-600">Saving report to this device…</p>
      </div>
    );
  }

  if (scanState === "done" && importedSignal) {
    return (
      <div className="bg-white border border-teal-200 rounded-2xl overflow-hidden">
        <div className="bg-teal-50 px-4 py-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-teal-600 flex-shrink-0">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold text-teal-800">Report saved</p>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          {importedSignal.locationName && (
            <p className="text-xs text-slate-500">{importedSignal.locationName}</p>
          )}
          {importedSignal.claim && (
            <p className="text-xs text-slate-600 italic leading-relaxed">
              &ldquo;{importedSignal.claim}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-teal-600 font-semibold">
              Credibility {Math.round(importedSignal.credibilityScore * 100)}%
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">Severity {importedSignal.severity}/5</span>
          </div>
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={cancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Scan another
          </button>
          <a
            href="/"
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors text-center"
          >
            View dashboard
          </a>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3.5 flex items-start gap-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-rose-700">{errorMsg ?? "Something went wrong"}</p>
        <button onClick={cancel} className="text-xs font-semibold text-rose-600 underline mt-1">
          Try again
        </button>
      </div>
    </div>
  );
}
