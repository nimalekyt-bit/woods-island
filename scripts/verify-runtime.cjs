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
const root = path.resolve(__dirname, '..');
const suppliedExe = process.argv[2] || path.join(root, 'src-tauri', 'target', 'release', 'woods-island.exe');
const port = Number(process.env.WOODS_TEST_CDP_PORT || 9334);
const musicPort = port + 1; // Isolated bridge: never send fixtures to the user's player.
const results = [];
const errors = [];
let proc;
let connections = [];
let providerServer;
let obsServer;
let weatherServer;

// Read native desktop PNGs without a separate browser renderer or image library.
function rgbaPng(bytes) {
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(bytes[24],8);assert.equal(bytes[25],6);assert.equal(bytes[28],0);
  const chunks=[];
  for(let p=8;p<bytes.length;){const size=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')chunks.push(bytes.subarray(p+8,p+8+size));p+=size+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert(filter<=4);
    for(let x=0;x<stride;x++){
      const index=y*stride+x,a=x>=4?pixels[index-4]:0,b=y?pixels[index-stride]:0,c=y&&x>=4?pixels[index-stride-4]:0;
      const prediction=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      pixels[index]=(raw[y*(stride+1)+1+x]+prediction)&255;
    }
  }
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
    pending.set(next, { resolve, reject, timer: setTimeout(() => { pending.delete(next); reject(new Error(`${method} timeout`)); }, 20000) });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  await command('Runtime.enable');
  const evaluate = async expression => (await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  const invoke = (name, args = {}) => evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
  connections.push(ws);
  return { ws, evaluate, invoke, command };
}

async function check(name, task) {
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
  const tempRoot = path.join(os.tmpdir(), 'woodscorp_obs');
  await fs.mkdir(tempRoot,{recursive:true});
  const directory = await fs.mkdtemp(path.join(tempRoot, 'island-acceptance-'));
  const exe = path.join(directory, 'woods-island.exe');
  await fs.copyFile(suppliedExe, exe);
  const dataDir = path.join(directory, 'data');
  await fs.mkdir(dataDir);
  let weatherRequests=0, lyricsRequests=0;
  const weatherStart=Math.floor(Date.now()/3600000)*3600;
  const weatherFixture={properties:{timeseries:Array.from({length:168},(_,i)=>({time:new Date((weatherStart+i*3600)*1000).toISOString(),data:{instant:{details:{air_temperature:2+i%4,wind_speed:3,relative_humidity:80,air_pressure_at_sea_level:1012,wind_from_direction:180}},next_1_hours:{summary:{symbol_code:i%2?'cloudy_day':'lightrain_night'},details:{precipitation_amount:0.4}}}}))}};
  weatherServer=http.createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url.startsWith('/lyrics')){
      lyricsRequests++;const query=new URL(req.url,'http://localhost').searchParams;
      if(query.get('track_name')==='Missing'){res.statusCode=404;res.end('{}');return;}
      if(query.get('track_name')==='Unavailable'){res.statusCode=503;res.end('{}');return;}
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
    proc = spawn(exe, [], { cwd: directory, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, APPDATA: path.join(directory, 'appdata'), WOODS_ISLAND_DATA_DIR: dataDir, WOODS_ISLAND_AGENT_HOME:agentHome, WOODS_ISLAND_STEAM_PATH:path.join(directory,'steam'), WOODS_ISLAND_MUSIC_PORT:String(musicPort), WOODS_ISLAND_WEATHER_URL:weatherUrl, WOODS_ISLAND_LYRICS_URL:weatherUrl.replace('/forecast','/lyrics'), WOODS_ISLAND_PASSIVE_QA:'1', WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
    proc.stdout.on('data', data => process.stdout.write(data));
    proc.stderr.on('data', data => process.stderr.write(data));
    proc.on('exit', (code, signal) => console.log(`Native process exited: code=${code}, signal=${signal}`));
    await new Promise((resolve, reject) => { proc.once('spawn', resolve); proc.once('error', reject); });
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
    assert.equal(boot.version, '1.0.0');
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
    await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:true,tab:"controls"});})()');
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
    await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:false,tab:"home"});})()');
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
    const open=()=>main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:true,tab:"weather"});})()');
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
    await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:false,tab:"home"});})()');await pause(600);
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
  await check('LRCLIB milliseconds highlight, advance, pause and seek the rendered lyrics',async()=>{
    const prior=await main.invoke('settings_get');let progress=1000,playing=true,at=Date.now(),timer;
    const publish=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'lyrics-fixture',title:'Test Slowed',artist:'Fixture',duration:12000,progress:Math.min(12000,progress+(playing?Date.now()-at:0)),isPlaying:playing})});
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
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Первая строка"','First active lyrics line');
      progress=3500;playing=true;at=Date.now();await publish();
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Вторая строка"','Lyrics progress while playing');
      progress=6000;playing=false;at=Date.now();await publish();await pause(450);
      assert.equal(await nowText(),'Вторая строка');await pause(1000);assert.equal(await nowText(),'Вторая строка');
      progress=0;at=Date.now();await publish();
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Первая строка"','Lyrics seek backwards');
      progress=9000;at=Date.now();await publish();
      await waitFor(main,'document.querySelector("[data-lyrics-now]")?.textContent === "Третья строка"','Lyrics seek forwards');
      await waitFor(main,'Number(getComputedStyle(document.querySelector("[data-lyrics-now]")).opacity) >= 0.99','Lyrics highlight animation');
      const active=await main.evaluate('(()=>{const e=document.querySelector("[data-lyrics-now]");return {color:getComputedStyle(e).color,weight:getComputedStyle(e).fontWeight,opacity:getComputedStyle(e).opacity};})()');
      assert(Number(active.weight)>=600);assert(Number(active.opacity)>=0.99);
      await main.invoke('settings_set',{settings:{mediaPill:'lyrics'}});
      await waitFor(main,'document.querySelector("[data-media-pill=lyrics] [data-lyrics-line]")?.textContent.includes("Третья строка")','Folded lyrics mode');
      await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:true,tab:"home"});})()');
      await waitFor(main,'document.querySelector("[data-home] [data-lyrics-now]")?.textContent === "Третья строка"','Home lyrics mode');
      assert(lyricsRequests>=4);return {milliseconds:true,highlight:true,advance:true,pause:true,seekBothDirections:true,foldedLyrics:true,homeLyrics:true,missing404:true,retryable503:true,isolatedBridge:true};
    }finally{
      clearInterval(timer);await main.invoke('media_pick',{id:null});await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");m.ot.setState({expanded:false,tab:"home"});})()');
      await main.invoke('settings_set',{settings:{lyrics:prior.lyrics,lyricsInPlayer:prior.lyricsInPlayer,lyricsInHome:prior.lyricsInHome,mediaPill:prior.mediaPill}});await pause(3400);
    }
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
        samples.push(await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js"),s=m.ot.getState();return {level:s.level,bands:s.bands,age:performance.now()-s.bandsAt,path:document.querySelector("[data-island] > svg path")?.getAttribute("d")};})()'));
        await pause(100);
      }
      assert(samples.every(s=>s.bands.length===8&&s.bands.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Number.isFinite(s.level)&&s.level>=0&&s.level<=1&&s.age<700));
      const peak=Math.max(...samples.map(s=>s.level)),bandPeak=Math.max(...samples.flatMap(s=>s.bands)),paths=new Set(samples.map(s=>s.path)).size;
      if(process.env.WOODS_TEST_EXPECT_AUDIO==='1'){assert(peak>0.00001,'Expected playing audio must reach WASAPI');assert(bandPeak>0,'Expected spectrum must contain energy');}
      if(peak>0.00001)assert(paths>1,'The liquid contour must change with measured sound');
      assert(samples.every(s=>s.path));return {eightBands:true,fresh:true,peak,bandPeak,distinctContours:paths,liveSoundDetected:peak>0.00001,explicitOutputPriority:true};
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
    const priorCapture=(await main.invoke('settings_get')).captureVisible;
    await main.invoke('settings_set',{settings:{captureVisible:true}});
    const d=await main.invoke('window_diagnostics');
    const pages=await pagesReady(p=>p.url.endsWith('/settings.html'));
    const background=await attach(pages.find(p=>p.url.endsWith('/settings.html')));
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
    await editor.invoke('plugin:window|hide',{label:'editor'});
    const size=await main.invoke('picker_size');assert(Array.isArray(size)&&size.length===2&&size.every(n=>n>0));
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
    for(const section of sections){
      await settings.evaluate(`document.querySelector('[data-nav="${section}"]').click()`);
      await pause(80);
      assert(await settings.evaluate(`document.querySelector('[data-nav="${section}"]').dataset.now==='true'`),section);
    }
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
    return {sections};
  });
  await check('Notes button exports Markdown to Obsidian without overwriting files',async()=>{
    const vault=path.join(directory,'vault');await fs.mkdir(vault);
    await main.invoke('settings_set',{settings:{obsidianVaultPath:vault}});
    const markdown='## Проверка Obsidian\n\n**Важное**\n- [ ] План';
    await main.invoke('note_set',{text:markdown});persisted.set('note_get',markdown);
    await main.invoke('note');
    await waitFor(main,'!!document.querySelector("[data-note-export]")','Obsidian export button');
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
    await pause(1300);assert(!(await main.evaluate(`window.__woodsEvents['downloads:update'].at(-1)`)).some(d=>d.id==='steam:42'),'Stale counters must not appear as an active download');
    await write(200);
    await waitFor(main,`window.__woodsEvents['downloads:update'].some(a=>a.some(d=>d.id==='steam:42'&&d.size===200&&d.total===500))`,'Steam in-progress manifest');
    await write(300);
    await waitFor(main,`window.__woodsEvents['downloads:update'].some(a=>a.some(d=>d.id==='steam:42'&&d.size===300&&d.speed>0))`,'Steam measured speed');
    await main.invoke('settings_set',{settings:{steamDownloads:false}});await pause(1200);
    assert(!(await main.evaluate(`window.__woodsEvents['downloads:update'].at(-1)`)).some(d=>d.id==='steam:42'));
    await main.invoke('settings_set',{settings:{steamDownloads:true}});await pause(1200);
    await write(350);await waitFor(main,`window.__woodsEvents['downloads:update'].some(a=>a.some(d=>d.id==='steam:42'&&d.size===350))`,'Steam resumed transfer');
    await write(500);await waitFor(main,`window.__woodsEvents['downloads:done'].some(d=>d.id==='steam:42')`,'Steam completion');
    return {progress:true,speed:true,completion:true,setting:true};
  });
  await check('Virtual desktop telemetry reaches the real frontend store',async()=>{
    const desk=await main.evaluate('(async()=>{const m=await import("/assets/Liquid-BbsJJY6K.js");return m.ot.getState().vdesk;})()');
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
  await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));
  console.log(`REPORT ${path.join(directory,'report.json')}`);
  console.log(`${results.filter(r=>r.ok&&!r.skipped).length}/${results.filter(r=>!r.skipped).length} passed; ${results.filter(r=>r.skipped).length} skipped`);
  process.exitCode = results.some(r=>!r.ok) ? 1 : 0;
})().catch(error=>{ console.error(error.stack); process.exitCode=2; }).finally(()=>{
  for(const ws of connections) ws.close();
  if(proc && proc.exitCode===null) proc.kill();
  if(providerServer)providerServer.close();
  if(weatherServer)weatherServer.close();
  if(obsServer){for(const client of obsServer.clients)client.terminate();obsServer.close();}
});
