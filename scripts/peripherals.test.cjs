const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const file = path.resolve(__dirname, "../runtime/peripherals/model.ts");
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = new Module(file);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
loaded._compile(compiled, file);
const {
  normalizePeripherals,
  visiblePeripherals,
  compactLimit,
  sameNamedDevices,
  createLowBatteryAlerts,
  createPeripheralEvents,
  peripheralName,
  createConnectionEvents,
  peripheralNotificationsActive,
  peripheralEventEnabled,
  samePeripheralNotice,
} = loaded.exports;
const device = (id, percent = 73, extra = {}) => ({
  id,
  name: "Wireless Mouse",
  kind: "mouse",
  transport: "bluetooth",
  present: true,
  connected: true,
  percent,
  charging: false,
  batteryStatus: "available",
  source: "windows",
  lastReadAt: 1000,
  ...extra,
});

test("manual voltage estimates remain visible without creating live charge alerts", () => {
  const feed = normalizePeripherals({
    devices: [
      device("g435", 83, {
        kind: "headset",
        transport: "receiver",
        source: "g435-manual",
        batteryStatus: "stale",
        charging: true,
        manualMillivolts: 4029,
        manualMeasurementAvailable: true,
      }),
    ],
  });
  assert.equal(feed.devices[0].charging, null);
  assert.equal(feed.devices[0].manualMillivolts, 4029);
  assert.equal(feed.devices[0].manualMeasurementAvailable, true);
  assert.equal(
    visiblePeripherals(feed, { peripheralUnknown: false }).length,
    1,
  );
  assert.deepEqual(
    createPeripheralEvents()(feed, { peripheralAlerts: true }),
    [],
  );
  assert.deepEqual(
    createLowBatteryAlerts()(feed, {
      peripheralAlerts: true,
      peripheralLowThreshold: 90,
    }),
    [],
  );
});
test("manual measurement is unavailable on unplugged receivers and other device kinds", () => {
  for (const extra of [
    { present: false, kind: "headset", transport: "receiver" },
    { kind: "mouse", transport: "receiver" },
    { kind: "headset", transport: "bluetooth" },
  ]) {
    const feed = normalizePeripherals({
      devices: [
        device("x", null, {
          ...extra,
          manualMeasurementAvailable: true,
          manualMillivolts: 999,
        }),
      ],
    });
    assert.equal(feed.devices[0].manualMeasurementAvailable, false);
    assert.equal(feed.devices[0].manualMillivolts, null);
  }
});

test("charge events require confirmed transitions and respect separate controls", () => {
  const events = createPeripheralEvents();
  let revision = 0;
  const feed = (extra = {}, preferences = {}) =>
    events(
      normalizePeripherals({
        devices: [device("one", 80, extra)],
        revision: ++revision,
      }),
      { peripheralAlerts: true, ...preferences },
    );
  assert.deepEqual(feed(), []);
  assert.deepEqual(
    feed({ charging: true }).map((e) => e.event),
    ["charging"],
  );
  assert.deepEqual(
    feed({ charging: false }).map((e) => e.event),
    ["unplugged"],
  );
  assert.deepEqual(feed({ charging: null }), []);
  assert.deepEqual(feed({ charging: true }), []);
  assert.deepEqual(
    feed({ charging: false }, { peripheralNotifyCharging: false }),
    [],
  );
  assert.deepEqual(feed({ charging: true }, { peripheralMuted: ["one"] }), []);
  assert.deepEqual(
    feed({ charging: false }, { peripheralHidden: ["one"] }).map(
      (e) => e.event,
    ),
    ["unplugged"],
  );
});

test("full charge hysteresis is seeded at startup and re-arms after a real discharge", () => {
  const events = createPeripheralEvents();
  let revision = 0;
  const feed = (percent) =>
    events(
      normalizePeripherals({
        devices: [device("one", percent)],
        revision: ++revision,
      }),
      { peripheralAlerts: true },
    );
  for (const percent of [100, 99, 100, 97, 100])
    assert.deepEqual(feed(percent), []);
  assert.deepEqual(feed(95), []);
  assert.deepEqual(
    feed(100).map((e) => e.event),
    ["full"],
  );
  assert.deepEqual(feed(100), []);
});

