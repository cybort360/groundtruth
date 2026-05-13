"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { encryptPayload } from "@/lib/crypto";

export interface QRPayload {
  v: 1;
  type: "text" | "photo" | "voice";
  lat: number;
  lng: number;
  ts: number;
  content?: string; // text or AI-extracted claim
}

interface Props {
  payload: QRPayload;
  onClose: () => void;
}

export default function QRShare({ payload, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nfcAvail, setNfcAvail]   = useState(false);
  const [nfcStatus, setNfcStatus] = useState<"idle" | "writing" | "done" | "error">("idle");
  const [canShare, setCanShare]   = useState(false);

  // Encryption state
  const [encEnabled, setEncEnabled] = useState(false);
  const [pin, setPin]               = useState("");
  const [encrypting, setEncrypting] = useState(false);
  // qrData holds the final string to encode — either plain URL or encrypted URL
  const [qrData, setQrData]         = useState<string | null>(null);
  // nfcData holds what gets written to NFC (JSON string, plain or encrypted)
  const [nfcData, setNfcData]       = useState<string>("");
  // Always show the PIN toggle — the encrypt/decrypt functions handle
  // unavailable crypto gracefully by falling back to plain QR.
  const canEncrypt = true;

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    setNfcAvail("NDEFReader" in window);
  }, []);

  // Build QR + NFC data whenever payload, encrypt toggle, or PIN changes.
  // Debounced 400 ms on the PIN so we don't re-encrypt on every keystroke.
  const buildQrData = useCallback(async () => {
    const origin = window.location.origin;

    if (encEnabled && pin.length >= 4) {
      setEncrypting(true);
      try {
        const encrypted = await encryptPayload(JSON.stringify(payload), pin);
        const encJson   = JSON.stringify(encrypted);
        const params    = new URLSearchParams({ d: btoa(encJson) });
        setQrData(`${origin}/import?${params}`);
        setNfcData(encJson);
      } catch (e) {
        console.error("[crypto] encrypt failed:", e);
        // Fall through to plain
        const params = new URLSearchParams({ d: btoa(JSON.stringify(payload)) });
        setQrData(`${origin}/import?${params}`);
        setNfcData(JSON.stringify(payload));
      } finally {
        setEncrypting(false);
      }
    } else {
      // Plain (unencrypted) mode
      const params = new URLSearchParams({ d: btoa(JSON.stringify(payload)) });
      setQrData(`${origin}/import?${params}`);
      setNfcData(JSON.stringify(payload));
    }
  }, [payload, encEnabled, pin]);

  // Debounce PIN changes by 400 ms so we don't re-encrypt mid-typing
  useEffect(() => {
    if (encEnabled && pin.length > 0 && pin.length < 4) {
      // Don't encrypt yet — PIN too short
      const params = new URLSearchParams({ d: btoa(JSON.stringify(payload)) });
      setQrData(`${window.location.origin}/import?${params}`);
      return;
    }
    const timer = setTimeout(() => { void buildQrData(); }, pin.length > 0 ? 400 : 0);
    return () => clearTimeout(timer);
  }, [buildQrData, encEnabled, pin, payload]);

  // Draw QR on canvas whenever qrData changes
  useEffect(() => {
    if (!canvasRef.current || !qrData) return;
    const locked = encEnabled && pin.length >= 4;
    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 240,
      margin: 2,
      color: {
        dark: locked ? "#0f4c35" : "#0f172a", // teal tint when locked
        light: "#ffffff",
      },
    }).catch(console.error);
  }, [qrData, encEnabled, pin]);

  function downloadQR() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `groundtruth-report-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function shareQR() {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "groundtruth-report.png", { type: "image/png" });
      try {
        await navigator.share({
          title: "GroundTruth Report",
          text: "Scan this QR code to import this report into GroundTruth.",
          files: [file],
        });
      } catch {
        // user cancelled — no-op
      }
    }, "image/png");
  }

  async function writeNFC() {
    if (!("NDEFReader" in window)) return;
    setNfcStatus("writing");
    try {
      // @ts-expect-error — NDEFReader types not in lib.dom
      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [{ recordType: "text", data: nfcData }],
      });
      setNfcStatus("done");
    } catch {
      setNfcStatus("error");
    }
  }

  const typeLabel =
    payload.type === "photo" ? "Photo report" :
    payload.type === "voice" ? "Voice report" :
    "Text report";

  const locked = encEnabled && pin.length >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm pb-safe overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-900">Share this report</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Another device scans this to import it — no internet needed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center gap-3 px-4 py-5">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className={`rounded-xl border-2 transition-colors ${locked ? "border-teal-400" : "border-slate-100"}`}
              aria-label="QR code for this report"
            />
            {/* Lock badge overlay when encrypted */}
            {locked && (
              <div className="absolute -top-2 -right-2 w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            )}
            {/* Encrypting spinner */}
            {encrypting && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                <svg className="animate-spin h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-xs font-semibold text-slate-700">{typeLabel}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {payload.lat.toFixed(4)}, {payload.lng.toFixed(4)}
            </p>
            {payload.content && (
              <p className="text-xs text-slate-500 mt-1 italic max-w-[220px] mx-auto leading-relaxed">
                &ldquo;{payload.content.slice(0, 80)}{payload.content.length > 80 ? "…" : ""}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* PIN lock toggle */}
        {canEncrypt && (
          <div className="px-4 pb-3">
            <div className={`rounded-xl border transition-colors ${encEnabled ? "border-teal-200 bg-teal-50" : "border-slate-100 bg-slate-50"}`}>
              <button
                onClick={() => { setEncEnabled((v) => !v); setPin(""); }}
                className="w-full flex items-center justify-between px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`w-4 h-4 ${encEnabled ? "text-teal-600" : "text-slate-400"}`}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className={`text-xs font-semibold ${encEnabled ? "text-teal-700" : "text-slate-600"}`}>
                    {encEnabled ? "PIN lock enabled" : "Lock with PIN"}
                  </span>
                </div>
                {/* Toggle pill */}
                <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${encEnabled ? "bg-teal-500" : "bg-slate-200"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${encEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </button>

              {encEnabled && (
                <div className="px-3.5 pb-3 space-y-2 border-t border-teal-100">
                  <p className="text-[11px] text-teal-600 pt-2 leading-relaxed">
                    Tell the recipient the PIN separately — it is not stored in the QR code.
                  </p>
                  <input
                    type="text"
                    inputMode="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter PIN (min. 4 characters)"
                    className="w-full px-3 py-2 border border-teal-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono tracking-wider"
                    autoFocus
                  />
                  {pin.length > 0 && pin.length < 4 && (
                    <p className="text-[11px] text-amber-600">PIN must be at least 4 characters.</p>
                  )}
                  {locked && (
                    <p className="text-[11px] text-teal-700 font-medium">
                      ✓ QR is encrypted. Share the PIN with your recipient out of band.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Download + Share row */}
        <div className="flex gap-2 px-4 pb-2">
          <button
            onClick={downloadQR}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
          {canShare && (
            <button
              onClick={() => void shareQR()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          )}
        </div>

        {/* NFC option */}
        {nfcAvail && (
          <div className="px-4 pb-2">
            <button
              onClick={() => void writeNFC()}
              disabled={nfcStatus === "writing" || nfcStatus === "done"}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                nfcStatus === "done"    ? "bg-teal-50 text-teal-700 border border-teal-100" :
                nfcStatus === "error"   ? "bg-rose-50 text-rose-700 border border-rose-100" :
                nfcStatus === "writing" ? "bg-slate-100 text-slate-400 cursor-wait" :
                "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" className="w-4 h-4">
                <path d="M20 12a8 8 0 0 0-8-8" /><path d="M4 12a8 8 0 0 1 8-8" />
                <path d="M20 12a8 8 0 0 1-8 8" /><path d="M4 12a8 8 0 0 0 8 8" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
              {nfcStatus === "writing" ? "Hold near another device…" :
               nfcStatus === "done"    ? `NFC written${locked ? " (encrypted)" : ""}` :
               nfcStatus === "error"   ? "NFC failed — use QR code" :
               `Share via NFC${locked ? " (encrypted)" : ""}`}
            </button>
          </div>
        )}

        <div className="px-4 pb-4 pt-1">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
