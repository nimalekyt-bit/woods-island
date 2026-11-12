// Read-only native control-panel checks; no physical input, focus or network changes.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const pause = ms => new Promise(r => setTimeout(r, ms));
const baseline = process.argv.includes('--baseline');
const supplied = path.resolve(process.argv[2] || path.join(__dirname,'../src-tauri/target/release/woods-island.exe'));
const port = Number(process.env.WOODS_TEST_CDP_PORT || 9344);
let proc, ws;

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'woods-controls-'));
  const exe = path.join(directory, 'woods-island.exe');
  await fs.copyFile(supplied, exe);
  const data = path.join(directory, 'data');
  await fs.mkdir(data);
  await fs.writeFile(path.join(data, 'settings.json'), JSON.stringify({controlsNet:'ethernet', firstRun:false, vpnLookupIp:false}));
  const started = performance.now();
  proc = spawn(exe, [], {cwd:directory, windowsHide:true, stdio:'ignore', env:{...process.env,
    WOODS_ISLAND_DATA_DIR:data, WOODS_ISLAND_PASSIVE_QA:'1', WOODS_ISLAND_AGENT_HOME:directory,
    WOODS_ISLAND_STEAM_PATH:directory, WOODS_ISLAND_MUSIC_PORT:String(port+1),
    APPDATA:path.join(directory,'appdata'), WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
  let page;
  for(let i=0;i<150;i++) {
    if(proc.exitCode!==null) throw Error(`Startup exit ${proc.exitCode}`);
    try { page=(await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(500)})).json()).find(p=>p.url==='http://tauri.localhost/'); } catch {}
    if(page)break;
    await pause(100);
  }
  assert(page,'Native WebView did not initialize');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  const errors=[], pending=new Map(); let id=0;
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
    const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);
    if(m.error||m.result?.exceptionDetails)p.reject(Error(JSON.stringify(m.error||m.result.exceptionDetails)));
    else p.resolve(m.result);
  });
  const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject,timer:setTimeout(()=>{pending.delete(n);reject(Error(`${method} timeout`));},20000)});ws.send(JSON.stringify({id:n,method,params}));});
  await command('Runtime.enable');
  const evaluate=async expression=>(await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
  const invoke=(name,args={})=>evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
  for(let i=0;i<150;i++){if(await evaluate('!!document.querySelector("[data-island]")'))break;await pause(100);}
  const startupMs=Math.round(performance.now()-started);
  const readings=[];let controls;
  for(let i=0;i<6;i++){const at=performance.now();controls=await invoke('controls_get');readings.push(Math.round((performance.now()-at)*10)/10);await pause(100);}
  assert(Array.isArray(controls.vpns));
  const openAt=performance.now();
  await evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:true,tab:"controls"});})()');
  let tile;
  for(let i=0;i<150;i++){
    tile=await evaluate('(()=>{const e=document.querySelector("[data-control=ethernet]");return e?{on:e.dataset.on,disabled:e.disabled,text:e.textContent}:null})()');
    if(tile&&!tile.disabled)break;
    if(baseline&&tile?.on==='none')break;
    await pause(25);
  }
  const openMs=Math.round(performance.now()-openAt);
  assert(tile,'Ethernet card did not render');
  const focused=await invoke('plugin:window|is_focused',{label:'main'});assert.equal(focused,false);
  if(!baseline){
    const native=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command', 'Get-NetAdapter -Physical | Where-Object { $_.NdisPhysicalMedium -eq 14 -or $_.PhysicalMediaType -eq "802.3" } | Select-Object InterfaceIndex,Status | ConvertTo-Json -Compress'],{windowsHide:true,encoding:'utf8'});
    assert.equal(native.status,0,native.stderr);
    const parsed=JSON.parse(native.stdout||'[]'), adapters=Array.isArray(parsed)?parsed:parsed?[parsed]:[];
    if(adapters.length){
      assert(controls.ethernetAdapter,'Windows has physical Ethernet but IPC has none');
      assert(adapters.some(a=>a.InterfaceIndex===controls.ethernetAdapter.index),'IPC picked a virtual adapter');
      assert.equal(controls.ethernet,adapters.some(a=>a.Status==='Up'));
      assert.equal(tile.on,String(controls.ethernet));assert.equal(tile.disabled,false);
    }else assert.equal(controls.ethernet,null);
    assert(Math.max(...readings)<250,`Control IPC is slow: ${readings}`);
    assert(openMs<750,`Control panel is slow: ${openMs}`);
    // Separate process against the same QA profile must exit without a second pill.
    const duplicate=spawnSync(exe,[],{cwd:directory,windowsHide:true,timeout:10000,env:{...process.env,WOODS_ISLAND_DATA_DIR:data,WOODS_ISLAND_PASSIVE_QA:'1'}});
    assert.equal(duplicate.status,0,'Duplicate instance did not exit cleanly');
    assert.equal(await invoke('plugin:window|is_focused',{label:'main'}),false);
  }
  assert.deepEqual(errors,[]);
  await evaluate('void window.__TAURI_INTERNALS__.invoke("quit");true').catch(()=>{});
  for(let i=0;i<100&&proc.exitCode===null;i++)await pause(100);
  assert.equal(proc.exitCode,0);
  const report={baseline,passiveQa:true,sha256:createHash('sha256').update(await fs.readFile(supplied)).digest('hex'),startupMs,controlsGetMs:readings,panelReadyMs:openMs,ethernet:controls.ethernet,physicalAdapter:!!controls.ethernetAdapter,tileOn:tile.on,focused,frontendErrors:errors};
  await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));console.log(`REPORT ${path.join(directory,'report.json')}`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(proc&&proc.exitCode===null)proc.kill();});
