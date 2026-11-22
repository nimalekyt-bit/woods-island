export interface PeripheralDevice {
  id: string;
  name: string;
  reportedName: string | null;
  kind: string;
  transport: string;
  present: boolean;
  connected: boolean | null;
  percent: number | null;
  charging: boolean | null;
  chargingReadAt: number | null;
  batteryStatus: "available" | "stale" | "unavailable";
  unavailableReason: string | null;
  source: string;
  lastReadAt: number | null;
  manualMeasurementAvailable: boolean;
  manualMillivolts: number | null;
}
export interface PeripheralSnapshot {
  revision: number;
  devices: PeripheralDevice[];
  loading: boolean;
  error: string | null;
  lastScanAt: number | null;
}
export interface PeripheralPreferences {
  showPeripherals?: boolean;
  peripheralHidden?: string[];
  peripheralLimit?: number;
  peripheralUnknown?: boolean;
  peripheralCharging?: boolean;
  peripheralSort?: string;
  peripheralAlerts?: boolean;
  peripheralLowThreshold?: number;
  peripheralNotifyLow?: boolean;
  peripheralNotifyCharging?: boolean;
  peripheralNotifyUnplugged?: boolean;
  peripheralNotifyFull?: boolean;
  peripheralNotifyConnection?: boolean;
  peripheralNotifyDisconnection?: boolean;
  peripheralNames?: string;
  peripheralMuted?: string[];
}
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
export function normalizePeripherals(value: unknown): PeripheralSnapshot {
  const data = object(value);
  const devices = new Map<string, PeripheralDevice>();
  for (const raw of Array.isArray(data?.devices)
    ? data.devices.slice(0, 128)
    : []) {
    const d = object(raw);
    if (!d || typeof d.id !== "string" || !d.id || typeof d.name !== "string")
      continue;
    const percent =
      typeof d.percent === "number" &&
      Number.isInteger(d.percent) &&
      d.percent >= 0 &&
      d.percent <= 100
        ? d.percent
        : null;
    const status =
      d.batteryStatus === "stale"
        ? "stale"
        : percent !== null && d.batteryStatus === "available"
          ? "available"
          : "unavailable";
    devices.set(d.id, {
      id: d.id,
      name: d.name.slice(0, 256) || "Device",
      reportedName:
        typeof d.reportedName === "string"
          ? d.reportedName.slice(0, 256)
          : null,
      kind: ["mouse", "keyboard", "headset", "gamepad", "other"].includes(
        String(d.kind),
      )
        ? String(d.kind)
        : "other",
      transport: ["bluetooth", "usb", "receiver"].includes(String(d.transport))
        ? String(d.transport)
        : "other",
      present: d.present === true,
      connected: typeof d.connected === "boolean" ? d.connected : null,
      percent,
      charging:
        d.source !== "g435-manual" &&
        d.present === true &&
        d.connected !== false &&
        (status === "available" || finite(d.chargingReadAt) !== null) &&
        typeof d.charging === "boolean"
          ? d.charging
          : null,
      chargingReadAt: finite(d.chargingReadAt),
      manualMeasurementAvailable:
        d.manualMeasurementAvailable === true &&
        d.kind === "headset" &&
        d.transport === "receiver" &&
        d.present === true,
      manualMillivolts:
        typeof d.manualMillivolts === "number" &&
        Number.isInteger(d.manualMillivolts) &&
        d.manualMillivolts >= 2500 &&
        d.manualMillivolts <= 4600
          ? d.manualMillivolts
          : null,
      batteryStatus: status,
      unavailableReason:
        typeof d.unavailableReason === "string" ? d.unavailableReason : null,
      source: typeof d.source === "string" ? d.source : "none",
      lastReadAt: finite(d.lastReadAt),
    });
  }
  return {
    revision: finite(data?.revision) ?? 0,
    devices: [...devices.values()],
    loading: data?.loading === true,
    error: typeof data?.error === "string" ? data.error : null,
    lastScanAt: finite(data?.lastScanAt),
  };
}
const priority: Record<string, number> = {
  headset: 0,
  mouse: 1,
  keyboard: 2,
  gamepad: 3,
  other: 4,
};
export function sortPeripherals(
  devices: PeripheralDevice[],
  sort = "type",
): PeripheralDevice[] {
  return [...devices].sort((a, b) => {
    if (sort === "charge") {
      const delta =
        (a.batteryStatus === "available" ? (a.percent ?? 101) : 101) -
        (b.batteryStatus === "available" ? (b.percent ?? 101) : 101);
      if (delta) return delta;
    } else if (sort === "type" && priority[a.kind] !== priority[b.kind])
      return priority[a.kind] - priority[b.kind];
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
export function visiblePeripherals(
  snapshot: PeripheralSnapshot,
  preferences: PeripheralPreferences,
): PeripheralDevice[] {
  const hidden = new Set(preferences.peripheralHidden ?? []);
  return sortPeripherals(
    snapshot.devices.filter(
      (d) =>
        d.present &&
        d.connected !== false &&
        !hidden.has(d.id) &&
        (preferences.peripheralUnknown !== false || d.percent !== null),
    ),
    preferences.peripheralSort,
  );
}
export function compactLimit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(6, Math.max(1, Math.round(value)))
    : 3;
}
export function sameNamedDevices(
  devices: PeripheralDevice[],
  device: PeripheralDevice,
): string {
  const peers = devices
    .filter((d) => d.name === device.name)
    .sort((a, b) => a.id.localeCompare(b.id));
  return peers.length > 1
    ? `${device.name} · ${peers.findIndex((d) => d.id === device.id) + 1}`
    : device.name;
}
/** Rising threshold hysteresis prevents repeat alerts from fluctuating device readings. */
export function createLowBatteryAlerts() {
  const notified = new Set<string>();
  return (
    snapshot: PeripheralSnapshot,
    preferences: PeripheralPreferences,
  ): PeripheralDevice[] => {
    if (
      preferences.showPeripherals === false ||
      preferences.peripheralAlerts !== true
    )
      return [];
    const threshold = Math.min(
      50,
      Math.max(5, preferences.peripheralLowThreshold ?? 20),
    );
    const muted = new Set(preferences.peripheralMuted ?? []);
    const result: PeripheralDevice[] = [];
    for (const d of snapshot.devices) {
      if (
        d.batteryStatus !== "available" ||
        d.percent === null ||
        !d.present ||
        d.connected === false
      )
        continue;
      if (d.charging === true || d.percent >= threshold + 5)
        notified.delete(d.id);
      else if (
        d.percent <= threshold &&
        !muted.has(d.id) &&
        !notified.has(d.id) &&
        preferences.peripheralNotifyLow !== false
      ) {
        notified.add(d.id);
        result.push(d);
      }
    }
    return result;
  };
}

export type PeripheralEvent = {
  event:
    | "low"
    | "charging"
    | "unplugged"
    | "full"
    | "connected"
    | "disconnected"
    | "usbConnected"
    | "usbDisconnected";
  device: PeripheralDevice;
};

export function peripheralEventEnabled(
  event: PeripheralEvent,
  p: PeripheralPreferences,
): boolean {
  if (
    p.showPeripherals === false ||
    p.peripheralAlerts !== true ||
    p.peripheralMuted?.includes(event.device.id)
  )
    return false;
  switch (event.event) {
    case "low":
      return p.peripheralNotifyLow !== false;
    case "charging":
      return p.peripheralNotifyCharging !== false;
    case "unplugged":
      return (
        (p.peripheralNotifyUnplugged ?? p.peripheralNotifyCharging) !== false
      );
    case "full":
      return p.peripheralNotifyFull !== false;
    case "connected":
    case "usbConnected":
      return p.peripheralNotifyConnection === true;
    case "disconnected":
    case "usbDisconnected":
      return (
        p.peripheralNotifyDisconnection ?? p.peripheralNotifyConnection === true
      );
    default:
      return false;
  }
}

export function samePeripheralNotice(
  a: { kind: string; device?: { id: string }; event?: string },
  b: { kind: string; device?: { id: string }; event?: string },
): boolean {
  return (
    a.kind === b.kind &&
    (a.kind !== "peripheralEvent" ||
      (a.device?.id === b.device?.id && a.event === b.event))
  );
}

/** A missing reading is unknown. A loss needs two successful inventories 12s apart. */
export function createConnectionEvents() {
  type State = {
    present: boolean;
    connected: boolean | null;
    pending?: { event: "disconnected" | "usbDisconnected"; at: number };
  };
  const states = new Map<string, State>();
  let initialized = false;
  let revision = -1;
  return (
    snapshot: PeripheralSnapshot,
    p: PeripheralPreferences,
    now = Date.now(),
  ): PeripheralEvent[] => {
    if (snapshot.revision <= revision) return [];
    revision = snapshot.revision;
    if (snapshot.loading || snapshot.error) {
      for (const state of states.values()) delete state.pending;
      return [];
    }
    const enabled = p.showPeripherals !== false && p.peripheralAlerts === true;
    const connect = p.peripheralNotifyConnection === true;
    const disconnect = p.peripheralNotifyDisconnection ?? connect;
    const muted = new Set(p.peripheralMuted ?? []);
    const result: PeripheralEvent[] = [];
    const at = snapshot.lastScanAt ?? now;
    const seen = new Set<string>();
    for (const device of snapshot.devices) {
      seen.add(device.id);
      const usb = device.transport === "receiver" || device.transport === "usb";
      const old = states.get(device.id);
      if (!old || !enabled || muted.has(device.id)) {
        states.set(device.id, {
          present: device.present,
          connected: usb && !device.present ? null : device.connected,
        });
        if (
          !old &&
          initialized &&
          enabled &&
          !muted.has(device.id) &&
          device.present
        )
          if (usb) result.push({ event: "usbConnected", device });
          else if (device.connected === true)
            result.push({ event: "connected", device });
        continue;
      }
      // Presence is evidence about a USB endpoint, never about radio power or sleep.
      if (usb && old.present !== device.present) {
        if (!device.present && !disconnect) {
          old.present = false;
          old.connected = null;
          delete old.pending;
        } else if (device.present) {
          result.push({ event: "usbConnected", device });
          old.present = true;
          old.connected = device.connected;
          delete old.pending;
        } else if (
          old.pending?.event === "usbDisconnected" &&
          at - old.pending.at >= 12000
        ) {
          result.push({ event: "usbDisconnected", device });
          old.present = false;
          old.connected = null;
          delete old.pending;
        } else if (old.pending?.event !== "usbDisconnected") {
          old.pending = { event: "usbDisconnected", at };
        }
        continue;
      }
      if (old.pending?.event === "usbDisconnected") delete old.pending;
      if (usb && !device.present) {
        old.connected = null;
        continue;
      }
      if (device.connected === null || old.connected === null) {
        old.connected = device.connected;
        delete old.pending;
        continue;
      }
      if (old.connected === device.connected) {
        delete old.pending;
        continue;
      }
      if (device.connected) {
        result.push({ event: "connected", device });
        old.connected = true;
        delete old.pending;
      } else if (!disconnect) {
        old.connected = false;
        delete old.pending;
      } else if (
        old.pending?.event === "disconnected" &&
        at - old.pending.at >= 12000
      ) {
        result.push({ event: "disconnected", device });
        old.connected = false;
        delete old.pending;
      } else if (old.pending?.event !== "disconnected") {
        old.pending = { event: "disconnected", at };
      }
    }
    for (const id of states.keys()) if (!seen.has(id)) states.delete(id);
    initialized = true;
    return result.filter(({ event }) =>
      event === "connected" || event === "usbConnected" ? connect : disconnect,
    );
  };
}

export function peripheralNotificationsActive(
  id: string,
  p: PeripheralPreferences,
): boolean {
  return (
    p.showPeripherals !== false &&
    p.peripheralAlerts === true &&
    !p.peripheralMuted?.includes(id) &&
    (p.peripheralNotifyLow !== false ||
      p.peripheralNotifyCharging !== false ||
      (p.peripheralNotifyUnplugged ?? p.peripheralNotifyCharging) !== false ||
      p.peripheralNotifyFull !== false ||
      p.peripheralNotifyConnection === true ||
      p.peripheralNotifyDisconnection === true)
  );
}
export function createPeripheralEvents() {
  const low = createLowBatteryAlerts();
  const connections = createConnectionEvents();
  const full = new Set<string>();
  let previous: PeripheralSnapshot | null = null;
  return (
    snapshot: PeripheralSnapshot,
    p: PeripheralPreferences,
    now = Date.now(),
  ): PeripheralEvent[] => {
    if (previous && snapshot.revision <= previous.revision) return [];
    if (snapshot.loading || snapshot.error) {
      connections(snapshot, p, now);
      previous = snapshot;
      return [];
    }
    const before = new Map(
      (previous && !previous.loading && !previous.error
        ? previous.devices
        : []
      ).map((d) => [d.id, d]),
    );
    const result: PeripheralEvent[] = low(snapshot, p).map((device) => ({
      event: "low",
      device,
    }));
    result.push(...connections(snapshot, p, now));
    const initialized = previous !== null;
    previous = snapshot;
    // Track the charge cycle even while alerts are muted or disabled. Opening
    // the app at 100% must not produce a later 99 -> 100 jitter notification.
    for (const device of snapshot.devices) {
      if (device.batteryStatus !== "available" || device.percent === null)
        continue;
      if (device.percent <= 95) full.delete(device.id);
      if (
        device.percent === 100 &&
        (!initialized ||
          !before.has(device.id) ||
          p.peripheralAlerts !== true ||
          p.showPeripherals === false ||
          p.peripheralNotifyFull === false ||
          p.peripheralMuted?.includes(device.id))
      )
        full.add(device.id);
    }
    if (
      !initialized ||
      p.showPeripherals === false ||
      p.peripheralAlerts !== true
    )
      return result;
    const muted = new Set(p.peripheralMuted ?? []);
    for (const device of snapshot.devices) {
      const old = before.get(device.id);
      if (!old || muted.has(device.id)) continue;
      if (
        !device.present ||
        device.connected === false ||
        !old.present ||
        old.connected === false
      )
        continue;
      if (
        (device.charging
          ? p.peripheralNotifyCharging !== false
          : (p.peripheralNotifyUnplugged ?? p.peripheralNotifyCharging) !==
            false) &&
        old.charging !== null &&
        device.charging !== null &&
        old.charging !== device.charging
      )
        result.push({
          event: device.charging ? "charging" : "unplugged",
          device,
        });
      if (
        p.peripheralNotifyFull !== false &&
        old.batteryStatus === "available" &&
        device.batteryStatus === "available" &&
        device.percent === 100 &&
        old.percent !== null &&
        old.percent < 100 &&
        !full.has(device.id)
      ) {
        full.add(device.id);
        result.push({ event: "full", device });
      }
    }
    return result;
  };
}
export function peripheralName(
  device: PeripheralDevice,
  preferences: PeripheralPreferences,
): string {
  try {
    const aliases = JSON.parse(preferences.peripheralNames ?? "{}");
    const name = aliases?.[device.id];
    if (typeof name === "string" && name.trim())
      return name.trim().slice(0, 80);
  } catch {}
  return device.name;
}
