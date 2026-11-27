// Native WebView acceptance. Uses an isolated profile; never changes owner device settings.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const supplied = path.resolve(process.argv[2]);
const port = 9354;
const hostedDebug = process.env.WOODS_HOSTED_WEBVIEW_DEBUG === "1";
if (hostedDebug) {
  assert(process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted" && process.env.RUNNER_OS === "Windows" && process.env.GITHUB_REPOSITORY === "nimalekyt-bit/woods-island" && process.env.RUNNER_TRACKING_ID && process.env.RUNNER_TEMP, "Hosted WebView2 debugging cannot be used locally");
}
let proc, ws, mainWs;
async function requireFreePort(value) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: value, exclusive: true }, () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}
(async () => {
  // Abort before launch if another WebView owns the debugging/music port.
  // Never attach this fixture runner to an unrelated application's profile.
  await requireFreePort(port);
  await requireFreePort(port + 1);
  const directory = await fs.mkdtemp(
    path.join(hostedDebug ? process.env.RUNNER_TEMP : os.tmpdir(), "woods-peripherals-"),
  );
  console.log("QA directory " + directory);
  const exe = path.join(directory, "woods-island.exe"),
    data = path.join(directory, "data");
  await fs.copyFile(supplied, exe);
  await fs.mkdir(data);
  const manualEvidenceIndex = process.argv.indexOf("--manual-evidence");
  const manualEvidence =
    manualEvidenceIndex >= 0
      ? JSON.parse(
          await fs.readFile(process.argv[manualEvidenceIndex + 1], "utf8"),
        )
      : null;
  if (manualEvidence) {
    assert.equal(typeof manualEvidence.id, "string");
    await fs.writeFile(
      path.join(data, "peripheral-manual.json"),
      JSON.stringify({ [manualEvidence.id]: manualEvidence.reading }),
    );
  }
  await fs.writeFile(
    path.join(data, "settings.json"),
    JSON.stringify({
      firstRun: false,
      // Text assertions below are Russian, independently of the runner OS locale.
      language: "ru",
      offsetX: 10000,
      showPeripherals: false,
      peripheralAlerts: false,
      vpnLookupIp: false,
    }),
  );
  proc = spawn(exe, [], {
    cwd: directory,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      WOODS_ISLAND_DATA_DIR: data,
      WOODS_ISLAND_PASSIVE_QA: "1",
      WOODS_ISLAND_AGENT_HOME: directory,
      WOODS_ISLAND_STEAM_PATH: directory,
      WOODS_ISLAND_MUSIC_PORT: String(port + 1),
      APPDATA: path.join(directory, "appdata"),
      ...(!hostedDebug ? {
        WEBVIEW2_USER_DATA_FOLDER: path.join(directory, "webview"),
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
      } : {}),
    },
  });
  let page;
  for (let i = 0; i < 200; i++) {
    assert.equal(proc.exitCode, null, "QA process exited");
    try {
      page = (
        await (
          await fetch(`http://127.0.0.1:${port}/json`, {
            signal: AbortSignal.timeout(500),
          })
        ).json()
      ).find((p) => p.url === "http://tauri.localhost/");
    } catch {}
    if (page) break;
    await pause(100);
  }
  assert(page, "Native WebView unavailable");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const errors = [],
    pending = new Map();
  let id = 0;
  const receive = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.text);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.error || m.result?.exceptionDetails)
      p.reject(Error(JSON.stringify(m.error || m.result.exceptionDetails)));
    else p.resolve(m.result);
  };
  ws.addEventListener("message", receive);
  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, {
        resolve,
        reject,
        timer: setTimeout(() => {
          pending.delete(n);
          reject(Error(`${method} timeout`));
        }, 20000),
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) =>
    (
      await command("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.value;
  const invoke = (name, args = {}) =>
    evaluate(
      `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`,
    );
  const waitFor = async (expression, label) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw Error(label);
  };
  await command("Runtime.enable");
  await waitFor(
    '!!document.querySelector("[data-island]")',
    "Island did not render",
  );
  const initial = await invoke("peripherals_get");
  assert.equal(initial.revision, 0);
  await invoke("peripherals_refresh");
  await pause(1000);
  assert.equal(
    (await invoke("peripherals_get")).revision,
    0,
    "Disabled polling ran",
  );
  const sample = (id, name, kind, percent, extra = {}) => ({
    id,
    name,
    kind,
    percent,
    transport: "receiver",
    present: true,
    connected: true,
    charging: false,
    batteryStatus: percent === null ? "unavailable" : "available",
    source: "fixture",
    lastReadAt: Date.now(),
    ...extra,
  });
  const devices = [
    sample("headset", "Wireless Headset", "headset", 64),
    sample("mouse1", "Wireless Mouse", "mouse", 18),
    sample("mouse2", "Wireless Mouse", "mouse", 91),
    sample("keyboard", "Wireless Keyboard", "keyboard", 86, { charging: true }),
    sample("g435", "G435 Wireless Gaming Headset", "headset", null, {
      connected: null,
      unavailableReason: "audioInterruption",
      manualMeasurementAvailable: true,
    }),
  ];
  // Simultaneous events from two devices must survive the real Island queue.
  const queueCheck = await evaluate(
    `(async()=>{const {ot}=await import('/assets/runtime-debug.js');const settings=ot.getState().settings;ot.setState({expanded:false,palette:false,peek:{kind:'agentAsk',id:100,ask:{id:'qa-only'}},queue:[],settings:{...settings,showPeripherals:true,peripheralAlerts:true}});const devices=${JSON.stringify(devices)};ot.getState().pushPeek({kind:'peripheralEvent',event:'low',device:devices[1]});ot.getState().pushPeek({kind:'peripheralEvent',event:'low',device:devices[2]});const queued=ot.getState().queue.map(n=>n.device.id);ot.setState({settings:{...settings,peripheralAlerts:false}});ot.getState().nextPeek();const result={queued,after:ot.getState().peek};ot.setState({peek:null,queue:[],settings});return result;})()`,
  );
  assert.deepEqual(queueCheck.queued, ["mouse1", "mouse2"]);
  assert.equal(queueCheck.after, null);
  const setFixture = async (patch) =>
    evaluate(
      `(async()=>{const {ot}=await import('/assets/runtime-debug.js');const s=ot.getState();ot.setState({expanded:true,tab:'home',pinned:true,holdOpen:true,peek:null,queue:[],peripherals:${JSON.stringify({ devices, revision: 20 })},settings:{...s.settings,showPeripherals:true,peripheralLimit:6,peripheralUnknown:true,peripheralHidden:[],peripheralMuted:[]},...${JSON.stringify(patch)}});})()`,
    );
  await evaluate(
    '(()=>{const style=document.createElement("style");style.id="peripheral-test-label";style.textContent=".peripheral-card>header>span::after{content:\\" · ТЕСТОВЫЕ ДАННЫЕ\\";font-size:10px;color:#e8aa51}";document.head.append(style);})()',
  );
  await setFixture({ peripheralCardOpen: false });
  await pause(600);
  assert.equal(
    await evaluate('document.querySelectorAll(".peripheral-mini").length'),
    5,
  );
  const capture = async (name) => {
    const rect = await evaluate(
      '(()=>{const r=document.querySelector("[data-island]").getBoundingClientRect();return {x:Math.max(0,r.x-5),y:Math.max(0,r.y-5),width:r.width+10,height:r.height+10,scale:1};})()',
    );
    const png = await command("Page.captureScreenshot", {
      format: "png",
      clip: rect,
      captureBeyondViewport: true,
    });
    await fs.writeFile(
      path.join(directory, name + ".png"),
      Buffer.from(png.data, "base64"),
    );
  };
  await capture("home-batteries");
  await evaluate('document.querySelector(".peripheral-summary").click()');
  await pause(500);
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-peripheral-device]").length',
    ),
    5,
  );
  assert(
    await evaluate(
      'document.querySelector("[data-peripheral-device=g435]").textContent.includes("Опрос отключён, чтобы не прерывать звук")',
    ),
    "Russian QA profile must show the G435 audio-interruption notice",
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("[data-notifications-active=true]").length',
    ),
    0,
  );
  await capture("battery-card");
  await evaluate('document.querySelector("[data-peripheral-device=g435] .peripheral-manual button").scrollIntoView({block:"nearest"})');
  const manualButton = await evaluate(
    '(()=>{const b=document.querySelector("[data-peripheral-device=g435] .peripheral-manual button"),r=b.getBoundingClientRect(),s=getComputedStyle(b);return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,paddingLeft:parseFloat(s.paddingLeft),paddingRight:parseFloat(s.paddingRight)};})()',
  );
  assert(manualButton.paddingLeft >= 7 && manualButton.paddingRight >= 7, "Manual button needs space around its hover text");
  await command("Input.dispatchMouseEvent", {type:"mouseMoved",x:manualButton.x,y:manualButton.y});
  await pause(200);
  const hoveredButton = await evaluate(
    '(()=>{const b=document.querySelector("[data-peripheral-device=g435] .peripheral-manual button"),r=b.getBoundingClientRect();return {width:r.width,height:r.height,hover:b.matches(":hover")};})()',
  );
  assert(hoveredButton.hover, "Manual button hover must be exercised in the native WebView");
  assert(Math.abs(hoveredButton.width-manualButton.width)<1 && Math.abs(hoveredButton.height-manualButton.height)<1, "Hover must not move or resize the button");
  await capture("manual-measure-hover");
  await command("Input.dispatchMouseEvent", {type:"mouseMoved",x:0,y:0});
  // The first click only exposes the interruption notice. QA never sends bridge commands.
  await evaluate(
    'document.querySelector("[data-peripheral-device=g435] .peripheral-manual button").click()',
  );
  await pause(200);
  await evaluate('document.querySelector("[data-peripheral-device=g435]").scrollIntoView({block:"nearest"})');
  assert(
    await evaluate(
      'document.querySelector("[data-peripheral-device=g435]").textContent.includes("прервёт звук и микрофон")',
    ),
  );
  await capture("manual-measure-confirmation");
  const denied = await evaluate(
    '(async()=>{try{await window.__TAURI_INTERNALS__.invoke("peripherals_g435_measure",{id:"g435",allowAudioPause:false});return "unexpected";}catch(e){return String(e);}})()',
  );
  assert(denied.includes("g435ConfirmationRequired"));
  const qaDenied = await evaluate(
    '(async()=>{try{await window.__TAURI_INTERNALS__.invoke("peripherals_g435_measure",{id:"g435",allowAudioPause:true});return "unexpected";}catch(e){return String(e);}})()',
  );
  assert(qaDenied.includes("g435QaDisabled"));
  await evaluate(
    'document.querySelector("[data-peripheral-device=g435] .peripheral-manual-actions button:last-child").click()',
  );
  const manualDevices = devices.map((d) =>
    d.id === "g435"
      ? {
          ...d,
          percent: 83,
          source: "g435-manual",
          batteryStatus: "stale",
          manualMillivolts: 4029,
          lastReadAt: Date.now() - 60000,
        }
      : d,
  );
  await setFixture({
    peripherals: { devices: manualDevices, revision: 21 },
    peripheralCardOpen: true,
  });
  await pause(200);
  await evaluate('document.querySelector("[data-peripheral-device=g435]").scrollIntoView({block:"nearest"})');
  assert(
    await evaluate(
      'document.querySelector("[data-peripheral-device=g435]").textContent.includes("≈83%")',
    ),
  );
  assert(
    await evaluate(
      'document.querySelector("[data-peripheral-device=g435]").textContent.includes("4029 мВ")',
    ),
  );
  await capture("manual-measure-reading");
  await setFixture({ peripheralCardOpen: true });
  // Visibility and notifications are independent preferences saved via the actual UI.
  await evaluate(
    'document.querySelector("[data-peripheral-device=mouse1] .peripheral-visibility").click()',
  );
  await pause(300);
  let saved = await invoke("settings_get");
  assert.deepEqual(saved.peripheralHidden, ["mouse1"]);
  assert.deepEqual(saved.peripheralMuted, []);
  // The saved backend profile keeps polling disabled, so restore only visual preferences.
  await evaluate(
    '(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({settings:{...ot.getState().settings,showPeripherals:true}});})()',
  );
  await evaluate(
    'document.querySelector("[data-peripheral-device=mouse2] .peripheral-visibility:nth-child(2)").click()',
  );
  await pause(300);
  saved = await invoke("settings_get");
  assert.deepEqual(saved.peripheralHidden, ["mouse1"]);
  assert.deepEqual(saved.peripheralMuted, ["mouse2"]);
  await setFixture({ peripheralCardOpen: true });
  await evaluate(
    'document.querySelector("[data-peripheral-device=mouse2] .peripheral-name").click()',
  );
  await pause(300);
  await evaluate(
    '(()=>{const i=document.querySelector(".peripheral-name-form input");const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;s.call(i,"Work mouse");i.dispatchEvent(new Event("input",{bubbles:true}));i.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await evaluate(
    'document.querySelector(".peripheral-name-form").requestSubmit()',
  );
  await pause(300);
  saved = await invoke("settings_get");
  assert.equal(JSON.parse(saved.peripheralNames).mouse2, "Work mouse");
  // Empty and wired-only inventories add no row to Home.
  await setFixture({
    peripherals: { devices: [], revision: 21 },
    peripheralCardOpen: false,
  });
  await pause(200);
  assert.equal(
    await evaluate('!!document.querySelector("[data-peripheral-panel]")'),
    false,
  );
  await setFixture({ peripheralCardOpen: true });
  await pause(300);
  const size = await evaluate(
    '(()=>{const p=document.querySelector("[data-island]").getBoundingClientRect(),h=document.querySelector("[data-home]"),r=h.getBoundingClientRect();return {height:p.height,viewport:Number(document.documentElement.dataset.layoutViewportHeight),homeScrollWidth:h.scrollWidth,homeWidth:h.clientWidth,overflow:[...h.querySelectorAll("*")].filter(e=>e.getBoundingClientRect().right>r.right+2).map(e=>({class:e.className,text:e.textContent.slice(0,70),width:e.getBoundingClientRect().width})).slice(0,20)};})()',
  );
  console.log(JSON.stringify(size));
  assert(
    await evaluate(
      '(()=>{const p=document.querySelector("[data-peripheral-panel]");return p.scrollWidth<=p.clientWidth+1;})()',
    ),
    "Peripheral panel overflows horizontally",
  );
  assert(size.height <= size.viewport - 20, "Battery card exceeds viewport");
  const scrolling = await evaluate(
    '(()=>{const h=document.querySelector("[data-home]");const css=getComputedStyle(h);const bar=getComputedStyle(h,"::-webkit-scrollbar");const old=h.scrollTop;h.scrollTop=h.scrollHeight;const bottom=h.scrollTop;const max=h.scrollHeight-h.clientHeight;h.scrollTop=old;return {overflowX:css.overflowX,overflowY:css.overflowY,scrollbarWidth:css.scrollbarWidth,webkitDisplay:bar.display,bottom,max};})()',
  );
  assert.equal(scrolling.overflowX, "hidden", "Home must not scroll horizontally");
  assert.equal(scrolling.overflowY, "auto", "Home must remain scrollable vertically");
  assert.equal(scrolling.webkitDisplay, "none", "Native scrollbar controls must be hidden");
  assert(Math.abs(scrolling.bottom - scrolling.max) <= 1, "Home content must remain reachable");
  // Real inventory through the isolated scanner, then stop and confirm no further reads.
  await invoke("settings_set", { settings: { showPeripherals: true } });
  await waitFor(
    '(async()=>{const s=await window.__TAURI_INTERNALS__.invoke("peripherals_get");return s.revision>0;})()',
    "Scanner did not complete",
  );
  const hardware = await invoke("peripherals_get");
  if (manualEvidence) {
    const restored = hardware.devices.find((d) => d.id === manualEvidence.id);
    assert(
      restored,
      "Hardware container for saved manual reading was not found",
    );
    assert.equal(restored.source, "g435-manual");
    assert.equal(restored.percent, manualEvidence.reading.estimatedPercent);
    assert.equal(restored.manualMillivolts, manualEvidence.reading.millivolts);
    assert.equal(restored.batteryStatus, "stale");
    assert.equal(restored.charging, null);
  }
  await evaluate(
    `(async()=>{const {ot}=await import('/assets/runtime-debug.js');document.querySelector('#peripheral-test-label')?.remove();ot.setState({peripherals:${JSON.stringify(hardware)},peripheralCardOpen:true,settings:{...ot.getState().settings,showPeripherals:true,peripheralHidden:[],peripheralMuted:[]}});})()`,
  );
  await pause(600);
  await capture("actual-devices");
  // Hosted VMs can have an empty physical inventory. Keep its actual capture/report
  // separate from the deterministic inventory used to verify card size at each scale.
  const dpiUsesFixture = hardware.devices.length === 0 || process.argv.includes("--fixture-dpi");
  const dpiSnapshot = dpiUsesFixture ? { devices, revision: hardware.revision } : hardware;
  if (dpiUsesFixture) {
    await invoke("settings_set", { settings: { showPeripherals: false } });
    await evaluate(
      '(()=>{const style=document.createElement("style");style.id="peripheral-test-label";style.textContent=".peripheral-card>header>span::after{content:\\" · ТЕСТОВЫЕ ДАННЫЕ\\";font-size:10px;color:#e8aa51}";document.head.append(style);})()',
    );
  }
  const dpi = [];
  for (const scale of [100, 150, 200]) {
    await invoke("settings_set", { settings: { scale, character: "liquid" } });
    await evaluate(
      `(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({peripherals:${JSON.stringify(dpiSnapshot)},peripheralCardOpen:true,settings:{...ot.getState().settings,showPeripherals:true},license:{...ot.getState().license,pro:true}});})()`,
    );
    await pause(900);
    const measure = await evaluate(
      '(()=>{const p=document.querySelector("[data-island]").getBoundingClientRect(),list=document.querySelector(".peripheral-device-list"),home=document.querySelector("[data-home]");return {height:p.height,viewport:Number(document.documentElement.dataset.layoutViewportHeight),listHeight:list.clientHeight,listScroll:list.scrollHeight,homeHeight:home.clientHeight,homeScroll:home.scrollHeight};})()',
    );
    assert(
      measure.height <= measure.viewport - 20,
      `Cloud exceeds viewport at ${scale}%`,
    );
    assert(measure.listHeight >= 60, `Device list is unusable at ${scale}%`);
    dpi.push({ scale, ...measure });
  }
  await invoke("settings_set", { settings: { scale: 100 } });
  await evaluate(
    `(async()=>{const {ot}=await import('/assets/runtime-debug.js');document.querySelector('#peripheral-test-label')?.remove();ot.setState({peripherals:${JSON.stringify(hardware)},peripheralCardOpen:true,settings:{...ot.getState().settings,showPeripherals:true}});})()`,
  );
  await pause(900);
  await capture("actual-cloud");
  await invoke("settings_set", { settings: { showPeripherals: false } });
  await pause(400);
  const stopped = await invoke("peripherals_get");
  await invoke("peripherals_refresh");
  await pause(1200);
  assert.equal(
    (await invoke("peripherals_get")).revision,
    stopped.revision,
    "Disabled refresh started scanner",
  );
  // Verify the new Settings layout in the actual embedded WebView2 as well.
  // This remains the isolated QA process/profile, never the owner's open app.
  await invoke("open_settings", { section: "modules" });
  let settingsPage;
  for (let attempt = 0; attempt < 100; attempt++) {
    settingsPage = (await (await fetch(`http://127.0.0.1:${port}/json`)).json())
      .find((page) => page.url.endsWith("/settings.html"));
    if (settingsPage) break;
    await pause(100);
  }
  assert(settingsPage, "Native Settings WebView unavailable");
  mainWs = ws;
  ws = new WebSocket(settingsPage.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", receive);
  await command("Runtime.enable");
  await waitFor(
    '!!document.querySelector(\'.peripheral-settings button[aria-label="Показывать на главной"]\')',
    "Battery settings did not render",
  );
  const toggleSetting = async (label) => {
    await evaluate(`document.querySelector('.peripheral-settings button[aria-label=${JSON.stringify(label)}]').click()`);
    await pause(250);
  };
  await toggleSetting("Показывать на главной");
  assert.equal((await invoke("settings_get")).showPeripherals, true);
  await toggleSetting("Уведомления устройств");
  assert.equal((await invoke("settings_get")).peripheralAlerts, true);
  await waitFor('document.querySelectorAll(".peripheral-settings [role=switch]").length===10', "Notification switches did not render");
  const settingsGeometry = [];
  for (const width of [820, 660]) {
    await invoke("plugin:window|set_size", { label: "settings", value: { Logical: { width, height: 720 } } });
    await pause(300);
    const geometry = await evaluate('(()=>{const section=document.querySelector(".peripheral-settings"),rect=section.getBoundingClientRect(),parent=section.parentElement.getBoundingClientRect();return {width:rect.width,parentWidth:parent.width,overflow:section.scrollWidth>section.clientWidth+1,checkboxes:section.querySelectorAll("input[type=checkbox]").length,switches:[...section.querySelectorAll("[role=switch]")].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,label:b.getAttribute("aria-label")}))};})()');
    assert(Math.abs(geometry.width - geometry.parentWidth) < 1, "Battery Settings must use full module width");
    assert.equal(geometry.overflow, false);
    assert.equal(geometry.checkboxes, 0);
    assert(geometry.switches.every((button) => button.width === 44 && button.height === 24 && button.label));
    settingsGeometry.push({ windowWidth: width, ...geometry });
    await evaluate('document.querySelector(".peripheral-settings").scrollIntoView({block:"start"})');
    const png = await command("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(path.join(directory, `settings-batteries-${width}.png`), Buffer.from(png.data, "base64"));
  }
  await toggleSetting("Показывать на главной");
  assert.equal((await invoke("settings_get")).showPeripherals, false);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(
      {
        passiveQa: true,
        frontendErrors: errors,
        size,
        dpi,
        dpiUsesFixture,
        settingsGeometry,
        hardware,
        manualHistoryRestored: !!manualEvidence,
        screenshots: [
          "home-batteries.png",
          "battery-card.png",
          "actual-devices.png",
          "actual-cloud.png",
          "manual-measure-confirmation.png",
          "manual-measure-reading.png",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { directory, size, dpi, hardware, frontendErrors: errors },
      null,
      2,
    ),
  );
  await evaluate('void window.__TAURI_INTERNALS__.invoke("quit");true').catch(
    () => {},
  );
})()
  .catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(() => {
    if (ws) ws.close();
    if (mainWs) mainWs.close();
    if (proc && proc.exitCode === null) proc.kill();
  });
