const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadLauncherGroupHelpers() {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../runtime/compat/home.js"),
    "utf8",
  );
  const start = src.indexOf("var _m = 2;");
  const end = src.indexOf("function usePlaybackPosition");
  assert(start !== -1 && end > start, "Could not locate launcher group helpers in home.js");
  const slice = src.slice(start, end);
  const exportsObj = {};
  vm.runInContext(
    `${slice}
    exportsObj.api = { vm, ym, xm, Sm, Cm, wm, Tm, Em, Dm, Om };`,
    vm.createContext({ exportsObj }),
  );
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const out = {};
  for (const [k, fn] of Object.entries(exportsObj.api)) {
    out[k] = (...args) => clone(fn(...args));
  }
  return out;
}

test("Launcher groups support string IDs and roundtrip without dropping items", () => {
  const { vm: parseGroups, ym: serializeGroups, xm: pruneGroups, Sm: buildSlots, wm: groupItems, Tm: addToGroup, Em: removeFromGroup } = loadLauncherGroupHelpers();
  const launcher = [
    { id: "launcher-1795736905430-0", name: "DeepAI Code", path: "C:\\a.lnk" },
    { id: "launcher-1795736913296-1", name: "Proxifier", path: "C:\\b.lnk" },
    { id: "link-1795736920000-2", name: "Docs", path: "https://example.com" },
  ];

  // Drop item 1 onto item 0 center -> creates group with string IDs
  const groups1 = groupItems([], launcher[1].id, launcher[0].id, "Группа", "g1");
  assert.equal(groups1.length, 1);
  assert.deepEqual(groups1[0].items, [launcher[0].id, launcher[1].id]);

  // Serialize -> reload via vm() -> must keep both string items!
  const reloaded = parseGroups(serializeGroups(groups1));
  assert.equal(reloaded.length, 1);
  assert.deepEqual(reloaded[0].items, [launcher[0].id, launcher[1].id]);

  // Adding a 3rd item and removing an item keeps valid state
  const groups2 = addToGroup(reloaded, "g1", launcher[2].id);
  const pruned = pruneGroups(groups2, launcher);
  assert.deepEqual(pruned[0].items, [launcher[0].id, launcher[1].id, launcher[2].id]);

  const slots = buildSlots(launcher, pruned);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].kind, "group");
  assert.equal(slots[0].items.length, 3);

  const shrunk = removeFromGroup(pruned, launcher[2].id);
  assert.equal(shrunk.length, 1);
  assert.equal(shrunk[0].items.length, 2);
});
