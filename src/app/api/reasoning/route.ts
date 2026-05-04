import { NextResponse } from "next/server";
import { runReasoning } from "@/lib/reasoning-engine";

export async function POST() {
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
