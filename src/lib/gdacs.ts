/**
 * GDACS Integration
 *
 * Fetches verified historical disaster events from the Global Disaster Alert
 * and Coordination System (GDACS) — a free public API operated by the
 * European Commission and the United Nations.
 *
 * Attribution required: © GDACS / European Commission (CC BY 4.0)
 * API docs: https://www.gdacs.org/gdacsapi/
 *
 * Results are stored locally in SQLite so the system works offline after
 * the first sync. check_history queries this table alongside GroundTruth's
 * own past assessments to give Gemma real historical context.
 */

const GDACS_API =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";

export const GDACS_TYPE_MAP: Record<string, string> = {
  FL: "flooding",
  EQ: "earthquake",
  TC: "tropical_storm",
  VO: "volcanic_activity",
  TS: "tsunami",
  WF: "wildfire",
  DR: "drought",
};

const SEVERITY_MAP: Record<string, string> = {
  Red: "critical",
  Orange: "severe",
  Green: "moderate",
};

export interface GDACSEvent {
  gdacsId: string;
  eventType: string; // mapped to GroundTruth types
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
}

interface GDACSFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: {
    eventtype: string;
    eventid: number;
    episodeid: number;
    name: string;
    description: string;
    alertlevel: string;
    country: string;
    iso3: string;
    fromdate: string;
    todate: string;
    severitydata?: { severitytext: string };
  };
}

/**
 * Fetch disaster events from GDACS for one date range.
 * Filters to Red + Orange alerts by default — significant events only.
 */
export async function fetchGDACSEvents(options: {
  fromDate: string;
  toDate: string;
  alertLevels?: string[];
}): Promise<GDACSEvent[]> {
  const alertLevels = options.alertLevels ?? ["Red", "Orange"];

  const params = new URLSearchParams({
    fromdate: options.fromDate,
    todate: options.toDate,
    alertlevel: alertLevels.join(","),
    episodeid: "0",
    eventlist: "FL,EQ,TC,VO,TS,WF,DR",
  });

  const res = await fetch(`${GDACS_API}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GDACS API ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as { features: GDACSFeature[] };

  return (data.features ?? [])
    .filter(
      (f) =>
        f.geometry?.type === "Point" &&
        Array.isArray(f.geometry.coordinates) &&
        GDACS_TYPE_MAP[f.properties.eventtype],
    )
    .map((f) => ({
      gdacsId: `${f.properties.eventtype}${f.properties.eventid}-${f.properties.episodeid}`,
      eventType: GDACS_TYPE_MAP[f.properties.eventtype],
      latitude: f.geometry!.coordinates[1],
      longitude: f.geometry!.coordinates[0],
      country: f.properties.country ?? "",
      alertLevel: f.properties.alertlevel ?? "Green",
      severity: SEVERITY_MAP[f.properties.alertlevel] ?? "moderate",
      name: f.properties.name ?? "",
      description: f.properties.description ?? "",
      severityText: f.properties.severitydata?.severitytext ?? "",
      fromDate: f.properties.fromdate ?? "",
      toDate: f.properties.todate ?? "",
    }));
}

/**
 * Fetch 3 years of GDACS history in 6-month chunks.
 * GDACS returns ~100 events per call; chunking captures the full record.
 */
export async function fetchGDACSHistory(yearsBack = 3): Promise<GDACSEvent[]> {
  const now = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - yearsBack);

  // Build 6-month windows
  const windows: { from: string; to: string }[] = [];
  const cursor = new Date(start);
  while (cursor < now) {
    const end = new Date(cursor);
    end.setMonth(end.getMonth() + 6);
    if (end > now) end.setTime(now.getTime());
    windows.push({
      from: cursor.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
    cursor.setMonth(cursor.getMonth() + 6);
  }

  const allEvents: GDACSEvent[] = [];
  const seen = new Set<string>();

  for (const w of windows) {
    try {
      const events = await fetchGDACSEvents({ fromDate: w.from, toDate: w.to });
      for (const e of events) {
        if (!seen.has(e.gdacsId)) {
          seen.add(e.gdacsId);
          allEvents.push(e);
        }
      }
    } catch (err) {
      console.warn(`[gdacs] Chunk ${w.from}–${w.to} failed:`, err);
    }
  }

  return allEvents;
}
