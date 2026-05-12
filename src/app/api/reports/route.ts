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

    // 1. Store raw report
    insertReport(report);

    // 2. Normalize: extract structured signal
    const signal = await normalizeReport(report);

    // 3. Score credibility
    const credibility = await scoreCredibility(signal);
    signal.credibilityScore = credibility.overallScore;
    signal.credibilityReasoning = credibility.reasoning;

    // 4. Store normalized signal
    insertSignal(signal);

    // 5. Broadcast to mesh peers (best-effort, non-blocking)
    void import("@/lib/mesh/discovery").then(({ broadcastSignalToPeers }) => {
      void broadcastSignalToPeers(signal.id, signal as unknown as Record<string, unknown>);
    }).catch(() => {/* mesh not running — ignore */});

    return NextResponse.json({
      reportId: report.id,
      signal: {
        id: signal.id,
        locationName: signal.locationName,
        claim: signal.claim,
        evidenceType: signal.evidenceType,
        severity: signal.severity,
        credibilityScore: signal.credibilityScore,
        credibilityReasoning: signal.credibilityReasoning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Report submission error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
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
