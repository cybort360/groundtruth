/**
 * update_event tool
 *
 * Creates or updates an event assessment in the database.
 * Called by the reasoning engine after it has synthesized signals.
 */

import { v4 as uuid } from "uuid";
import { upsertEvent } from "../db";
import type { AssessedEvent } from "@/types";

export async function updateEvent(args: Record<string, unknown>): Promise<{
  eventId: string;
  action: "created" | "updated";
  confidence: number;
  status: string;
}> {
  const eventId = (args.event_id as string) || uuid();
  const isNew = !args.event_id;

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
