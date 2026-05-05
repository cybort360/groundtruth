"use client";

import { useState } from "react";
import type { AssessedEvent, EventType } from "@/types";
import { EventTypeIcon, CheckCircleIcon } from "./icons";

// ── Per-type guidance ────────────────────────────────────────────────────────

const TYPE_GUIDANCE: Record<string, { avoid: string; caution: string }> = {
  flooding:          { avoid: "Avoid low-lying roads, underpasses, drainage channels. Never drive through standing water. 30 cm can sweep a car.", caution: "Levels may still rise. Seek higher ground and keep an exit route clear." },
  earthquake:        { avoid: "Stay away from damaged structures. Aftershocks can collapse weakened buildings. Check for gas leaks before re-entering.", caution: "Ground may be unstable. Avoid tall structures and bridges. Monitor alerts." },
  wildfire:          { avoid: "Evacuate immediately if in the fire path. Move upwind. Close all vents to limit smoke infiltration.", caution: "Monitor air quality and wind direction. Keep go-bags ready. Follow evacuation orders." },
  landslide:         { avoid: "Stay away from hillsides and drainage channels. Do not try to outrun a slide.", caution: "Listen for cracking or rumbling sounds. Move to flat stable ground away from slopes." },
  tsunami:           { avoid: "Move inland and uphill immediately. Don't wait to see the wave. Don't return until all-clear is issued.", caution: "Ground shaking near the coast is a natural warning. Know your evacuation route." },
  tropical_storm:    { avoid: "Stay indoors away from windows. Avoid flooded roads and coastal areas. Don't go out during the eye.", caution: "Secure loose outdoor items. Keep devices charged. Monitor storm track updates." },
  road_closure:      { avoid: "Do not attempt to pass. Find an alternative route using local knowledge.", caution: "Adjacent roads may back up. Allow significant extra travel time." },
  power_outage:      { avoid: "Stay away from downed power lines. Treat all as live. Never run generators indoors.", caution: "Preserve battery. Use battery lighting. Keep the fridge closed to preserve food." },
  structural_damage: { avoid: "Do not enter the structure. Collapse can be sudden even from a distance.", caution: "Visible cracks can worsen rapidly. Alert building authorities immediately." },
  gas_leak:          { avoid: "Evacuate immediately. No open flames, switches, or electronics nearby. Call emergency services from a safe distance.", caution: "Open windows if safe. Do not re-enter until cleared by authorities." },
  avalanche:         { avoid: "Do not travel through avalanche paths or steep snow-loaded slopes. If caught, create an air pocket.", caution: "Recent snowfall or rapid warming raises risk. Carry avalanche safety equipment." },
  volcanic_activity: { avoid: "Follow evacuation orders. Avoid valleys and river channels (lahar risk). Wear N95 masks against ash.", caution: "Ash can impair visibility and breathing. Protect water supplies. Monitor alert levels." },
  other:             { avoid: "Avoid the affected area until more information is available. Follow local authority instructions.", caution: "Situation is developing. Stay informed and be ready to act on official guidance." },
};

