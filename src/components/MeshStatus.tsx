"use client";

import { useEffect, useState } from "react";

interface Peer {
  id: string;
  address: string;
  port: number;
  lastSeen: number;
  signalsReceived: number;
  ageSeconds: number;
}

interface SyncEvent {
  from: string;
  signalId: string;
  ts: number;
}

interface MeshData {
  localId: string;
  localAddress: string;
  localPort: number;
  peerCount: number;
  peers: Peer[];
  syncLog: SyncEvent[];
  error?: string;
}

function getRelativeTime(ageSeconds: number): string {
  if (ageSeconds < 5) return "just now";
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  return `${Math.floor(ageSeconds / 60)}m ago`;
}

function PeerRow({ peer }: { peer: Peer }) {
  const fresh = peer.ageSeconds < 15;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fresh ? "bg-teal-400" : "bg-amber-400"}`}
        title={fresh ? "Connected" : "Fading"}
      />
      <span className="text-xs font-mono text-slate-600 flex-1 truncate">
        {peer.address}:{peer.port}
      </span>
      <span className="text-xs text-slate-400 flex-shrink-0">
        {peer.signalsReceived > 0 && (
          <span className="text-teal-600 mr-1.5">↓{peer.signalsReceived}</span>
        )}
        {getRelativeTime(peer.ageSeconds)}
      </span>
    </div>
  );
}

export default function MeshStatus({ isOffline }: { isOffline: boolean }) {
  const [mesh, setMesh]         = useState<MeshData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchMesh = async () => {
      try {
        const res = await fetch("/api/mesh");
        if (res.ok) setMesh(await res.json() as MeshData);
      } catch {
        // mesh is optional — fail silently
      }
    };
    void fetchMesh();
    const id = setInterval(fetchMesh, 5_000);
    return () => clearInterval(id);
  }, []);

  const peerCount   = mesh?.peerCount ?? 0;
  const meshRunning = mesh && !mesh.error;

  // ── Sync status ─────────────────────────────────────────────────────────────
  const lastSync            = mesh?.syncLog[0] ?? null;
  const lastSyncAgeSecs     = lastSync ? Math.round((Date.now() - lastSync.ts) / 1000) : null;
  const recentlySynced      = lastSyncAgeSecs !== null && lastSyncAgeSecs < 30;
  const totalSignals        = mesh?.peers.reduce((n, p) => n + p.signalsReceived, 0) ?? 0;
  const uniqueSyncPeers     = mesh ? new Set(mesh.syncLog.map((e) => e.from)).size : 0;

  const syncStatusLine =
    lastSyncAgeSecs !== null
      ? `Last synced ${getRelativeTime(lastSyncAgeSecs)} · ${totalSignals} signal${totalSignals !== 1 ? "s" : ""} from ${uniqueSyncPeers} peer${uniqueSyncPeers !== 1 ? "s" : ""}`
      : peerCount > 0
      ? "Connected — waiting for peer reports"
      : null;

  // ── Status indicators ────────────────────────────────────────────────────────
  const statusDot =
    !meshRunning    ? "bg-slate-300" :
    peerCount === 0 ? "bg-amber-400" :
                      "bg-teal-400";

  const statusLabel =
    !meshRunning    ? "Mesh not running" :
    peerCount === 0 ? "Searching for peers…" :
                      `${peerCount} device${peerCount !== 1 ? "s" : ""} on this network`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        {/* Mesh topology icon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round"
          className={`w-4 h-4 text-teal-600 flex-shrink-0 ${recentlySynced ? "ring-pulse" : ""}`} aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <line x1="12" y1="7" x2="5" y2="17" />
          <line x1="12" y1="7" x2="19" y2="17" />
          <line x1="5" y1="19" x2="19" y2="19" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Local Mesh</span>
            {isOffline && (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                WAN offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-xs text-slate-500">{statusLabel}</span>
          </div>
          {syncStatusLine && (
            <p className="text-[10px] text-teal-600 mt-0.5 truncate">{syncStatusLine}</p>
          )}
        </div>

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="animate-expand px-4 pb-4 pt-3 border-t border-slate-100 space-y-3">

          {/* This device */}
          {meshRunning && mesh && (
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                This device
              </p>
              <p className="text-xs font-mono text-slate-600">
                {mesh.localId} · {mesh.localAddress}:{mesh.localPort}
              </p>
            </div>
          )}

          {/* Peers */}
          {meshRunning && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {peerCount === 0 ? "No peers discovered" : `${peerCount} peer${peerCount !== 1 ? "s" : ""}`}
              </p>
              {mesh!.peers.map((peer) => (
                <PeerRow key={peer.id} peer={peer} />
              ))}
              {peerCount === 0 && (
                <p className="text-xs text-slate-400 italic mt-1">
                  Open GroundTruth on another device on this Wi-Fi to connect.
                </p>
              )}
            </div>
          )}

          {/* Sync log */}
          {meshRunning && mesh!.syncLog.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Recent syncs
              </p>
              <div className="space-y-1">
                {mesh!.syncLog.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-teal-500 text-xs font-bold">↓</span>
                    <span className="text-xs font-mono text-slate-500 truncate flex-1">
                      {ev.signalId.slice(0, 12)}…
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      from {ev.from.slice(3, 11)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not running */}
          {!meshRunning && (
            <p className="text-xs text-slate-400">
              Mesh discovery is inactive.{" "}
              <code className="bg-slate-100 text-slate-600 px-1 rounded">npm run dev</code>{" "}
              activates it automatically.
            </p>
          )}

          {/* How it works */}
          <details className="group">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-teal-600 transition-colors select-none">
              How it works
            </summary>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Every phone on the same Wi-Fi automatically finds the others —
              no internet needed. When someone submits a report on one device,
              it instantly appears on all the others. Useful when the cell
              tower is down but a local hotspot is still running.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