test("each event direction can be disabled without delaying old notifications", () => {
  const events = createPeripheralEvents();
  let revision = 0;
  let now = 1000;
  const feed = (extra, p = {}) =>
    events(
      normalizePeripherals({
        devices: [device("one", 80, extra)],
        revision: ++revision,
      }),
      {
        peripheralAlerts: true,
        peripheralNotifyConnection: false,
        peripheralNotifyDisconnection: true,
        ...p,
      },
      (now += 15000),
    ).map((e) => e.event);
  assert.deepEqual(feed({}), []);
  assert.deepEqual(feed({ connected: false }), []);
  assert.deepEqual(feed({ connected: false }), ["disconnected"]);
  assert.deepEqual(feed({ connected: true }), []);
  assert.deepEqual(
    feed(
      { charging: true },
      { peripheralNotifyCharging: false, peripheralNotifyUnplugged: true },
    ),
    [],
  );
  assert.deepEqual(
    feed(
      { charging: false },
      { peripheralNotifyCharging: false, peripheralNotifyUnplugged: true },
    ),
    ["unplugged"],
  );
  assert.deepEqual(
    feed({ connected: false }, { peripheralNotifyDisconnection: false }),
    [],
  );
  assert.deepEqual(feed({ connected: false }), []);
});

test("queued notices respect current settings and keep different devices distinct", () => {
  const n = (id, event = "low") => ({
    kind: "peripheralEvent",
    device: device(id),
    event,
  });
  assert.equal(samePeripheralNotice(n("one"), n("two")), false);
  assert.equal(samePeripheralNotice(n("one"), n("one", "full")), false);
  assert.equal(samePeripheralNotice(n("one"), n("one")), true);
  assert.equal(
    samePeripheralNotice({ kind: "volume" }, { kind: "volume" }),
    true,
  );
  assert.equal(
    peripheralEventEnabled(n("one"), { peripheralAlerts: false }),
    false,
  );
  assert.equal(
    peripheralEventEnabled(n("one"), {
      peripheralAlerts: true,
      peripheralMuted: ["one"],
    }),
    false,
  );
  assert.equal(
    peripheralEventEnabled(n("two"), {
      peripheralAlerts: true,
      peripheralMuted: ["one"],
    }),
    true,
  );
  assert.equal(
    peripheralEventEnabled(n("two", "unplugged"), {
      peripheralAlerts: true,
      peripheralNotifyCharging: false,
      peripheralNotifyUnplugged: true,
    }),
    true,
  );
  assert.equal(
    peripheralEventEnabled(n("two", "connected"), {
      peripheralAlerts: true,
      peripheralNotifyConnection: false,
      peripheralNotifyDisconnection: true,
    }),
    false,
  );
  assert.equal(
    peripheralEventEnabled(n("two", "disconnected"), {
      peripheralAlerts: true,
      peripheralNotifyConnection: false,
      peripheralNotifyDisconnection: true,
    }),
    true,
  );
});

test("failed inventories cannot generate charge events and muted full cycles stay silent", () => {
  const events = createPeripheralEvents();
  let revision = 0;
  const feed = (percent, extra = {}, p = {}, snapshot = {}) =>
    events(
      normalizePeripherals({
        devices: [device("one", percent, extra)],
        revision: ++revision,
        ...snapshot,
      }),
      { peripheralAlerts: true, ...p },
    );
  assert.deepEqual(feed(80), []);
  assert.deepEqual(
    feed(5, { charging: true }, {}, { error: "inventoryUnavailable" }),
    [],
  );
  assert.deepEqual(feed(80, { charging: false }), []);
  assert.deepEqual(feed(100, {}, { peripheralMuted: ["one"] }), []);
  assert.deepEqual(feed(99), []);
  assert.deepEqual(feed(100), []);
  assert.deepEqual(feed(95), []);
  assert.deepEqual(
    feed(100).map((e) => e.event),
    ["full"],
  );
});

test("a fresh charging reading is independent of an unavailable or stale percentage", () => {
  const events = createPeripheralEvents();
  let revision = 0;
  const feed = (charging, batteryStatus = "unavailable", extra = {}) =>
    events(
      normalizePeripherals({
        devices: [
          device("one", null, {
            charging,
            chargingReadAt: 2000,
            batteryStatus,
            ...extra,
          }),
        ],
        revision: ++revision,
      }),
      { peripheralAlerts: true },
    ).map((e) => e.event);
  assert.deepEqual(feed(false), []);
  assert.deepEqual(feed(true), ["charging"]);
  assert.deepEqual(feed(false, "stale"), ["unplugged"]);
  assert.deepEqual(feed(true, "stale", { chargingReadAt: null }), []);
  assert.deepEqual(feed(true, "unavailable", { present: false }), []);
});

test("connection notices never infer radio connectivity from receiver presence", () => {
  const events = createPeripheralEvents();
  let revision = 0;
  let now = 0;
  const feed = (connected, advance = 1000) =>
    events(
      normalizePeripherals({
        devices: [device("one", null, { transport: "receiver", connected })],
        revision: ++revision,
      }),
      { peripheralAlerts: true, peripheralNotifyConnection: true },
      (now += advance),
    );
  for (const connected of [null, true, null, false])
    assert.deepEqual(feed(connected), []);
  assert.deepEqual(
    feed(true).map((e) => e.event),
    ["connected"],
  );
  assert.deepEqual(feed(false), []);
  assert.deepEqual(
    feed(false, 15000).map((e) => e.event),
    ["disconnected"],
  );
});

