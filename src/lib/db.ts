/**
 * SQLite Database Layer
 *
 * All database operations go through this module.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Report, NormalizedSignal, AssessedEvent } from "@/types";

// On Vercel (serverless), use /tmp which is writable. Locally use data/.
const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "groundtruth.db")
  : path.join(process.cwd(), "data", "groundtruth.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const database = db!;

  database.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('photo', 'voice', 'text', 'sensor')),
      raw_content TEXT,
      image_base64 TEXT,
      audio_base64 TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      submitted_at TEXT NOT NULL,
      submitter_id TEXT
    );

    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES reports(id),
      location_name TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      claim TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      severity INTEGER DEFAULT 1,
      details TEXT,
      is_firsthand INTEGER DEFAULT 1,
      timestamp TEXT NOT NULL,
      credibility_score REAL,
      credibility_reasoning TEXT,
      normalized_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL DEFAULT 500,
      confidence REAL NOT NULL,
      reasoning_chain TEXT,
      status TEXT DEFAULT 'active',
      first_reported TEXT,
      last_updated TEXT,
      signal_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS event_signals (
      event_id TEXT REFERENCES events(id),
      signal_id TEXT REFERENCES signals(id),
      PRIMARY KEY (event_id, signal_id)
    );

    CREATE INDEX IF NOT EXISTS idx_signals_geo ON signals(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_events_geo ON events(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

    -- GDACS: verified historical disaster events from the EU/UN public API.
    -- Populated by /api/gdacs/sync. Queried by check_history for real baseline data.
    CREATE TABLE IF NOT EXISTS gdacs_events (
      gdacs_id    TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      country     TEXT,
      alert_level TEXT,
      severity    TEXT,
      name        TEXT,
      description TEXT,
      severity_text TEXT,
      from_date   TEXT,
      to_date     TEXT,
      fetched_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gdacs_sync_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at      TEXT NOT NULL,
      events_fetched INTEGER NOT NULL,
      from_date      TEXT NOT NULL,
      to_date        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gdacs_geo  ON gdacs_events(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_gdacs_type ON gdacs_events(event_type);
  `);

  // Migrations: add columns if they don't exist yet.
  // SQLite doesn't support "ADD COLUMN IF NOT EXISTS", so we try/catch each.
  try {
    database.exec(`ALTER TABLE events ADD COLUMN assessed_by TEXT DEFAULT 'local'`);
  } catch { /* column already exists */ }

  try {
    database.exec(`ALTER TABLE events ADD COLUMN thinking_trace TEXT`);
  } catch { /* column already exists */ }

  // Seed GDACS events from bundled JSON if the table is empty.
  // This runs on every cold start on Vercel (ephemeral /tmp DB) so users
  // always have the verified historical baseline without needing a manual sync.
  const gdacsCount = (database
    .prepare("SELECT COUNT(*) as n FROM gdacs_events")
    .get() as { n: number }).n;

  if (gdacsCount === 0) {
    try {
      const seedPath = path.join(process.cwd(), "data", "gdacs-seed.json");
      const raw = fs.readFileSync(seedPath, "utf-8");
      const events = JSON.parse(raw) as Array<Record<string, unknown>>;
      const stmt = database.prepare(`
        INSERT OR IGNORE INTO gdacs_events
          (gdacs_id, event_type, latitude, longitude, country, alert_level, severity,
           name, description, severity_text, from_date, to_date, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      const insertAll = database.transaction((rows: Array<Record<string, unknown>>) => {
        for (const e of rows) {
          stmt.run(
            e.gdacsId, e.eventType, e.latitude, e.longitude,
            e.country, e.alertLevel, e.severity,
            e.name, e.description, e.severityText,
            e.fromDate, e.toDate, now,
          );
        }
      });
      insertAll(events);
      console.log(`[db] Seeded ${events.length} GDACS events from bundled data.`);
    } catch (err) {
      // Non-fatal — app works without historical data, just less context for Gemma
      console.warn("[db] GDACS seed skipped:", err);
    }
  }
}

// --- Report Operations ---

export function insertReport(report: Report): void {
  const database = getDb();
  database.prepare(`
    INSERT INTO reports (id, type, raw_content, image_base64, audio_base64, latitude, longitude, submitted_at, submitter_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.id,
    report.type,
    report.rawContent || null,
    report.imageBase64 || null,
    report.audioBase64 || null,
    report.latitude,
    report.longitude,
    report.submittedAt,
    report.submitterId || null,
  );
}

export function getReport(id: string): Report | undefined {
  const database = getDb();
  const row = database.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return mapReport(row);
}

// --- Signal Operations ---

export function insertSignal(signal: NormalizedSignal): void {
  const database = getDb();
  database.prepare(`
    INSERT INTO signals (id, report_id, location_name, latitude, longitude, claim, evidence_type, severity, details, is_firsthand, timestamp, credibility_score, credibility_reasoning, normalized_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    signal.id,
    signal.reportId,
    signal.locationName,
    signal.latitude,
    signal.longitude,
    signal.claim,
    signal.evidenceType,
    signal.severity,
    signal.details,
    signal.isFirsthand ? 1 : 0,
    signal.timestamp,
    signal.credibilityScore,
    signal.credibilityReasoning,
    new Date().toISOString(),
  );
}

export function getAllSignals(): NormalizedSignal[] {
  const database = getDb();
  const rows = database.prepare("SELECT * FROM signals ORDER BY timestamp DESC").all() as Record<string, unknown>[];
  return rows.map(mapSignal);
}

export function getSignalsNear(lat: number, lng: number, radiusKm: number = 5): NormalizedSignal[] {
  const database = getDb();
  // Approximate bounding box (1 degree ~ 111km)
  const delta = radiusKm / 111;
  const rows = database.prepare(`
    SELECT * FROM signals
    WHERE latitude BETWEEN ? AND ?
    AND longitude BETWEEN ? AND ?
    ORDER BY timestamp DESC
  `).all(lat - delta, lat + delta, lng - delta, lng + delta) as Record<string, unknown>[];
  return rows.map(mapSignal);
}

// --- Event Operations ---

export function upsertEvent(event: Partial<AssessedEvent> & { id: string }): void {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM events WHERE id = ?").get(event.id);

  if (existing) {
    database.prepare(`
      UPDATE events SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        event_type = COALESCE(?, event_type),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        radius_meters = COALESCE(?, radius_meters),
        confidence = COALESCE(?, confidence),
        reasoning_chain = COALESCE(?, reasoning_chain),
        status = COALESCE(?, status),
        last_updated = ?,
        signal_count = COALESCE(?, signal_count)
      WHERE id = ?
    `).run(
      event.title, event.description, event.eventType,
      event.latitude, event.longitude, event.radiusMeters,
      event.confidence, event.reasoningChain, event.status,
      new Date().toISOString(), event.signalCount, event.id,
    );
  } else {
    database.prepare(`
      INSERT INTO events (id, title, description, event_type, latitude, longitude, radius_meters, confidence, reasoning_chain, status, first_reported, last_updated, signal_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.title, event.description || "", event.eventType || "unknown",
      event.latitude, event.longitude, event.radiusMeters || 500,
      event.confidence, event.reasoningChain || "", event.status || "active",
      new Date().toISOString(), new Date().toISOString(), event.signalCount || 0,
    );
  }
}

/**
 * Find an existing active/uncertain event of the same type within ~500 m of
 * the given coordinates. Used by update_event to avoid creating duplicates on
 * repeated reasoning runs.
 *
 * 0.005 degrees ≈ 550 m at the equator — tight enough to match the same
 * incident without accidentally merging distinct nearby events.
 */
export function findNearbyActiveEvent(
  lat: number,
  lng: number,
  eventType: string,
): string | null {
  const row = getDb()
    .prepare(`
      SELECT id FROM events
      WHERE event_type = ?
        AND status IN ('active', 'uncertain')
        AND ABS(latitude  - ?) < 0.005
        AND ABS(longitude - ?) < 0.005
      ORDER BY last_updated DESC
      LIMIT 1
    `)
    .get(eventType, lat, lng) as { id: string } | undefined;
  return row?.id ?? null;
}

export function getActiveEvents(): AssessedEvent[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM events WHERE status IN ('active', 'uncertain') ORDER BY confidence DESC
  `).all() as Record<string, unknown>[];
  return rows.map(mapEvent);
}

/**
 * Return all events (any status) within an approximate bounding box of the
 * given coordinates. Used by check_history and cross-cluster correlation.
 * delta is in degrees: 1° ≈ 111 km, so radiusMeters / 111000 gives the box half-width.
 */
export function getEventsNear(
  lat: number,
  lng: number,
  radiusMeters: number,
): AssessedEvent[] {
  const delta = radiusMeters / 111000;
  const rows = getDb()
    .prepare(`
      SELECT * FROM events
      WHERE ABS(latitude  - ?) < ?
        AND ABS(longitude - ?) < ?
      ORDER BY last_updated DESC
    `)
    .all(lat, delta, lng, delta) as Record<string, unknown>[];
  return rows.map(mapEvent);
}

/**
 * Update an event's confidence and append a note to its reasoning chain.
 * Used by the cross-cluster correlation pass in the reasoning engine.
 */
export function updateEventConfidence(
  eventId: string,
  confidence: number,
  appendReasoning: string,
): void {
  getDb()
    .prepare(`
      UPDATE events SET
        confidence      = ?,
        reasoning_chain = reasoning_chain || ?,
        last_updated    = ?
      WHERE id = ?
    `)
    .run(confidence, appendReasoning, new Date().toISOString(), eventId);
}

export function setEventAssessedBy(eventId: string, assessedBy: string): void {
  getDb()
    .prepare("UPDATE events SET assessed_by = ? WHERE id = ?")
    .run(assessedBy, eventId);
}

export function setEventThinkingTrace(eventId: string, trace: string): void {
  getDb()
    .prepare("UPDATE events SET thinking_trace = ? WHERE id = ?")
    .run(trace, eventId);
}

// --- GDACS Operations ---

import type { GDACSEvent } from "./gdacs";

/** Bulk-insert GDACS events. Uses INSERT OR REPLACE so re-syncing is safe. */
export function insertGDACSEvents(events: GDACSEvent[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO gdacs_events
      (gdacs_id, event_type, latitude, longitude, country, alert_level, severity,
       name, description, severity_text, from_date, to_date, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  const insert = db.transaction((rows: GDACSEvent[]) => {
    for (const e of rows) {
      stmt.run(
        e.gdacsId, e.eventType, e.latitude, e.longitude,
        e.country, e.alertLevel, e.severity,
        e.name, e.description, e.severityText,
        e.fromDate, e.toDate, now,
      );
    }
  });
  insert(events);
  return events.length;
}

export interface GDACSHistoricalRecord {
  gdacsId: string;
  eventType: string;
  latitude: number;
  longitude: number;
  country: string;
  alertLevel: string;
  severity: string;
  name: string;
  description: string;
  severityText: string;
  fromDate: string;
  toDate: string;
  distanceMeters: number;
}

/** Return GDACS events near a coordinate within a bounding box. */
export function getGDACSEventsNear(
  lat: number,
  lng: number,
  radiusMeters: number,
  eventType?: string,
): GDACSHistoricalRecord[] {
  const delta = radiusMeters / 111000;
  let query = `
    SELECT * FROM gdacs_events
    WHERE ABS(latitude  - ?) < ?
      AND ABS(longitude - ?) < ?
  `;
  const params: (number | string)[] = [lat, delta, lng, delta];
  if (eventType) {
    query += ` AND event_type = ?`;
    params.push(eventType);
  }
  query += ` ORDER BY from_date DESC LIMIT 20`;

  const rows = getDb().prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    gdacsId: r.gdacs_id as string,
    eventType: r.event_type as string,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    country: r.country as string,
    alertLevel: r.alert_level as string,
    severity: r.severity as string,
    name: r.name as string,
    description: r.description as string,
    severityText: r.severity_text as string,
    fromDate: r.from_date as string,
    toDate: r.to_date as string,
    distanceMeters: Math.round(
      haversineApprox(lat, lng, r.latitude as number, r.longitude as number)
    ),
  }));
}

function haversineApprox(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GDACSSyncStatus {
  lastSync: string | null;
  totalEvents: number;
  syncCount: number;
}

export function getGDACSSyncStatus(): GDACSSyncStatus {
  const db = getDb();
  const last = db
    .prepare(`SELECT synced_at, events_fetched FROM gdacs_sync_log ORDER BY id DESC LIMIT 1`)
    .get() as { synced_at: string; events_fetched: number } | undefined;
  const total = (db.prepare(`SELECT COUNT(*) as n FROM gdacs_events`).get() as { n: number }).n;
  const count = (db.prepare(`SELECT COUNT(*) as n FROM gdacs_sync_log`).get() as { n: number }).n;
  return {
    lastSync: last?.synced_at ?? null,
    totalEvents: total,
    syncCount: count,
  };
}

export function logGDACSSync(eventsFetched: number, fromDate: string, toDate: string): void {
  getDb()
    .prepare(`INSERT INTO gdacs_sync_log (synced_at, events_fetched, from_date, to_date) VALUES (?, ?, ?, ?)`)
    .run(new Date().toISOString(), eventsFetched, fromDate, toDate);
}

/** Count signals not yet linked to any event — the "unanalyzed" queue depth. */
export function getUnlinkedSignalCount(): number {
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) as count FROM signals
      WHERE id NOT IN (SELECT DISTINCT signal_id FROM event_signals)
    `)
    .get() as { count: number };
  return row.count;
}

export function linkSignalToEvent(eventId: string, signalId: string): void {
  const database = getDb();
  database.prepare(`
    INSERT OR IGNORE INTO event_signals (event_id, signal_id) VALUES (?, ?)
  `).run(eventId, signalId);
}

export function getEventSignals(eventId: string): NormalizedSignal[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT s.* FROM signals s
    JOIN event_signals es ON s.id = es.signal_id
    WHERE es.event_id = ?
    ORDER BY s.timestamp DESC
  `).all(eventId) as Record<string, unknown>[];
  return rows.map(mapSignal);
}

// --- Mappers ---

function mapReport(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    type: row.type as Report["type"],
    rawContent: row.raw_content as string | undefined,
    imageBase64: row.image_base64 as string | undefined,
    audioBase64: row.audio_base64 as string | undefined,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    submittedAt: row.submitted_at as string,
    submitterId: row.submitter_id as string | undefined,
  };
}

function mapSignal(row: Record<string, unknown>): NormalizedSignal {
  return {
    id: row.id as string,
    reportId: row.report_id as string,
    locationName: row.location_name as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    claim: row.claim as string,
    evidenceType: row.evidence_type as NormalizedSignal["evidenceType"],
    timestamp: row.timestamp as string,
    severity: row.severity as number,
    details: row.details as string,
    isFirsthand: Boolean(row.is_firsthand),
    credibilityScore: row.credibility_score as number,
    credibilityReasoning: row.credibility_reasoning as string,
  };
}

function mapEvent(row: Record<string, unknown>): AssessedEvent {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    eventType: row.event_type as AssessedEvent["eventType"],
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    radiusMeters: row.radius_meters as number,
    confidence: row.confidence as number,
    reasoningChain: row.reasoning_chain as string,
    status: row.status as AssessedEvent["status"],
    firstReported: row.first_reported as string,
    lastUpdated: row.last_updated as string,
    signalCount: row.signal_count as number,
    assessedBy: ((row.assessed_by as string | undefined) ?? "local") as AssessedEvent["assessedBy"],
    thinkingTrace: (row.thinking_trace as string | undefined) ?? undefined,
    signals: [],   // populated separately via getEventSignals
    conflicts: [], // populated by reasoning engine
  };
}
