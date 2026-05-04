/**
 * GET /api/mesh
 *
 * Returns the current mesh state: local device identity, discovered peers,
 * and recent signal sync log. Polled by the MeshStatus component every 5 s.
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Import lazily so the module doesn't error on cold start before
    // the custom server has initialised the mesh daemon.
    const { meshState } = await import("@/lib/mesh/discovery");

    const peers = Array.from(meshState.peers.values()).map((p) => ({
      id: p.id,
      address: p.address,
      port: p.port,
      lastSeen: p.lastSeen,
      signalsReceived: p.signalsReceived,
      ageSeconds: Math.round((Date.now() - p.lastSeen) / 1000),
    }));

    return NextResponse.json({
      localId: meshState.localId,
      localAddress: meshState.localAddress,
      localPort: meshState.localPort,
      peerCount: peers.length,
      peers,
      syncLog: meshState.syncLog.slice(0, 10), // last 10 sync events
    });
  } catch {
    // Mesh daemon not running (e.g. plain `next dev` without custom server)
    return NextResponse.json({
      localId: "not-running",
      localAddress: "127.0.0.1",
      localPort: 3000,
      peerCount: 0,
      peers: [],
      syncLog: [],
      error: "Mesh discovery requires the custom server (npm run dev:mesh)",
    });
  }
}
