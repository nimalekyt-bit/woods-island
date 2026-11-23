const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { loadTypeScript: load } = require("./load-runtime-typescript.cjs");
const { vpnProfiles, vpnPickAction, vpnErrorMessage } = load(
  "runtime/vpn/profiles.ts",
);
test("Client selection keeps confirmed state and refuses to guess the unknown custom state", () => {
  const profiles = vpnProfiles([
    { id: "ras:Office", name: "Office", ready: true, on: true },
    {
      id: "app:custom",
      name: "My VPN",
      ready: true,
      on: null,
      lastRequestedOn: true,
    },
  ]);
  assert.equal(vpnPickAction(profiles[0]), false);
  assert.equal(vpnPickAction(profiles[1]), null);
  assert.equal(profiles[1].lastRequestedOn, true);
  const off = vpnProfiles([
    { id: "app:warp", name: "WARP", ready: true, on: false },
  ])[0];
  assert.equal(vpnPickAction(off), true);
});
test("Malformed and duplicate profiles cannot add bogus controls or executable paths", () => {
  const values = [
    null,
    17,
    [],
    { id: "other", name: "Bad" },
    {
      id: "app:custom",
      name: "My VPN",
      ready: true,
      on: "true",
      launchPath: "bad\0path",
    },
    { id: "app:custom", name: "Duplicate", ready: true, on: true },
    { id: "ras:Line\nBreak", name: "Bad" },
  ];
  const profiles = vpnProfiles(values);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].on, null);
  assert.equal(profiles[0].launchPath, null);
  assert.equal(vpnProfiles({}).length, 0);
});
test("Known transition errors explain the failure in Russian and English", () => {
  assert.equal(
    vpnErrorMessage(
      "Error: The custom VPN is still connected after its disconnect command",
      "ru",
    ),
    "Команда выполнена, но VPN всё ещё подключён. Проверь его клиент",
  );
  assert.match(
    vpnErrorMessage(
      "VPN client did not confirm the requested connection state",
      "en",
    ),
    /did not confirm/,
  );
  assert.equal(
    vpnErrorMessage("Unknown native error", "en"),
    "Unknown native error",
  );
});
