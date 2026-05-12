"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import LocationPickerLoader from "./LocationPickerLoader";
import QRShare, { type QRPayload } from "./QRShare";
import { useTranslations } from "@/lib/i18n";
import { reverseGeocode } from "@/lib/geocode";

type ReportMode = "photo" | "voice" | "text";

interface SubmitResult {
  reportId: string;
  signal: {
    id: string;
    locationName: string;
    claim: string;
    evidenceType: string;
    severity: number;
    credibilityScore: number;
    credibilityReasoning: string;
  };
}

interface LocationState {
  status: "idle" | "acquiring" | "acquired" | "failed";
  latitude?: number;
  longitude?: number;
  placeName?: string | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("FileReader did not return a string"));
        return;
      }
      // Strip the data URL prefix (e.g. "data:audio/webm;base64,")
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("FileReader did not return a string"));
        return;
      }
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ReportForm() {
  const [mode, setMode] = useState<ReportMode>("text");

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Text state
  const [textContent, setTextContent] = useState("");

  // Location state — starts idle; GPS only requested when user explicitly asks
  const [location, setLocation] = useState<LocationState>({ status: "idle" });

  // Location map picker
  const [showPicker, setShowPicker] = useState(false);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null);

  const { t, locale } = useTranslations();

  // Called only when the user explicitly taps "Use my location"
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ status: "failed" });
      return;
    }
    setLocation({ status: "acquiring" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ status: "acquired", latitude, longitude });
        // Resolve a human-readable name in the background — non-blocking
        void reverseGeocode(latitude, longitude).then((name) => {
          if (name) {
            setLocation((prev) =>
              prev.status === "acquired" ? { ...prev, placeName: name } : prev
            );
          }
        });
      },
      () => setLocation({ status: "failed" }),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSubmitError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      // Pick a supported MIME type with fallback
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setSubmitError("Microphone access denied. Please allow microphone access and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const getEffectiveLocation = (): { latitude: number; longitude: number } | null => {
    if (
      location.status === "acquired" &&
      location.latitude !== undefined &&
      location.longitude !== undefined
    ) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    return null;
  };

  const isSubmitEnabled = (): boolean => {
    if (isSubmitting) return false;
    if (!getEffectiveLocation()) return false;
    if (mode === "photo") return !!photoFile;
    if (mode === "voice") return !!audioBlob;
    if (mode === "text") return textContent.trim().length > 0;
    return false;
  };

  const handleSubmit = async () => {
    const coords = getEffectiveLocation();
    if (!coords) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        type: mode,
        locale,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      if (mode === "photo" && photoFile) {
        body.image = await fileToBase64(photoFile);
      } else if (mode === "voice" && audioBlob) {
        body.audio = await blobToBase64(audioBlob);
      } else if (mode === "text") {
        body.content = textContent;
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? `Server error: ${res.status}`);
      }

      const data = (await res.json()) as SubmitResult;
      setSubmitResult(data);

      // Build QR payload for offline sharing — coords already resolved above
      setQrPayload({
        v: 1,
        type: mode,
        lat: coords.latitude,
        lng: coords.longitude,
        ts: Date.now(),
        content: mode === "text" ? textContent.trim() : (data.signal.claim ?? undefined),
      });

      // Fire reasoning engine in the background — don't await so the
      // confirmation screen appears immediately. The dashboard will pick
      // up the new event on its next 30-second poll (or manual Analyze).
      void fetch("/api/reasoning", { method: "POST" }).catch(() => {
        // Reasoning failure is non-fatal — the signal is already persisted
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMode("text");
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setIsRecording(false);
    setRecordingSeconds(0);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTextContent("");
    setShowPicker(false);
    setSubmitResult(null);
    setSubmitError(null);
  };

  if (submitResult) {
    return (
      <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 w-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 border border-teal-100">
            <svg
              className="w-8 h-8 text-teal-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t.report.successTitle}</h2>
            {submitResult.signal.locationName && (
              <p className="text-sm text-slate-500 mt-0.5">{submitResult.signal.locationName}</p>
            )}
          </div>
          {submitResult.signal.claim && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 w-full text-left">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">AI extracted claim</p>
              <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{submitResult.signal.claim}&rdquo;</p>
            </div>
          )}
          <div className="flex gap-2 w-full">
            <div className="flex-1 flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-medium text-teal-700">Credibility</span>
              <span className="text-sm font-bold text-teal-700">
                {Math.round(submitResult.signal.credibilityScore * 100)}%
              </span>
            </div>
            <div className={`flex-1 flex items-center justify-between rounded-xl px-3.5 py-2.5 border ${
              submitResult.signal.severity >= 4 ? "bg-rose-50 border-rose-100" :
              submitResult.signal.severity === 3 ? "bg-amber-50 border-amber-100" :
              "bg-slate-50 border-slate-100"
            }`}>
              <span className={`text-xs font-medium ${
                submitResult.signal.severity >= 4 ? "text-rose-700" :
                submitResult.signal.severity === 3 ? "text-amber-700" :
                "text-slate-600"
              }`}>Severity</span>
              <span className={`text-sm font-bold ${
                submitResult.signal.severity >= 4 ? "text-rose-700" :
                submitResult.signal.severity === 3 ? "text-amber-700" :
                "text-slate-700"
              }`}>
                {submitResult.signal.severity}/5
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 border border-teal-100 rounded-xl px-3.5 py-2.5 w-full">
            <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-medium">{t.report.successSubtitle}</span>
          </div>
          {/* Share via QR — only shown if we have coords */}
          {qrPayload && (
            <button
              onClick={() => setShowQR(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h2v2h-2z" /><path d="M18 14h3" /><path d="M14 18v3" /><path d="M20 18v3" /><path d="M18 20h3" />
              </svg>
              {t.report.shareQR}
            </button>
          )}

          <div className="flex gap-3 w-full">
            <button
              onClick={resetForm}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              {t.report.submitAnother}
            </button>
            <a
              href="/"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-center"
            >
              {t.report.viewDashboard}
            </a>
          </div>
        </div>
      </div>

      {/* QR share modal */}
      {showQR && qrPayload && (
        <QRShare payload={qrPayload} onClose={() => setShowQR(false)} />
      )}
      </>
    );
  }

  const MODE_ICONS: Record<ReportMode, React.ReactNode> = {
    photo: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h.879a1.5 1.5 0 0 0 1.243-.659l.494-.741A1.5 1.5 0 0 1 7.36 4h5.28a1.5 1.5 0 0 1 1.243.659l.495.741A1.5 1.5 0 0 0 15.62 6H16.5A1.5 1.5 0 0 1 18 7.5v7A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5v-7z" />
        <circle cx="10" cy="11" r="2.5" />
      </svg>
    ),
    voice: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="7" y="2" width="6" height="9" rx="3" />
        <path d="M4 10a6 6 0 0 0 12 0M10 16v2M7 18h6" />
      </svg>
    ),
    text: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M4 6h12M4 10h8M4 14h6" />
      </svg>
    ),
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-full">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-5">
        {(["photo", "voice", "text"] as ReportMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 px-3 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              mode === m
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {MODE_ICONS[m]}
            {m === "photo" ? t.report.photoLabel : m === "voice" ? t.report.voiceLabel : t.report.textLabel}
          </button>
        ))}
      </div>

      {/* Photo mode */}
      {mode === "photo" && (
        <div className="mb-5 flex flex-col gap-3">
          {!photoPreview && (
            <div className="flex gap-2">
              {/* Camera — capture="environment" tells the browser to open the camera directly */}
              <label className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/30 cursor-pointer transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                  strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-slate-400">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-xs font-semibold text-slate-600">{t.report.takePhoto}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </label>

              {/* Upload from library */}
              <label className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/30 cursor-pointer transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                  strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-slate-400">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-xs font-semibold text-slate-600">{t.report.chooseFromLibrary}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
          )}
          {photoPreview && (
            <div className="w-full border border-teal-200 bg-teal-50 rounded-xl overflow-hidden">
              <img
                src={photoPreview}
                alt="Preview"
                className="mx-auto max-h-56 w-full object-cover"
              />
            </div>
          )}
          {photoPreview && (
            <button
              onClick={() => {
                if (photoPreview) URL.revokeObjectURL(photoPreview);
                setPhotoFile(null);
                setPhotoPreview(null);
              }}
              className="text-xs text-rose-500 hover:text-rose-700 font-medium self-center"
            >
              {t.report.remove}
            </button>
          )}
        </div>
      )}

      {/* Voice mode */}
      {mode === "voice" && (
        <div className="mb-5 flex flex-col items-center gap-4">
          {!audioBlob ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div
                className={`flex items-center justify-center w-24 h-24 rounded-full border-4 transition-colors ${
                  isRecording
                    ? "border-rose-400 bg-rose-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                {isRecording ? (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                    </span>
                    <span className="text-sm font-mono text-rose-600 font-semibold">
                      {recordingSeconds}s
                    </span>
                  </span>
                ) : (
                  <svg
                    className="w-10 h-10 text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                )}
              </div>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                  isRecording
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-teal-600 hover:bg-teal-700 text-white"
                }`}
              >
                {isRecording ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <rect x="3" y="3" width="10" height="10" rx="1" />
                    </svg>
                    Stop Recording
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <circle cx="8" cy="8" r="5" />
                    </svg>
                    Start Recording
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="w-full bg-slate-50 rounded-xl p-3 border border-slate-200">
                <audio controls src={audioUrl ?? undefined} className="w-full" />
              </div>
              <button
                onClick={() => {
                  setAudioBlob(null);
                  if (audioUrl) URL.revokeObjectURL(audioUrl);
                  setAudioUrl(null);
                  setRecordingSeconds(0);
                }}
                className="text-xs text-rose-500 hover:text-rose-700 font-medium"
              >
                Record again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Text mode */}
      {mode === "text" && (
        <div className="mb-5">
          <label htmlFor="text-report" className="sr-only">Report description</label>
          <textarea
            id="text-report"
            rows={5}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder={t.report.textPlaceholder}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Location section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t.report.locationLabel}</p>
          {/* Allow re-picking location even after GPS lock */}
          {location.status === "acquired" && (
            <button
              onClick={() => setShowPicker(true)}
              className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
            >
              {t.report.movePin}
            </button>
          )}
        </div>

        {/* Idle — ask the user before touching geolocation */}
        {location.status === "idle" && !showPicker && (
          <div className="flex gap-2">
            <button
              onClick={requestLocation}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors text-sm font-semibold text-teal-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
              {t.report.useMyLocation}
            </button>
            <button
              onClick={() => setShowPicker(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-slate-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {t.report.pickOnMap}
            </button>
          </div>
        )}

        {/* Acquiring GPS */}
        {location.status === "acquiring" && (
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
            <svg className="animate-spin h-4 w-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t.emergency.gpsAcquiring}
          </div>
        )}

        {/* GPS acquired — show name + coords, offer map adjustment */}
        {location.status === "acquired" && !showPicker && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 min-w-0">
              {location.placeName ? (
                <p className="text-xs font-medium text-emerald-800 truncate">{location.placeName}</p>
              ) : null}
              <p className="text-[10px] font-mono text-emerald-600">
                {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              GPS
            </span>
          </div>
        )}

        {/* GPS failed — prompt to open map picker */}
        {location.status === "failed" && !showPicker && (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 border-dashed rounded-xl px-4 py-4 hover:bg-amber-100/60 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-amber-600">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">Tap to pin your location</p>
              <p className="text-xs text-amber-600 mt-0.5">GPS unavailable — pick on map instead</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className="w-4 h-4 text-amber-400 ml-auto flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Retry GPS after failure */}
        {location.status === "failed" && !showPicker && (
          <button
            onClick={requestLocation}
            className="mt-2 text-xs font-medium text-slate-500 hover:text-teal-600 transition-colors"
          >
            ↺ Try again
          </button>
        )}

        {/* Map picker — shown inline when open */}
        {showPicker && (
          <LocationPickerLoader
            initialLat={location.latitude}
            initialLng={location.longitude}
            onConfirm={(lat, lng, name) => {
              setLocation({ status: "acquired", latitude: lat, longitude: lng, placeName: name });
              setShowPicker(false);
            }}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!isSubmitEnabled()}
        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
          isSubmitEnabled()
            ? "bg-teal-600 hover:bg-teal-700 text-white shadow-sm active:scale-[0.98]"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t.report.submitting}
          </span>
        ) : (
          t.report.submitButton
        )}
      </button>
    </div>
  );
}
