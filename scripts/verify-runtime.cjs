// Real WebView2/Tauri acceptance. All writes go to an isolated temporary profile.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function zipFixture(files) {
  const crc32=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  const parts=[],central=[];let offset=0;
  for(const [name,content]of files){const n=Buffer.from(name),b=Buffer.from(content),crc=crc32(b),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(b.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);parts.push(h,n,b);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+b.length;}
  const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,c,end]);
}
const root = path.resolve(__dirname, '..');
const suppliedExe = process.argv[2] || path.join(root, 'src-tauri', 'target', 'release', 'woods-island.exe');
const port = Number(process.env.WOODS_TEST_CDP_PORT || 9334);
const musicPort = port + 1; // Isolated bridge: never send fixtures to the user's player.
assert(Number.isInteger(port)&&port>=1024&&port<65535,'Invalid QA CDP port');
assert(port!==3003&&musicPort!==3003,'QA ports must never use the owner music bridge on 3003');
const results = [];
const errors = [];
const approvedBitmapIds=['artifact-foldling','artifact-knotling','noct-manta','null-star-thief','paradox-fold','iskorka-cat','kryazhik','nokt','latunchik','shursh','skol'];
const testFilter=process.env.WOODS_TEST_FILTER?new RegExp(process.env.WOODS_TEST_FILTER):null;
let matchedChecks=0;
let proc;
let connections = [];
let providerServer;
let obsServer;
let weatherServer;

async function assertQaMusicBridge() {
  for(let attempt=0;attempt<30;attempt++){
    const query=spawnSync('powershell.exe',['-NoProfile','-Command',
      `Get-NetTCPConnection -LocalPort ${musicPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`
    ],{encoding:'utf8',windowsHide:true});
    const owners=query.stdout.trim().split(/\s+/).filter(Boolean).map(Number);
    assert(owners.every(owner=>Number.isInteger(owner)&&owner===proc.pid),'Fixture music port belongs to another process: '+JSON.stringify({musicPort,owners,testProcessPid:proc.pid}));
    if(owners.length)return {musicPort,owners};
    assert.equal(proc.exitCode,null,'QA process exited before binding its music bridge');
    await pause(100);
  }
  throw new Error('Isolated QA music bridge did not bind its own fixture port');
}

async function assertPassiveForeground(client) {
  const tauriFocused=await client.invoke('plugin:window|is_focused',{label:'main'});
  // Win32's foreground process is authoritative; Tauri can retain a child-focus flag.
  const focus=spawnSync('powershell.exe',['-NoProfile','-Command',
    'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class WoodsQaForeground { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint process); }\'; $foregroundOwner=0; [void][WoodsQaForeground]::GetWindowThreadProcessId([WoodsQaForeground]::GetForegroundWindow(),[ref]$foregroundOwner); Write-Output $foregroundOwner'
  ],{encoding:'utf8',windowsHide:true});
  assert.equal(focus.status,0,focus.stderr);
  const foregroundPid=Number(focus.stdout.trim());
  assert(foregroundPid>0,'Foreground PID unavailable');
  assert.notEqual(foregroundPid,proc.pid,'Native QA window became the foreground window');
  const diagnostics=await client.invoke('window_diagnostics');
  assert(diagnostics.exStyle&0x08000000,'WS_EX_NOACTIVATE must stay set');
  return {tauriFocused,foregroundPid,testProcessPid:proc.pid,noActivate:true};
}

// Runs in the real WebView2 page. Leaf bounds include stroke and all four
// transformed corners, so rotated shoes and the tail's round caps are covered.
function readAttachedPaint() {
  const pill=document.querySelector('[data-island]');
  const svg=pill?.querySelector(':scope > [data-attached-character]');
  if(!svg)return null;
  const paint={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity,nodes:0};
  for(const node of svg.querySelectorAll('path,circle,ellipse,rect,line,polyline,polygon,text,image,use')){
    let visible=true;
    for(let ancestor=node;ancestor&&ancestor!==pill;ancestor=ancestor.parentElement){
      const style=getComputedStyle(ancestor);
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0){visible=false;break;}
    }
    if(!visible||(node.tagName==='path'&&!node.getAttribute('d')))continue;
    const style=getComputedStyle(node),box=node.getBBox(),matrix=node.getScreenCTM();
    const stroke=style.stroke!=='none'&&Number(style.strokeOpacity)>0?parseFloat(style.strokeWidth)/2:0;
    if(!matrix||(!box.width&&!box.height&&!stroke))continue;
    const points=[[box.x-stroke,box.y-stroke],[box.x+box.width+stroke,box.y-stroke],
      [box.x-stroke,box.y+box.height+stroke],[box.x+box.width+stroke,box.y+box.height+stroke]]
      .map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
    paint.left=Math.min(paint.left,...points.map(point=>point.x));
    paint.top=Math.min(paint.top,...points.map(point=>point.y));
    paint.right=Math.max(paint.right,...points.map(point=>point.x));
    paint.bottom=Math.max(paint.bottom,...points.map(point=>point.y));
    paint.nodes++;
  }
  const rect=pill.getBoundingClientRect();
  return {id:svg.dataset.character,mood:svg.dataset.characterMood,paint,viewport:[innerWidth,innerHeight],
    pill:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},
    attachment:[Number(svg.dataset.attachmentRight),Number(svg.dataset.attachmentBottom)],
    layoutViewportHeight:Number(document.documentElement.dataset.layoutViewportHeight)};
}

function assertAttachedContainment(sample,native,label) {
  assert(sample&&sample.paint.nodes>0,'Attached drawing missing: '+label);
  const physical=Object.fromEntries(['left','top','right','bottom'].map(key=>[key,sample.paint[key]*native.pageFactor]));
  assert(Object.values(physical).every(Number.isFinite),'Non-finite attached paint: '+label);
  assert(native.visualBounds&&native.bounds,'Native region diagnostics missing: '+label);
  const contains=outer=>physical.left>=outer[0]-1&&physical.top>=outer[1]-1&&
    physical.right<=outer[2]+1&&physical.bottom<=outer[3]+1;
  assert(contains([0,0,native.width,native.height]),'Attached paint clipped by WebView canvas: '+JSON.stringify({label,sample,native}));
  assert(contains(native.visualBounds),'Attached paint clipped by native region: '+JSON.stringify({label,sample,native}));
  // The extra painted surface must not turn the character into a desktop hitbox.
  assert(native.bounds[2]<=Math.ceil((sample.pill.right+4)*native.pageFactor)+2,'Right hitbox grew with paint: '+label);
  assert(native.bounds[3]<=Math.ceil((sample.pill.bottom+6)*native.pageFactor)+2,'Bottom hitbox grew with paint: '+label);
  assert(physical.bottom>native.bounds[3],'Fixture must include paint below the pill hitbox: '+label);
  return physical;
}

// Read native desktop PNGs without a separate browser renderer or image library.
function rgbaPng(bytes) {
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(bytes[24],8);assert([2,6].includes(bytes[25]));assert.equal(bytes[28],0);
  const channels=bytes[25]===6?4:3;
  const chunks=[];
  for(let p=8;p<bytes.length;){const size=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')chunks.push(bytes.subarray(p+8,p+8+size));p+=size+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,decoded=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert(filter<=4);
    for(let x=0;x<stride;x++){
      const index=y*stride+x,a=x>=channels?decoded[index-channels]:0,b=y?decoded[index-stride]:0,c=y&&x>=channels?decoded[index-stride-channels]:0;
      const prediction=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      decoded[index]=(raw[y*(stride+1)+1+x]+prediction)&255;
    }
  }
  if(channels===4)return {width,height,pixels:decoded};
  const pixels=Buffer.alloc(width*height*4);
  for(let p=0;p<width*height;p++){decoded.copy(pixels,p*4,p*channels,p*channels+3);pixels[p*4+3]=channels===4?decoded[p*channels+3]:255;}
  return {width,height,pixels};
}

async function attach(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error || message.result?.exceptionDetails) item.reject(new Error(JSON.stringify(message.error || message.result.exceptionDetails)));
    else item.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject, timer: setTimeout(() => { pending.delete(next); reject(new Error(`${method} timeout`)); }, method === 'Runtime.evaluate' ? 60000 : 20000) });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  await command('Runtime.enable');
  const evaluate = async expression => (await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  const invoke = (name, args = {}) => evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
  await evaluate('performance.setResourceTimingBufferSize(10000)');
  connections.push(ws);
  return { ws, evaluate, invoke, command };
}

async function check(name, task) {
  const matches=!testFilter||testFilter.test(name);
  if(matches)matchedChecks++;
  const critical=name==='No unhandled frontend exceptions'||name==='Explicit quit exits the application';
  if(!matches&&!critical){
    results.push({name,ok:true,skipped:true,details:{skipped:true,reason:'Targeted diagnostic run'}});return;
  }
  try { const details = await task(); const skipped=details?.skipped===true; results.push({ name, ok: true, ...(skipped?{skipped:true}:{}), details }); console.log(`${skipped?'SKIP':'PASS'} ${name}`); }
  catch (error) { results.push({ name, ok: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}

async function pagesReady(predicate = p => p.url === 'http://tauri.localhost/') {
  let last = 'No CDP response';
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) throw new Error(`Application exited during startup: ${proc.exitCode}`);
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) })).json();
      last = JSON.stringify(pages.map(p=>({url:p.url,title:p.title})));
      if (pages.some(predicate)) return pages;
    } catch(error) { last = error.message; }
    await pause(200);
  }
  throw new Error(`WebView2 page did not initialize: ${last}`);
}

async function waitFor(client, expression, name) {
  for(let attempt=0;attempt<100;attempt++) {if(await client.evaluate(expression))return;await pause(100);}
  throw new Error(`${name} did not initialize`);
}
async function waitForWindowClosed(suffix) {
  for(let i=0;i<100;i++) {
    const pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
    if(!pages.some(page=>page.url.endsWith(suffix)))return;
    await pause(100);
  }
  throw new Error(`Closing ${suffix} did not release its WebView`);
}
async function listen(client, name) {
  return client.evaluate(`(() => { window.__woodsEvents ??= {}; window.__woodsEvents[${JSON.stringify(name)}] = []; const handler = window.__TAURI_INTERNALS__.transformCallback(e => window.__woodsEvents[${JSON.stringify(name)}].push(e.payload)); return window.__TAURI_INTERNALS__.invoke('plugin:event|listen', {event:${JSON.stringify(name)},target:{kind:'Any'},handler}); })()`);
}
async function quit(client) {
  await client.evaluate('void window.__TAURI_INTERNALS__.invoke("quit"); true').catch(()=>{});
  for(let i=0;i<100 && proc.exitCode===null;i++) await pause(100);
  assert.equal(proc.exitCode,0);
  for(const ws of connections) ws.close();
  connections=[];
}

