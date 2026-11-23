// Runs the real agents module in an isolated native host; never installs hooks
// in the owner's profile or executes the tools described by mock permissions.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process"),
  { pathToFileURL } = require("node:url");
const executable = process.env.WOODS_AGENT_FIXTURE_EXE || process.argv[2];
if (!executable)
  throw new Error("Provide the isolated native agents fixture executable");
const root = path.resolve(
  process.env.WOODS_QA_TEMP || process.env.TEMP || os.tmpdir(),
  "woods-agent-native",
);
let directory, host;
const shellChildren = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(probe, label) {
  for (let i = 0; i < 100; i++) {
    const value = await probe();
    if (value) return value;
    await pause(50);
  }
  throw new Error("Timed out: " + label);
}

(async () => {
  await fs.mkdir(root, { recursive: true });
  directory = await fs.mkdtemp(path.join(root, "User's data & $(literal)-"));
  const home = path.join(directory, "profile"),
    data = path.join(directory, "data");
  const env = {
    ...process.env,
    WOODS_AGENT_FIXTURE_ROOT:directory,
    WOODS_ISLAND_AGENT_HOME: home,
    WOODS_ISLAND_DATA_DIR: data,
    WOODS_ISLAND_NODE: process.execPath,
  };
  const configs = {
    claude: path.join(home, ".claude/settings.json"),
    codex: path.join(home, ".codex/hooks.json"),
    notify: path.join(home, ".codex/config.toml"),
    plugin: path.join(home, ".config/opencode/plugins/woods-island.js"),
  };
  const foreignClaude = {
    permissions: { allow: ["Read"] },
    hooks: {
      Stop: [
        {
          matcher: "*",
          hooks: [
            { type: "command", command: "original-notify.exe", custom: true },
          ],
        },
      ],
    },
  };
  const foreignCodex = {
    description: "Owner hooks",
    hooks: {
      SessionStart: [
        { hooks: [{ type: "command", command: "owner-command" }] },
      ],
    },
  };
  const foreignNotify =
    '# Owner configuration\nmodel = "owner-model"\nnotify = ["original.exe", "spaces & literal"]\n[projects.owner]\ntrust_level = "trusted"\n';
  for (const [file, text] of [
    [configs.claude, JSON.stringify(foreignClaude)],
    [configs.codex, JSON.stringify(foreignCodex)],
    [configs.notify, foreignNotify],
  ]) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  }
  await fs.mkdir(path.dirname(configs.plugin), { recursive: true });
  await fs.writeFile(
    path.join(path.dirname(configs.plugin), "owner-plugin.js"),
    "// Owner plugin",
  );
  function start() {
    const child = spawn(executable, [], { env, windowsHide: true });
    let buffer = "",
      sequence = 0;
    const pending = new Map(),
      events = [];
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const value = JSON.parse(line);
        if (value.event) events.push(value);
        else {
          const callback = pending.get(value.request);
          if (callback) {
            pending.delete(value.request);
            callback(value);
          }
        }
      }
    });
    const errors = [];
    child.stderr.on("data", (chunk) => errors.push(String(chunk)));
    const exited = new Promise((resolve) => child.once("exit", resolve));
    return {
      child,
      events,
      errors,
      exited,
      request: (input) =>
        new Promise((resolve, reject) => {
          const request = ++sequence;
          const timer = setTimeout(() => {
            pending.delete(request);
            reject(
              new Error("Native request timed out: " + JSON.stringify(input)),
            );
          }, 5000);
          pending.set(request, (value) => {
            clearTimeout(timer);
            resolve(value);
          });
          child.stdin.write(JSON.stringify({ ...input, request }) + "\n");
        }),
    };
  }
  const invoke = async (input) => {
    const result = await host.request(input);
    assert(result.ok, result.error);
    return result.result;
  };
  host = start();
  assert.deepEqual(await invoke({ op: "connections" }), {
    claude: "off",
    codex: "off",
    opencode: "off",
  });
  for (const agent of ["claude", "codex"])
    await invoke({ op: "connect", agent, on: false });
  assert.equal(
    await fs.readFile(configs.claude, "utf8"),
    JSON.stringify(foreignClaude),
  );
  assert.equal(
    await fs.readFile(configs.codex, "utf8"),
    JSON.stringify(foreignCodex),
  );
  await invoke({ op: "connect", agent: "claude", on: true });
  let claude = JSON.parse(await fs.readFile(configs.claude, "utf8"));
  assert.deepEqual(claude.permissions, foreignClaude.permissions);
  assert.deepEqual(claude.hooks.Stop[0], foreignClaude.hooks.Stop[0]);
  assert.equal((await invoke({ op: "connections" })).claude, "on");
  const ownedCommand = (config, event) =>
    config.hooks[event]
      .flatMap((group) => group.hooks)
      .find((hook) => hook.command?.startsWith("powershell.exe ")).command;
  async function run(command, payload, shell = "cmd") {
    const child = spawn(
      shell === "cmd" ? "cmd.exe" : "powershell.exe",
      shell === "cmd"
        ? ["/d", "/s", "/c", command]
        : ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      {
        env: {
          ...env,
          WOODS_ISLAND_DATA_DIR: path.join(directory, "must-stay-empty"),
        },
        windowsHide: true,
      },
    );
    shellChildren.push(child);
    let output = "",
      error = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (error += chunk));
    child.stdin.end(JSON.stringify(payload));
    const exited = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve({ code, output, error }));
    });
    return { child, exited };
  }
  for (const shell of ["cmd", "powershell"]) {
    const child = await run(
      ownedCommand(claude, "Stop"),
      {
        session_id: shell,
        cwd: "E:\\Projects\\Woods",
        last_assistant_message: "Проверено 🌲 & literal $(keep)",
      },
      shell,
    );
    const result = await child.exited;
    assert.equal(result.code, 0, result.error);
    await until(async () => {
      const snapshot = await invoke({ op: "snapshot" });
      return snapshot.find(
        (item) =>
          item.agent === "claude" &&
          item.state === "done" &&
          item.message === "Проверено 🌲 & literal $(keep)",
      );
    }, shell + " UTF-8 status");
  }
  assert.equal(
    await fs.stat(path.join(directory, "must-stay-empty")).then(
      () => true,
      () => false,
    ),
    false,
    "installed command retains its Woods profile",
  );
  const beforeRefresh = await fs.readFile(configs.claude, "utf8");
  await invoke({ op: "connect", agent: "claude", on: true });
  assert.equal(await fs.readFile(configs.claude, "utf8"), beforeRefresh);
  claude.hooks.UserPromptSubmit[0].hooks[0].command = `node "${path.join(data, "island-notify.cjs")}" --event UserPromptSubmit`;
  await fs.writeFile(configs.claude, JSON.stringify(claude));
  assert.equal((await invoke({ op: "connections" })).claude, "old");
  await invoke({ op: "connect", agent: "claude", on: true });
  await invoke({ op: "connect", agent: "codex", on: true });
  assert.equal((await invoke({ op: "connections" })).codex, "on");
  assert.equal(await fs.readFile(configs.notify, "utf8"), foreignNotify);
  let codex = JSON.parse(await fs.readFile(configs.codex, "utf8"));
  assert.deepEqual(codex.hooks.SessionStart, foreignCodex.hooks.SessionStart);
  for (const verdict of ["allow", "deny", "terminal"]) {
    const before = host.events.length;
    const child = await run(ownedCommand(codex, "PermissionRequest"), {
      session_id: "permission-" + verdict,
      cwd: "E:\\Woods",
      tool_name: "exec_command",
      tool_input: { cmd: "This tool is a fixture and is never executed" },
    });
    const ask = await until(
      () =>
        host.events
          .slice(before)
          .find(
            (item) =>
              item.event === "agents:ask" && item.payload.agent === "codex",
          )?.payload,
      "Codex permission " + verdict,
    );
    assert.equal(ask.detail, "This tool is a fixture and is never executed");
    await invoke({ op: "answer", id: ask.id, verdict });
    const result = await child.exited;
    assert.equal(result.code, 0, result.error);
    if (verdict === "terminal") assert.equal(result.output, "");
    else
      assert.equal(
        JSON.parse(result.output).hookSpecificOutput.decision.behavior,
        verdict,
      );
    await until(
      () =>
        host.events
          .slice(before)
          .some(
            (item) =>
              item.event === "agents:ask-done" && item.payload === ask.id,
          ),
      "answered request closes",
    );
  }
  const working = await run(ownedCommand(codex, "UserPromptSubmit"), {
    session_id: "after-restart",
    cwd: "E:\\Restart",
    prompt: "fixture",
  });
  assert.equal((await working.exited).code, 0);
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) =>
          item.agent === "codex" &&
          item.project === "Restart" &&
          item.state === "working",
      ),
    "initial active session",
  );
  host.child.stdin.end();
  assert.equal(await host.exited, 0);
  host = start();
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) =>
          item.agent === "codex" &&
          item.project === "Restart" &&
          item.state === "working",
      ),
    "restored active session",
  );
  const stopped = await run(ownedCommand(codex, "Stop"), {
    session_id: "after-restart",
    cwd: "E:\\Restart",
    last_assistant_message: "Still connected after restarting",
  });
  assert.equal((await stopped.exited).code, 0);
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) => item.message === "Still connected after restarting",
      ),
    "hook after restart",
  );
  await invoke({ op: "configure", ask: false });
  await until(
    async () =>
      JSON.parse(
        await fs.readFile(path.join(data, "agents", "heartbeat.json"), "utf8"),
      ).ask === false,
    "disabled question heartbeat",
  );
  const quiet = await run(ownedCommand(codex, "PermissionRequest"), {
    session_id: "disabled",
    tool_name: "Read",
  });
  const quietResult = await quiet.exited;
  assert.equal(quietResult.code, 0);
  assert.equal(quietResult.output, "");
  await invoke({ op: "configure", ask: true });
  await invoke({ op: "connect", agent: "codex", on: false });
  const bridge = path.join(data, "island-notify.cjs");
  await fs.writeFile(
    path.join(data, "codex-notify-chain.json"),
    JSON.stringify(["original.exe", "spaces & literal"]),
  );
  await fs.writeFile(
    configs.notify,
    '# Owner configuration\nmodel="owner-model"\nnotify=' +
      JSON.stringify([process.execPath, bridge, "--provider", "codex"]) +
      '\n[projects.owner]\ntrust_level="trusted"\n',
  );
  assert.equal((await invoke({ op: "connections" })).codex, "old");
  await invoke({ op: "connect", agent: "codex", on: true });
  const migrated = await fs.readFile(configs.notify, "utf8");
  assert(migrated.includes("# Owner configuration"));
  assert(migrated.includes('"original.exe"'));
  assert(!migrated.includes("island-notify.cjs"));
  assert(migrated.includes('trust_level="trusted"'));
  await invoke({ op: "connect", agent: "opencode", on: true });
  assert.equal((await invoke({ op: "connections" })).opencode, "on");
  assert.equal(
    await fs.readFile(
      path.join(path.dirname(configs.plugin), "owner-plugin.js"),
      "utf8",
    ),
    "// Owner plugin",
  );
  const plugin = (await import(pathToFileURL(configs.plugin).href)).default;
  assert.equal(plugin.id, "woods-island");
  assert.equal(typeof plugin.server, "function");
  assert.equal(typeof plugin.setup, "function");
  const v1 = await plugin.server({ directory: "E:\\OpenCodeV1" });
  await v1.event({
    event: {
      type: "session.execution.started",
      properties: { sessionID: "open-v1" },
    },
  });
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) =>
          item.agent === "opencode" &&
          item.project === "OpenCodeV1" &&
          item.state === "working",
      ),
    "opencode1 working",
  );
  await v1.event({
    event: {
      type: "session.text.ended",
      properties: { sessionID: "open-v1", text: "OpenCode finished 🌲" },
    },
  });
  await v1.event({
    event: { type: "session.idle", properties: { sessionID: "open-v1" } },
  });
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) =>
          item.message === "OpenCode finished 🌲" && item.state === "done",
      ),
    "opencode1 completed text",
  );
  await v1.event({
    event: {
      type: "permission.asked",
      properties: {
        sessionID: "open-v1",
        permission: "edit",
        patterns: ["fixture.txt"],
      },
    },
  });
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) =>
          item.message === "edit: fixture.txt" && item.state === "waiting",
      ),
    "opencode1 permission",
  );
  await v1.event({
    event: {
      type: "session.error",
      properties: {
        sessionID: "open-v1",
        error: { data: { message: "Fixture connection error" } },
      },
    },
  });
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) =>
          item.message === "Fixture connection error" && item.state === "error",
      ),
    "opencode1 error",
  );
  await v1.event({
    event: { type: "session.deleted", properties: { info: { id: "open-v1" } } },
  });
  await until(
    async () =>
      !(await invoke({ op: "snapshot" })).some(
        (item) => item.project === "OpenCodeV1",
      ),
    "opencode1 removal",
  );
  let signal;
  const cleanup = await plugin.setup({
    location: { directory: "E:\\OpenCodeV2" },
    event: {
      subscribe: ({ signal: s }) => {
        signal = s;
        return (async function* () {
          yield {
            type: "session.execution.started",
            data: { sessionID: "open-v2" },
          };
        })();
      },
    },
  });
  await until(
    async () =>
      (await invoke({ op: "snapshot" })).some(
        (item) => item.project === "OpenCodeV2" && item.state === "working",
      ),
    "opencode2 subscription",
  );
  cleanup();
  assert.equal(signal.aborted, true);
  for (const agent of ["claude", "codex", "opencode"])
    await invoke({ op: "connect", agent, on: false });
  assert.deepEqual(await invoke({ op: "connections" }), {
    claude: "off",
    codex: "off",
    opencode: "off",
  });
  assert.deepEqual(
    JSON.parse(await fs.readFile(configs.claude, "utf8")).hooks.Stop,
    foreignClaude.hooks.Stop,
  );
  assert.deepEqual(
    JSON.parse(await fs.readFile(configs.codex, "utf8")).hooks.SessionStart,
    foreignCodex.hooks.SessionStart,
  );
  host.child.stdin.end();
  assert.equal(await host.exited, 0);
  host = undefined;
  await fs.writeFile(
    path.join(root, "report.json"),
    JSON.stringify(
      {
        pass: true,
        realAgentsModule: true,
        tauriStorageHarness: true,
        actualShells: ["cmd", "Windows PowerShell"],
        utf8: true,
        literalPaths: true,
        configOwnership: true,
        oldRefresh: true,
        notifyPreserved: true,
        legacyMigration: true,
        codexPermissions: ["allow", "deny", "terminal"],
        restart: true,
        disabledPrompts: true,
        opencode: [1, 2],
        opencodeErrorsAndDeletion: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Native agent hooks passed: actual cmd/PowerShell UTF-8 transport, config ownership/refresh, native Codex decisions, restart, disabled prompts, opencode1/2 and notify migration. " +
      path.join(root, "report.json"),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const child of shellChildren)
      if (child.exitCode === null) child.kill();
    if (host) {
      host.child.stdin.end();
      await Promise.race([host.exited, pause(500)]);
      if (host.child.exitCode === null) host.child.kill();
    }
    if (directory) {
      assert(path.resolve(directory).startsWith(root + path.sep));
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
