import { NextResponse } from "next/server";
import { fetchGDACSHistory } from "@/lib/gdacs";
import {
  insertGDACSEvents,
  logGDACSSync,
  getGDACSSyncStatus,
} from "@/lib/db";

/** GET /api/gdacs/sync — return current sync status */
export async function GET() {
  const status = getGDACSSyncStatus();
  return NextResponse.json(status);
}

/** POST /api/gdacs/sync — fetch from GDACS and store locally */
export async function POST() {
  try {
    const yearsBack = 3;
    const toDate = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(
      Date.now() - yearsBack * 365.25 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    console.log(`[gdacs] Starting sync: ${fromDate} → ${toDate}`);
    const events = await fetchGDACSHistory(yearsBack);
    const inserted = insertGDACSEvents(events);
    logGDACSSync(inserted, fromDate, toDate);

    console.log(`[gdacs] Sync complete: ${inserted} events stored`);
    return NextResponse.json({
      ok: true,
      inserted,
      fromDate,
      toDate,
      message: `Synced ${inserted} disaster events from GDACS (${fromDate} → ${toDate}).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[gdacs] Sync failed:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
