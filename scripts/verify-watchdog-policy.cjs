const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "src-tauri/src/watchdog_policy.rs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "woods-watchdog-policy-"));
const exe = path.join(dir, "watchdog-policy.exe");
const compile = spawnSync(
  "rustc",
  ["+1.98.1", "--edition=2021", "--test", source, "-o", exe],
  { encoding: "utf8", windowsHide: true },
);
assert.equal(compile.status, 0, compile.stderr);
const result = spawnSync(exe, [], { encoding: "utf8", windowsHide: true });
fs.writeFileSync(
  path.join(dir, "report.json"),
  JSON.stringify(
    {
      source,
      sourceSha256: createHash("sha256")
        .update(fs.readFileSync(source))
        .digest("hex"),
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    },
    null,
    2,
  ),
);
assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
console.log(result.stdout.trim());
console.log("REPORT " + path.join(dir, "report.json"));
