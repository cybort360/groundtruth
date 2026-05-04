"use client";

import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-teal-700 px-4 py-2.5">
        <div className="h-3 w-48 bg-teal-600 rounded animate-pulse" />
      </div>
      <div className="bg-slate-100 animate-pulse" style={{ height: 280 }} />
      <div className="bg-white px-4 py-3 flex justify-end gap-2">
        <div className="h-8 w-16 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-8 w-32 bg-teal-100 rounded-xl animate-pulse" />
      </div>
    </div>
  ),
});

export default LocationPicker;
