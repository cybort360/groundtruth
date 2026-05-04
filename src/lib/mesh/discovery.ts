/**
 * Mesh Discovery — LAN peer-to-peer discovery via UDP broadcast.
 *
 * Each GroundTruth instance broadcasts a small announcement packet on the
 * local network every 10 seconds. Peers on the same WiFi/LAN receive it
 * and add each other to their peer table. No internet required.
 *
 * Architecture:
 *   UDP port 7042: discovery broadcasts (255.255.255.255)
 *   HTTP:          signal sync between peers via /api/mesh/sync
 *
 * This module runs inside the custom Next.js server (server.ts).
 * It is NOT imported by the Next.js app router code directly.
 */

import dgram from "dgram";
import os from "os";
import { randomUUID } from "crypto";

export interface Peer {
  id: string;
  address: string;
  port: number;       // HTTP port of the peer's GroundTruth server
  lastSeen: number;   // Date.now()
  signalsReceived: number;
}

export interface MeshState {
  localId: string;
  localAddress: string;
  localPort: number;
  peers: Map<string, Peer>;
  syncLog: Array<{ from: string; signalId: string; ts: number }>;
}

const DISCOVERY_UDP_PORT = 7042;
const ANNOUNCE_INTERVAL_MS = 10_000;
const PEER_STALE_MS = 35_000; // remove if not seen for 35 s
const MAX_SYNC_LOG = 50;

export const meshState: MeshState = {
  localId: `gt-${randomUUID().slice(0, 8)}`,
  localAddress: getLocalIPv4(),
  localPort: 3000,
  peers: new Map(),
  syncLog: [],
};

function getLocalIPv4(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (!iface.internal && iface.family === "IPv4") {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

interface AnnouncePacket {
  type: "gt-announce";
  id: string;
  port: number;
  version: string;
}

export function initMeshDiscovery(appHttpPort: number): void {
  meshState.localPort = appHttpPort;
  meshState.localAddress = getLocalIPv4();

  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("error", (err) => {
    // Non-fatal — mesh discovery degrades gracefully if UDP is unavailable
    console.warn(`[mesh] UDP error: ${err.message}`);
  });

  socket.on("message", (msg, rinfo) => {
    try {
      const packet = JSON.parse(msg.toString()) as AnnouncePacket;

      if (packet.type !== "gt-announce") return;
      if (packet.id === meshState.localId) return; // our own broadcast

      const existing = meshState.peers.get(packet.id);
      meshState.peers.set(packet.id, {
        id: packet.id,
        address: rinfo.address,
        port: packet.port,
        lastSeen: Date.now(),
        signalsReceived: existing?.signalsReceived ?? 0,
      });

      if (!existing) {
        console.log(`[mesh] Peer discovered: ${packet.id} @ ${rinfo.address}:${packet.port}`);
      }
    } catch {
      // ignore malformed packets
    }
  });

  socket.bind(DISCOVERY_UDP_PORT, () => {
    try {
      socket.setBroadcast(true);
    } catch {
      // Some environments don't allow broadcast — mesh still works on same host
    }

    const announce = () => {
      const payload = Buffer.from(
        JSON.stringify({
          type: "gt-announce",
          id: meshState.localId,
          port: appHttpPort,
          version: "0.1",
        } satisfies AnnouncePacket)
      );
      socket.send(payload, DISCOVERY_UDP_PORT, "255.255.255.255", (err) => {
        if (err) console.warn(`[mesh] Broadcast failed: ${err.message}`);
      });
    };

    announce();
    setInterval(announce, ANNOUNCE_INTERVAL_MS);

    // Evict stale peers
    setInterval(() => {
      const cutoff = Date.now() - PEER_STALE_MS;
      for (const [id, peer] of meshState.peers) {
        if (peer.lastSeen < cutoff) {
          meshState.peers.delete(id);
          console.log(`[mesh] Peer lost: ${id}`);
        }
      }
    }, ANNOUNCE_INTERVAL_MS);

    console.log(
      `[mesh] Discovery active — device ${meshState.localId} @ ${meshState.localAddress}:${appHttpPort}`
    );
  });
}

/**
 * Push a newly inserted signal to all known peers via HTTP POST.
 * Called by the /api/reports route after a signal is persisted.
 * Failures are silent — mesh is best-effort.
 */
export async function broadcastSignalToPeers(
  signalId: string,
  signalPayload: Record<string, unknown>
): Promise<void> {
  const peers = Array.from(meshState.peers.values());
  if (peers.length === 0) return;

  const body = JSON.stringify({
    fromId: meshState.localId,
    signalId,
    signal: signalPayload,
  });

  await Promise.allSettled(
    peers.map(async (peer) => {
      const url = `http://${peer.address}:${peer.port}/api/mesh/sync`;
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // peer unreachable — that's OK
      }
    })
  );
}

/**
 * Record that a signal was received from a peer.
 */
export function recordPeerSync(fromId: string, signalId: string): void {
  meshState.syncLog.unshift({ from: fromId, signalId, ts: Date.now() });
  if (meshState.syncLog.length > MAX_SYNC_LOG) {
    meshState.syncLog.length = MAX_SYNC_LOG;
  }
  const peer = meshState.peers.get(fromId);
  if (peer) peer.signalsReceived++;
}
