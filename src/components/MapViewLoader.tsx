"use client";
import dynamic from "next/dynamic";
import type { AssessedEvent } from "@/types";

const MapViewDynamic = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
      Loading map…
    </div>
  ),
});

interface MapViewLoaderProps {
  events: AssessedEvent[];
  onEventClick?: (eventId: string) => void;
  centerOverride?: [number, number] | null;
}

export default function MapViewLoader(props: MapViewLoaderProps) {
  return <MapViewDynamic {...props} />;
}
