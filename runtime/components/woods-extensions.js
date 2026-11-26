// Compatibility application source; migrate components incrementally.
// Woods-owned additions to the extracted runtime; keep their source readable.
// Quantize the selected line's measured width; the component delays shrinkage.
export function songLyricsWidth(widths) {
  const widest = widths.reduce((max, width) => (Number.isFinite(width) ? Math.max(max, width) : max), 0);
  return widest > 0 ? Math.ceil(Math.min(520, Math.max(96, widest)) / 16) * 16 : 0;
}

export const lyricsSizeTransition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
  mass: 1,
};

export function validWeatherForecast(value) {
  return (
    value &&
    typeof value.now?.temp === "number" &&
    typeof value.now?.code === "number" &&
    Array.isArray(value.hours) &&
    value.hours.length > 0 &&
    value.hours.every((hour) => Number.isFinite(hour.time) && hour.time > 0 && hour.time < 1e11) &&
    Array.isArray(value.days) &&
    value.days.length > 0
  );
}
export const woodsInfoIcon = {
  name: "info",
  size: 24,
  node: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "outline" }],
    ["path", { d: "M12 16v-4", key: "stem" }],
    ["path", { d: "M12 8h.01", key: "dot" }],
  ],
};
export function exportNote({ id, title, text }) {
  return window.__TAURI_INTERNALS__.invoke("note_export", { id: id || null, title, text });
}

