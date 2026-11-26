import { React } from "../react";
import { ot as useIslandStore } from "../compat/island-store.js";
import { H as t } from "../compat/shared.js";
import { DeviceIcon } from "../peripherals/DeviceIcon";
import { peripheralName } from "../peripherals/model";
import {
  compactDevice,
  loadParts,
  percent,
  speed,
  type SystemLoad,
} from "./indicator-model";
export function CompactIndicators() {
  const settings = useIslandStore((state: any) => state.settings),
    payload = useIslandStore((state: any) => state.peripherals),
    load: SystemLoad | null = useIslandStore((state: any) => state.systemLoad);
  const device = compactDevice(settings, payload),
    parts = loadParts(settings),
    fresh = load && Date.now() - load.observedAt < 5000;
  if (!device && !parts.length) return null;
  return (
    <span
      data-compact-indicators
      className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-ink-2"
    >
      {device && (
        <span
          data-device-battery
          title={`${peripheralName(device, settings)} · ${device.percent}%`}
          style={{ width: 52 }}
          className={`tabular flex shrink-0 items-center gap-1 ${(device.percent ?? 101) <= (settings.deviceBatteryLow ?? 20) ? "text-danger" : ""}`}
        >
          <DeviceIcon kind={device.kind} size={14} />
          {device.percent}%
        </span>
      )}
      {parts.map((part) => (
        <span
          key={part}
          data-pill-load={part}
          style={{ width: part === "net" ? 78 : 58 }}
          title={
            part === "net"
              ? t(
                  `Сеть: ↓ ${speed(fresh ? load.down : null)} · ↑ ${speed(fresh ? load.up : null)}`,
                  `Network: ↓ ${speed(fresh ? load.down : null)} · ↑ ${speed(fresh ? load.up : null)}`,
                )
              : undefined
          }
          className="tabular flex shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap"
        >
          <span className="text-[9px] text-ink-3">
            {part === "net" ? "↓" : part.toUpperCase()}
          </span>
          <span>
            {part === "net"
              ? speed(fresh ? load.down : null)
              : percent(fresh ? load[part === "ram" ? "memory" : part] : null)}
          </span>
        </span>
      ))}
    </span>
  );
}
