import { React } from "../react";
import { H as t } from "../compat/shared.js";
import {
  weatherPlaces,
  samePlace,
  type PlaceSettings,
  type WeatherPlace,
} from "./places";

export function WeatherPlaces({
  settings,
  onPick,
  busy = false,
}: {
  settings: PlaceSettings;
  onPick: (place: WeatherPlace) => void;
  busy?: boolean;
}) {
  const places = weatherPlaces(settings);
  if (places.length < 2) return null;
  return (
    <div
      data-weather-places
      role="group"
      aria-label={t("Недавние города", "Recent cities")}
      style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}
    >
      {places.map((place) => {
        const current =
          !!settings.weatherCity?.trim() &&
          samePlace(place, {
            lat: settings.weatherLat ?? NaN,
            lon: settings.weatherLon ?? NaN,
          });
        return (
          <button
            key={`${place.lat}:${place.lon}`}
            aria-pressed={current}
            disabled={busy || current}
            onClick={() => onPick(place)}
            title={place.name}
            className="press"
            style={{
              maxWidth: "100%",
              minWidth: 0,
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 12,
              lineHeight: "16px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              background: current
                ? "var(--accent-soft, rgba(255,255,255,.12))"
                : "rgba(255,255,255,.055)",
              color: "inherit",
              opacity: current ? 0.65 : 1,
            }}
          >
            {place.name}
          </button>
        );
      })}
    </div>
  );
}
