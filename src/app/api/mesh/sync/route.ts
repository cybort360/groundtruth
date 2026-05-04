/**
 * POST /api/mesh/sync
 *
 * Receives a signal broadcast from a peer device on the local mesh.
 * Inserts the signal into the local database (if not already present)
 * so it participates in the next reasoning cycle.
 *
 * Body: { fromId: string, signalId: string, signal: NormalizedSignal }
 */

import { NextRequest, NextResponse } from "next/server";
import { insertSignal, getAllSignals } from "@/lib/db";
import type { NormalizedSignal } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fromId: string;
      signalId: string;
      signal: NormalizedSignal;
    };

    if (!body.fromId || !body.signal) {
      return NextResponse.json({ error: "Invalid mesh sync payload" }, { status: 400 });
    }

    // Idempotency check — don't insert duplicates
    const existing = getAllSignals().find((s) => s.id === body.signal.id);
    if (existing) {
      return NextResponse.json({ status: "already_known", signalId: body.signal.id });
    }

    // Insert the peer's signal into our local DB
    insertSignal(body.signal);

    // Record the sync event for the UI
    const { recordPeerSync } = await import("@/lib/mesh/discovery");
    recordPeerSync(body.fromId, body.signal.id);

    console.log(`[mesh/sync] Received signal ${body.signal.id} from peer ${body.fromId}`);

    return NextResponse.json({ status: "accepted", signalId: body.signal.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
