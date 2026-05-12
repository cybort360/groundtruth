/**
 * Reverse geocoding via Nominatim (OpenStreetMap).
 * Free, no API key, requires internet — fails gracefully when offline.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
      { headers: { "Accept-Language": "en" }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: { road?: string; neighbourhood?: string; suburb?: string; city?: string };
    };
    const a = data.address;
    if (a) {
      const parts = [a.road, a.neighbourhood ?? a.suburb, a.city].filter(Boolean);
      if (parts.length) return parts.slice(0, 2).join(", ");
    }
    return data.display_name?.split(",").slice(0, 2).join(",").trim() ?? null;
  } catch {
    return null;
  }
}
