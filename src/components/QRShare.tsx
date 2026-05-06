"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

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
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [nfcAvail, setNfcAvail] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<"idle" | "writing" | "done" | "error">("idle");

  // Generate QR code onto the canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
      width: 240,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(console.error);
  }, [payload]);

  // Detect Web NFC support (Android Chrome only)
  useEffect(() => {
    setNfcAvail("NDEFReader" in window);
  }, []);

  async function writeNFC() {
    if (!("NDEFReader" in window)) return;
    setNfcStatus("writing");
    try {
      // @ts-expect-error — NDEFReader types not in lib.dom
      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [{ recordType: "text", data: JSON.stringify(payload) }],
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
          <canvas
            ref={canvasRef}
            className="rounded-xl border border-slate-100"
            aria-label="QR code for this report"
          />
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

        {/* NFC option */}
        {nfcAvail && (
          <div className="px-4 pb-2">
            <button
              onClick={() => void writeNFC()}
              disabled={nfcStatus === "writing" || nfcStatus === "done"}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                nfcStatus === "done"   ? "bg-teal-50 text-teal-700 border border-teal-100" :
                nfcStatus === "error"  ? "bg-rose-50 text-rose-700 border border-rose-100" :
                nfcStatus === "writing"? "bg-slate-100 text-slate-400 cursor-wait" :
                "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {/* NFC wave icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" className="w-4 h-4">
                <path d="M20 12a8 8 0 0 0-8-8" /><path d="M4 12a8 8 0 0 1 8-8" />
                <path d="M20 12a8 8 0 0 1-8 8" /><path d="M4 12a8 8 0 0 0 8 8" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
              {nfcStatus === "writing" ? "Hold near another device…" :
               nfcStatus === "done"    ? "NFC written" :
               nfcStatus === "error"   ? "NFC failed — use QR code" :
               "Share via NFC tap"}
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
