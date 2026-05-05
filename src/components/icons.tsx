/**
 * Shared SVG icon components used across the app.
 * All icons: viewBox="0 0 20 20", stroke-based, no fill (unless noted).
 * Pass className to override size — default is w-5 h-5.
 */

interface IconProps {
  className?: string;
}

// ── Event-type icons ──────────────────────────────────────────────────────────

export function FloodingIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 7 C4 5.5 6 8.5 8 7 C10 5.5 12 8.5 14 7 C16 5.5 18 8.5 18 7" />
      <path d="M2 11 C4 9.5 6 12.5 8 11 C10 9.5 12 12.5 14 11 C16 9.5 18 12.5 18 11" />
      <path d="M5 15 C7 13.5 9 16.5 11 15 C13 13.5 15 16.5 15 15" />
    </svg>
  );
}

export function EarthquakeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 10 L4 10 L5.5 5 L7.5 15 L9.5 7 L11 13 L13 10 L19 10" />
    </svg>
  );
}

export function WildfireIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 18 C7 18 5.5 15 5.5 12.5 C5.5 10 7 8 10 5 C10 7.5 12 9 12 11.5 C13 9.5 13 7 11.5 5.5 C14.5 6.5 16 9.5 16 12.5 C16 15 14.5 18 10 18Z" />
    </svg>
  );
}

export function LandslideIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 17 L9 4 L16 17" />
      <circle cx="13" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M1 17 H19" />
    </svg>
  );
}

export function TsunamiIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 14 C3 10 7 6 11 10 C13 12 15.5 9 18 7 L18 10 C15.5 12 13 15 10 13 C7 11 4 14 3 17Z" />
      <path d="M3 17 C6 15 9 18 12 17 C15 16 17 18 19 17" />
    </svg>
  );
}

export function TropicalStormIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 10 C10 7.5 12.5 6 14.5 8 C16.5 10 14.5 13.5 11.5 13.5 C8.5 13.5 6.5 11 7.5 8.5 C8.5 6 11.5 6.5 12 8.5" />
    </svg>
  );
}

export function RoadClosureIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 2 L7 18 M11 2 L13 18" />
      <path d="M4 10 H16" strokeWidth={2.2} />
      <path d="M6 7.5 L14 12.5 M14 7.5 L6 12.5" />
    </svg>
  );
}

export function PowerOutageIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2 L7 11 H11 L9 19 L17 8 H13 L15 2Z" />
    </svg>
  );
}

export function StructuralDamageIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 18 V9 L10 3 L18 9 V18" />
      <path d="M8 18 V13 H12 V18" />
      <path d="M9 7.5 L11 10 L10 9 L12 11.5" />
    </svg>
  );
}

export function GasLeakIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 13 C3.5 11.5 3.5 8 6 7 C5.5 5 7.5 3 10 4.5 C11 3 14 3.5 14.5 5.5 C17 6.5 17.5 10 16 12.5Z" />
      <path d="M10 13 V16" />
      <path d="M7.5 16 C9 14.5 11 14.5 12.5 16" />
    </svg>
  );
}

export function AvalancheIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 18 L10 4 L17 18" />
      <path d="M6 13 C8 11 10 13.5 12 11 C14 8.5 15.5 11 17.5 9"
        strokeDasharray="2 1.5" />
    </svg>
  );
}

export function VolcanicActivityIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 18 L7 10 L9 13 L10 9 L11 13 L13 10 L18 18" />
      <path d="M8.5 5.5 L10 2.5 L11.5 5.5" />
      <path d="M6 7 L4 4.5" />
      <path d="M14 7 L16 4.5" />
    </svg>
  );
}

export function IncidentIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 2 L18.5 17 H1.5 L10 2Z" />
      <path d="M10 8 V12" />
      <path d="M10 15 V15.01" strokeWidth={2.5} />
    </svg>
  );
}

// ── Event-type dispatcher ─────────────────────────────────────────────────────

export function EventTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const cls = className ?? "w-5 h-5";
  switch (type) {
    case "flooding":          return <FloodingIcon className={cls} />;
    case "earthquake":        return <EarthquakeIcon className={cls} />;
    case "wildfire":          return <WildfireIcon className={cls} />;
    case "landslide":         return <LandslideIcon className={cls} />;
    case "tsunami":           return <TsunamiIcon className={cls} />;
    case "tropical_storm":    return <TropicalStormIcon className={cls} />;
    case "road_closure":      return <RoadClosureIcon className={cls} />;
    case "power_outage":      return <PowerOutageIcon className={cls} />;
    case "structural_damage": return <StructuralDamageIcon className={cls} />;
    case "gas_leak":          return <GasLeakIcon className={cls} />;
    case "avalanche":         return <AvalancheIcon className={cls} />;
    case "volcanic_activity": return <VolcanicActivityIcon className={cls} />;
    default:                  return <IncidentIcon className={cls} />;
  }
}

// ── Evidence-type icons ───────────────────────────────────────────────────────

export function EvidenceIcon({
  type,
  className,
}: {
  type: "photo" | "audio" | "text" | "sensor";
  className?: string;
}) {
  const cls = className ?? "w-4 h-4";
  if (type === "photo")
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h.879a1.5 1.5 0 0 0 1.06-.44l.883-.883A1.5 1.5 0 0 1 7.38 4h5.243a1.5 1.5 0 0 1 1.06.44l.883.883A1.5 1.5 0 0 0 15.62 6H16.5A1.5 1.5 0 0 1 18 7.5v8A1.5 1.5 0 0 1 16.5 17h-13A1.5 1.5 0 0 1 2 15.5v-8z" />
        <circle cx="10" cy="11" r="2.5" />
      </svg>
    );
  if (type === "audio")
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="7" y="2" width="6" height="9" rx="3" />
        <path d="M4 10a6 6 0 0 0 12 0M10 16v2M7 18h6" />
      </svg>
    );
  if (type === "sensor")
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M3.5 6.5a9 9 0 0 0 0 7M6 8.5a5 5 0 0 0 0 3M16.5 6.5a9 9 0 0 1 0 7M14 8.5a5 5 0 0 1 0 3" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  // text
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M4 6h12M4 10h8M4 14h6" />
    </svg>
  );
}

// ── General UI icons ──────────────────────────────────────────────────────────

export function CheckCircleIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="10" cy="10" r="8" />
      <path d="M6.5 10 L9 12.5 L13.5 8" />
    </svg>
  );
}

export function SearchIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M13 13 L17 17" />
    </svg>
  );
}

export function AlertDotIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="currentColor" />
    </svg>
  );
}
