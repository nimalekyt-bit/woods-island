// Sequential baseline/candidate measurements; isolated profiles, actual Tauri/WebView2 processes.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = path.resolve(__dirname, '..');
const arguments_ = process.argv.slice(2).filter(value => value !== '--');
const baseline = arguments_[0];
const candidate = arguments_[1] || path.join(root, 'src-tauri/target/release/woods-island.exe');
const seconds = Number(process.env.WOODS_PERF_SECONDS || 20);
const port = Number(process.env.WOODS_PERF_PORT || 9460);
const scratchRoot = path.resolve(process.env.WOODS_PERF_TEMP || path.join(root, '.qa-temp', 'performance-work'));
const hidden = process.env.WOODS_PERF_HIDE === '1';
const peripheralComparison = process.env.WOODS_PERF_PERIPHERALS === '1';
const reportPath = path.resolve(process.env.WOODS_PERF_REPORT || path.join(root, '.qa-temp', 'performance.json'));
const reverseOrder = process.env.WOODS_PERF_ORDER === 'candidate-first';
const ownedAudio = process.env.WOODS_PERF_GSMTC_FIXTURE === '1';
const originalBaseline = process.env.WOODS_PERF_ORIGINAL === '1';
async function audioAction(action) {
  const state=await(await fetch('http://127.0.0.1:9550/state')).json();
  assert.equal(state.kind,'woods-owned-eq-player','Only the owned QA audio player may be controlled');
  const response=await fetch('http://127.0.0.1:9550/'+action);assert(response.ok);
  return state;
}
let proc, ws, fixtureTimer;
const exceptions = [];
async function requireFreePort(value) {
  await new Promise((resolve,reject)=>{
    const server=net.createServer();server.once('error',reject);
    server.listen({host:'127.0.0.1',port:value,exclusive:true},()=>server.close(error=>error?reject(error):resolve()));
  });
}
async function connect(url) {
  ws = new WebSocket(url); await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
  let id=0;const pending=new Map();
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error||m.result?.exceptionDetails?p.reject(Error(JSON.stringify(m.error||m.result.exceptionDetails))):p.resolve(m.result);}};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject,timer:setTimeout(()=>reject(Error(method+' '+String(params.expression||'').slice(0,160)+' timed out')),20000)});ws.send(JSON.stringify({id:key,method,params}));});
  await command('Runtime.enable');await command('Performance.enable');
  const evaluate=async expression=>(await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
  const invoke=(name,args={})=>evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
  return {command,evaluate,invoke};
}
async function run(label,source) {
  const original=originalBaseline&&label==='baseline';
  await requireFreePort(port);await requireFreePort(port+1);
  await fs.mkdir(scratchRoot,{recursive:true});
  const directory=await fs.mkdtemp(path.join(scratchRoot,`woods-perf-${label}-`)),data=path.join(directory,'data');await fs.mkdir(data);
  const exe=path.join(directory,original?'island.exe':'woods-island.exe');await fs.copyFile(source,exe);
  await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({firstRun:false,style:'capsule',theme:'dark',scale:100,characterMusic:'liquid',layoutNotice:false,capsNotice:false,volumeNotice:false,offsetX:hidden?10000:0,showPeripherals:peripheralComparison?label==='candidate':true,peripheralAlerts:false,autostart:false,obsStatus:false,showClock:true,clockSeconds:false,character:'liquid',liquidWith:false,liquidSpectrum:true,lyrics:false,mediaPill:'normal',checkUpdates:false,moduleWeather:false,autoHide:false,hideInFullscreen:false}));
  if(original){
    const create=spawnSync('python',['-c','import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL)"); c.execute("INSERT INTO kv VALUES(?,?)",("settings",open(sys.argv[2],encoding="utf-8").read())); c.commit(); c.close()',path.join(data,'island.db'),path.join(data,'settings.json')],{windowsHide:true,encoding:'utf8'});
    assert.equal(create.status,0,create.stderr);
  }
  proc=spawn(exe,[],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,TEMP:directory,TMP:directory,WOODS_QA_SKIP_CLIPBOARD:'1',WOODS_ISLAND_DATA_DIR:data,WOODS_ISLAND_AGENT_HOME:path.join(directory,'agent-home'),WOODS_ISLAND_MUSIC_PORT:String(port+1),WOODS_ISLAND_STEAM_PATH:path.join(directory,'steam'),WOODS_ISLAND_PASSIVE_QA:'1',ISLAND_DATA_DIR:data,ISLAND_DISABLE:'clipboard',ISLAND_CODEX_DIR:path.join(directory,'codex'),ISLAND_CLAUDE_DIR:path.join(directory,'claude'),ISLAND_OPENCODE_DIR:path.join(directory,'opencode'),WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
  let pages;for(let i=0;i<100;i++){try{pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();if(pages.some(p=>p.url==='http://tauri.localhost/'))break;}catch{}await pause(200);}
  const client=await connect(pages.find(p=>p.url==='http://tauri.localhost/').webSocketDebuggerUrl);
  for(let i=0;i<100;i++){if(await client.evaluate('!!document.querySelector("[data-island]")'))break;await pause(100);}
  assert(await client.evaluate('!!document.querySelector("[data-island]")'));
  await client.evaluate(`(async()=>{window.__perfStore=${original?"(await import('/assets/Liquid-B0G64ooe.js')).Ft":"(await import('/assets/runtime-debug.js')).ot"};})()`);
  await client.invoke('settings_set',{settings:{through:true,opacityThrough:100}});
  await pause(350);
  if(!original)await client.evaluate('(async()=>{const debug=await import("/assets/runtime-debug.js");debug.setCharacterCursor?.(null);})()');
  if(hidden)await client.invoke('set_island_hidden',{hidden:true});
  let fixturePlaying=false,fixturePosition=0,fixtureAt=Date.now();
  const publish=()=>fetch(`http://127.0.0.1:${port+1}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'performance-fixture',title:'Performance fixture',artist:'Woods',duration:300000,progress:fixturePosition+(fixturePlaying?Date.now()-fixtureAt:0),isPlaying:fixturePlaying})});
  let selectedApp='ru.yandex.desktop.music.mod.connector',signal;
  if(ownedAudio){
    signal=await audioAction('pause');
    const sources=await client.invoke('media_sources'),selected=sources.find(source=>source.title==='Woods EQ fixture');
    assert(selected,'Owned GSMTC audio fixture must be available');selectedApp=selected.id;
  }else{await publish();fixtureTimer=setInterval(()=>void publish().catch(()=>{}),1000);await pause(1000);}
  await client.invoke('media_pick',{id:selectedApp});
  await pause(8000);
  await client.evaluate(`(async()=>{window.__perfEvents={};window.__perfAudio={peakLevel:0,peakBand:0};for(const event of ['media:update','media:bands','media:level','downloads:update','agents:update','controls:changed','peripherals:update']){window.__perfEvents[event]=0;const handler=window.__TAURI_INTERNALS__.transformCallback(message=>{window.__perfEvents[event]++;if(event==='media:level'&&Number.isFinite(message.payload))window.__perfAudio.peakLevel=Math.max(window.__perfAudio.peakLevel,message.payload);if(event==='media:bands'&&Array.isArray(message.payload))for(const band of message.payload)if(Number.isFinite(band))window.__perfAudio.peakBand=Math.max(window.__perfAudio.peakBand,band);});await window.__TAURI_INTERNALS__.invoke('plugin:event|listen',{event,target:{kind:'Any'},handler});}})()`);
  const result={sha256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),sourceKind:original?'original':'woods',signal,scenarios:{}};
  if(peripheralComparison) {
    const snapshot=await client.invoke('peripherals_get');
    if(label==='baseline')assert.equal(snapshot.revision,0,'Disabled peripheral scanner must not run');
    else assert(snapshot.revision>0,'Enabled peripheral scanner must complete');
    result.hardware=snapshot;
  }
  for(const phase of ['idle','music','paused']) {
    if(phase==='music') {
      fixturePlaying=true;fixtureAt=Date.now();if(ownedAudio)await audioAction('reset');else await publish();await pause(3500);
      await client.invoke('settings_set',{settings:{mediaPill:'title'}});await pause(500);
      assert(await client.evaluate(`document.body.textContent.includes(${JSON.stringify(ownedAudio?'Woods EQ fixture':'Performance fixture')})`),
        'The music fixture must reach the rendered pill before measuring');
      await client.invoke('settings_set',{settings:{mediaPill:'normal'}});await pause(1000);
    }
    if(phase==='paused') {
      fixturePosition+=Date.now()-fixtureAt;fixturePlaying=false;if(ownedAudio)await audioAction('pause');else await publish();await pause(4000);
    }
    const currentMedia=await client.evaluate('window.__perfStore.getState().media');
    assert.equal(currentMedia?.app,selectedApp,'Never measure the user’s real media session as the fixture');
    if(ownedAudio)assert.equal(currentMedia?.title,'Woods EQ fixture');
    assert.equal(currentMedia?.playing,fixturePlaying);
    await client.evaluate(`(()=>{
      Object.keys(window.__perfEvents).forEach(k=>window.__perfEvents[k]=0);window.__perfAudio={peakLevel:0,peakBand:0};
      window.__perfContourTimes=[];
      window.__perfObserver?.disconnect();
      const path=Array.from(document.querySelectorAll('[data-island] path')).sort((a,b)=>(b.getAttribute('d')||'').length-(a.getAttribute('d')||'').length)[0];
      const shape=document.querySelector('[data-character="liquid"]')||path?.closest('svg');
      window.__perfObserver=new MutationObserver(records=>{if(records.some(record=>record.attributeName==='d'))window.__perfContourTimes.push(performance.now());});
      if(shape)window.__perfObserver.observe(shape,{subtree:true,attributes:true,attributeFilter:['d']});
      return !!shape;
    })()`);
    const file=path.join(directory,phase+'.json');
    const sampler=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/sample-process-tree.ps1'),'-RootProcessId',String(proc.pid),'-Seconds',String(seconds),'-OutFile',file],{windowsHide:true,stdio:'pipe'});
    let stderr='',stdout='';sampler.stderr.on('data',data=>stderr+=data);
    const completed=new Promise((resolve,reject)=>{sampler.once('exit',resolve);sampler.once('error',reject);});
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Performance sampler did not finish GPU initialization')),30000);
      sampler.stdout.on('data',data=>{stdout+=data;if(stdout.includes('WOODS_PERF_READY')){clearTimeout(timeout);resolve();}});
      sampler.once('error',error=>{clearTimeout(timeout);reject(error);});
      sampler.once('exit',code=>{clearTimeout(timeout);if(!stdout.includes('WOODS_PERF_READY'))reject(Error('Sampler exited before measurement: '+code+' '+stderr));});
    });
    await client.evaluate('Object.keys(window.__perfEvents).forEach(k=>window.__perfEvents[k]=0);window.__perfAudio={peakLevel:0,peakBand:0};window.__perfContourTimes=[]');
    const before=await client.command('Performance.getMetrics');
    const code=await completed;assert.equal(code,0,stderr);
    const after=await client.command('Performance.getMetrics');
    const samples=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
    const list=Array.isArray(samples)?samples:[samples],sum=list.reduce((a,s)=>a+s.cpuSeconds,0),duration=list.reduce((a,s)=>a+s.seconds,0);
    const metric=(values,name)=>values.metrics.find(m=>m.name===name)?.value||0;
    const mean=key=>list.reduce((a,s)=>a+s[key],0)/list.length;
    const events=await client.evaluate('window.__perfEvents');
    const contourTimes=await client.evaluate('window.__perfObserver.disconnect();window.__perfContourTimes');
    const intervals=contourTimes.slice(1).map((time,index)=>time-contourTimes[index]).sort((a,b)=>a-b);
    const quantile=p=>intervals.length?intervals[Math.floor((intervals.length-1)*p)]:null;
    const contourFrames={count:contourTimes.length,medianMs:quantile(.5),p95Ms:quantile(.95),p99Ms:quantile(.99),gapsOver100Ms:intervals.filter(value=>value>100).length};
    assert(list.length>=10 && list.every(s=>s.processes>=3),'Whole process tree must include WebView2');
    assert(sum>0,'CPU accounting must preserve fractional processor time');
    result.scenarios[phase]={durationSeconds:duration,cpuMachinePercent:100*sum/duration/os.cpus().length,cpuOneCorePercent:100*sum/duration,meanWorkingMiB:mean('workingBytes')/1048576,meanPrivateMiB:mean('privateBytes')/1048576,maxWorkingMiB:Math.max(...list.map(s=>s.workingBytes))/1048576,processes:Math.max(...list.map(s=>s.processes)),names:[...new Set(list.flatMap(s=>s.names))],jsTaskSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration'),jsHeapMiB:metric(after,'JSHeapUsedSize')/1048576,events,samples:list};
    console.log(`${label}/${phase}: CPU ${result.scenarios[phase].cpuMachinePercent.toFixed(3)}%, private ${result.scenarios[phase].meanPrivateMiB.toFixed(1)} MiB; ${list[0].processes} processes`);
    result.scenarios[phase].contourFrames=contourFrames;
    result.scenarios[phase].observedAudio=await client.evaluate("window.__perfAudio");
    result.scenarios[phase].viewState=await client.evaluate(`(()=>{const s=window.__perfStore.getState(),shape=document.querySelector('[data-character="liquid"]');return {mediaLive:s.mediaLive,playing:s.media?.playing,mood:shape?.dataset.characterMood,expanded:s.expanded,hovered:s.hovered,through:s.settings?.through};})()`);
    const gpu=list.map(sample=>sample.gpuEnginePercent).filter(value=>typeof value==='number'&&Number.isFinite(value));
    result.scenarios[phase].gpuEngineUtilization=gpu.length?{meanPercent:gpu.reduce((a,b)=>a+b,0)/gpu.length,maxPercent:Math.max(...gpu),counters:Math.max(...list.map(sample=>sample.gpuCounters))}:null;
    result.scenarios[phase].sharedMediaService={cpuMachinePercent:100*list.reduce((sum,sample)=>sum+(sample.sharedMediaServiceCpuSeconds||0),0)/duration/os.cpus().length,pids:[...new Set(list.flatMap(sample=>sample.mediaServicePids||[]))]};
  }
  if(peripheralComparison) {
    result.finalPeripheralRevision=(await client.invoke('peripherals_get')).revision;
    if(label==='baseline')assert.equal(result.finalPeripheralRevision,0,'Disabled peripheral polling resumed');
  }
  clearInterval(fixtureTimer);fixtureTimer=null;
  await client.evaluate('void window.__TAURI_INTERNALS__.invoke("quit");true');
  for(let i=0;i<100&&proc.exitCode===null;i++)await pause(100);assert.equal(proc.exitCode,0);ws.close();ws=null;proc=null;await pause(1000);
  return result;
}
(async()=>{
  assert(baseline,'Provide the preserved baseline executable');
  assert(!originalBaseline||ownedAudio,'Original comparison requires the same owned GSMTC audio fixture');
  assert(Number.isInteger(seconds)&&seconds>=12&&seconds<=120,'Measurement seconds must be 12–120');
  assert(Number.isInteger(port)&&port>=1024&&port<65535,'Use two valid non-privileged local ports');
  let previous,current;
  if(reverseOrder){current=await run('candidate',candidate);previous=await run('baseline',baseline);}
  else{previous=await run('baseline',baseline);current=await run('candidate',candidate);}
  const report={date:new Date().toISOString(),logicalProcessors:os.cpus().length,windowHidden:hidden,peripheralComparison,method:'Sequential isolated profiles. Peripheral comparison uses the same executable with polling disabled/enabled. Idle is a forced paused connector fixture, music is playing metadata, paused follows music. CPU sums the native app and descendants observed by the sampler; short-lived scanners can fall between samples and require separate measurement. The existing Windows audio output is only observed; this harness never changes playback, volume, device or personal profile. Hidden mode measures a hidden HUD and must not be reported as visible-HUD performance.',baseline:previous,candidate:current,frontendExceptions:exceptions};
  await fs.mkdir(path.dirname(reportPath), { recursive:true });
  report.ownedGsmtcFixture=ownedAudio;report.originalBaseline=originalBaseline;
  if(ownedAudio)report.method='Sequential isolated profiles with an owned Edge GSMTC session, the same 48 kHz tone sequence and unchanged output/master volume. Only the QA audio element is paused/reset. Each app uses the same selected media source. CPU/RAM sum the native process and its WebView2 descendants; the independent player is excluded. Contour intervals measure actual SVG mutations, not compositor FPS. Short-lived processes can fall between samples.';
  report.order=reverseOrder?['candidate','baseline']:['baseline','candidate'];
  await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  assert.equal(exceptions.length,0,'No frontend exceptions');
  for(const scenario of ['idle','music','paused']) {
    const a=previous.scenarios[scenario],b=current.scenarios[scenario];
    assert(b.cpuMachinePercent<=a.cpuMachinePercent*1.5+0.5,`${scenario} CPU regression`);
    assert(b.meanPrivateMiB<=a.meanPrivateMiB*1.3+50,`${scenario} memory regression`);
    assert(b.cpuMachinePercent<5,`${scenario} CPU budget`);
    assert.equal(b.events['downloads:update'],0,'No repeating unchanged download events');
    if(scenario!=='music'){
      assert.equal(b.events['media:bands'],0,'Paused visualization does not keep capturing');
      assert.equal(b.events['media:level'],0,'Paused visualization does not emit repeating meter events');
      assert(b.events['media:update']<=2,'Unchanged paused metadata is deduplicated');
    }
  }
  console.log(`PASS process tree performance budgets; report saved in ${reportPath}`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  clearInterval(fixtureTimer);ws?.close();
  if(proc&&proc.exitCode===null){
    // Only the child started from this run's isolated directory and its tree.
    const cleanup=spawn('taskkill.exe',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    await new Promise(resolve=>{cleanup.once('exit',resolve);cleanup.once('error',resolve);});
  }
});
