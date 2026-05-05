/**
 * update_event tool
 *
 * Creates or updates an event assessment in the database.
 * Called by the reasoning engine after it has synthesized signals.
 */

import { v4 as uuid } from "uuid";
import { upsertEvent, findNearbyActiveEvent } from "../db";
import type { AssessedEvent } from "@/types";

export async function updateEvent(args: Record<string, unknown>): Promise<{
  eventId: string;
  action: "created" | "updated";
  confidence: number;
  status: string;
}> {
  // If the model didn't supply an event_id, check whether an active event
  // already exists at this location + type before generating a new UUID.
  // This prevents duplicate events from accumulating across Analyze runs.
  let eventId = args.event_id as string | undefined;
  let isNew = false;
  if (!eventId) {
    const lat  = args.latitude  as number | undefined;
    const lng  = args.longitude as number | undefined;
    const type = args.event_type as string | undefined;
    const existing = (lat !== undefined && lng !== undefined && type)
      ? findNearbyActiveEvent(lat, lng, type)
      : null;
    if (existing) {
      eventId = existing;       // reuse — update in place
    } else {
      eventId = uuid();         // genuinely new location
      isNew   = true;
    }
  }

  upsertEvent({
    id: eventId,
    title: args.title as string,
    eventType: args.event_type as AssessedEvent["eventType"],
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    radiusMeters: args.radius_meters as number | undefined,
    confidence: args.confidence as number,
    reasoningChain: args.reasoning_chain as string,
    status: (args.status as "active" | "resolved" | "uncertain") || "active",
  });

  return {
    eventId,
    action: isNew ? "created" : "updated",
    confidence: args.confidence as number,
    status: (args.status as string) || "active",
  };
}
