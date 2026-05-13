import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { insertReport, insertSignal, getAllSignals } from "@/lib/db";
import { normalizeReport } from "@/lib/signal-normalizer";
import { scoreCredibility } from "@/lib/credibility-scorer";
import type { Report } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const report: Report = {
      id: uuid(),
      type: body.type,
      rawContent: body.content || undefined,
      imageBase64: body.image || undefined,
      audioBase64: body.audio || undefined,
      latitude: body.latitude,
      longitude: body.longitude,
      submittedAt: new Date().toISOString(),
      submitterId: body.submitterId || undefined,
      locale: typeof body.locale === "string" ? body.locale : undefined,
    };

    // Persist the raw report immediately so the client gets instant feedback.
    insertReport(report);

    // AI processing (normalize + credibility score) runs in the background.
    // The client does not wait for this — it shows a confirmation right away.
    void processReportAsync(report);

    return NextResponse.json({ reportId: report.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Report submission error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Normalize and score a report in the background after the HTTP response is sent. */
async function processReportAsync(report: Report): Promise<void> {
  try {
    const signal = await normalizeReport(report);

    try {
      const credibility = await scoreCredibility(signal);
      signal.credibilityScore = credibility.overallScore;
      signal.credibilityReasoning = credibility.reasoning;
    } catch (err) {
      console.warn("[reports] credibility scoring failed, using default:", err);
      signal.credibilityScore = 0.5;
      signal.credibilityReasoning = "Credibility scoring unavailable.";
    }

    insertSignal(signal);

    void import("@/lib/mesh/discovery").then(({ broadcastSignalToPeers }) => {
      void broadcastSignalToPeers(signal.id, signal as unknown as Record<string, unknown>);
    }).catch(() => { /* mesh not running */ });
  } catch (err) {
    console.error("[reports] background processing failed:", err);
  }
}

export async function GET() {
  try {
    const signals = getAllSignals();
    return NextResponse.json({ signals, count: signals.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
