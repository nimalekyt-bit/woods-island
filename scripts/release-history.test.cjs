const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const esbuild = require(
  require.resolve("esbuild", {
    paths: [path.dirname(require.resolve("vite/package.json"))],
  }),
);
const root = path.resolve(__dirname, "..");
const build = esbuild.buildSync({
  entryPoints: [path.join(root, "runtime/releases/history.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const compiled = { exports: {} };
new Function("module", "exports", build.outputFiles[0].text)(
  compiled,
  compiled.exports,
);
const { releaseHistory, releaseUrl } = compiled.exports;
const current = require(path.join(root, "package.json")).version;
test("Canonical published release content reaches the app, including prose-only fixes and resolved versions", () => {
  const history = releaseHistory(current);
  const canonical = fs
    .readdirSync(path.join(root, "releases"))
    .filter((name) => /^\d+\.\d+\.\d+$/.test(name));
  for (const version of canonical) {
    const record = require(
      path.join(root, "releases", version, "release.json"),
    );
    const entry = history.find((item) => item.version === version);
    assert(entry, "Missing release " + version);
    assert.equal(
      entry.summary.ru,
      record.site.summary.ru.replaceAll("{{version}}", version),
    );
    assert.equal(
      entry.summary.en,
      record.site.summary.en.replaceAll("{{version}}", version),
    );
    for (const lang of ["ru", "en"])
      assert(
        entry.paragraphs[lang].every(
          (item) => item.text && !item.text.includes("{{"),
        ),
      );
  }
  assert(
    history
      .find((item) => item.version === "1.3.1")
      .paragraphs.ru.some((item) =>
        item.text.includes("обычный опрос раз в минуту"),
      ),
    "Do not silently drop prose without bullet markers",
  );
  assert(
    history
      .find((item) => item.version === "1.3.1")
      .paragraphs.en.some((item) =>
        item.text.includes("normal scans run once a minute"),
      ),
  );
});
test("The installed version limits history and an unknown version cannot pretend to be current", () => {
  assert.deepEqual(releaseHistory(""), []);
  assert.deepEqual(releaseHistory("unavailable"), []);
  assert.deepEqual(
    releaseHistory("1.2.2").map((entry) => entry.version),
    ["1.2.2", "1.2.0", "1.1.1", "1.1.0", "1.0.0"],
  );
  assert.equal(
    new Set(releaseHistory(current).map((entry) => entry.version)).size,
    releaseHistory(current).length,
  );
});
test("Release links stay with Woods and select the requested stable tag", () => {
  assert.equal(
    releaseUrl("1.3.1"),
    "https://github.com/nimalekyt-bit/woods-island/releases/tag/v1.3.1",
  );
  assert.equal(
    releaseUrl(""),
    "https://github.com/nimalekyt-bit/woods-island/releases/latest",
  );
  assert.equal(
    releaseUrl("https://other.example/"),
    "https://github.com/nimalekyt-bit/woods-island/releases/latest",
  );
});
