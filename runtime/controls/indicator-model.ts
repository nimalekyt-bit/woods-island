import {
  normalizePeripherals,
  visiblePeripherals,
  type PeripheralPreferences,
} from "../peripherals/model";
export interface IndicatorSettings extends PeripheralPreferences {
  deviceBattery?: string;
  deviceBatteryLow?: number;
  loadInPill?: string[];
}
export const LOAD_PARTS = ["cpu", "ram", "gpu", "net"] as const;
export type LoadPart = (typeof LOAD_PARTS)[number];
export function loadParts(settings?: IndicatorSettings | null): LoadPart[] {
  return LOAD_PARTS.filter(
    (part) =>
      Array.isArray(settings?.loadInPill) && settings.loadInPill.includes(part),
  );
}
export function compactDevice(
  settings: IndicatorSettings | null | undefined,
  payload: unknown,
) {
  if (
    !settings ||
    settings.showPeripherals === false ||
    !["low", "always"].includes(settings.deviceBattery ?? "")
  )
    return null;
  const devices = visiblePeripherals(
    normalizePeripherals(payload),
    settings,
  ).filter(
    (device) => device.batteryStatus === "available" && device.percent !== null,
  );
  devices.sort(
    (a, b) =>
      (a.percent ?? 101) - (b.percent ?? 101) || a.id.localeCompare(b.id),
  );
  const device = devices[0];
  const threshold = Math.min(
    50,
    Math.max(5, Number(settings.deviceBatteryLow) || 20),
  );
  return device &&
    (settings.deviceBattery === "always" ||
      (device.percent ?? 101) <= threshold)
    ? device
    : null;
}
export function compactIndicatorWidth(
  settings?: IndicatorSettings | null,
  payload?: unknown,
): number {
  const widths: number[] = loadParts(settings).map((part) =>
    part === "net" ? 78 : 58,
  );
  if (compactDevice(settings, payload)) widths.unshift(52);
  return (
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, widths.length - 1) * 6
  );
}
export interface SystemLoad {
  cpu: number | null;
  memory: number | null;
  gpu: number | null;
  down: number | null;
  up: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  observedAt: number;
}
export function percent(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(Math.max(0, Math.min(100, value)))}%`
    : "—";
}
export function speed(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return "—";
  return value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB/s`
    : value >= 1024
      ? `${Math.round(value / 1024)} KB/s`
      : `${Math.round(value)} B/s`;
}