test("brief radio loss and unknown sleep readings cannot generate disconnect/reconnect spam", () => {
  const events = createConnectionEvents();
  let revision = 0;
  const p = { peripheralAlerts: true, peripheralNotifyConnection: true };
  const feed = (connected, at, extra = {}) =>
    events(
      normalizePeripherals({
        devices: [device("one", 50, { connected })],
        revision: ++revision,
        ...extra,
      }),
      p,
      at,
    );
  assert.deepEqual(feed(true, 0), []);
  assert.deepEqual(feed(false, 1000), []);
  assert.deepEqual(feed(true, 5000), []);
  assert.deepEqual(feed(null, 15000), []);
  assert.deepEqual(feed(false, 30000), []);
  assert.deepEqual(
    feed(true, 40000).map((e) => e.event),
    ["connected"],
  );
  assert.deepEqual(feed(false, 50000), []);
  assert.deepEqual(feed(false, 66000, { error: "inventoryUnavailable" }), []);
  assert.deepEqual(feed(false, 80000), []);
  assert.deepEqual(
    feed(false, 96000).map((e) => e.event),
    ["disconnected"],
  );
});

test("USB receiver removal is distinct from unknown radio state and requires a fresh confirmation", () => {
  const events = createConnectionEvents();
  const p = { peripheralAlerts: true, peripheralNotifyConnection: true };
  const s = (present, revision) =>
    normalizePeripherals({
      devices: [
        device("receiver", null, {
          transport: "receiver",
          present,
          connected: null,
        }),
      ],
      revision,
    });
  assert.deepEqual(events(s(true, 1), p, 0), []);
  assert.deepEqual(events(s(false, 2), p, 1000), []);
  assert.deepEqual(events(s(false, 2), p, 16000), []);
  assert.deepEqual(
    events(s(false, 3), p, 16000).map((e) => e.event),
    ["usbDisconnected"],
  );
  assert.deepEqual(
    events(s(true, 4), p, 17000).map((e) => e.event),
    ["usbConnected"],
  );
  assert.deepEqual(events(s(false, 5), p, 18000), []);
  assert.deepEqual(events(s(true, 6), p, 19000), []);
});

test("startup inventories and changes while muted never create delayed connection notices", () => {
  const events = createConnectionEvents();
  const p = { peripheralAlerts: true, peripheralNotifyConnection: true };
  const s = (connected, revision) =>
    normalizePeripherals({
      devices: [device("one", null, { connected })],
      revision,
    });
  assert.deepEqual(
    events(normalizePeripherals({ loading: true, revision: 0 }), p, 0),
    [],
  );
  assert.deepEqual(events(s(true, 1), p, 1000), []);
  assert.deepEqual(
    events(s(false, 2), { ...p, peripheralMuted: ["one"] }, 2000),
    [],
  );
  assert.deepEqual(events(s(false, 3), p, 20000), []);
  assert.deepEqual(
    events(s(true, 4), p, 21000).map((e) => e.event),
    ["connected"],
  );
});

test("a per-device preference cannot imply that globally disabled notifications are active", () => {
  assert.equal(peripheralNotificationsActive("one", {}), false);
  assert.equal(
    peripheralNotificationsActive("one", { peripheralAlerts: true }),
    true,
  );
  assert.equal(
    peripheralNotificationsActive("one", {
      peripheralAlerts: true,
      peripheralMuted: ["one"],
    }),
    false,
  );
  assert.equal(
    peripheralNotificationsActive("one", {
      peripheralAlerts: true,
      peripheralNotifyLow: false,
      peripheralNotifyCharging: false,
      peripheralNotifyFull: false,
    }),
    false,
  );
});

test("device aliases are independent, bounded and safely recover from damaged settings", () => {
  const one = device("one"),
    two = device("two");
  assert.equal(
    peripheralName(one, { peripheralNames: '{"one":"  Work mouse  "}' }),
    "Work mouse",
  );
  assert.equal(
    peripheralName(two, { peripheralNames: '{"one":"Work mouse"}' }),
    two.name,
  );
  assert.equal(peripheralName(one, { peripheralNames: "broken" }), one.name);
  assert.equal(
    peripheralName(one, { peripheralNames: '{"one":"   "}' }),
    one.name,
  );
  assert.equal(
    peripheralName(one, {
      peripheralNames: JSON.stringify({ one: "a".repeat(100) }),
    }).length,
    80,
  );
});

