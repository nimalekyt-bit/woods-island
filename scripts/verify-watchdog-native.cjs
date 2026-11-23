// Dedicated recovery acceptance. Never attaches to or hangs the owner's app.
// The copied executable, profile, agent home, ports and temporary files are ours.
// Run only after root's native build includes watchdog integration.
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const os = require("node:os");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const sourceExe = process.argv[2];
const scenario = process.argv[3] || "standard";
assert(sourceExe, "Pass the newly built Woods executable explicitly");
assert(
  ["standard", "startup", "ui-thread"].includes(scenario),
  "Unknown recovery scenario",
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
let directory,
  exe,
  dataDir,
  port,
  musicPort,
  proc,
  mockServer,
  threadHelperDone;
const clients = new Set(),
  ownedPids = new Set(),
  results = [];

function ps(script) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: true, timeout: 15000 },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  assert(value !== 3003, "Never use the owner music bridge");
  return value;
}
function imagePids() {
  const output = ps(
    `$taskExe=${quote(exe)}; $taskOwned=@(Get-CimInstance Win32_Process -Filter "Name='woods-island.exe'" | Where-Object { $_.ExecutablePath -eq $taskExe } | Select-Object -ExpandProperty ProcessId); ConvertTo-Json -InputObject $taskOwned -Compress`,
  );
  const pids = JSON.parse(output || "[]");
  for (const pid of pids) {
    assert(Number.isInteger(pid) && pid > 0);
    ownedPids.add(pid);
  }
  return pids;
}
function assertCdpOwnership() {
  // The debug socket belongs to WebView2. Walk its native parent chain and require
  // the exact copied Woods executable before ever issuing a browser command.
  const output = ps(`
    $taskExe=${quote(exe)};
    $taskSocketOwners=@(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique);
    $taskFound=@();
    foreach($taskOwner in $taskSocketOwners){
      $taskCursor=[uint32]$taskOwner;
      for($taskDepth=0;$taskDepth -lt 16 -and $taskCursor -gt 0;$taskDepth++){
        $taskProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$taskCursor" -ErrorAction SilentlyContinue;
        if(!$taskProcess){break}
        if($taskProcess.ExecutablePath -eq $taskExe){$taskFound+=@{browserPid=[uint32]$taskOwner;rootPid=[uint32]$taskProcess.ProcessId};break}
        $taskCursor=[uint32]$taskProcess.ParentProcessId;
      }
    }
    ConvertTo-Json -InputObject @($taskFound) -Compress
  `);
  const owners = JSON.parse(output || "[]");
  assert(
    owners.length > 0,
    "CDP socket is not owned by the copied QA application",
  );
  assert(
    owners.every(
      (owner) => Number.isInteger(owner.rootPid) && owner.rootPid > 0,
    ),
  );
  for (const owner of owners) ownedPids.add(owner.rootPid);
  return owners;
}
async function pages() {
  const response = await fetch(`http://127.0.0.1:${port}/json`, {
    signal: AbortSignal.timeout(1200),
  });
  assert(response.ok);
  const list = await response.json();
  assertCdpOwnership();
  return list.filter((page) => page.type === "page");
}
async function attach(page, { startupPause = false } = {}) {
  assertCdpOwnership();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("QA debug connection timeout")),
      5000,
    );
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    ws.addEventListener(
      "error",
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
      { once: true },
    );
  });
  let next = 0,
    frame,
    paused;
  const pending = new Map(),
    contexts = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.executionContextCreated")
      contexts.set(message.params.context.id, message.params.context);
    if (message.method === "Runtime.executionContextDestroyed")
      contexts.delete(message.params.executionContextId);
    if (message.method === "Runtime.executionContextsCleared") contexts.clear();
    if (message.method === "Debugger.paused") paused = message.params;
    if (message.method === "Debugger.resumed") paused = undefined;
    if (
      message.method === "Page.frameNavigated" &&
      !message.params.frame.parentId
    )
      frame = message.params.frame.id;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error || message.result?.exceptionDetails)
      item.reject(
        new Error(
          JSON.stringify(message.error || message.result.exceptionDetails),
        ),
      );
    else item.resolve(message.result);
  });
  const close = () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("QA page disconnected"));
    }
    pending.clear();
    clients.delete(client);
  };
  ws.addEventListener("close", close, { once: true });
  const command = (method, params = {}, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(method + " timeout"));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  const evaluate = async (expression) => {
    // An explicit default world of the main frame avoids stale about:blank contexts.
    const context = [...contexts.values()].find(
      (context) =>
        context.auxData?.isDefault && context.auxData?.frameId === frame,
    );
    const result = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...(context ? { contextId: context.id } : {}),
    });
    return result.result?.value;
  };
  const client = {
    ws,
    command,
    evaluate,
    contexts,
    pageId: page.id,
    getPaused: () => paused,
    invoke: (name, args = {}) =>
      evaluate(
        `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`,
      ),
  };
  clients.add(client);
  if (startupPause) {
    await command("Debugger.enable");
    await command("Debugger.pause");
  }
  await command("Page.enable");
  await command("Runtime.enable");
  frame = (await command("Page.getFrameTree")).frameTree.frame.id;
  return client;
}
async function waitFor(task, label, timeout = 15000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    try {
      const value = await task();
      if (value) return value;
    } catch (error) {
      last = error.message;
    }
    await pause(350);
  }
  throw new Error(`${label} timed out${last ? ": " + last : ""}`);
}
async function readyClient({ differentPid, timeout = 160000 } = {}) {
  return waitFor(
    async () => {
      const page = (await pages()).find((page) =>
        /^http:\/\/tauri\.localhost\/(?:index\.html)?$/.test(page.url),
      );
      if (!page) return false;
      const client = await attach(page);
      try {
        if (
          !(await client.evaluate(
            '!!window.__TAURI_INTERNALS__&&!!document.querySelector("[data-island]")',
          ))
        ) {
          client.ws.close();
          return false;
        }
        const state = await client.invoke("watchdog_status");
        assert.equal(
          state.enabled,
          true,
          "Build must contain the opted-in watchdog",
        );
        if (!state.pageReady || (differentPid && state.pid === differentPid)) {
          client.ws.close();
          return false;
        }
        assert(Number.isInteger(state.pid) && imagePids().includes(state.pid));
        return { client, state };
      } catch (error) {
        client.ws.close();
        throw error;
      }
    },
    "Healthy Woods QA renderer",
    timeout,
  );
}
async function incident(result, timeout) {
  return waitFor(
    async () => {
      const value = JSON.parse(
        await fs.readFile(path.join(dataDir, "watchdog-last.json"), "utf8"),
      );
      return value.result === result ? value : false;
    },
    "Watchdog diagnostic " + result,
    timeout,
  );
}
async function suspendUiThread(pid) {
  assert(
    imagePids().includes(pid),
    "UI-thread target must belong to the unique QA image",
  );
  const helperFile = path.join(directory, "suspend-own-ui.ps1");
  // The helper owns process/thread handles while waiting. A recycled PID or
  // thread ID cannot turn its finally-resume into an operation on another app.
  const helper = `
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class WoodsOwnedUiHang {
  private delegate bool EnumProc(IntPtr hwnd, IntPtr extra);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc proc, IntPtr extra);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern IntPtr OpenProcess(uint rights, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern IntPtr OpenThread(uint rights, bool inherit, uint id);
  [DllImport("kernel32.dll")] private static extern uint GetProcessIdOfThread(IntPtr thread);
  [DllImport("kernel32.dll")] private static extern bool GetProcessTimes(IntPtr process, out long created, out long exited, out long kernel, out long user);
  [DllImport("kernel32.dll")] private static extern bool GetThreadTimes(IntPtr thread, out long created, out long exited, out long kernel, out long user);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder image, ref int size);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern uint SuspendThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] private static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
  public static void Run(uint pid, string image) {
    IntPtr process=IntPtr.Zero, thread=IntPtr.Zero; bool suspended=false;
    try {
      process=OpenProcess(0x101000, false, pid);
      if(process==IntPtr.Zero) throw new Exception("QA process handle unavailable");
      var buffer=new StringBuilder(32768); int size=buffer.Capacity;
      if(!QueryFullProcessImageName(process,0,buffer,ref size) || !String.Equals(buffer.ToString(),image,StringComparison.OrdinalIgnoreCase))
        throw new Exception("QA process executable identity mismatch");
      long pc,pe,pk,pu;
      if(!GetProcessTimes(process,out pc,out pe,out pk,out pu)) throw new Exception("QA process creation identity unavailable");
      uint ui=0;
      EnumWindows((hwnd,extra)=>{uint owner;uint candidate=GetWindowThreadProcessId(hwnd,out owner);
        if(owner==pid && IsWindowVisible(hwnd) && GetWindow(hwnd,4)==IntPtr.Zero){ui=candidate;return false;} return true;},IntPtr.Zero);
      if(ui==0) throw new Exception("No visible top-level window of our QA process");
      thread=OpenThread(0x0802,false,ui);
      if(thread==IntPtr.Zero || GetProcessIdOfThread(thread)!=pid) throw new Exception("QA UI thread identity mismatch");
      long tc,te,tk,tu;
      if(!GetThreadTimes(thread,out tc,out te,out tk,out tu)) throw new Exception("QA UI thread creation identity unavailable");
      uint previous=SuspendThread(thread);
      if(previous==0xffffffff) throw new Exception("Cannot suspend own QA UI thread");
      suspended=true;
      if(previous!=0) throw new Exception("QA UI thread was already suspended");
      Console.WriteLine("QA_SUSPENDED="+pid+"|"+ui+"|"+pc+"|"+tc);
      Console.Out.Flush();
      uint ended=WaitForSingleObject(process,150000);
      Console.WriteLine("QA_PREDECESSOR_WAIT="+ended); Console.Out.Flush();
    } finally {
      if(suspended && thread!=IntPtr.Zero){ResumeThread(thread);Console.WriteLine("QA_THREAD_RESUME_FINALLY");}
      if(thread!=IntPtr.Zero) CloseHandle(thread);
      if(process!=IntPtr.Zero) CloseHandle(process);
    }
  }
}
'@
[WoodsOwnedUiHang]::Run([uint32]${pid},${quote(exe)})
`;
  await fs.writeFile(helperFile, helper);
  const helperProcess = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      helperFile,
    ],
    {
      cwd: directory,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TEMP: path.join(directory, "tmp"),
        TMP: path.join(directory, "tmp"),
      },
    },
  );
  let output = "",
    errorOutput = "";
  helperProcess.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  helperProcess.stderr.on("data", (chunk) => {
    errorOutput += chunk.toString();
  });
  threadHelperDone = new Promise((resolve, reject) => {
    helperProcess.once("error", reject);
    helperProcess.once("exit", (code) =>
      code === 0
        ? resolve({ code, output, errorOutput })
        : reject(new Error("Owned UI helper failed: " + errorOutput)),
    );
  });
  // Attach a rejection handler immediately while readiness is being awaited.
  threadHelperDone.catch(() => {});
  return waitFor(
    () => {
      const line = output
        .split(/\r?\n/)
        .find((line) => line.startsWith("QA_SUSPENDED="));
      if (line) {
        const [actualPid, threadId, processCreated, threadCreated] = line
          .slice("QA_SUSPENDED=".length)
          .split("|");
        assert.equal(Number(actualPid), pid);
        return {
          pid: Number(actualPid),
          threadId: Number(threadId),
          processCreated,
          threadCreated,
          suspended: true,
        };
      }
      if (helperProcess.exitCode !== null)
        throw new Error(errorOutput || "UI helper exited without suspension");
      return false;
    },
    "Verified own QA UI thread suspension",
    20000,
  );
}
async function check(name, task) {
  const at = Date.now();
  try {
    const evidence = await task();
    results.push({ name, ok: true, elapsedMs: Date.now() - at, evidence });
    console.log("PASS " + name);
  } catch (error) {
    results.push({
      name,
      ok: false,
      elapsedMs: Date.now() - at,
      error: error.message,
    });
    console.log("FAIL " + name + ": " + error.message);
    throw error;
  }
}
async function cleanup() {
  for (const client of [...clients]) client.ws.close();
  if (exe) {
    // Recheck the exact unique image path immediately before stopping each PID.
    // No global taskkill or recursive process-name operation is used.
    try {
      ps(
        `$taskExe=${quote(exe)}; Get-CimInstance Win32_Process -Filter "Name='woods-island.exe'" | Where-Object { $_.ExecutablePath -eq $taskExe } | ForEach-Object { $taskCurrent=Get-CimInstance Win32_Process -Filter "ProcessId=$($_.ProcessId)" -ErrorAction SilentlyContinue; if($taskCurrent -and $taskCurrent.ExecutablePath -eq $taskExe){Stop-Process -Id $taskCurrent.ProcessId -ErrorAction SilentlyContinue} }`,
      );
    } catch {}
  }
  if (mockServer) await new Promise((resolve) => mockServer.close(resolve));
  if (threadHelperDone) await threadHelperDone.catch(() => {});
}

