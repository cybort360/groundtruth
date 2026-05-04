/**
 * SQLite Database Layer
 *
 * All database operations go through this module.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 */

import Database from "better-sqlite3";
import path from "path";
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
  `);
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

export function getActiveEvents(): AssessedEvent[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM events WHERE status IN ('active', 'uncertain') ORDER BY confidence DESC
  `).all() as Record<string, unknown>[];
  return rows.map(mapEvent);
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
    signals: [],   // populated separately via getEventSignals
    conflicts: [], // populated by reasoning engine
  };
}