function getGuidance(type: string, section: "avoid" | "caution") {
  return (TYPE_GUIDANCE[type] ?? TYPE_GUIDANCE.other)[section];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({
  color,
  children,
}: {
  color: "rose" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const dot =
    color === "rose"    ? "bg-rose-500"    :
    color === "amber"   ? "bg-amber-400"   :
                          "bg-emerald-500";
  const text =
    color === "rose"    ? "text-rose-700"  :
    color === "amber"   ? "text-amber-700" :
                          "text-emerald-700";

  return (
    <div className="flex items-center gap-2 mb-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className={`text-xs font-semibold uppercase tracking-wider ${text}`}>
        {children}
      </span>
    </div>
  );
}

function AvoidCard({ event }: { event: AssessedEvent }) {
  return (
    <div className="bg-rose-50 border border-rose-100 rounded-xl px-3.5 py-3">
      <div className="flex items-start gap-2 mb-1">
        <span className="flex-shrink-0 mt-0.5 text-rose-400">
          <EventTypeIcon type={event.eventType} className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
              {event.title}
            </p>
            <span className="text-xs font-bold text-rose-600 flex-shrink-0">
              {Math.round(event.confidence * 100)}%
            </span>
          </div>
          <p className="text-xs text-rose-700 mt-1 leading-relaxed">
            {getGuidance(event.eventType, "avoid")}
          </p>
        </div>
      </div>
    </div>
  );
}

function CautionCard({ event }: { event: AssessedEvent }) {
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 mt-0.5 text-amber-500">
          <EventTypeIcon type={event.eventType} className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
              {event.title}
            </p>
            <span className="text-xs font-bold text-amber-600 flex-shrink-0">
              {Math.round(event.confidence * 100)}%
            </span>
          </div>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            {getGuidance(event.eventType, "caution")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ClearRow({ event }: { event: AssessedEvent }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
      <span className="flex-shrink-0 text-emerald-500">
        <EventTypeIcon type={event.eventType} className="w-4 h-4" />
      </span>
      <span className="text-sm text-slate-700 flex-1 truncate">{event.title}</span>
      <span className="text-xs text-emerald-600 font-medium flex-shrink-0">
        {event.status === "resolved" ? "Resolved" : `${Math.round(event.confidence * 100)}%`}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ActionAdvisor({ events }: { events: AssessedEvent[] }) {
  const [open, setOpen] = useState(true);

  const avoidList = events
    .filter((e) => e.status === "active" && e.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence);

  const cautionList = events.filter(
    (e) => e.status === "uncertain" || (e.status === "active" && e.confidence >= 0.4 && e.confidence < 0.6)
  );

  const clearList = events.filter(
    (e) => e.status === "resolved" || (e.status === "active" && e.confidence < 0.4)
  );

  const activeCount = events.filter((e) => e.status === "active").length;
  const allClear = avoidList.length === 0 && cautionList.length === 0;

  // Summary text for collapsed state
  const summary =
    avoidList.length > 0
      ? `${avoidList.length} area${avoidList.length !== 1 ? "s" : ""} to avoid`
      : allClear && clearList.length > 0
      ? "All areas appear clear"
      : activeCount === 0
      ? "No active events"
      : "Monitoring…";

  const summaryColor =
    avoidList.length > 0 ? "text-rose-600" :
    allClear             ? "text-emerald-600" :
                           "text-slate-500";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header — always visible, toggles expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          {/* Shield icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 text-teal-600 flex-shrink-0" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-sm font-semibold text-slate-900">Safety Advice</span>
          {!open && (
            <span className={`text-xs font-medium ${summaryColor}`}>
              · {summary}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{activeCount} active</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div className="animate-expand px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
          {/* All-clear / empty state */}
          {avoidList.length === 0 && cautionList.length === 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-3.5 py-3 mt-2">
              <span className="text-emerald-500 flex-shrink-0">
                <CheckCircleIcon className="w-5 h-5" />
              </span>
              <p className="text-sm text-emerald-700 font-medium">
                {clearList.length > 0
                  ? "All monitored areas are clear or resolving."
                  : "No active events detected — all routes appear clear."}
              </p>
            </div>
          )}

          {/* Avoid */}
          {avoidList.length > 0 && (
            <div className="mt-2">
              <SectionLabel color="rose">Areas to avoid</SectionLabel>
              <div className="space-y-2">
                {avoidList.map((e) => <AvoidCard key={e.id} event={e} />)}
              </div>
            </div>
          )}

          {/* Caution */}
          {cautionList.length > 0 && (
            <div>
              <SectionLabel color="amber">Proceed with caution</SectionLabel>
              <div className="space-y-2">
                {cautionList.map((e) => <CautionCard key={e.id} event={e} />)}
              </div>
            </div>
          )}

          {/* Clear */}
          {clearList.length > 0 && (
            <div>
              <SectionLabel color="emerald">Appears clear</SectionLabel>
              <div className="space-y-1.5">
                {clearList.map((e) => <ClearRow key={e.id} event={e} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