(async () => {
  const tempRoot = path.join(root, 'src-tauri', 'target', 'qa-temp', 'woodscorp_obs');
  await fs.mkdir(tempRoot,{recursive:true});
  const directory = await fs.mkdtemp(path.join(tempRoot, 'island-acceptance-'));
  const exe = path.join(directory, 'woods-island.exe');
  await fs.copyFile(suppliedExe, exe);
  const dataDir = path.join(directory, 'data');
  await fs.mkdir(dataDir);
  const scratchDir=path.join(directory,'tmp');
  await fs.mkdir(scratchDir);
  let weatherRequests=0, lyricsRequests=0;
  const weatherStart=Math.floor(Date.now()/3600000)*3600;
  const weatherFixture={properties:{timeseries:Array.from({length:168},(_,i)=>({time:new Date((weatherStart+i*3600)*1000).toISOString(),data:{instant:{details:{air_temperature:2+i%4,wind_speed:3,relative_humidity:80,air_pressure_at_sea_level:1012,wind_from_direction:180}},next_1_hours:{summary:{symbol_code:i%2?'cloudy_day':'lightrain_night'},details:{precipitation_amount:0.4}}}}))}};
  weatherServer=http.createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url.startsWith('/lyrics')){
      lyricsRequests++;const query=new URL(req.url,'http://localhost').searchParams;
      if(query.get('track_name')==='Missing'){res.statusCode=404;res.end('{}');return;}
      if(query.get('track_name')==='Unavailable'){res.statusCode=503;res.end('{}');return;}
      if(query.get('track_name')==='Geometry'){
        res.end(JSON.stringify({id:43,plainLyrics:'',syncedLyrics:'[00:00.00]Да\n[00:04.00]Эта длинная строка проверяет плавную смену текста и перенос внутри музыкальной пилюли\n[00:08.00]Сверхдлинноесловобезпробелов'.repeat(1)+'продолжениесловабезразрывов'.repeat(8),instrumental:false}));return;
      }
      res.end(JSON.stringify({id:42,plainLyrics:'Первая строка\nВторая строка\nТретья строка',syncedLyrics:'[00:00.00]Первая строка\n[00:04.00]Вторая строка\n[00:08.00]Третья строка',instrumental:false}));return;
    }
    weatherRequests++;res.end(JSON.stringify(req.url.startsWith('/sun')?{properties:{sunrise:{time:new Date((weatherStart-8*3600)*1000).toISOString()},sunset:{time:new Date((weatherStart-2*3600)*1000).toISOString()}}}:weatherFixture));
  });
  await new Promise(resolve=>weatherServer.listen(0,'127.0.0.1',resolve));
  const weatherUrl=`http://127.0.0.1:${weatherServer.address().port}/forecast`;
  await fs.writeFile(path.join(dataDir,'weather.json'),JSON.stringify({lat:53.2424,lon:34.3668,fetchedAt:Date.now(),now:{temp:2,code:'cloudy'},hours:[{time:weatherStart*1000}]}));
  const agentHome=path.join(directory,'agent-home');
  const agentConfigs=[['.claude/settings.json',JSON.stringify({permissions:{allow:['Read']},hooks:{Stop:[{hooks:[{type:'command',command:'fixture-notify.exe'}]}]}})],['.codex/config.toml','# untouched fixture\nnotify = ["fixture-notify.exe"]\nmodel = "fixture"\n'],['.config/opencode/opencode.json','{}']];
  for(const [name,content]of agentConfigs){const file=path.join(agentHome,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);}
  async function launch(){
    proc = spawn(exe, [], { cwd: directory, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, TEMP:scratchDir, TMP:scratchDir, APPDATA: path.join(directory, 'appdata'), WOODS_ISLAND_DATA_DIR: dataDir, WOODS_ISLAND_AGENT_HOME:agentHome, WOODS_ISLAND_STEAM_PATH:path.join(directory,'steam'), WOODS_ISLAND_MUSIC_PORT:String(musicPort), WOODS_ISLAND_WEATHER_URL:weatherUrl, WOODS_ISLAND_LYRICS_URL:weatherUrl.replace('/forecast','/lyrics'), WOODS_ISLAND_PASSIVE_QA:'1', WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
    proc.stdout.on('data', data => process.stdout.write(data));
    proc.stderr.on('data', data => process.stderr.write(data));
    proc.on('exit', (code, signal) => console.log(`Native process exited: code=${code}, signal=${signal}`));
    await new Promise((resolve, reject) => { proc.once('spawn', resolve); proc.once('error', reject); });
    await assertQaMusicBridge();
  }
  await launch();
  const pages = await pagesReady();
  let main = await attach(pages.find(p => p.url === 'http://tauri.localhost/'));
  await waitFor(main,'!!document.querySelector("[data-island]")','Main UI');
  for(let i=0;i<100;i++){if(await main.invoke('window_diagnostics'))break;await pause(100);}
  await pause(400);
  const persisted = new Map();
  const fixture = path.join(directory,'fixture.txt');
  await fs.writeFile(fixture,'Woods Island acceptance · Проверка');
  await check('Main UI mounts', async () => { assert(await main.evaluate('!!document.querySelector("[data-island]")')); });
  await check('Settings and image editor renderers are absent until requested',async()=>{
    assert(!pages.some(page=>/\/(settings|editor)\.html$/.test(page.url)));
    return {settingsLazy:true,imageEditorLazy:true};
  });
  await check('No Windows caption; DPI bounds match canvas', async () => {
    const d = await main.invoke('window_diagnostics');
    assert.equal(d.style & 0x00C00000, 0);
    assert(d.exStyle & 0x08000000, 'WS_EX_NOACTIVATE is required');
    assert(d.exStyle & 0x00200000, 'WS_EX_NOREDIRECTIONBITMAP avoids the native glass canvas');
    assert.equal(d.exStyle & 0x00080000,0,'WS_EX_LAYERED must not be injected');
    assert.equal(d.width, Math.round(760 * d.scale));
    assert(d.bounds && d.bounds[2] <= d.width && d.bounds[3] <= d.height);
    return d;
  });
  await check('Bootstrap uses real audio device', async () => {
    const boot = await main.invoke('bootstrap');
    const devices = await main.invoke('audio_devices');
    assert(Array.isArray(devices));
    assert(boot.audio && Number.isFinite(boot.audio.level));
    assert(boot.audio.level >= 0 && boot.audio.level <= 1);
    if(devices.length) assert(devices.some(d => d.name === boot.audio.device || d.id === boot.audio.device));
    assert.equal(boot.version,JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version);
    return { devices: devices.length, version: boot.version };
  });
  await check('Chosen audio endpoint changes monitoring without rerouting sound',async()=>{
    const prior=await main.invoke('settings_get');const devices=await main.invoke('audio_devices');
    const chosen=devices.find(d=>!d.default)||devices[0];if(!chosen)return {devices:0};
    try{
      const defaults=devices.filter(d=>d.default).map(d=>d.id);
      assert.deepEqual(await main.invoke('settings_set',{settings:{audioOutput:chosen.id}}),[]);await pause(300);
      const boot=await main.invoke('bootstrap');assert.equal(boot.audio.deviceId,chosen.id);assert.equal(boot.audio.chosen,true);
      const after=await main.invoke('audio_devices');assert.deepEqual(after.filter(d=>d.default).map(d=>d.id),defaults);
      assert(after.some(d=>d.id===chosen.id&&d.chosen));return {selected:chosen.name,defaultUnchanged:true};
    }finally{await main.invoke('settings_set',{settings:{audioOutput:prior.audioOutput}});}
  });
  await check('Bootstrap supplies virtual desktop state before the first frontend telemetry listener',async()=>{
    const boot=await main.invoke('bootstrap');assert(Object.hasOwn(boot,'vdesk'));
    if(boot.vdesk===null)return {available:false,initialState:null};
    assert(boot.vdesk.count>=1&&boot.vdesk.index>=1&&boot.vdesk.index<=boot.vdesk.count);
    await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().vdesk!==null;})()','Initial virtual desktop snapshot');
    const initial=await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().vdesk;})()');
    assert(initial.count>=1&&initial.index>=1&&initial.index<=initial.count);
    return {available:true,bootstrap:boot.vdesk,initial};
  });
  await check('Capture visibility setting changes native display protection',async()=>{
    assert.equal((await main.invoke('window_diagnostics')).captureAffinity,0x11);
    assert.deepEqual(await main.invoke('settings_set',{settings:{captureVisible:true}}),[]);
    assert.equal((await main.invoke('window_diagnostics')).captureAffinity,0);
    await main.invoke('settings_set',{settings:{captureVisible:false}});
    assert.equal((await main.invoke('window_diagnostics')).captureAffinity,0x11);
  });
  await check('Chosen microphone remains readable without recording or mute changes',async()=>{
    const prior=await main.invoke('settings_get');const inputs=await main.invoke('audio_inputs');
    const chosen=inputs.find(d=>!d.default)||inputs[0];if(!chosen)return {inputs:0};
    try{
      await main.invoke('settings_set',{settings:{audioInput:chosen.id}});
      const after=await main.invoke('audio_inputs');assert(after.some(d=>d.id===chosen.id&&d.chosen));
      const audio=(await main.invoke('bootstrap')).audio;assert.equal(typeof audio.micMuted,'boolean');
      assert.deepEqual(after.filter(d=>d.default).map(d=>d.id),inputs.filter(d=>d.default).map(d=>d.id));
      return {selected:chosen.name,readable:true,defaultUnchanged:true};
    }finally{await main.invoke('settings_set',{settings:{audioInput:prior.audioInput}});}
  });
  await check('Native notification and network reads return usable contracts',async()=>{
    assert(['allowed','denied','unspecified','unavailable'].includes(await main.invoke('notifications_access')));
    const prior=await main.invoke('settings_get');
    await main.invoke('settings_set',{settings:{vpnLookupIp:false}});
    try{const vpn=await main.invoke('vpn_refresh');assert.equal(vpn.ip,null);assert.equal(typeof vpn.active,'boolean');}finally{await main.invoke('settings_set',{settings:{vpnLookupIp:prior.vpnLookupIp}});}
    const controls=await main.invoke('controls_get');assert(Array.isArray(controls.vpns));
    assert(Array.isArray(await main.invoke('bt_devices')));
    return {notifications:await main.invoke('notifications_access'),vpnProfiles:controls.vpns.length};
  });
  await check('Settings merge + persist, toggles do not crash', async () => {
    const before = await main.invoke('settings_get');
    const warnings = await main.invoke('settings_set', { settings: { opacityRest: 93, weatherCity: 'Брянск', weatherLat: 53.2424, weatherLon: 34.3668 } });
    assert(Array.isArray(warnings));
    const after = await main.invoke('settings_get');
    assert.equal(after.opacityRest, 93);
    assert.equal(after.theme, before.theme);
    assert.equal(JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8')).weatherCity, 'Брянск');
  });
  await check('Island scale changes physical size, viewport and clip bounds together',async()=>{
    // Folded audio/volume notices can expire between measurements. Use the
    // fixed control panel so CSS geometry measures zoom rather than a notice.
    await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:true,tab:"controls"});})()');
    await pause(1200);
    const original=await main.invoke('window_diagnostics');
    const rect=await main.evaluate('(()=>{const r=document.querySelector("[data-island]").getBoundingClientRect();return {width:r.width,height:r.height};})()');
    const measured=[];
    for(const value of [150,200,80,100]){
      const warnings=await main.invoke('settings_set',{settings:{scale:value}});assert.deepEqual(warnings,[]);
      await pause(750);
      await main.evaluate('window.__TAURI_INTERNALS__.invoke("report_page_scale",{width:window.innerWidth})');
      const d=await main.invoke('window_diagnostics');
      const dom=await main.evaluate('(()=>{const r=document.querySelector("[data-island]").getBoundingClientRect();return {width:r.width,height:r.height,viewport:window.innerWidth};})()');
      assert.equal(d.width,Math.round(760*d.scale*value/100));
      assert(Math.abs(dom.viewport-760)<=2,JSON.stringify(dom));
      assert(Math.abs(d.pageFactor-d.scale*value/100)<.01,JSON.stringify(d));
      assert(Math.abs(dom.width-rect.width)<10,`CSS geometry changed unexpectedly: baseline=${JSON.stringify(rect)} current=${JSON.stringify(dom)}`);
      assert(d.bounds[2]<=d.width&&d.bounds[3]<=d.height);
      assert.equal(d.style&0x00C00000,0);assert.equal(d.exStyle&0x00080000,0);
      assert.equal(await main.invoke('plugin:window|is_focused',{label:'main'}),false);
      measured.push({value,width:d.width,pillWidth:Math.round(dom.width*d.pageFactor),bounds:d.bounds});
    }
    assert.equal((await main.invoke('window_diagnostics')).width,original.width);
    await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:false,tab:"home"});})()');
    return measured;
  });
  await check('Weather search works offline for Брянск', async () => {
    const cities = await main.invoke('weather_search', { query: 'брянск' });
    assert(cities.some(c => c.name === 'Брянск' && c.lat === 53.2424 && c.lon === 34.3668));
  });
  await check('Media source and playback contracts', async () => {
    const sources = await main.invoke('media_sources');
    assert(Array.isArray(sources));
    const boot = await main.invoke('bootstrap');
    if(boot.media) { assert(Number.isFinite(boot.media.updatedAt)); assert(boot.media.positionMs >= 0 || boot.media.position >= 0); }
    return { sources: sources.length, mediaPresent: !!boot.media };
  });
  await check('Weather opens, switches hours/week and units, and rejects legacy data',async()=>{
    const data=await main.invoke('weather_get');assert(data&&data.schemaVersion===2);assert.equal(data.utcOffset,10800);
    assert(data.days.length>=7&&data.hours.length===24);assert(data.hours.every(h=>h.time<1e11&&Number.isFinite(h.code)));
    assert(weatherRequests>0,'Legacy cache must have been replaced');
    const open=()=>main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:true,tab:"weather"});})()');
    await open();await waitFor(main,'!!document.querySelector("[data-wx-now]")','Weather panel');
    await main.evaluate('document.querySelector("[data-wx-view=week]").click()');await waitFor(main,'!!document.querySelector("[data-wx-week]")','Weather week');
    assert.equal(await main.evaluate('document.querySelector("[data-wx-week]").children.length'),7);
    await main.evaluate('document.querySelector("[data-wx-view=hours]").click()');assert(await main.evaluate('!!document.querySelector("[data-wx-hours]")'));
    const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'weather-fixed.png'),Buffer.from(shot.data,'base64'));
    await main.invoke('settings_set',{settings:{weatherUnits:'imperial'}});await pause(300);
    const imperial=await main.invoke('weather_get');assert.equal(imperial.units,'imperial');assert.equal(imperial.now.temp,data.now.temp*1.8+32);
    await main.invoke('plugin:event|emit',{event:'weather:update',payload:{now:{temp:2,code:'cloudy'},hours:[]}});
    await waitFor(main,'document.body.innerText.includes("Некорректные данные прогноза")','Invalid weather recovery');
    await main.invoke('settings_set',{settings:{weatherUnits:'metric'}});await main.invoke('weather_refresh');await waitFor(main,'!!document.querySelector("[data-wx-now]")','Recovered weather');
    assert(!(await main.evaluate('document.querySelector("[data-island]").innerText')).includes('NaN'));
    await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:false,tab:"home"});})()');await pause(600);
    return {days:data.days.length,hours:data.hours.length,utcOffset:data.utcOffset,legacyCacheReplaced:true,imperial:true,invalidRecovery:true,protocolFixture:true};
  });
  await check('Live Yandex connector reaches the rendered pill with cover and advancing time',async()=>{
    await pause(1500);
    const first=(await main.invoke('bootstrap')).media;
    if(!first||first.transport!=='yandex-connector')return {skipped:true,live:false,reason:'No live Yandex connector on this machine'};
    assert(first.title&&first.artist);assert(first.durationMs>0);
    const volume=await main.invoke('player_volume');assert(Number.isFinite(volume.level));assert.equal(typeof volume.muted,'boolean');
    const sources=await main.invoke('media_sources');assert(sources.some(s=>s.id===first.app));
    await main.invoke('settings_set',{settings:{mediaPill:'title'}});await pause(1000);
    const text=await main.evaluate('document.querySelector("[data-island]").innerText');
    assert(text.includes(first.title),JSON.stringify(text));
    const cover=(await main.invoke('bootstrap')).cover;if(first.cover)assert.equal(cover,first.cover);
    const second=(await main.invoke('bootstrap')).media;
    if(first.key===second?.key&&first.playing&&second.playing)assert(second.positionMs>first.positionMs,'Live position should advance');
    await main.invoke('settings_set',{settings:{mediaPill:'normal'}});
    return {live:true,title:first.title,artist:first.artist,position:first.positionMs,nextPosition:second?.positionMs,cover:!!cover};
  });
  await check('Plain island and visible pause collapse after 2500 ms despite repeated metadata',async()=>{
    const prior=await main.invoke('settings_get');let playing=false,timer;
    const publish=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'pause-fixture',title:'Pause fixture',artist:'Fixture',duration:300000,progress:60000,isPlaying:playing})});
      assert.equal(response.status,200);
    };
    const state=()=>main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js"),s=ot.getState(),pill=document.querySelector("[data-island]"),progress=document.querySelector("[data-media-progress]");return {live:s.mediaLive,playing:s.media?.playing,width:pill.getBoundingClientRect().width,liquid:!!document.querySelector("[data-island] > svg"),badge:!!document.querySelector("[data-media-paused]"),progress:progress?.style.width,transition:progress?getComputedStyle(progress).transitionDuration:null};})()');
    try{
      await main.invoke('media_pick',{id:null});
      await main.invoke('settings_set',{settings:{character:'none',characterMusic:'liquid',liquidWith:true,mediaPill:'title',lyrics:false,showClock:false,showBattery:false,showWeather:false,layoutInPill:false,desktopInPill:false,agentsStatus:false,obsStatus:false,showPrivacy:false,downloadsInPill:'off',moduleShelf:false}});
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[]});})()');
      await publish();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>publish().catch(error=>errors.push({description:error.message})),120);
      await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().media?.playing===false;})()','Paused isolated source');
      await pause(3400);const idle=await state();assert.equal(idle.liquid,false,'No character must be plain: '+JSON.stringify(idle));
      playing=true;await publish();
      await waitFor(main,'!!document.querySelector("[data-media-pill=title][data-playback-state=playing]")','Playing title pill');await pause(800);
      assert.equal((await state()).liquid,true,'Chosen music character still applies');
      playing=false;await publish();await waitFor(main,'!!document.querySelector("[data-media-paused]")','Immediate pause badge');
      const pausedAt=Date.now();const paused=await state();assert.equal(paused.live,true);assert.equal(paused.transition,'0s');
      await pause(600);const still=await state();assert.equal(still.progress,paused.progress);assert.equal(still.liquid,false,'Pause restores plain idle character');
      const screenshot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'title-paused.png'),Buffer.from(screenshot.data,'base64'));
      await pause(1000);assert.equal((await state()).live,true,'Grace must remain visible before deadline');
      await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return !ot.getState().mediaLive;})()','Pause grace deadline');
      const collapseMs=Date.now()-pausedAt;assert(collapseMs>=2300&&collapseMs<3300,`Unexpected observed grace: ${collapseMs} ms`);
      await pause(800);const collapsed=await state();assert(collapsed.width<paused.width-20,JSON.stringify({paused,collapsed}));assert.equal(collapsed.liquid,false);
      playing=true;await publish();await waitFor(main,'!!document.querySelector("[data-media-pill=title][data-playback-state=playing]")','Resume after collapse');
      playing=false;await publish();await waitFor(main,'!!document.querySelector("[data-media-paused]")','Second pause');await pause(600);
      playing=true;await publish();await waitFor(main,'!!document.querySelector("[data-media-pill=title][data-playback-state=playing]")','Resume before deadline');await pause(2300);assert.equal((await state()).live,true);assert.equal((await state()).badge,false);
      await main.invoke('settings_set',{settings:{mediaPill:'normal'}});playing=false;await publish();
      await waitFor(main,'!!document.querySelector("[data-media-pill=normal] [data-media-paused]")','Normal pill pause badge');
      assert.equal(await main.invoke('plugin:window|is_focused',{label:'main'}),false);
      return {plainIdle:true,plainPaused:true,titleBadge:true,normalBadge:true,frozenProgress:true,metadataEveryMs:120,collapseMs,resumeCancelsCollapse:true,pausedWidth:paused.width,collapsedWidth:collapsed.width};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await pause(3400);}
  });
  await check('LRCLIB milliseconds highlight, advance, pause and seek the rendered lyrics',async()=>{
    const prior=await main.invoke('settings_get');let progress=1000,playing=true,at=Date.now(),timer,phase='bootstrap';
    const publishEvents=[];
    await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');const trace={started:performance.now(),samples:[]};window.__woodsLyricsQaTrace=trace;trace.timer=setInterval(()=>{const state=ot.getState(),pill=document.querySelector('[data-media-pill]');trace.samples.push({at:performance.now()-trace.started,media:state.media,mediaLive:state.mediaLive,expanded:state.expanded,hovered:state.hovered,holdOpen:state.holdOpen,pinned:state.pinned,tab:state.tab,peek:state.peek?.kind,settings:{mediaPill:state.settings?.mediaPill,lyrics:state.settings?.lyrics,lyricsInHome:state.settings?.lyricsInHome,lyricsInPlayer:state.settings?.lyricsInPlayer},dom:{mode:pill?.dataset.mediaPill,now:Array.from(document.querySelectorAll('[data-lyrics-now]')).map(e=>e.textContent),folded:Array.from(document.querySelectorAll('[data-lyrics-line]')).map(e=>e.textContent),paused:!!document.querySelector('[data-media-paused]')}});if(trace.samples.length>1000)trace.samples.shift();},50);})()`);
    const saveTrace=async outcome=>{
      const browser=await main.evaluate(`(()=>{const trace=window.__woodsLyricsQaTrace;return {started:trace.started,samples:trace.samples};})()`);
      const tracePath=path.join(directory,'lyrics-timing-proof.json');
      await fs.writeFile(tracePath,JSON.stringify({outcome,phase,publishEvents,browser},null,2));
      return tracePath;
    };
    const publish=async()=>{
      const frame={trackId:'lyrics-fixture',title:'Test Slowed',artist:'Fixture',duration:12000,progress:Math.min(12000,progress+(playing?Date.now()-at:0)),isPlaying:playing};
      const event={phase,sentAt:Date.now(),frame};publishEvents.push(event);
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(frame)});
      event.receivedAt=Date.now();event.status=response.status;
      assert(response.ok,'The isolated music bridge must accept the fixture');
    };
    const nowText=()=>main.evaluate('document.querySelector("[data-lyrics-now]")?.textContent');
    try{
      const lyrics=await main.invoke('lyrics_get',{artist:'Fixture',title:'Test Slowed',album:'Fixture album',durationMs:12000});
      assert.equal(lyrics.synced[1].ms,4000);assert(!('time' in lyrics.synced[1]));
      assert.equal((await main.invoke('lyrics_get',{artist:'Fixture',title:'Missing'})).found,false);
      await assert.rejects(main.invoke('lyrics_get',{artist:'Fixture',title:'Unavailable'}),/503/);
      await main.invoke('settings_set',{settings:{lyrics:true,lyricsInPlayer:true,lyricsInHome:true,mediaPill:'player'}});
      at=Date.now();await publish();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>publish().catch(error=>errors.push({description:error.message})),120);
      phase='first line';
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Первая строка"','First active lyrics line');
      phase='advance';
      progress=3500;playing=true;at=Date.now();await publish();
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Вторая строка"','Lyrics progress while playing');
      phase='pause450';
      progress=6000;playing=false;at=Date.now();await publish();await pause(450);
      assert.equal(await nowText(),'Вторая строка');phase='pause1450';await pause(1000);assert.equal(await nowText(),'Вторая строка');
      phase='seek backwards';
      progress=0;at=Date.now();await publish();
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Первая строка"','Lyrics seek backwards');
      phase='seek forwards';
      progress=9000;at=Date.now();await publish();
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Третья строка"','Lyrics seek forwards');
      await waitFor(main,'Number(getComputedStyle(document.querySelector("[data-lyrics-now]")).opacity) >= 0.99','Lyrics highlight animation');
      const active=await main.evaluate('(()=>{const e=document.querySelector("[data-lyrics-now]");return {color:getComputedStyle(e).color,weight:getComputedStyle(e).fontWeight,opacity:getComputedStyle(e).opacity};})()');
      assert(Number(active.weight)>=600);assert(Number(active.opacity)>=0.99);
      playing=true;at=Date.now();await publish();
      phase='folded lyrics';
      await main.invoke('settings_set',{settings:{mediaPill:'lyrics'}});
      await waitFor(main,'document.querySelector("[data-media-pill=lyrics] [data-lyrics-line]")?.textContent.includes("Третья строка")','Folded lyrics mode');
      await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:true,tab:"home"});})()');
      phase='home lyrics';
      await waitFor(main,'document.querySelector("[data-home] [data-lyrics-now]")?.textContent === "Третья строка"','Home lyrics mode');
      assert(lyricsRequests>=4);const timingProof=await saveTrace('passed');return {milliseconds:true,highlight:true,advance:true,pause:true,seekBothDirections:true,foldedLyrics:true,homeLyrics:true,missing404:true,retryable503:true,isolatedBridge:true,timingProof};
    }catch(error){
      const timingProof=await saveTrace('failed');
      const screenshot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'lyrics-failure.png'),Buffer.from(screenshot.data,'base64'));
      console.log(`Lyrics diagnostic phase ${phase}: ${timingProof}`);throw error;
    }finally{
      await main.evaluate('clearInterval(window.__woodsLyricsQaTrace?.timer);delete window.__woodsLyricsQaTrace');
      clearInterval(timer);await main.invoke('media_pick',{id:null});await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:false,tab:"home"});})()');
      await main.invoke('settings_set',{settings:{lyrics:prior.lyrics,lyricsInPlayer:prior.lyricsInPlayer,lyricsInHome:prior.lyricsInHome,mediaPill:prior.mediaPill}});await pause(3400);
    }
  });
  await check('Lyrics keep stable geometry across short, wrapped and unbroken lines',async()=>{
    const prior=await main.invoke('settings_get');let position=1000,timer;
    const send=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'geometry-fixture',title:'Geometry',artist:'Fixture',duration:20000,progress:position,isPlaying:true})});assert.equal(response.status,200);
    };
    try{
      await main.invoke('settings_set',{settings:{lyrics:true,mediaPill:'lyrics',character:'liquid',liquidWith:false,showClock:false,showBattery:false,showWeather:false,layoutInPill:false,desktopInPill:false}});
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[]});})()');
      await main.evaluate(`(()=>{window.__lyricMotion=[];const start=performance.now();function tick(){const p=document.querySelector('[data-island]')?.getBoundingClientRect();window.__lyricMotion.push({t:performance.now()-start,width:p?.width,height:p?.height});if(performance.now()-start<2500)requestAnimationFrame(tick);}requestAnimationFrame(tick);})()`);
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});timer=setInterval(()=>void send().catch(()=>{}),200);
      await waitFor(main,'document.querySelector("[data-lyrics-line]")?.textContent === "Да"','Short geometry line');await pause(1000);
      const frames=await main.evaluate(`new Promise(resolve=>{const samples=[],start=performance.now();function tick(){const pill=document.querySelector('[data-island]'),viewport=document.querySelector('[data-lyrics-viewport]');const p=pill?.getBoundingClientRect(),v=viewport?.getBoundingClientRect();samples.push({t:performance.now()-start,width:p?.width,height:p?.height,viewportHeight:v?.height});if(performance.now()-start<1800)requestAnimationFrame(tick);else resolve(samples);}requestAnimationFrame(tick);})`);
      assert(frames.length>15);const width=frames.at(-1).width,height=frames.at(-1).height;
      assert(Math.max(...frames.map(f=>f.width))-Math.min(...frames.map(f=>f.width))<1);
      const opening=await main.evaluate('window.__lyricMotion');
      // Width is quantized to 2 physical pixels; very close RAF timestamps
      // must not amplify that harmless rounding into a fictitious large jump.
      const normalizedSteps=opening.slice(1).map((frame,i)=>Math.abs(frame.width-opening[i].width)*16/Math.max(4,frame.t-opening[i].t));
      await fs.writeFile(path.join(directory,'lyrics-motion.json'),JSON.stringify(opening));
      assert(Math.max(...normalizedSteps)<70,'Lyrics width must animate rather than jump: '+JSON.stringify(opening.filter((f,i)=>i&&normalizedSteps[i-1]>=70)));
      assert(Math.max(...opening.map(f=>f.width))<=width+2,'Lyrics opening must not overshoot its final width');
      const lines=[];
      for(const next of [4500,8500,1000]){
        position=next;await send();await pause(700);
        const sample=await main.evaluate(`(()=>{const p=document.querySelector('[data-island]').getBoundingClientRect(),v=document.querySelector('[data-lyrics-viewport]').getBoundingClientRect(),line=Array.from(document.querySelectorAll('[data-lyrics-line]')).find(e=>Number(getComputedStyle(e).opacity)>.99),text=line?.lastElementChild;return {width:p.width,height:p.height,viewportHeight:v.height,textHeight:text?.getBoundingClientRect().height,wrap:text?getComputedStyle(text).overflowWrap:null,lineCount:document.querySelectorAll('[data-lyrics-line]').length,text:line?.textContent};})()`);
        assert(Math.abs(sample.width-width)<1,JSON.stringify(sample));assert(Math.abs(sample.height-height)<1);
        assert.equal(sample.viewportHeight,30);assert(sample.textHeight<=30);assert.equal(sample.lineCount,1);assert.equal(sample.wrap,'anywhere');lines.push({position:next,...sample,text:undefined});
        if(next===4500){const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'lyrics-wrapped.png'),Buffer.from(shot.data,'base64'));}
      }
      const screenshot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'lyrics-stable.png'),Buffer.from(screenshot.data,'base64'));
      assert.equal(await main.invoke('plugin:window|is_focused',{label:'main'}),false);
      return {stableWidth:width,stableHeight:height,frameCount:frames.length,openingFrames:opening.length,maxWidthChangePer16ms:Math.max(...normalizedSteps),shortLongAndUnbroken:true,lines};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await pause(3400);}
  });
  await check('Typed pill transitions retain sizes and lyrics lifecycle at 80/100/150/200 percent',async()=>{
    const prior=await main.invoke('settings_get');let playing=true,position=1000,timer;
    const send=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'typed-geometry',title:'Geometry',artist:'Fixture',duration:20000,progress:position,isPlaying:playing})});assert.equal(response.status,200);
    };
    const reset=()=>main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false,pinned:false,holdOpen:false,tall:false,tab:"home",dragOver:null});})()');
    const sample=()=>main.evaluate('(async()=>{const {lyricsStore}=await import("/assets/runtime-debug.js"),p=document.querySelector("[data-island]").getBoundingClientRect(),v=document.querySelector("[data-lyrics-viewport]")?.getBoundingClientRect();return {width:p.width,height:p.height,viewportHeight:v?.height,lineW:lyricsStore.getState().lineW,wrap:lyricsStore.getState().wrap,pill:document.querySelector("[data-media-pill]")?.dataset.mediaPill};})()');
    // WebView2 rounds layout coordinates to subpixels when page zoom is 80%.
    const heightIs=(value,expected)=>assert(Math.abs(value-expected)<0.05,`Height ${value}, expected ${expected}`);
    const measured=[];
    try{
      await main.invoke('settings_set',{settings:{lyrics:true,mediaPill:'normal',character:'none',characterMusic:'none',liquidWith:false,showClock:false,showBattery:false,showWeather:false,showCaps:false,layoutInPill:false,desktopInPill:false,agentsStatus:false,obsStatus:false,showPrivacy:false,downloadsInPill:'badge',moduleShelf:false,openOnHover:false}});
      await reset();await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>void send().catch(()=>{}),200);
      await waitFor(main,'!!document.querySelector("[data-media-pill=normal]")','Typed normal fixture');
      for(const scale of [80,100,150,200]){
        await main.invoke('settings_set',{settings:{scale,mediaPill:'normal'}});await reset();await pause(850);
        const normal=await sample();assert(Math.abs(normal.width-268)<3,JSON.stringify({scale,normal}));heightIs(normal.height,32);assert.equal(normal.lineW,0);
        await main.invoke('settings_set',{settings:{mediaPill:'lyrics'}});
        await waitFor(main,'document.querySelector("[data-lyrics-line]")?.textContent === "Да"','Typed lyrics mount');await pause(1000);
        const lyrics=await sample();heightIs(lyrics.height,44);heightIs(lyrics.viewportHeight,30);assert(lyrics.lineW>0);assert(lyrics.width<=682);
        position=8500;await send();await pause(450);const long=await sample();assert(Math.abs(long.width-lyrics.width)<1,JSON.stringify({scale,lyrics,long}));assert.equal(long.height,lyrics.height);
        position=1000;await send();await pause(350);
        await main.invoke('settings_set',{settings:{mediaPill:'normal',character:'legs',characterMusic:'legs',showClock:true}});await pause(900);
        const face=await sample();heightIs(face.height,32);assert(face.width>=265,JSON.stringify({scale,face}));assert.equal(face.lineW,0,'Lyrics must release width on unmount');
        await main.invoke('settings_set',{settings:{character:'pixel',characterMusic:'pixel'}});await pause(800);
        const slot=await sample();heightIs(slot.height,32);assert(slot.width>=265,JSON.stringify({scale,slot}));
        await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.getState().open("click","controls");})()');await pause(1000);
        const expanded=await sample();assert(Math.abs(expanded.width-680)<3);heightIs(expanded.height,336);
        await reset();await main.invoke('settings_set',{settings:{character:'none',characterMusic:'none',showClock:false,mediaPill:'title'}});await pause(900);
        playing=false;await send();await waitFor(main,'!!document.querySelector("[data-media-paused]")','Typed paused title');
        heightIs((await sample()).height,44);await pause(3400);const idle=await sample();assert(Math.abs(idle.width-150)<3);heightIs(idle.height,30);
        assert.equal(await main.invoke('plugin:window|is_focused',{label:'main'}),false);
        measured.push({scale,normal,lyrics,long,face,slot,expanded,idle});
        playing=true;await send();await waitFor(main,'!!document.querySelector("[data-media-pill=title][data-playback-state=playing]")','Typed resume');
      }
      return {scales:[80,100,150,200],measured,lyricsUnmountResetsWidth:true,shortLongWidthStable:true,faceAndSlot:true,pausedCollapse:true,noFocus:true};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await reset();await pause(3400);}
  });
  await check('Pause badge stays visible inside the cover in title/normal/lyrics at every scale',async()=>{
    const prior=await main.invoke('settings_get');let playing=true,timer;
    const send=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'badge-fixture',title:'Pause fixture',artist:'Fixture',duration:300000,progress:60000,isPlaying:playing})});assert.equal(response.status,200);
    };
    const measurements=[];
    const contains=(outer,inner)=>inner.left>=outer.left-.05&&inner.top>=outer.top-.05&&inner.right<=outer.right+.05&&inner.bottom<=outer.bottom+.05;
    try{
      await main.invoke('settings_set',{settings:{mediaPill:'title',lyrics:true,character:'none',characterMusic:'none',liquidWith:false,openOnHover:false}});
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false});})()');
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});timer=setInterval(()=>void send().catch(()=>{}),150);
      for(const scale of [80,100,150,200])for(const mode of ['title','normal','lyrics']){
        playing=true;await send();await main.invoke('settings_set',{settings:{scale,mediaPill:mode}});
        await waitFor(main,`!!document.querySelector('[data-media-pill=${mode}][data-playback-state=playing]')`,'Playing badge fixture');await pause(500);
        playing=false;await send();await waitFor(main,`!!document.querySelector('[data-media-pill=${mode}] [data-media-paused]')`,'Pause badge mount');
        const sample=await main.evaluate(`(()=>{const badge=document.querySelector('[data-media-pill=${mode}] [data-media-paused]'),cover=badge.parentElement,pill=badge.closest('[data-media-pill]'),icon=badge.querySelector('svg');const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const b=rect(badge),i=rect(icon),s=getComputedStyle(badge);return {badge:b,cover:rect(cover),pill:rect(pill),icon:i,position:s.position,background:s.backgroundColor,color:s.color,visibleAtCenter:badge.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)),bars:icon.querySelectorAll('rect').length};})()`);
        assert(contains(sample.cover,sample.badge),'Badge outside cover: '+JSON.stringify({scale,mode,...sample}));
        assert(contains(sample.pill,sample.badge),'Badge clipped by pill');assert(contains(sample.badge,sample.icon));
        assert(Math.abs(sample.badge.width-14)<.05&&Math.abs(sample.badge.height-14)<.05);assert.equal(sample.position,'absolute');assert.equal(sample.visibleAtCenter,true);assert.equal(sample.bars,2);assert.equal(sample.color,'rgb(255, 255, 255)');
        measurements.push({scale,mode,...sample});
        if(scale===100&&mode==='title'){
          const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'pause-badge-fixed.png'),Buffer.from(shot.data,'base64'));
          const p=sample.pill;const crop=await main.command('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,p.left-3),y:Math.max(0,p.top),width:p.width+6,height:p.height,scale:3}});await fs.writeFile(path.join(directory,'pause-badge-fixed-detail.png'),Buffer.from(crop.data,'base64'));
        }
      }
      return {measurements,insideCover:true,insidePill:true,twoBarsVisible:true,highContrast:true,scales:[80,100,150,200],modes:['title','normal','lyrics']};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await pause(3400);}
  });
  await check('Typed character engine renders 36 builtin and 9 optional characters, pause, sleep and cursor at every scale',async()=>{
    const prior=await main.invoke('settings_get');
    const measured=[];let playing=false,timer;
    const send=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'character-engine-fixture',title:'Character fixture',artist:'Fixture',duration:20000,progress:1000,isPlaying:playing})});
    try {
      await main.invoke('settings_set',{settings:{liquidWith:false,showClock:false,showBattery:false,showWeather:false,showCaps:false,layoutInPill:false,desktopInPill:false,agentsStatus:false,obsStatus:false,showPrivacy:false,downloadsInPill:'off',moduleShelf:false,openOnHover:false,lyrics:false,mediaPill:'normal',moduleMedia:true}});
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>void send().catch(()=>{}),80);
      const catalog=await main.evaluate('(async()=>{const {characterCatalog}=await import("/assets/runtime-debug.js");return characterCatalog.map(({id,kind,bitmap})=>({id,kind,source:bitmap?.source}));})()');
      assert.equal(catalog.length,46);assert.equal(catalog.filter(c=>c.source==='codex').length,9);
      assert.deepEqual(catalog.filter(c=>c.source==='woods').map(c=>c.id).sort(),approvedBitmapIds.slice().sort(),'The approved eleven bitmap pets are the production authored catalog');
      assert(!catalog.some(c=>c.id==='stardust-beetle'),'Rejected beetle draft must not remain in the production catalog');
      const library=await main.invoke('pets_catalog');
      const optionalReady=new Map(library.pets.map(pet=>['codex-pet-'+pet.id,pet.available]));
      for(const scale of [80,100,150,200]) {
        await main.invoke('settings_set',{settings:{scale}});
        const rows=[];
        for(const definition of catalog) {
          await main.invoke('settings_set',{settings:{character:definition.id,characterMusic:definition.id}});
          for(const state of ['idle','music','pause','sleep']) {
            playing=state==='music';await send();
            await main.evaluate(`(async()=>{const {ot,setCharacterCursor}=await import('/assets/runtime-debug.js');setCharacterCursor([120,45]);ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false,pinned:false,holdOpen:false,tall:false,tab:'home',dragOver:null,asleep:${state==='sleep'}});})()`);
            const expectedMood=playing?'music':state==='sleep'?'sleep':'idle';
            await pause(300);
            const sampleCurrent=()=>main.evaluate(`(()=>{
            const pill=document.querySelector('[data-island]'),expectedMood=${JSON.stringify(expectedMood)};
            // AnimatePresence can retain the preceding media/idle slot during its exit.
            const roots=Array.from(pill.querySelectorAll('[data-character="${definition.id}"]'));
            const root=roots.findLast(element=>element.dataset.characterMood===expectedMood)??roots.at(-1);
            const svg=root?.tagName==='svg'?root:root?.querySelector('svg');
            const bitmap=root?.querySelector('[data-bitmap-art]');
            let artwork=null;
            if(svg){const box=svg.getBBox(),matrix=svg.getScreenCTM();
              const points=[[box.x,box.y],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
              artwork={left:points[0].x,top:points[0].y,right:points[1].x,bottom:points[1].y,width:box.width,height:box.height};}
            if(bitmap){const rect=bitmap.getBoundingClientRect();artwork={left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height};}
            const bounds=pill.getBoundingClientRect();
            return {mood:root?.dataset.characterMood,
              nodes:svg?.querySelectorAll('*').length??(bitmap?1:0),artwork,viewport:[innerWidth,innerHeight],
              availability:root?.dataset.petAvailability,frame:root?.dataset.petFrame,
              pill:{width:bounds.width,height:bounds.height},clip:getComputedStyle(pill.querySelector('[data-liquid-clip]')).overflow};
            })()`);
            let sample=await sampleCurrent();
            // Transport updates and AnimatePresence exits are asynchronous. Wait for the
            // requested painted state, rather than accepting an outgoing slot's element.
            const unavailable=definition.source==='codex'&&!optionalReady.get(definition.id);
            for(let attempt=0;definition.id!=='none'&&!unavailable&&(sample.nodes===0||sample.mood!==expectedMood)&&attempt<30;attempt++){
              await send();await pause(100);sample=await sampleCurrent();
            }
            rows.push({...definition,state,...sample});
          }
        }
        assert.equal(rows.length,catalog.length*4);
        for(const row of rows){
          assert(row.pill.width>0&&row.pill.height>0,JSON.stringify(row));
          assert.equal(row.clip,'hidden');
          if(row.id==='none'){assert.equal(row.nodes,0);continue;}
          if(row.source==='codex'&&!optionalReady.get(row.id)){assert(['unavailable','error'].includes(row.availability),JSON.stringify(row));assert.equal(row.nodes,0);continue;}
          if(row.source){assert.equal(row.availability,'ready',JSON.stringify(row));assert.match(row.frame,/^\d+:\d+$/);}
          assert(row.nodes>0,'Drawing missing: '+JSON.stringify(row));
          assert.equal(row.mood,row.state==='music'?'music':row.state==='sleep'?'sleep':'idle',JSON.stringify(row));
          assert(row.artwork.width>0&&row.artwork.height>0,JSON.stringify(row));
          assert(row.artwork.right>0&&row.artwork.left<row.viewport[0]&&row.artwork.bottom>0&&row.artwork.top<row.viewport[1],
            'Drawing outside native viewport: '+JSON.stringify(row));
        }
        measured.push({scale,rows});console.log('Character matrix scale '+scale+': '+rows.length+' frames');
      }
      const focusCheck=await assertPassiveForeground(main);
      const screenshot=await main.command('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(directory,'typed-character-engine.png'),Buffer.from(screenshot.data,'base64'));
      return {builtinCharacters:36,optionalCodex:9,optionalStatus:library.status,plainOption:true,scales:[80,100,150,200],states:['idle','music','pause','sleep'],
        cursor:'Synthetic native coordinates; physical pointer untouched',measured,noFocus:true,...focusCheck};
    }finally{
      clearInterval(timer);await main.invoke('media_pick',{id:null});
      await main.invoke('settings_set',{settings:prior});
      await main.evaluate('(async()=>{const {ot,setCharacterCursor}=await import("/assets/runtime-debug.js");setCharacterCursor(null);ot.setState({mediaLive:false,asleep:false,media:null,expanded:false,palette:false,peek:null,queue:[]});})()');
      await pause(400);
    }
  });
  await check('Approved bitmap pets paint real pixels, track gaze, blink, sleep and freeze in WebView2',async()=>{
    const prior=await main.invoke('settings_get'),measurements=[];
    const ids=approvedBitmapIds;
    const debug="/assets/runtime-debug.js";
    const freeze=enabled=>main.evaluate(`(async()=>{const m=await import(${JSON.stringify(debug)});m.suspendCharacterAnimations('bitmap-native-qa',${enabled});})()`);
    const reset=asleep=>main.evaluate(`(async()=>{const m=await import(${JSON.stringify(debug)});m.ot.setState({mediaLive:false,asleep:${asleep},media:null,expanded:false,palette:false,peek:null,queue:[],hovered:false,holdOpen:false,pinned:false,tall:false,dragOver:null});})()`);
    const sample=id=>main.evaluate(`(()=>{const roots=Array.from(document.querySelector('[data-island]').querySelectorAll('[data-character="${id}"]'));const e=roots.at(-1),a=e?.querySelector('[data-bitmap-art]'),f=e?.querySelector('[data-bitmap-face]');return {mood:e?.dataset.characterMood,state:e?.dataset.petState,animation:e?.dataset.petAnimation,frame:e?.dataset.petFrame,availability:e?.dataset.petAvailability,look:e?.dataset.petLook,face:f&&!f.hidden?getComputedStyle(f).backgroundPosition:null,body:a?getComputedStyle(a).backgroundPosition:null};})()`);
    const screenshot=async()=>Buffer.from((await main.command('Page.captureScreenshot',{format:'png'})).data,'base64');
    // WebView zoom changes CSS coordinates and screenshot surface pixels by
    // different factors. Calibrate full captures, instead of sending CSS crops
    // directly to CDP (80% zoom otherwise samples the black beside the pet).
    const differences=(a,b,rect)=>{const first=rgbaPng(a),second=rgbaPng(b);assert.equal(first.width,second.width);assert.equal(first.height,second.height);const sx=first.width/rect.viewportWidth,sy=first.height/rect.viewportHeight;
      const bounds=[Math.max(0,Math.floor(rect.x*sx)),Math.max(0,Math.floor(rect.y*sy)),Math.min(first.width,Math.ceil((rect.x+rect.width)*sx)),Math.min(first.height,Math.ceil((rect.y+rect.height)*sy))];let changed=0;
      for(let y=bounds[1];y<bounds[3];y++)for(let x=bounds[0];x<bounds[2];x++){const p=(y*first.width+x)*4;if(first.pixels.subarray(p,p+4).some((value,index)=>Math.abs(value-second.pixels[p+index])>3))changed++;}
      return {changed,physicalBounds:bounds,surface:[first.width,first.height],cssToSurface:[sx,sy]};};
    try{
      await main.invoke('media_pick',{id:null});
      await main.invoke('settings_set',{settings:{moduleMedia:false,characterMusic:'',liquidWith:false,showClock:false,showBattery:false,showWeather:false,showCaps:false,layoutInPill:false,desktopInPill:false,agentsStatus:false,obsStatus:false,showPrivacy:false,downloadsInPill:'off',moduleShelf:false,openOnHover:false}});
      await reset(false);
      for(const scale of [80,100,150,200])for(const id of ids){
        await freeze(false);await main.invoke('settings_set',{settings:{scale,character:id}});await reset(false);
        await waitFor(main,`(()=>{const e=document.querySelector('[data-island] [data-character="${id}"]'),a=e?.querySelector('[data-bitmap-art]');return e?.dataset.petAvailability==='ready'&&e.dataset.petFrame&&a&&getComputedStyle(a).backgroundImage!=='none';})()`,id+' painted atlas');await pause(400);await freeze(true);
        const clip=await main.evaluate(`(()=>{const a=document.querySelector('[data-island] [data-character="${id}"] [data-bitmap-art]'),r=a.getBoundingClientRect();return {x:Math.max(0,Math.floor(r.left)),y:Math.max(0,Math.floor(r.top)),width:Math.ceil(r.width)+2,height:Math.ceil(r.height)+2,viewportWidth:innerWidth,viewportHeight:innerHeight};})()`);
        const visible=await screenshot();
        await main.evaluate(`document.querySelector('[data-island] [data-character="${id}"] [data-bitmap-art]').style.visibility='hidden'`);await pause(60);
        const hidden=await screenshot();
        await main.evaluate(`document.querySelector('[data-island] [data-character="${id}"] [data-bitmap-art]').style.visibility=''`);await pause(60);
        const comparison=differences(visible,hidden,clip),painted=comparison.changed;
        if(painted<=12){await fs.writeFile(path.join(directory,`bitmap-${id}-${scale}-visible.png`),visible);await fs.writeFile(path.join(directory,`bitmap-${id}-${scale}-hidden.png`),hidden);const debug=await main.evaluate(`(()=>{const e=document.querySelector('[data-island] [data-character="${id}"]'),a=e?.querySelector('[data-bitmap-art]');return {clip:${JSON.stringify(clip)},sample:${JSON.stringify(await sample(id))},ratio:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight,scale:visualViewport.scale},art:a?{background:getComputedStyle(a).backgroundImage.slice(0,80),position:getComputedStyle(a).backgroundPosition,size:getComputedStyle(a).backgroundSize}:null,ancestors:Array.from((function*(n){while(n){yield n;n=n.parentElement;}})(a)).map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {tag:n.tagName,class:n.className,display:s.display,visibility:s.visibility,opacity:s.opacity,rect:[r.left,r.top,r.width,r.height]};})};})()`);await fs.writeFile(path.join(directory,`bitmap-${id}-${scale}-debug.json`),JSON.stringify(debug,null,2));}
        assert(painted>12,`No bitmap paint at ${id}/${scale}: ${painted}`);
        measurements.push({id,scale,paintedPixels:painted,clip,...comparison});
        console.log(`Bitmap paint ${id}/${scale}: ${painted} pixels`);
        if(scale===100)await fs.writeFile(path.join(directory,`bitmap-${id}.png`),visible);
      }
      const reactions=[];
      await main.invoke('settings_set',{settings:{scale:100}});
      for(const id of ids){
        await freeze(false);await main.invoke('settings_set',{settings:{character:id}});await reset(false);
        await waitFor(main,`document.querySelector('[data-island] [data-character="${id}"]')?.dataset.petAvailability==='ready'`,id+' reaction atlas');
        const looks=[];
        for(const direction of [-1,1]){
          await freeze(false);
          await main.evaluate(`(async()=>{const e=document.querySelector('[data-island] [data-character="${id}"]'),r=e.getBoundingClientRect();for(let n=0;n<5;n++){window.dispatchEvent(new MouseEvent('mousemove',{clientX:r.left+r.width/2+${direction}*250,clientY:r.top+r.height/2}));await new Promise(resolve=>setTimeout(resolve,70));}})()`);
          await freeze(true);const gaze=await sample(id);assert(gaze.face,'Awake face overlay missing: '+id);looks.push(gaze);
        }
        assert.notEqual(looks[0].face,looks[1].face,'Bitmap face must move independently: '+id);
        await freeze(false);
        const timeline=await main.evaluate(`(async()=>{const snapshots=[];for(let n=0;n<230;n++){const e=Array.from(document.querySelector('[data-island]').querySelectorAll('[data-character="${id}"]')).at(-1);snapshots.push({animation:e?.dataset.petAnimation,frame:e?.dataset.petFrame,faceHidden:e?.querySelector('[data-bitmap-face]')?.hidden});await new Promise(resolve=>setTimeout(resolve,35));}return snapshots;})()`);
        assert(new Set(timeline.map(frame=>frame.frame)).size>2,'Bitmap timeline did not animate: '+id);
        assert(timeline.some(frame=>frame.animation==='blink'&&frame.faceHidden),'Automatic bitmap blink missing: '+id);
        await freeze(true);const stillBefore=await sample(id);await pause(350);assert.deepEqual(await sample(id),stillBefore,'Suspended bitmap keeps changing: '+id);
        await freeze(false);await reset(true);await waitFor(main,`document.querySelector('[data-island] [data-character="${id}"]')?.dataset.characterMood==='sleep'`,id+' sleep');await pause(150);
        const sleeping=await sample(id);assert.equal(sleeping.state,'sleep');assert.equal(sleeping.look,'off');assert.equal(sleeping.face,null);
        await reset(false);await waitFor(main,`document.querySelector('[data-island] [data-character="${id}"]')?.dataset.characterMood==='idle'`,id+' wake');
        reactions.push({id,looks,animatedFrames:new Set(timeline.map(frame=>frame.frame)).size,automaticBlink:true,sleeping,frozen:true});
        console.log(`Bitmap reactions ${id}: gaze/blink/sleep/freeze passed`);
      }
      return {paintMeasurements:measurements,reactions,physicalInput:false,...await assertPassiveForeground(main)};
    }finally{await freeze(false);await reset(false);await main.invoke('settings_set',{settings:prior});await pause(300);}
  });
  await check('Local Codex import reads installed atlases, validates checksums and keeps optional settings honest',async()=>{
    const expectedVersion=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
    assert.equal((await main.invoke('bootstrap')).version,expectedVersion,'Native executable version differs from the frontend package');
    const imported=await main.invoke('pets_import_codex');
    assert.equal(imported.pets.length,9);const ready=imported.pets.filter(p=>p.available);
    if(process.env.WOODS_TEST_EXPECT_CODEX==='1')assert.equal(ready.length,9,JSON.stringify(imported));
    for(const pet of ready){
      const image=await main.invoke('pets_asset',{id:pet.id});assert.match(image,/^data:image\/webp;base64,/);
      const bytes=Buffer.from(image.split(',')[1],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),pet.sha256);
      assert.equal(bytes.length,pet.bytes);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    }
    const badId=await main.evaluate(`(async()=>{try{await window.__TAURI_INTERNALS__.invoke('pets_asset',{id:'../secret'});return null;}catch(error){return String(error);}})()`);assert(badId,'Unsafe asset ID must be rejected');
    if(ready.length){const file=path.join(dataDir,'pets','codex',ready[0].id,'sheet.webp'),bytes=await fs.readFile(file),changed=Buffer.from(bytes);changed[changed.length-1]^=1;try{await fs.writeFile(file,changed);const rejected=await main.evaluate(`(async()=>{try{await window.__TAURI_INTERNALS__.invoke('pets_asset',{id:${JSON.stringify(ready[0].id)}});return null;}catch(error){return String(error);}})()`);assert.match(rejected,/checksum/i);}finally{await fs.writeFile(file,bytes);}}
    await main.invoke('open_settings',{section:'character'});const pages=await pagesReady(p=>p.url.endsWith('/settings.html')),settings=await attach(pages.find(p=>p.url.endsWith('/settings.html')));
    await waitFor(settings,'!!document.querySelector("[data-pet-import]")','Local pet import control');
    await waitFor(settings,'!!document.querySelector("[data-pet-library-status]")&&document.querySelector("[data-pet-library-status]").dataset.petLibraryStatus!=="loading"','Local pet settings availability');
    const indexPath=path.join(dataDir,'pets','codex','index.json'),priorIndex=await fs.stat(indexPath).catch(()=>null);
    const importButton=await settings.evaluate(`(async()=>{const button=document.querySelector('[data-pet-import]');button.click();await new Promise(resolve=>setTimeout(resolve,200));for(let n=0;n<200;n++){if(!button.disabled)break;await new Promise(resolve=>setTimeout(resolve,50));}return {disabled:button.disabled,status:document.querySelector('[data-pet-library-status]').dataset.petLibraryStatus,invokeWritable:Object.getOwnPropertyDescriptor(window.__TAURI_INTERNALS__,'invoke')?.writable};})()`);
    assert.equal(importButton.disabled,false,'Import button must become available after completion');
    if(priorIndex){const nextIndex=await fs.stat(indexPath);assert(nextIndex.mtimeMs>priorIndex.mtimeMs,'Import button must rewrite the native profile index');importButton.indexRewritten=true;}
    const options=await settings.evaluate(`Array.from(document.querySelectorAll('[data-character-music] option')).filter(e=>e.value).map(e=>({id:e.value,disabled:e.disabled}))`);
    assert.equal(options.length,45);assert.equal(options.filter(p=>!p.id.startsWith('codex-pet-')).length,36);
    for(const id of approvedBitmapIds)assert(options.some(option=>option.id===id&&!option.disabled),'Approved bitmap is selectable in music settings: '+id);
    assert(!options.some(option=>option.id==='stardust-beetle'),'Rejected beetle draft must not remain selectable');
    for(const option of options.filter(p=>p.id.startsWith('codex-pet-'))){const pet=imported.pets.find(p=>'codex-pet-'+p.id===option.id);assert.equal(option.disabled,!pet.available,option.id);}
    const status=await settings.evaluate('document.querySelector("[data-pet-library-status]")?.dataset.petLibraryStatus');assert(status&&status!=='loading');
    assert(await settings.evaluate('!!document.querySelector("[data-character-option=codex-pet-codex]")'),'Codex group is visible');
    await main.invoke('plugin:window|close',{label:'settings'});await waitForWindowClosed('/settings.html');
    return {status:imported.status,available:ready.length,checksums:ready.map(p=>({id:p.id,bytes:p.bytes,sha256:p.sha256})),badId,tamperRejected:ready.length>0,importButton,settingsOptions:options,localProfileOnly:true,...await assertPassiveForeground(main)};
  });
  await check('Attached tail and legs remain painted inside native bounds through pause, move and scale',async()=>{
    const prior=await main.invoke('settings_get');
    let playing=false,timer,background;
    const measurements=[],geometryOnly=[],desktopProof=[];
    const send=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'attached-fixture',title:'Attached fixture',artist:'Fixture',duration:300000,progress:60000,isPlaying:playing})});
      assert.equal(response.status,200);
    };
    const reset=()=>main.evaluate('(async()=>{const {ot,setCharacterCursor}=await import("/assets/runtime-debug.js");setCharacterCursor([120,45]);ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false,pinned:false,holdOpen:false,tall:false,tab:"home",dragOver:null,asleep:false});})()');
    const sample=()=>main.evaluate(`(${readAttachedPaint.toString()})()`);
    const proveDesktop=async(label)=>{
      const d=await main.invoke('window_diagnostics');
      await main.invoke('plugin:window|set_position',{label:'settings',value:{Physical:{x:d.left-20,y:d.top}}});
      await main.invoke('plugin:window|set_size',{label:'settings',value:{Physical:{width:d.width+40,height:d.height+80}}});
      await main.invoke('plugin:window|show',{label:'settings'});
      await main.invoke('plugin:window|set_always_on_top',{label:'settings',value:true});
      await main.invoke('plugin:window|set_always_on_top',{label:'main',value:false});
      await main.invoke('plugin:window|set_always_on_top',{label:'main',value:true});
      await main.invoke('set_island_hidden',{hidden:false});
      await main.evaluate('(async()=>{const {suspendCharacterAnimations}=await import("/assets/runtime-debug.js");suspendCharacterAnimations("attached-desktop-proof",true);})()');
      try{
        const painted=await sample();
        await main.evaluate('(()=>{const svg=document.querySelector("[data-attached-character]");window.__attachedVisibility=svg.style.visibility;svg.style.visibility="hidden";})()');await pause(150);
        const hidden=await main.invoke('window_diagnostics',{snapshot:true});assert(hidden.snapshot,hidden.snapshotError);
        await main.evaluate('(()=>{document.querySelector("[data-attached-character]").style.visibility=window.__attachedVisibility;})()');await pause(150);
        const visible=await main.invoke('window_diagnostics',{snapshot:true});assert(visible.snapshot,visible.snapshotError);
        for(const key of ['left','top','width','height','bounds','visualBounds'])assert.deepEqual(visible[key],hidden[key],'Attachment visibility changed native geometry: '+key);
        const physical=assertAttachedContainment(painted,visible,label+'/desktop');
        const decode=uri=>Buffer.from(uri.split(',')[1],'base64');
        const a=rgbaPng(decode(hidden.snapshot)),b=rgbaPng(decode(visible.snapshot));
        assert.equal(a.width,b.width);assert.equal(a.height,b.height);
        let changed=0,fixturePixels=0,right=-Infinity,bottom=-Infinity;
        // Expanded pills cast a shadow under the shoes. Check the unobscured
        // background across the canvas, then compare only the SVG's paint box.
        for(let y=80;y<a.height;y+=8)for(let x=0;x<a.width;x+=8){
          const offset=(y*a.width+x)*4;
          if(a.pixels[offset]===185&&a.pixels[offset+1]===212&&a.pixels[offset+2]===56)fixturePixels++;
        }
        for(let y=Math.max(0,Math.floor(physical.top));y<Math.min(a.height,Math.ceil(physical.bottom)+2);y++){
          for(let x=Math.max(0,Math.floor(physical.left));x<Math.min(a.width,Math.ceil(physical.right)+2);x++){
            if(x<=visible.bounds[2]+1&&y<=visible.bounds[3]+1)continue;
            const offset=(y*a.width+x)*4;
            const delta=Math.max(...[0,1,2].map(channel=>Math.abs(a.pixels[offset+channel]-b.pixels[offset+channel])));
            if(delta>20){changed++;right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
          }
        }
        assert(fixturePixels>30,'Isolated solid background missing behind attached paint: '+label);
        if(changed<=10){
          await fs.writeFile(path.join(directory,label.replaceAll('/','-')+'-hidden-debug.png'),decode(hidden.snapshot));
          await fs.writeFile(path.join(directory,label.replaceAll('/','-')+'-visible-debug.png'),decode(visible.snapshot));
          const cdp=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,label.replaceAll('/','-')+'-cdp-debug.png'),Buffer.from(cdp.data,'base64'));
        }
        assert(changed>10,'Native desktop screenshot contains no attached paint outside the hitbox: '+JSON.stringify({label,painted,physical,native:{bounds:visible.bounds,visualBounds:visible.visualBounds,width:visible.width,height:visible.height},fixturePixels,changed}));
        assert(bottom>=physical.bottom-6*visible.pageFactor,'Native desktop clipped the bottom of attached paint: '+JSON.stringify({label,physical,bottom}));
        if(painted.id==='tail')assert(right>=physical.right-8*visible.pageFactor,'Native desktop clipped the tail tip: '+JSON.stringify({label,physical,right}));
        desktopProof.push({label,changed,fixturePixels,right,bottom,physical,native:visible.visualBounds});
        if(/\/200\/(music|expanded|chat)$/.test(label))await fs.writeFile(path.join(directory,label.replaceAll('/','-')+'-desktop.png'),decode(visible.snapshot));
      }finally{
        await main.evaluate('(()=>{const svg=document.querySelector("[data-attached-character]");if(svg&&window.__attachedVisibility!==undefined)svg.style.visibility=window.__attachedVisibility;delete window.__attachedVisibility;})()');
        await main.evaluate('(async()=>{const {suspendCharacterAnimations}=await import("/assets/runtime-debug.js");suspendCharacterAnimations("attached-desktop-proof",false);})()');
      }
    };
    const record=async(label)=>{
      // Several live animation frames catch rotating shoes and the swinging tail.
      const frames=[];
      for(let frame=0;frame<5;frame++){
        const painted=await sample(),native=await main.invoke('window_diagnostics');
        frames.push({sample:painted,native,physical:assertAttachedContainment(painted,native,label)});
        await pause(80);
      }
      measurements.push({label,frames});
      await proveDesktop(label);
      return frames.at(-1);
    };
    try{
      await main.invoke('media_pick',{id:null});
      await main.invoke('settings_set',{settings:{liquidWith:false,showClock:false,showBattery:false,showWeather:false,showCaps:false,layoutInPill:false,desktopInPill:false,agentsStatus:false,obsStatus:false,showPrivacy:false,downloadsInPill:'off',moduleShelf:false,openOnHover:false,lyrics:false,mediaPill:'normal',moduleMedia:true,offsetX:0,captureVisible:true}});
      assert(await main.invoke('open_settings',{section:'general'}));
      const pages=await pagesReady(page=>page.url.endsWith('/settings.html'));
      background=await attach(pages.find(page=>page.url.endsWith('/settings.html')));
      await waitFor(background,'!!document.body','Attached proof background canvas');
      await background.evaluate('(()=>{const e=document.createElement("div");e.id="woods-attached-background";e.style.cssText="position:fixed;inset:0;z-index:2147483647;background:#b9d438;pointer-events:none";document.body.append(e);})()');
      await reset();await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>void send().catch(error=>errors.push({description:error.message})),100);
      for(const id of ['tail','legs'])for(const scale of [80,100,150,200]){
        await main.invoke('settings_set',{settings:{character:id,characterMusic:id,scale}});
        playing=false;await send();await reset();
        await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return !ot.getState().mediaLive;})()','Attached idle after pause grace');
        await pause(850);
        assert.equal((await sample()).mood,'idle');await record(`${id}/${scale}/idle`);
        playing=true;await send();
        await waitFor(main,'!!document.querySelector("[data-media-pill=normal][data-playback-state=playing]")','Attached playing media');
        await pause(850);assert.equal((await sample()).mood,'music');await record(`${id}/${scale}/music`);
        playing=false;await send();
        await waitFor(main,'!!document.querySelector("[data-media-paused]")','Attached immediate pause');
        await pause(350);assert.equal((await sample()).mood,'idle');await record(`${id}/${scale}/pause`);
        await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return !ot.getState().mediaLive;})()','Attached pause collapse');
        await pause(850);await record(`${id}/${scale}/pauseCollapsed`);
        await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"controls",tall:false});})()');
        await pause(1100);const expanded=await record(`${id}/${scale}/expanded`);
        assert(Math.abs(expanded.sample.pill.width-680)<3,'Expanded attachment fixture must test maximum width');
        await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({tab:"chat",tall:true});})()');
        await pause(1100);const chat=await record(`${id}/${scale}/chat`);
        assert(chat.sample.pill.height>=419,'Chat attachment fixture must test maximum height');
        assert(Math.abs(chat.sample.layoutViewportHeight-480)<2,'Transparent overscan changed chat layout viewport');
        await reset();await pause(1000);
        const before=await record(`${id}/${scale}/beforeGeometryOnly`);
        // Block only rectangle reports. Native scale/position must preserve the
        // last attachment insets even when the CSS rectangle stays unchanged.
        await main.evaluate('(async()=>{const {O}=await import("/assets/runtime-debug.js");window.__attachedQa={api:O,reportRect:O.reportRect,blocked:0,root:document.querySelector("[data-attached-character]"),nodes:Array.from(document.querySelectorAll("[data-attached-character] *"))};O.reportRect=function(){window.__attachedQa.blocked++;return Promise.resolve(null);};})()');
        try{
          assert.equal(await main.evaluate('(async()=>{const {O}=await import("/assets/runtime-debug.js");return await O.reportRect(0,0,0,0,false)===null;})()'),true,'Rectangle report override must prevent IPC dispatch');
          const nextScale=scale===200?80:200;
          for(const [kind,patch]of [['move',{offsetX:37}],['scale',{scale:nextScale}],['restore',{offsetX:0,scale}]]){
            assert.deepEqual(await main.invoke('settings_set',{settings:patch}),[]);
            await pause(850);const current=await record(`${id}/${scale}/${kind}WithoutRectReport`);
            const reuse=await main.evaluate('(()=>{const qa=window.__attachedQa,root=document.querySelector("[data-attached-character]");return {sameRoot:root===qa.root,sameNodes:qa.nodes.every(node=>root.contains(node)),blocked:qa.blocked};})()');
            assert(reuse.sameRoot&&reuse.sameNodes,'Native geometry change rebuilt attached DOM');
            assert(reuse.blocked>=1,'Rectangle report override was not exercised');
            for(const key of ['left','top','width','height'])assert(Math.abs(current.sample.pill[key]-before.sample.pill[key])<2,'CSS pill changed in geometry-only test: '+key);
            if(kind==='move')assert(Math.abs(current.native.left-before.native.left-Math.round(37*current.native.scale))<=1,'Native move fixture did not move the window');
            if(kind==='scale')assert.equal(current.native.zoom,nextScale/100);
            geometryOnly.push({id,scale,kind,reuse,native:current.native});
          }
        }finally{
          await main.evaluate('(()=>{window.__attachedQa.api.reportRect=window.__attachedQa.reportRect;delete window.__attachedQa;window.dispatchEvent(new Event("resize"));})()');
        }
        console.log(`Attachment matrix ${id}/${scale}: paint, pause, expanded/chat, move/scale passed`);
      }
      await main.invoke('settings_set',{settings:{character:'none',characterMusic:'none',scale:100}});
      await reset();await pause(850);
      const plain=await main.invoke('window_diagnostics');
      assert.deepEqual(plain.canvasOverscan,[0,0]);assert.equal(plain.width,Math.round(760*plain.scale));
      assert.equal(await sample(),null);
      const focus=await assertPassiveForeground(main);
      return {characters:['tail','legs'],scales:[80,100,150,200],states:['idle','music','pause','pauseCollapsed','expanded','chat'],measurements,geometryOnly,desktopProof,plainReset:true,strokeAndTransformedCorners:true,...focus};
    }finally{
      clearInterval(timer);await main.invoke('media_pick',{id:null});
      await main.evaluate('(()=>{if(window.__attachedQa){window.__attachedQa.api.reportRect=window.__attachedQa.reportRect;delete window.__attachedQa;}})()');
      await main.invoke('set_island_hidden',{hidden:false});
      if(background){
        await main.invoke('plugin:window|hide',{label:'settings'});
        await main.invoke('plugin:window|set_always_on_top',{label:'settings',value:false});
        await background.evaluate('document.getElementById("woods-attached-background")?.remove()');
      }
      await main.invoke('settings_set',{settings:prior});
      await main.evaluate('(async()=>{const {ot,setCharacterCursor}=await import("/assets/runtime-debug.js");setCharacterCursor(null);ot.setState({mediaLive:false,media:null,asleep:false,expanded:false,palette:false,peek:null,queue:[],tall:false,tab:"home"});})()');
      await pause(400);
    }
  });
  await check('Disabled download cards and agent questions suppress their UI events',async()=>{
    const prior=await main.invoke('settings_get');
    const peek=()=>main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().peek?.kind??null;})()');
    const reset=()=>main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[]});})()');
    try{
      for(const [field,event,payload,kind]of [
        ['showDownloads','downloads:done',{id:'audit',path:fixture,name:'fixture.txt',size:1},'download'],
        ['agentsAsk','agents:ask',{id:'audit-question',kind:'permission',agent:'claude',tool:'Read',input:{},until:Date.now()+30000},'agentAsk'],
      ]){
        await main.invoke('settings_set',{settings:{[field]:false}});await reset();
        await main.invoke('plugin:event|emit',{event,payload});await pause(150);assert.notEqual(await peek(),kind);
        await main.invoke('settings_set',{settings:{[field]:true}});await reset();
        await main.invoke('plugin:event|emit',{event,payload});await waitFor(main,`(async()=>{const {ot}=await import('/assets/runtime-debug.js');return ot.getState().peek?.kind==='${kind}';})()`,field+' enabled');
      }
      return {showDownloads:true,agentsAsk:true,disabledAndEnabled:true};
    }finally{await reset();await main.invoke('settings_set',{settings:prior});}
  });
  await check('Optional hover opens after its delay; click remains the default',async()=>{
    const prior=await main.invoke('settings_get');
    const reset=()=>main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false,mediaLive:false});})()');
    try{
      for(const enabled of [false,true]){
        await main.invoke('settings_set',{settings:{openOnHover:enabled,hoverDelayMs:250}});await reset();
        await main.invoke('plugin:event|emit',{event:'hover',payload:true});await pause(100);
        assert.equal(await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().expanded;})()'),false);
        await pause(250);assert.equal(await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().expanded;})()'),enabled);
        await main.invoke('plugin:event|emit',{event:'hover',payload:false});
      }
      return {clickDefault:true,hoverOptIn:true,delay:true};
    }finally{await reset();await main.invoke('settings_set',{settings:prior});}
  });
  await check('Opening the releases page does not leave a fictitious download running',async()=>{
    const result=await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js'),{O:api}=await import('/assets/runtime-debug.js');const original=api.updateInstall;let requests=0;try{api.updateInstall=()=>{requests++;return Promise.resolve(true);};ot.setState({expanded:true,palette:false,peek:null,queue:[],updating:null});ot.getState().installUpdate();await new Promise(r=>setTimeout(r,150));return {requests,updating:ot.getState().updating,expanded:ot.getState().expanded};}finally{api.updateInstall=original;ot.setState({expanded:false,peek:null,queue:[],updating:null});}})()`);
    assert.equal(result.requests,1);assert.equal(result.updating,null);assert.equal(result.expanded,false);return {...result,backendOpenMocked:true};
  });
  await check('WASAPI follows the active player output and animates the liquid spectrum',async()=>{
    const prior=await main.invoke('settings_get');let timer;
    const publish=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'audio-fixture',title:'Audio routing fixture',artist:'Fixture',duration:300000,progress:1000,isPlaying:true})});
    try{
      await main.invoke('settings_set',{settings:{audioOutput:'',character:'liquid',characterMusic:'liquid',liquidWith:true,liquidSpectrum:true,mediaPill:'normal'}});
      await publish();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>publish().catch(error=>errors.push({description:error.message})),120);
      await pause(1700);const samples=[];
      for(let index=0;index<25;index++){
        samples.push(await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js"),s=m.ot.getState();return {level:s.level,bands:s.bands,age:performance.now()-s.bandsAt,path:document.querySelector("[data-island] > svg path")?.getAttribute("d")};})()'));
        await pause(100);
      }
      assert(samples.every(s=>s.bands.length===8&&s.bands.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Number.isFinite(s.level)&&s.level>=0&&s.level<=1));
      assert(samples.every(s=>s.age<700||(s.level===0&&s.bands.every(v=>v===0))),
        'Nonzero live spectrum must remain fresh; silence may stop repeating events');
      const peak=Math.max(...samples.map(s=>s.level)),bandPeak=Math.max(...samples.flatMap(s=>s.bands)),paths=new Set(samples.map(s=>s.path)).size;
      if(process.env.WOODS_TEST_EXPECT_AUDIO==='1'){assert(peak>0.00001,'Expected playing audio must reach WASAPI');assert(bandPeak>0,'Expected spectrum must contain energy');}
      if(peak>0.00001)assert(paths>1,'The liquid contour must change with measured sound');
      assert(samples.every(s=>s.path));return {eightBands:true,liveSpectrumFresh:true,silenceMayBeDeduplicated:true,peak,bandPeak,distinctContours:paths,liveSoundDetected:peak>0.00001,explicitOutputPriority:true};
    }finally{
      clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:{audioOutput:prior.audioOutput,character:prior.character,characterMusic:prior.characterMusic,liquidWith:prior.liquidWith,liquidSpectrum:prior.liquidSpectrum,mediaPill:prior.mediaPill}});await pause(3400);
    }
  });
  await check('Repeated hover keeps the folded pill visible and native styles unchanged',async()=>{
    await main.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}))');
    await waitFor(main,'document.querySelector("[data-island]").getBoundingClientRect().height < 44','Idle pill');
    const original=await main.invoke('window_diagnostics');
    for(let i=0;i<5;i++){
      await main.invoke('hover',{state:true});await pause(120);
      const state=await main.evaluate('(() => {const e=document.querySelector("[data-island]"),r=e.getBoundingClientRect();return {height:r.height,bottom:r.bottom,opacity:getComputedStyle(e.parentElement).opacity};})()');
      assert(state.height>0&&state.bottom>0&&Number(state.opacity)>0,JSON.stringify(state));
      const d=await main.invoke('window_diagnostics');assert.equal(d.exStyle,original.exStyle);
      await main.invoke('hover',{state:false});await pause(120);
    }
  });
  await check('Click expands, Escape collapses', async () => {
    // A startup hotkey warning is a temporary card with its own click target.
    await main.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}))');
    await pause(800);
    await waitFor(main,'document.querySelector("[data-island]").getBoundingClientRect().height < 44','Folded pill after startup cards');
    await pause(300);
    const rect = () => main.evaluate('(() => { const r = document.querySelector("[data-island]").getBoundingClientRect(); return {w:r.width,h:r.height}; })()');
    const before = await rect();
    const point=await main.evaluate('(() => {const r=document.querySelector("[data-island]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await main.command('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await main.command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await main.command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    await pause(1000);
    const after = await rect();
    const screenshot=await main.command('Page.captureScreenshot',{format:'png'});
    await fs.writeFile(path.join(directory,'main-expanded.png'),Buffer.from(screenshot.data,'base64'));
    assert(after.h > before.h + 20, JSON.stringify({before,after,text:await main.evaluate('document.body.innerText.slice(0,300)')}));
    await main.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}))');
    await pause(600);
    const closed = await rect();
    assert(closed.h < after.h);
  });
  await check('Native desktop pixels outside collapsed and expanded island have no glass tint',async()=>{
    assert(await main.invoke('open_settings',{section:'general'}));
    const priorCapture=(await main.invoke('settings_get')).captureVisible;
    await main.invoke('settings_set',{settings:{captureVisible:true}});
    const d=await main.invoke('window_diagnostics');
    const pages=await pagesReady(p=>p.url.endsWith('/settings.html'));
    const background=await attach(pages.find(p=>p.url.endsWith('/settings.html')));
    await waitFor(background,'!!document.body','Settings background canvas');
    await background.evaluate('(() => {const e=document.createElement("div");e.id="woods-qa-background";e.style.cssText="position:fixed;inset:0;z-index:2147483647;background:repeating-conic-gradient(#b9d438 0% 25%,#593292 0% 50%) 0 0/64px 64px;pointer-events:none";document.body.append(e);})()');
    try{
      await main.invoke('plugin:window|set_position',{label:'settings',value:{Physical:{x:d.left-20,y:d.top}}});
      await main.invoke('plugin:window|set_size',{label:'settings',value:{Physical:{width:d.width+40,height:d.height+80}}});
      await main.invoke('plugin:window|show',{label:'settings'});
      await main.invoke('plugin:window|set_always_on_top',{label:'settings',value:true});
      await main.invoke('plugin:window|set_always_on_top',{label:'main',value:true});
      assert.equal(await main.invoke('plugin:window|is_focused',{label:'settings'}),false,'Passive QA must not take keyboard focus');
      const testedStates={};
      for(const mode of ['collapsed','expanded']){
      if(mode==='expanded'){await main.invoke('click');await pause(800);}
      await main.invoke('set_island_hidden',{hidden:true});await pause(350);
      const hidden=await main.invoke('window_diagnostics',{snapshot:true});assert(hidden.snapshot,hidden.snapshotError);
      await main.invoke('set_island_hidden',{hidden:false});await pause(350);
      const visible=await main.invoke('window_diagnostics',{snapshot:true});assert(visible.snapshot,visible.snapshotError);
      const decode=uri=>Buffer.from(uri.split(',')[1],'base64');
      await fs.writeFile(path.join(directory,`desktop-${mode}-hidden.png`),decode(hidden.snapshot));
      await fs.writeFile(path.join(directory,`desktop-${mode}-visible.png`),decode(visible.snapshot));
      const a=rgbaPng(decode(hidden.snapshot)),b=rgbaPng(decode(visible.snapshot));
      assert.equal(a.width,b.width);assert.equal(a.height,b.height);
      const bounds=visible.bounds;assert(bounds);
      if(mode==='expanded')assert(bounds[3]>200,'Expanded panel must actually be open');
      let samples=0,changed=0,fixturePixels=0,pillChanges=0;
      for(let y=88;y<a.height-12;y+=7)for(let x=12;x<a.width-12;x+=7){
        const offset=(y*a.width+x)*4;
        if((a.pixels[offset]===185&&a.pixels[offset+1]===212&&a.pixels[offset+2]===56)||(a.pixels[offset]===89&&a.pixels[offset+1]===50&&a.pixels[offset+2]===146))fixturePixels++;
        if(x>=bounds[0]-48&&x<=bounds[2]+48&&y<=bounds[3]+48)continue;
        samples++;if(a.pixels.subarray(offset,offset+3).compare(b.pixels.subarray(offset,offset+3)))changed++;
      }
      for(let y=Math.max(0,bounds[1]);y<bounds[3];y+=3)for(let x=bounds[0];x<bounds[2];x+=3){const o=(y*a.width+x)*4;if(a.pixels.subarray(o,o+3).compare(b.pixels.subarray(o,o+3)))pillChanges++;}
      assert(fixturePixels>100,'The isolated checkerboard must actually be behind the island');
      assert(samples>100);assert.equal(changed,0,`${changed}/${samples} desktop samples tinted`);
      assert(pillChanges>10,'The island must actually be visible during the comparison');
      testedStates[mode]={samples,changed,fixturePixels,pillChanges};
      }
      return testedStates;
    }finally{
      await main.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}))');
      await main.invoke('set_island_hidden',{hidden:false});
      await main.invoke('plugin:window|hide',{label:'settings'});
      await main.invoke('plugin:window|set_always_on_top',{label:'settings',value:false});
      await background.evaluate('document.getElementById("woods-qa-background")?.remove()');
      await main.invoke('settings_set',{settings:{captureVisible:priorCapture}});
    }
  });
  await check('Notes/chat/timer/launcher groups round-trip', async () => {
    const cases = [ ['note_set','note_get','text','[{"id":"acceptance","title":"Проверка","text":"Сохранено"}]'], ['chat_set','chat_get','json','[{"id":"acceptance","messages":[]}]'], ['timer_set','timer_get','json','{"duration":60,"remaining":60}'], ['launcher_groups_set','launcher_groups_get','json','{"acceptance":[]}'] ];
    for (const [set,get,key,value] of cases) { await main.invoke(set,{[key]:value}); assert.equal(await main.invoke(get),value); persisted.set(get,value); }
  });
  await check('Launcher link and shelf persist', async () => {
    assert(await main.invoke('launcher_add_link',{link:'https://example.com',name:'Acceptance',icon:''}));
    const items = await main.invoke('launcher_list');
    assert(items.some(x=>x.name==='Acceptance'));
    assert(await main.invoke('shelf_add',{paths:[fixture]}));
    assert((await main.invoke('shelf_list')).some(x=>x.path===fixture&&x.exists===true&&x.size>0));
    assert(await fs.stat(path.join(dataDir,'launcher.json')));
    assert(await fs.stat(path.join(dataDir,'shelf.json')));
  });
  await check('Agents state and config ownership are read without changing fixtures',async()=>{
    assert.deepEqual(await main.invoke('agents_connections'),{claude:'off',codex:'taken',opencode:'off'});
    assert(Array.isArray(await main.invoke('agents_now')));
    for(const [name,content]of agentConfigs)assert.equal(await fs.readFile(path.join(agentHome,name),'utf8'),content);
    const denied=await main.evaluate('window.__TAURI_INTERNALS__.invoke("agents_answer",{id:"../outside",verdict:"allow"}).then(()=>({ok:true}),error=>({ok:false,error:String(error)}))');
    assert.equal(denied.ok,false);assert.match(denied.error,/Invalid request ID/);
  });
  await check('Web AI read contract and invalid service rejection',async()=>{
    assert.equal(await main.invoke('web_ai_popped'),null);
    const invalid=await main.evaluate('window.__TAURI_INTERNALS__.invoke("web_ai_embed",{service:"https://invalid.example",x:0,y:0,width:100,height:100,focus:false,word:0}).then(()=>({ok:true}),error=>({ok:false,error:String(error)}))');
    assert.equal(invalid.ok,false);assert.match(invalid.error,/Unknown AI website/);
  });
  await check('Claude single and multiple choices reach the real answer file',async()=>{
    const id='native-choice-fixture';
    const questions=[{question:'Какой режим?',header:'Режим',multiSelect:false,options:[{label:'Быстро'},{label:'Точно'}]},{question:'Что включить?',header:'Модули',multiSelect:true,options:[{label:'Музыка, текст'},{label:'Буфер'},{label:'Заметки'}]}];
    const file=path.join(dataDir,'agents',id+'.json');await fs.mkdir(path.dirname(file),{recursive:true});
    await main.invoke('settings_set',{settings:{agentsAsk:true,agentsStatus:true}});
    await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[]});})()');
    await fs.writeFile(file,JSON.stringify({id,agent:'claude',state:'waiting',project:'Fixture',at:Date.now(),ask:{id,kind:'question',agent:'claude',project:'Fixture',tool:'AskUserQuestion',until:Date.now()+120000,questions}}));
    await waitFor(main,'!!document.querySelector("[data-agent-ask=question]")','Claude question UI');
    await main.evaluate('document.querySelector("[data-ask-choice=Быстро]").click()');
    await waitFor(main,'!!document.querySelector("[data-ask-done]")','Multi-select step');
    assert.equal(await main.evaluate('document.querySelector("[data-ask-done]").disabled'),true);
    await main.evaluate(`document.querySelector('[data-ask-choice="Музыка, текст"]').click();document.querySelector('[data-ask-choice="Буфер"]').click()`);
    assert.equal(await main.evaluate('document.querySelector("[data-ask-done]").disabled'),false);
    await main.evaluate('document.querySelector("[data-ask-done]").click()');
    const answerFile=path.join(dataDir,'agents','answers',id+'.json');
    let answer;for(let i=0;i<50;i++){try{answer=JSON.parse(await fs.readFile(answerFile,'utf8'));break;}catch{}await pause(100);}
    assert.equal(answer?.verdict,'answer');assert.deepEqual(answer.answers,{'Какой режим?':['Быстро'],'Что включить?':['Музыка, текст','Буфер']});
    await fs.rm(file);return {single:true,multiple:true,commaLabel:true,nativeAnswer:true};
  });
  await check('Store inventory and icons are native; launcher accepts an installed AUMID',async()=>{
    const apps=await main.invoke('palette_apps'),store=apps.filter(app=>app.path.startsWith('shell:AppsFolder\\'));
    assert(store.length>0,'Installed Store applications must appear');
    const selected=store[0];assert.equal(selected.kind,'app');assert(selected.aumid.includes('!'));
    const icon=await main.invoke('palette_icon',{path:selected.path});assert.match(icon,/^data:image\/png;base64,/);
    await main.invoke('launcher_add',{paths:[selected.path]});assert((await main.invoke('launcher_list')).some(item=>item.path===selected.path&&item.exists));
    const invalid=await main.evaluate('window.__TAURI_INTERNALS__.invoke("open_path",{path:"shell:AppsFolder\\\\../invalid!id"}).then(()=>false,()=>true)');assert.equal(invalid,true);
    return {storeCount:store.length,icon:true,launcher:true,activationImplementation:'IApplicationActivationManager; actual app activation omitted in passive QA'};
  });
  await check('PPTX attachments preserve presentation order and Unicode text',async()=>{
    const bytes=zipFixture([
      ['ppt/presentation.xml',"<p:presentation xmlns:p='p' xmlns:r='r'><p:sldIdLst><p:sldId id='2' r:id='second'/><p:sldId id='1' r:id='first'/></p:sldIdLst></p:presentation>"],
      ['ppt/_rels/presentation.xml.rels',"<Relationships><Relationship Id='first' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide' Target='slides/slide1.xml'/><Relationship Id='second' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide' Target='slides/slide9.xml'/></Relationships>"],
      ['ppt/slides/slide1.xml',"<p:sld xmlns:p='p' xmlns:a='a'><a:p><a:r><a:t>Первый файл</a:t></a:r></a:p></p:sld>"],
      ['ppt/slides/slide9.xml',"<p:sld xmlns:p='p' xmlns:a='a'><a:p><a:r><a:t>Привет &amp; 🌲</a:t></a:r><a:br/><a:r><a:t>Вторая строка</a:t></a:r></a:p></p:sld>"],
    ]);
    const file=path.join(directory,'presentation.PPTX');await fs.writeFile(file,bytes);
    const imported=await main.invoke('attach_paths',{paths:[file]});assert.deepEqual(imported.errors,[]);assert.equal(imported.items[0].kind,'document');
    const document=JSON.parse(await fs.readFile(path.join(dataDir,'attachments',imported.items[0].id+'.json'),'utf8'));
    assert(document.text.indexOf('Привет & 🌲')<document.text.indexOf('Первый файл'));assert(document.text.includes('🌲\nВторая строка'));
    return {order:true,unicode:true,lineBreaks:true,attachment:true};
  });
  let attachmentId;
  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  await check('Attachments return document/image contracts and missing-file errors',async()=>{
    const imported=await main.invoke('attach_paths',{paths:[fixture,path.join(directory,'missing.txt')]});
    assert(Array.isArray(imported.items)&&Array.isArray(imported.errors));assert.equal(imported.items.length,1);assert.equal(imported.errors.length,1);
    const document=imported.items[0];assert.equal(document.kind,'document');assert.equal(document.name,'fixture.txt');assert(document.chars>0);assert.equal(document.truncated,false);assert.equal(typeof document.id,'string');attachmentId=document.id;
    const image=await main.invoke('attach_data',{name:'pixel.png',data:pixel});assert.equal(image.kind,'image');assert.equal(typeof image.id,'string');assert.match(image.thumb,/^data:image\/png;base64,/);assert.equal(image.items,undefined);
    assert((await fs.readFile(path.join(dataDir,'attachments',`${attachmentId}.json`),'utf8')).includes('Проверка'));
  });
  await check('AI models, UTF-8 streaming, attachment resolution and HTTP error events',async()=>{
    const received=[];
    providerServer=http.createServer(async(request,response)=>{
      if(request.url==='/v1/models'){response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'fixture-model'}]}));return;}
      if(request.url!=='/v1/chat/completions'){response.writeHead(404);response.end();return;}
      let body='';for await(const chunk of request)body+=chunk;const data=JSON.parse(body);received.push(data);
      if(data.messages.some(message=>JSON.stringify(message).includes('force-http-error'))){response.writeHead(429);response.end('fixture rate limit');return;}
      response.setHeader('content-type','text/event-stream');
      if(data.messages.some(message=>JSON.stringify(message).includes('force-cancel'))){
        response.write('data: '+JSON.stringify({choices:[{delta:{content:'pending'}}]})+'\n\n');
        const timer=setTimeout(()=>response.end('data: [DONE]\n\n'),600);
        response.on('close',()=>clearTimeout(timer));return;
      }
      const bytes=Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'Проверка ✓'}}]})+'\n\ndata: [DONE]\n\n');
      response.write(bytes.subarray(0,55));setTimeout(()=>response.end(bytes.subarray(55)),30);
    });
    await new Promise(resolve=>providerServer.listen(0,'127.0.0.1',resolve));
    const prior=await main.invoke('settings_get');
    try{
      await main.invoke('settings_set',{settings:{aiBaseUrl:`http://127.0.0.1:${providerServer.address().port}/v1`,aiModel:'fixture-model'}});
      assert.deepEqual(await main.invoke('ai_models'),['fixture-model']);
      for(const name of ['ai:chunk','ai:done','ai:error'])await listen(main,name);
      const id=Date.now()*1000+1;
      await main.invoke('ai_chat',{id,messages:[{role:'user',content:'Fixture stream',attachments:attachmentId?[attachmentId]:[]}]});
      await waitFor(main,`window.__woodsEvents['ai:done'].includes(${id})||window.__woodsEvents['ai:error'].some(e=>e.id===${id})`,'AI streaming result');
      assert((await main.evaluate("window.__woodsEvents['ai:done']")).includes(id));
      const chunks=await main.evaluate("window.__woodsEvents['ai:chunk']");assert.equal(chunks.filter(e=>e.id===id).map(e=>e.text).join(''),'Проверка ✓');
      assert(received[0].messages[0].content.some(c=>c.type==='text'&&c.text.includes('Проверка')),'Attachment text must reach the provider');
      const failedId=id+1;
      await main.invoke('ai_chat',{id:failedId,messages:[{role:'user',content:'force-http-error'}]});
      await waitFor(main,`window.__woodsEvents['ai:error'].some(e=>e.id===${failedId})`,'AI error');
      const error=(await main.evaluate("window.__woodsEvents['ai:error']")).find(e=>e.id===failedId);assert.equal(typeof error.id,'number');assert.match(error.message,/429/);
      const cancelledId=id+2;
      await main.invoke('ai_chat',{id:cancelledId,messages:[{role:'user',content:'force-cancel'}]});
      await waitFor(main,`window.__woodsEvents['ai:chunk'].some(e=>e.id===${cancelledId})`,'AI cancellation fixture start');
      assert.equal(await main.invoke('ai_cancel',{id:cancelledId}),true);
      await pause(800);
      assert(!(await main.evaluate("window.__woodsEvents['ai:done']")).includes(cancelledId));
      assert(!(await main.evaluate("window.__woodsEvents['ai:error']")).some(e=>e.id===cancelledId));
    }finally{await main.invoke('settings_set',{settings:{aiBaseUrl:prior.aiBaseUrl,aiModel:prior.aiModel}});await new Promise(resolve=>providerServer.close(resolve));providerServer=null;}
  });
  await check('OBS v5 handshake authenticates, reads state and rejects bad password',async()=>{
    let WebSocketServer;
    try{WebSocketServer=require('ws').WebSocketServer;}catch{
      const runtime=process.env.WOODS_TEST_WS_MODULE||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright-core','lib','utilsBundle.js');
      WebSocketServer=require(runtime).wsServer;
    }
    const password='woods-island-fixture-only';const salt='fixture-salt';const challenge='fixture-challenge';
    const hash=value=>createHash('sha256').update(value).digest('base64');const authentication=hash(hash(password+salt)+challenge);
    const requests=[];let authenticated=0;
    obsServer=new WebSocketServer({port:0,host:'127.0.0.1'});
    await new Promise(resolve=>obsServer.once('listening',resolve));
    obsServer.on('connection',socket=>{
      socket.send(JSON.stringify({op:0,d:{obsWebSocketVersion:'5.5.0',rpcVersion:1,authentication:{salt,challenge}}}));
      socket.on('message',bytes=>{
        const message=JSON.parse(bytes.toString());
        if(message.op===1){if(message.d.authentication!==authentication){socket.close(4009,'Authentication failed');return;}authenticated++;socket.send(JSON.stringify({op:2,d:{negotiatedRpcVersion:1}}));return;}
        if(message.op!==6)return;requests.push(message.d.requestType);
        const known=['GetStreamStatus','GetRecordStatus'].includes(message.d.requestType);
        socket.send(JSON.stringify({op:7,d:{requestType:message.d.requestType,requestId:message.d.requestId,requestStatus:{result:known,code:known?100:204},responseData:{outputActive:false,outputPaused:false,outputDuration:321}}}));
      });
    });
    const prior=await main.invoke('settings_get');
    try{
      await main.invoke('settings_set',{settings:{obsPort:obsServer.address().port,obsStatus:false}});
      await main.invoke('obs_password_set',{password:'incorrect-fixture-password'});
      const denied=await main.invoke('obs_state');assert.equal(denied.connected,false);assert.equal(typeof denied.problem,'string');
      await main.invoke('obs_password_set',{password});assert.equal(await main.invoke('obs_password_status'),true);
      const state=await main.invoke('obs_state');assert.equal(state.connected,true);assert.equal(state.streaming,false);assert.equal(state.recording,false);assert.equal(state.streamDuration,321);assert(authenticated>0);
      assert(requests.includes('GetStreamStatus')&&requests.includes('GetRecordStatus'));assert(requests.every(name=>name.startsWith('Get')));
      return {authenticated,requests};
    }finally{
      await main.invoke('obs_password_set',{password:''});await main.invoke('settings_set',{settings:{obsPort:prior.obsPort,obsStatus:prior.obsStatus}});
      for(const client of obsServer.clients)client.terminate();await new Promise(resolve=>obsServer.close(resolve));obsServer=null;
    }
  });
  await check('Native screen capture produces real PNG and dimensions',async()=>{
    await listen(main,'capture:done');const size=await main.invoke('picker_size');
    await main.invoke('capture_region',{x:0,y:0,w:160/size[0],h:90/size[1],mode:'area'});
    await waitFor(main,"window.__woodsEvents['capture:done'].some(e=>e.kind==='screenshot')",'Capture result');
    const capture=(await main.evaluate("window.__woodsEvents['capture:done']")).find(e=>e.kind==='screenshot');
    assert(path.resolve(capture.path).startsWith(path.resolve(dataDir)+path.sep));
    const bytes=await fs.readFile(capture.path);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),capture.width);assert.equal(bytes.readUInt32BE(20),capture.height);
    assert(Math.abs(capture.width-160)<=1&&Math.abs(capture.height-90)<=1);return {path:capture.path,width:capture.width,height:capture.height};
  });
  await check('Windows OCR recognizes actual rendered text from a PNG',async()=>{
    const text=await main.invoke('ocr_file',{path:path.join(root,'docs','qa','ocr-fixture.png')});
    assert.match(text,/Woods\s+Island\s+2048/i);return {text:text.trim()};
  });
  await check('MP4 screen recording contains video and WASAPI system audio',async()=>{
    const prior=await main.invoke('settings_get');const size=await main.invoke('picker_size');let recording=false;
    try{
      await main.invoke('settings_set',{settings:{recordingSound:'system',recordingFps:15,recordingQuality:'low',recordingDir:path.join(dataDir,'Recordings')}});
      await listen(main,'record:done');
      assert.equal(await main.invoke('record_begin',{x:0,y:0,w:160/size[0],h:90/size[1],format:'mp4'}),true);recording=true;
      await pause(1500);assert.equal(await main.invoke('record_stop'),true);recording=false;
      await waitFor(main,"window.__woodsEvents['record:done'].some(e=>e?.path)",'Recording result');
      const video=(await main.evaluate("window.__woodsEvents['record:done']")).find(e=>e?.path);
      assert(path.resolve(video.path).startsWith(path.resolve(dataDir)+path.sep));assert((await fs.stat(video.path)).size>0);
      const ffprobe=process.env.WOODS_TEST_FFPROBE||path.join(root,'src-tauri','resources','bin','ffprobe.exe');
      const probe=spawnSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',video.path],{windowsHide:true,encoding:'utf8',timeout:15000});
      assert.equal(probe.status,0,probe.stderr||probe.error?.message);const metadata=JSON.parse(probe.stdout);
      assert(metadata.streams.some(s=>s.codec_type==='video'&&s.width===160&&s.height===90));assert(metadata.streams.some(s=>s.codec_type==='audio'&&s.sample_rate>0));assert(Number(metadata.format.duration)>0);
      return {path:video.path,streams:metadata.streams.map(s=>({type:s.codec_type,codec:s.codec_name})),duration:metadata.format.duration};
    }finally{
      if(recording)await main.invoke('record_stop').catch(()=>{});
      await main.invoke('settings_set',{settings:{recordingSound:prior.recordingSound,recordingFps:prior.recordingFps,recordingQuality:prior.recordingQuality,recordingDir:prior.recordingDir}});
    }
  });
  await check('Image editor loads and saves its isolated fixture without clipboard writes',async()=>{
    const imagePath=path.join(directory,'editor-fixture.png');await fs.writeFile(imagePath,Buffer.from(pixel.split(',')[1],'base64'));
    assert.equal(await main.invoke('editor_open',{path:imagePath}),true);
    const current=await pagesReady(p=>p.url.endsWith('/editor.html'));const editor=await attach(current.find(p=>p.url.endsWith('/editor.html')));
    await waitFor(editor,'document.querySelectorAll("canvas").length>0','Editor canvas');
    const image=await editor.invoke('editor_image');assert.match(image.dataUrl,/^data:image\/png;base64,/);
    assert.equal(await editor.invoke('editor_save',{dataUrl:image.dataUrl,copy:false}),true);
    assert.equal((await fs.readFile(imagePath)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    await main.invoke('plugin:window|close',{label:'editor'});
    await waitForWindowClosed('/editor.html');
    assert(await main.invoke('editor_open',{path:imagePath}));
    const reopened=await pagesReady(page=>page.url.endsWith('/editor.html'));
    const fresh=await attach(reopened.find(page=>page.url.endsWith('/editor.html')));
    await waitFor(fresh,'document.querySelectorAll("canvas").length>0','Recreated editor canvas');
    assert.equal(await fresh.invoke('plugin:window|is_focused',{label:'editor'}),false);
    assert.match((await fresh.invoke('editor_image')).dataUrl,/^data:image\/png;base64,/);
    await main.invoke('plugin:window|close',{label:'editor'});
    await waitForWindowClosed('/editor.html');
    const size=await main.invoke('picker_size');assert(Array.isArray(size)&&size.length===2&&size.every(n=>n>0));
    return {rendererReleased:true,recreatedWithoutFocus:true,persistedImage:true};
  });
  await check('Settings UI renders after repeated harmless toggles', async () => {
    await main.invoke('open_settings',{section:'appearance'});
    const current = await pagesReady(p=>p.url.endsWith('/settings.html'));
    const settingsPage = current.find(p=>p.url.endsWith('/settings.html'));
    assert(settingsPage);
    const settings = await attach(settingsPage);
    assert.equal(await main.invoke('plugin:window|is_focused',{label:'settings'}),false,'Settings must remain passive during QA');
    await waitFor(settings,'document.querySelectorAll("[data-nav]").length>=8','Settings navigation');
    assert.equal(await settings.evaluate('document.querySelector("h1").textContent'),'Woods Island');
    assert(await settings.evaluate('Number(document.querySelector("[data-nav=pro] svg circle")?.getAttribute("r"))===10'),'About uses the information icon');
    const sections=await settings.evaluate('Array.from(document.querySelectorAll("[data-nav]")).map(e=>e.dataset.nav)');
    const controlsBySection=[];
    for(const section of sections){
      await settings.evaluate(`document.querySelector('[data-nav="${section}"]').click()`);
      await pause(80);
      assert(await settings.evaluate(`document.querySelector('[data-nav="${section}"]').dataset.now==='true'`),section);
      const count=await settings.evaluate(`(()=>{const e=document.getElementById('${section}');return {switches:e?.querySelectorAll('[role=switch]').length??0,inputs:e?.querySelectorAll('input,textarea,select').length??0};})()`);
      controlsBySection.push({section,...count});
    }
    await settings.evaluate('document.querySelector("[data-nav=character]").click()');await pause(100);
    const characters=await settings.evaluate('Array.from(document.querySelectorAll("[data-character-music] option")).map(e=>e.value).filter(Boolean)');
    assert.equal(characters.length,45);
    const previousCharacter=(await main.invoke('settings_get')).character;
    for(const character of characters){await main.invoke('settings_set',{settings:{character}});await pause(70);assert(await main.evaluate('!!document.querySelector("[data-island]")'));}
    await main.invoke('settings_set',{settings:{character:previousCharacter}});
    await settings.evaluate('document.querySelector("[data-nav=pro]").click()');await pause(100);
    const about=await settings.evaluate('document.querySelector("[data-woods-about]").textContent');
    assert(about.includes('Woods Island')&&about.includes('Obsidian'));
    assert(!about.includes('Проба')&&!about.includes('Купить'));
    assert.equal(await settings.evaluate('document.querySelectorAll("[data-pro-mark]").length'),0);
    const contact=await settings.evaluate('document.querySelector("[data-woods-contact]").textContent');assert(contact.includes('@woodskilla'));
    const aboutShot=await settings.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'about-woods.png'),Buffer.from(aboutShot.data,'base64'));
    await settings.invoke('settings_set',{settings:{language:'en'}});await pause(250);
    assert((await settings.evaluate('document.querySelector("[data-woods-about]").textContent')).includes('All features available'));
    await settings.invoke('settings_set',{settings:{language:'ru'}});
    for(let i=0;i<6;i++) await settings.invoke('settings_set',{settings:{clockSeconds:i%2===0}});
    await pause(300);
    assert(await settings.evaluate('document.querySelectorAll("button").length > 10'));
    const screenshot=await settings.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'settings.png'),Buffer.from(screenshot.data,'base64'));
    await main.invoke('plugin:window|close',{label:'settings'});
    await waitForWindowClosed('/settings.html');
    assert(await main.invoke('open_settings',{section:'general'}));
    const reopened=await pagesReady(page=>page.url.endsWith('/settings.html'));
    const fresh=await attach(reopened.find(page=>page.url.endsWith('/settings.html')));
    await waitFor(fresh,'document.querySelectorAll("button").length>10','Recreated settings UI');
    await waitFor(fresh,'document.querySelector("[data-nav=general]")?.dataset.now==="true"','Requested settings section after recreation');
    assert.equal(await fresh.invoke('plugin:window|is_focused',{label:'settings'}),false);
    return {sections,controlsBySection,charactersMounted:characters.length,rendererReleased:true,recreatedWithoutFocus:true};
  });
  await check('Notes button exports Markdown to Obsidian without overwriting files',async()=>{
    const loadedAssets=async()=>{
      const resources=await main.command('Page.getResourceTree');
      const collect=tree=>[...(tree.resources??[]).map(resource=>resource.url),...(tree.childFrames??[]).flatMap(collect)];
      return collect(resources.frameTree);
    };
    assert.equal((await loadedAssets()).some(name=>name.includes('vendor-editor-')),false,'Rich editor must not load before notes');
    const vault=path.join(directory,'vault');await fs.mkdir(vault);
    await main.invoke('settings_set',{settings:{obsidianVaultPath:vault}});
    const markdown='## Проверка Obsidian\n\n**Важное**\n- [ ] План';
    await main.invoke('note_set',{text:markdown});persisted.set('note_get',markdown);
    await main.invoke('note');
    await waitFor(main,'!!document.querySelector("[data-note-export]")','Obsidian export button');
    await waitFor(main,'!!document.querySelector("[data-note-editor]")','Lazy rich editor');
    const editorResources=await loadedAssets();
    assert(editorResources.some(name=>name.includes('vendor-editor-')),JSON.stringify(editorResources));
    await main.evaluate('document.querySelector("[data-note-export]").click()');
    const folder=path.join(vault,'Woods Island');
    for(let i=0;i<100;i++){if((await fs.readdir(folder).catch(()=>[])).length)break;await pause(100);}
    const first=(await fs.readdir(folder)).find(name=>name.endsWith('.md'));assert(first);
    assert.equal(await fs.readFile(path.join(folder,first),'utf8'),markdown);
    await main.evaluate('document.querySelector("[data-note-export]").click()');
    for(let i=0;i<100;i++){if((await fs.readdir(folder)).length>=2)break;await pause(100);}
    assert.equal((await fs.readdir(folder)).filter(name=>name.endsWith('.md')).length,2);
    assert.equal(await fs.readFile(path.join(folder,first),'utf8'),markdown);
    return {folder};
  });
  await check('Steam progress and completion use actual manifest changes',async()=>{
    const apps=path.join(directory,'steam','steamapps');await fs.mkdir(apps,{recursive:true});
    const manifest=path.join(apps,'appmanifest_42.acf');
    const write=bytes=>fs.writeFile(manifest,`"AppState" { "appid" "42" "name" "Проверка Steam" "installdir" "fixture" "StateFlags" "${bytes<500?1024:4}" "BytesToDownload" "500" "BytesDownloaded" "${bytes}" }`);
    await listen(main,'downloads:update');await listen(main,'downloads:done');await write(100);
    await pause(1300);assert(!(await main.evaluate(`window.__woodsEvents['downloads:update'].at(-1) ?? []`)).some(d=>d.id==='steam:42'),'Stale counters must not appear as an active download');
    await write(200);
    await waitFor(main,`window.__woodsEvents['downloads:update'].some(a=>a.some(d=>d.id==='steam:42'&&d.size===200&&d.total===500))`,'Steam in-progress manifest');
    await write(300);
    await waitFor(main,`window.__woodsEvents['downloads:update'].some(a=>a.some(d=>d.id==='steam:42'&&d.size===300&&d.speed>0))`,'Steam measured speed');
    await main.invoke('settings_set',{settings:{steamDownloads:false}});await pause(1200);
    assert(!(await main.evaluate(`window.__woodsEvents['downloads:update'].at(-1) ?? []`)).some(d=>d.id==='steam:42'));
    await main.invoke('settings_set',{settings:{steamDownloads:true}});await pause(1200);
    await write(350);await waitFor(main,`window.__woodsEvents['downloads:update'].some(a=>a.some(d=>d.id==='steam:42'&&d.size===350))`,'Steam resumed transfer');
    await write(500);await waitFor(main,`window.__woodsEvents['downloads:done'].some(d=>d.id==='steam:42')`,'Steam completion');
    return {progress:true,speed:true,completion:true,setting:true};
  });
  await check('Virtual desktop telemetry reaches the real frontend store',async()=>{
    const desk=await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");return m.ot.getState().vdesk;})()');
    assert(desk&&desk.count>=1&&desk.index>=1&&desk.index<=desk.count);return desk;
  });
  await check('Restart restores settings, notes, chat, timer, launcher and shelf',async()=>{
    await main.invoke('settings_set',{settings:{scale:150}});
    await quit(main);await launch();
    const restarted=await pagesReady();main=await attach(restarted.find(p=>p.url==='http://tauri.localhost/'));
    await waitFor(main,'!!document.querySelector("[data-island]")','Restarted main UI');
    const settings=await main.invoke('settings_get');assert.equal(settings.opacityRest,93);assert.equal(settings.weatherCity,'Брянск');assert.equal(settings.clockSeconds,false);
    assert.equal(settings.scale,150);await pause(500);const geometry=await main.invoke('window_diagnostics');assert.equal(geometry.width,Math.round(760*geometry.scale*1.5));
    for(const [get,value]of persisted)assert.equal(await main.invoke(get),value,get);
    assert((await main.invoke('launcher_list')).some(x=>x.name==='Acceptance'));
    assert((await main.invoke('shelf_list')).some(x=>x.path===fixture));
    for(const [name,content]of agentConfigs)assert.equal(await fs.readFile(path.join(agentHome,name),'utf8'),content);
  });
  await check('No unhandled frontend exceptions', async () => { assert.equal(errors.length,0, JSON.stringify(errors).slice(0,1000)); });
  await check('Explicit quit exits the application', async () => {
    await quit(main);
  });
  const report = { directory, testedExe: suppliedExe, sha256:createHash('sha256').update(await fs.readFile(exe)).digest('hex'), passiveQa:true, results, frontendErrors: errors };
  if(testFilter&&matchedChecks===0)results.push({name:'Test filter matches an acceptance check',ok:false,error:'No acceptance check matched WOODS_TEST_FILTER'});
  await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));
  console.log(`REPORT ${path.join(directory,'report.json')}`);
  console.log(`${results.filter(r=>r.ok&&!r.skipped).length}/${results.filter(r=>!r.skipped).length} passed; ${results.filter(r=>r.skipped).length} skipped`);
  process.exitCode = results.some(r=>!r.ok)||errors.length>0 ? 1 : 0;
})().catch(error=>{ console.error(error.stack); process.exitCode=2; }).finally(()=>{
  for(const ws of connections) ws.close();
  if(proc && proc.exitCode===null) proc.kill();
  if(providerServer)providerServer.close();
  if(weatherServer)weatherServer.close();
  if(obsServer){for(const client of obsServer.clients)client.terminate();obsServer.close();}
});
