import { NextResponse } from "next/server";
import { runReasoning } from "@/lib/reasoning-engine";

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// One analysis run allowed per WINDOW_MS across all callers.
// Resets on server restart (cold start), which is fine for a demo.
const WINDOW_MS = 30_000; // 30 seconds
let lastRun = 0;

export async function POST() {
  const now = Date.now();
  const elapsed = now - lastRun;

  if (lastRun > 0 && elapsed < WINDOW_MS) {
    const retryAfter = Math.ceil((WINDOW_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: `Analysis is cooling down. Try again in ${retryAfter}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  lastRun = now;

  try {
    const result = await runReasoning();

    return NextResponse.json({
      events: result.events,
      signalsProcessed: result.signalsProcessed,
      conflictsDetected: result.conflictsDetected,
      thinkingTrace: result.thinkingTrace,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Reasoning engine error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
