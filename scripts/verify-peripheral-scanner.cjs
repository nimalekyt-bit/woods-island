// Real scanner acceptance only. Starts no HUD, settings profile or audio control.
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");

const executable = path.resolve(process.argv[2]);
const reportPath = path.resolve(process.argv[3]);
const example = process.argv.includes("--example");
const coreHarness = process.argv.includes("--core-harness");
const endpointParent = (id) => id.split(/:tg:|:ry:/)[0];

async function scan(order) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      [example || coreHarness ? "--scan-report" : "--peripheral-scan"],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          WOODS_PERIPHERAL_SCAN_ORDER: JSON.stringify(order),
          WOODS_PERIPHERAL_SCAN_PROGRESS: "1",
          WOODS_PERIPHERAL_PARENT_PID: String(process.pid),
        },
      },
    );
    let output = "",
      errors = "",
      exceeded = false;
    const timer = setTimeout(() => {
      exceeded = true;
      child.kill();
    }, 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (Buffer.byteLength(output) > 512 * 1024) {
        exceeded = true;
        child.kill();
      }
    });
    child.stderr.on("data", (chunk) => {
      errors = (errors + chunk).slice(-4096);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      try {
        assert.equal(
          exceeded,
          false,
          "Scanner exceeded its output or time limit",
        );
        assert.equal(code, 0, errors || "Scanner failed");
        const boundary = output.indexOf("\n");
        assert(boundary >= 0, "Discovery must precede the telemetry payload");
        const inventory = JSON.parse(output.slice(0, boundary));
        // The diagnostic example pretty-prints its final JSON; production
        // emits one compact line. Require exactly one complete payload in both.
        const payload = JSON.parse(output.slice(boundary + 1));
        assert.deepEqual(inventory.discovered, payload.discovered);
        const found = new Set(payload.discovered);
        assert(
          payload.visited.every((id) => found.has(id)),
          "Visited IDs must be present",
        );
        assert(inventory.first === null || found.has(inventory.first));
        const expected = order.find((id) => found.has(id));
        if (expected)
          assert.equal(
            inventory.first,
            expected,
            "The requested first container was ignored",
          );
        assert.equal(
          new Set(payload.devices.map((d) => d.id)).size,
          payload.devices.length,
        );
        for (const device of payload.devices) {
          if (device.transport !== "bluetooth")
            assert(found.has(endpointParent(device.id)));
          assert(
            device.percent === null ||
              (Number.isInteger(device.percent) &&
                device.percent >= 0 &&
                device.percent <= 100),
          );
          assert(
            device.charging === null || typeof device.charging === "boolean",
          );
          if (device.connected === false) assert.equal(device.charging, null);
          if (
            device.name === "Logitech G435" &&
            device.unavailableReason === "audioInterruption"
          ) {
            assert.equal(device.percent, null);
            assert.equal(device.charging, null);
            assert.equal(device.source, "none");
          }
        }
        resolve({
          milliseconds: performance.now() - started,
          inventory,
          payload,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

(async () => {
  const normal = await scan([]);
  const reverse = await scan([...normal.payload.discovered].reverse());
  const report = {
    date: new Date().toISOString(),
    executable,
    sha256: createHash("sha256")
      .update(await fs.readFile(executable))
      .digest("hex"),
    mode: coreHarness
      ? "native scanner core and extracted production scan_payload; HUD/worker excluded"
      : example
        ? "diagnostic example calling production scan_payload"
        : "production scanner subprocess",
    checks:
      "Complete discovery before I/O, ordering, raw endpoint identities, nullable battery/charging, G435 audio exclusion, 8-second scanner budget.",
    normal,
    reverse,
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `PASS scanner discovery and ordering; ${normal.payload.devices.length} raw devices; report ${reportPath}`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
