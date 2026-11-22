export interface WeatherPlace {
  name: string;
  lat: number;
  lon: number;
  timezone?: string;
  utcOffset?: number | null;
}
export interface PlaceSettings {
  weatherCity?: string;
  weatherLat?: number;
  weatherLon?: number;
  weatherTimezone?: string;
  weatherUtcOffset?: number | null;
  weatherPlaces?: string;
}
export function samePlace(
  a: Pick<WeatherPlace, "lat" | "lon">,
  b: Pick<WeatherPlace, "lat" | "lon">,
) {
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lon - b.lon) < 0.0001;
}
export function weatherPlaces(settings: PlaceSettings): WeatherPlace[] {
  let saved: unknown = [];
  try {
    if (
      typeof settings.weatherPlaces === "string" &&
      settings.weatherPlaces.length <= 16384
    )
      saved = JSON.parse(settings.weatherPlaces);
  } catch {}
  const current = {
    name: settings.weatherCity,
    lat: settings.weatherLat,
    lon: settings.weatherLon,
    timezone: settings.weatherTimezone,
    utcOffset: settings.weatherUtcOffset,
  };
  const result: WeatherPlace[] = [];
  for (const value of [current, ...(Array.isArray(saved) ? saved : [])]) {
    if (
      !value ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 512 ||
      typeof value.lat !== "number" ||
      !Number.isFinite(value.lat) ||
      Math.abs(value.lat) > 90 ||
      typeof value.lon !== "number" ||
      !Number.isFinite(value.lon) ||
      Math.abs(value.lon) > 180
    )
      continue;
    if (!result.some((other) => samePlace(value, other)))
      result.push({ ...value, name: value.name.trim() });
    if (result.length === 8) break;
  }
  return result;
}
export function placePatch(place: WeatherPlace) {
  return {
    weatherCity: place.name,
    weatherLat: place.lat,
    weatherLon: place.lon,
    weatherTimezone: place.timezone || "",
    weatherUtcOffset: place.utcOffset ?? null,
  };
}