(async () => {
  const scratch = path.resolve(
    process.env.WOODS_WATCHDOG_QA_DIR || os.tmpdir(),
  );
  await fs.mkdir(scratch, { recursive: true });
  directory = await fs.mkdtemp(path.join(scratch, "woods-watchdog-native-"));
  exe = path.join(directory, "woods-island.exe");
  dataDir = path.join(directory, "data");
  await fs.copyFile(path.resolve(sourceExe), exe);
  await fs.mkdir(dataDir);
  port = await freePort();
  musicPort = await freePort();
  while (musicPort === port) musicPort = await freePort();
  mockServer = http.createServer((req, res) => {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end("{}");
  });
  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const mockUrl = `http://127.0.0.1:${mockServer.address().port}`;
  const defaults = JSON.parse(
    (await fs.readFile(path.join(root, "src-tauri/src/lib.rs"), "utf8")).match(
      /fn default_settings\(\)[\s\S]*?r###"([\s\S]*?)"###/,
    )[1],
  );
  const settings = {
    ...defaults,
    autostart: false,
    checkUpdates: false,
    autoDownloadUpdates: false,
    vpnLookupIp: false,
    showVpn: false,
    showPeripherals: false,
    showDownloads: false,
    showWeather: false,
    obsStatus: false,
    onboardingCompleted: true,
  };
  for (const key of Object.keys(settings))
    if (key.startsWith("hotkey")) settings[key] = "";
  await fs.writeFile(
    path.join(dataDir, "settings.json"),
    JSON.stringify(settings),
  );
  const note = JSON.stringify({
    text: "Woods watchdog saved fixture · сохранённая заметка",
    title: "QA only",
  });
  await fs.writeFile(path.join(dataDir, "notes.json"), note);
  const scratchDir = path.join(directory, "tmp");
  await fs.mkdir(scratchDir);
  const agentHome = path.join(directory, "agent-home");
  await fs.mkdir(agentHome);
  proc = spawn(exe, [], {
    cwd: directory,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      TEMP: scratchDir,
      TMP: scratchDir,
      APPDATA: path.join(directory, "appdata"),
      WOODS_ISLAND_DATA_DIR: dataDir,
      WOODS_ISLAND_AGENT_HOME: agentHome,
      WOODS_ISLAND_STEAM_PATH: path.join(directory, "steam"),
      WOODS_ISLAND_MUSIC_PORT: String(musicPort),
      WOODS_ISLAND_WEATHER_URL: mockUrl,
      WOODS_ISLAND_LYRICS_URL: mockUrl,
      WOODS_ISLAND_WEBAI_TEST_URL: mockUrl,
      WOODS_ISLAND_PASSIVE_QA: "1",
      WOODS_WATCHDOG_QA_RECOVERY: "1",
      ...(scenario === "startup"
        ? { WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER: "1" }
        : {}),
      WEBVIEW2_USER_DATA_FOLDER: path.join(directory, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
  });
  ownedPids.add(proc.pid);
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  await new Promise((resolve, reject) => {
    proc.once("spawn", resolve);
    proc.once("error", reject);
  });
  let main, initialPid;
  if (scenario === "startup") {
    await check(
      "A fresh WebView with no ready signal receives startup recovery and retains its profile",
      async () => {
        const waiting = await waitFor(
          async () => {
            const found = await pages();
            return found.length > 0 ? found : false;
          },
          "Waiting QA WebViews",
          25000,
        );
        const initialTargets = waiting.map(({ id, url, title }) => ({
          id,
          url,
          title,
        }));
        const initialPage =
          waiting.find((page) =>
            /^http:\/\/tauri\.localhost\/(?:index\.html)?$/.test(page.url),
          ) || waiting.find((page) => page.url === "about:blank");
        assert(initialPage, "Cannot identify the initial main QA target");
        const heldMain = await attach(initialPage, { startupPause: true });
        const pauseInfo = await waitFor(
          () => heldMain.getPaused(),
          "Initial QA debugger paused frame",
          10000,
        );
        const beforeResult = await heldMain.command(
          "Debugger.evaluateOnCallFrame",
          {
            callFrameId: pauseInfo.callFrames[0].callFrameId,
            expression:
              '({hasIsland:!!document.querySelector("[data-island]"),readyState:document.readyState,url:location.href})',
            returnByValue: true,
          },
        );
        const beforeReady = beforeResult.result.value;
        assert.equal(
          beforeReady.hasIsland,
          false,
          "Startup debugger arrived after DOM mount; this is a harness race, not zero-ready evidence",
        );
        await fs.writeFile(
          path.join(directory, "startup-before-ready.json"),
          JSON.stringify(beforeReady, null, 2),
        );
        // The environment variable alone was not a reliable hold on this runtime.
        // An explicit debugger pause plus the native incident proves no accepted
        // main-page ready signal, without altering production grace or binaries.
        const log = await incident("requested", 85000);
        assert.equal(log.reason, "startup");
        assert.equal(log.pageReady, false);
        assert.equal(log.recovery, "navigate");
        assert.equal(log.pid, proc.pid);
        // The deliberate debugger pause also blocks restoration in the same
        // renderer. Keep it held: the production watchdog must complete its next
        // bounded step and recover via a fresh process, without debugger assistance.
        const recovered = await readyClient({
          differentPid: proc.pid,
          timeout: 115000,
        });
        main = recovered.client;
        heldMain.ws.close();
        assert.notEqual(recovered.state.pid, proc.pid);
        assert.equal(proc.exitCode, 0);
        assert.equal(imagePids().length, 1);
        assert.equal(await main.invoke("note_get"), note);
        assert.equal((await main.invoke("settings_get")).autostart, false);
        const restart = await incident("requested", 10000);
        assert.equal(restart.reason, "startup");
        assert.equal(restart.pageReady, false);
        assert.equal(restart.recovery, "restart");
        return {
          initialTargets,
          beforeReady,
          startupBeforeFirstReady: true,
          navigation: log,
          restart,
          recovered: recovered.state,
          profileRetained: true,
          method:
            "Explicit CDP Debugger.pause before mounted DOM remains held until automatic process handoff",
        };
      },
    );
    await main
      .evaluate('void window.__TAURI_INTERNALS__.invoke("quit"); true')
      .catch(() => {});
    main.ws.close();
    await waitFor(
      () => imagePids().length === 0,
      "Deliberate startup QA quit",
      15000,
    );
    return;
  }
  await check(
    "Opted-in native watchdog boots with an isolated profile and native/page health",
    async () => {
      const ready = await readyClient();
      main = ready.client;
      initialPid = ready.state.pid;
      assert.equal(initialPid, proc.pid);
      assert.equal(await main.invoke("note_get"), note);
      assert.equal(ready.state.protected, false);
      return {
        pid: initialPid,
        state: ready.state,
        ownImage: true,
        profileIsolated: true,
      };
    },
  );
  if (scenario === "ui-thread") {
    await check(
      "A suspended native UI thread is recovered independently with one owned process handoff",
      async () => {
        const identity = await suspendUiThread(initialPid);
        main.ws.close();
        const replacement = await readyClient({
          differentPid: initialPid,
          timeout: 165000,
        });
        main = replacement.client;
        const helper = await threadHelperDone;
        assert(helper.output.includes("QA_PREDECESSOR_WAIT=0"));
        assert(helper.output.includes("QA_THREAD_RESUME_FINALLY"));
        assert.equal(proc.exitCode, 0);
        assert(!imagePids().includes(initialPid));
        assert.equal(imagePids().length, 1);
        assert.equal(await main.invoke("note_get"), note);
        assert.equal((await main.invoke("settings_get")).autostart, false);
        const log = await incident("requested", 10000);
        assert.equal(log.reason, "window");
        assert.equal(log.recovery, "restart");
        return {
          identity,
          incident: log,
          replacement: replacement.state,
          processCount: 1,
          profileRetained: true,
          helper,
        };
      },
    );
    await main
      .evaluate('void window.__TAURI_INTERNALS__.invoke("quit"); true')
      .catch(() => {});
    main.ws.close();
    await waitFor(
      () => imagePids().length === 0,
      "Deliberate native-thread QA quit",
      15000,
    );
    return;
  }
  await check(
    "Wrong sequence and auxiliary-window replies cannot mask main-page liveness",
    async () => {
      assert.equal(
        await main.invoke("page_pong", {
          sequence: Number.MAX_SAFE_INTEGER,
          ready: true,
        }),
        false,
      );
      await main.invoke("open_settings", { section: "pro" });
      const auxiliary = await waitFor(async () => {
        const page = (await pages()).find((page) =>
          page.url.endsWith("/settings.html"),
        );
        if (!page) return false;
        const client = await attach(page);
        try {
          if (
            await client.evaluate(
              'typeof window.__TAURI_INTERNALS__?.invoke === "function"',
            )
          )
            return client;
          client.ws.close();
          return false;
        } catch (error) {
          client.ws.close();
          throw error;
        }
      }, "Settings QA window");
      assert.equal(
        await auxiliary.invoke("page_pong", { sequence: 1, ready: true }),
        false,
      );
      await main.invoke("plugin:window|close", { label: "settings" });
      auxiliary.ws.close();
      return { invalidMainChallengeRejected: true, auxiliaryRejected: true };
    },
  );
  await check(
    "Hidden native island keeps answering probes without a false recovery",
    async () => {
      await main.invoke("plugin:window|hide", { label: "main" });
      const samples = [];
      for (let index = 0; index < 7; index++) {
        await pause(5000);
        const state = await main.invoke("watchdog_status");
        samples.push(state);
        assert.equal(state.pid, initialPid);
        assert.equal(state.state, "watching");
        assert(state.pageAgeActiveMs < 6500);
      }
      await main.invoke("plugin:window|show", { label: "main" });
      return { seconds: 35, samples };
    },
  );
  await check(
    "A main page on about:blank is navigated back to Woods without replacing the process",
    async () => {
      await main.command("Page.navigate", { url: "about:blank" });
      main.ws.close();
      const recovered = await readyClient({ timeout: 105000 });
      main = recovered.client;
      assert.equal(recovered.state.pid, initialPid);
      assert.equal(await main.invoke("note_get"), note);
      const log = await incident("requested", 10000);
      assert.equal(log.recovery, "navigate");
      assert.equal((await main.invoke("settings_get")).autostart, false);
      return {
        pid: initialPid,
        recovered: recovered.state,
        incident: log,
        profileRetained: true,
      };
    },
  );
  await check(
    "A persistently blocked renderer escalates to one replacement after its predecessor exits",
    async () => {
      const before = (await main.invoke("watchdog_status")).pid;
      await main.command("Page.addScriptToEvaluateOnNewDocument", {
        source: "addEventListener('load',()=>{for(;;){}},{once:true});",
      });
      // This blocks only this copied QA renderer. Navigation must either restore it
      // or reach the second-stage handoff; the preload repeats the block after navigation.
      await main.evaluate("setTimeout(()=>{for(;;){}},0); true");
      main.ws.close();
      const replacement = await readyClient({
        differentPid: before,
        timeout: 180000,
      });
      main = replacement.client;
      assert.equal(proc.exitCode, 0);
      assert(!imagePids().includes(before));
      assert.equal(imagePids().length, 1);
      assert.equal(await main.invoke("note_get"), note);
      assert.equal((await main.invoke("settings_get")).autostart, false);
      const budget = JSON.parse(
        await fs.readFile(path.join(dataDir, "watchdog-budget.json"), "utf8"),
      );
      assert.equal(
        budget.attempts.filter((attempt) => attempt.kind === "restart").length,
        1,
      );
      const log = await incident("requested", 10000);
      assert.equal(log.recovery, "restart");
      return {
        predecessor: before,
        replacement: replacement.state.pid,
        processCount: 1,
        creationIdentityGate: true,
        budget,
        incident: log,
        profileRetained: true,
      };
    },
  );
  await check(
    "Persisted recovery limits stop restart loops and manual quit does not relaunch",
    async () => {
      const current = (await main.invoke("watchdog_status")).pid,
        now = Date.now();
      const entries = [
        ...Array.from({ length: 4 }, () => ({ at: now, kind: "navigate" })),
        ...Array.from({ length: 2 }, () => ({ at: now, kind: "restart" })),
      ];
      await fs.writeFile(
        path.join(dataDir, "watchdog-budget.json"),
        JSON.stringify({ schemaVersion: 1, attempts: entries }),
      );
      await main.command("Page.navigate", { url: "about:blank" });
      const log = await incident("budgetExhausted", 85000);
      assert.equal(log.pid, current);
      assert.deepEqual(imagePids(), [current]);
      await main.command("Page.navigate", {
        url: "http://tauri.localhost/index.html",
      });
      main.ws.close();
      const restored = await readyClient({ timeout: 25000 });
      main = restored.client;
      assert.equal(restored.state.state, "limited");
      assert.equal(restored.state.pid, current);
      await main
        .evaluate('void window.__TAURI_INTERNALS__.invoke("quit"); true')
        .catch(() => {});
      main.ws.close();
      await waitFor(
        () => imagePids().length === 0,
        "Deliberate QA quit",
        15000,
      );
      await pause(5000);
      assert.equal(imagePids().length, 0);
      return {
        budgetExhausted: true,
        pidUnchanged: true,
        limitedState: true,
        deliberateQuitNoReplacement: true,
        incident: log,
      };
    },
  );
})()
  .catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    if (directory) {
      const sha256 = createHash("sha256")
        .update(await fs.readFile(exe))
        .digest("hex");
      const report = {
        directory,
        testedExe: sourceExe,
        scenario,
        sha256,
        ports: { debug: port, music: musicPort },
        ownedPids: [...ownedPids],
        pass:
          results.length ===
            (scenario === "standard" ? 6 : scenario === "startup" ? 1 : 2) &&
          results.every((result) => result.ok),
        results,
        limits: [
          scenario === "startup"
            ? "The startup scenario requires an explicit debugger pause before DOM mount plus an incident with pageReady=false; a race is a failed harness attempt, not accepted coverage. The natural startup-stall cause remains a separate diagnosis."
            : scenario === "ui-thread"
              ? "The isolated native UI thread is suspended while the watchdog stays runnable; whole-process suspension is not a recoverable UI hang."
              : "Standard acceptance tests blank navigation; zero-ready launch and native UI-thread suspension have separate startup/ui-thread scenario reports.",
          "Real sleep/resume and guarded audio/microphone tasks are not exercised by this script; Rust policy/guard tests cover their decisions and lifetimes.",
        ],
      };
      await fs.writeFile(
        path.join(directory, "report.json"),
        JSON.stringify(report, null, 2),
      );
      console.log("REPORT " + path.join(directory, "report.json"));
      if (!report.pass) process.exitCode = 1;
    }
  });