test("an unsupported audio bridge stays unknown and cannot generate battery alerts", () => {
  const s = snapshot([
    device("g435", null, { unavailableReason: "audioInterruption" }),
  ]);
  assert.equal(s.devices[0].percent, null);
  assert.equal(s.devices[0].unavailableReason, "audioInterruption");
  assert.deepEqual(
    visiblePeripherals(s, {}).map((d) => d.id),
    ["g435"],
  );
  assert.deepEqual(createPeripheralEvents()(s, { peripheralAlerts: true }), []);
});

test("a detected batteryless keyboard remains available in the Home row and card", () => {
  const s = snapshot([
    device("fl680", null, {
      name: "FL Esports FL680",
      kind: "keyboard",
      transport: "receiver",
      unavailableReason: "readerUnavailable",
    }),
  ]);
  const [fl680] = visiblePeripherals(s, {});
  assert.equal(fl680.id, "fl680");
  assert.equal(fl680.percent, null);
  assert.equal(fl680.batteryStatus, "unavailable");
});
const snapshot = (devices) =>
  normalizePeripherals({ devices, revision: 1, loading: false });
test("absent, malformed and unknown readings are distinct from a real zero", () => {
  const s = snapshot([
    device("zero", 0),
    device("unknown", null),
    device("sentinel", 255),
    device("negative", -1),
    device("nan", NaN),
    { id: "broken" },
  ]);
  assert.equal(s.devices.length, 5);
  assert.equal(s.devices[0].percent, 0);
  assert(s.devices.slice(1).every((d) => d.percent === null));
  assert.deepEqual(normalizePeripherals(null).devices, []);
});
test("two identical mice remain distinct while duplicate interfaces collapse by id", () => {
  const s = snapshot([device("one", 70), device("two", 40), device("one", 71)]);
  assert.equal(s.devices.length, 2);
  assert.equal(s.devices[0].percent, 71);
  assert.equal(sameNamedDevices(s.devices, s.devices[0]), "Wireless Mouse · 1");
  assert.equal(sameNamedDevices(s.devices, s.devices[1]), "Wireless Mouse · 2");
});
test("hidden, disconnected and unavailable devices respect separate preferences", () => {
  const s = snapshot([
    device("shown"),
    device("hidden"),
    device("offline", 42, { connected: false }),
    device("unknown", null),
    device("gone", 40, { present: false }),
  ]);
  assert.deepEqual(
    visiblePeripherals(s, {
      peripheralHidden: ["hidden"],
      peripheralUnknown: false,
    }).map((d) => d.id),
    ["shown"],
  );
  assert.deepEqual(
    visiblePeripherals(s, { peripheralHidden: ["hidden"] }).map((d) => d.id),
    ["shown", "unknown"],
  );
});
test("lowest battery ordering keeps unknown and stale levels behind real readings", () => {
  const s = snapshot([
    device("stale", 5, { batteryStatus: "stale" }),
    device("full", 90),
    device("low", 12),
    device("unknown", null),
  ]);
  assert.deepEqual(
    visiblePeripherals(s, { peripheralSort: "charge" })
      .slice(0, 2)
      .map((d) => d.id),
    ["low", "full"],
  );
  assert.equal(compactLimit(Infinity), 3);
  assert.equal(compactLimit(-2), 1);
  assert.equal(compactLimit(20), 6);
});
test("stale readings cannot assert charging or trigger low battery alerts", () => {
  const s = snapshot([
    device("stale", 5, { batteryStatus: "stale", charging: true }),
    device("unknown", null, { charging: true }),
  ]);
  assert(s.devices.every((d) => d.charging === null));
  assert.deepEqual(createLowBatteryAlerts()(s, { peripheralAlerts: true }), []);
});
test("low battery alert fires once, re-arms above hysteresis or on charge, and respects opt out", () => {
  const alerts = createLowBatteryAlerts();
  const p = { peripheralAlerts: true, peripheralLowThreshold: 20 };
  assert.equal(alerts(snapshot([device("one", 19)]), p).length, 1);
  for (const percent of [18, 20, 21, 19])
    assert.deepEqual(alerts(snapshot([device("one", percent)]), p), []);
  assert.deepEqual(alerts(snapshot([device("one", 26)]), p), []);
  assert.equal(alerts(snapshot([device("one", 18)]), p).length, 1);
  assert.deepEqual(
    alerts(snapshot([device("one", 15, { charging: true })]), p),
    [],
  );
  assert.equal(alerts(snapshot([device("one", 15)]), p).length, 1);
  assert.deepEqual(
    createLowBatteryAlerts()(snapshot([device("two", 5)]), {
      ...p,
      showPeripherals: false,
    }),
    [],
  );
  assert.deepEqual(
    createLowBatteryAlerts()(snapshot([device("two", 5)]), {
      ...p,
      peripheralMuted: ["two"],
    }),
    [],
  );
  assert.equal(
    createLowBatteryAlerts()(snapshot([device("two", 5)]), {
      ...p,
      peripheralHidden: ["two"],
    }).length,
    1,
  );
});
