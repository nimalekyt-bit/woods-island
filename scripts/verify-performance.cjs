// Sequential baseline/candidate measurements; isolated profiles, actual Tauri/WebView2 processes.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = path.resolve(__dirname, '..');
const arguments_ = process.argv.slice(2).filter(value => value !== '--');
const baseline = arguments_[0];
const candidate = arguments_[1] || path.join(root, 'src-tauri/target/release/woods-island.exe');
const seconds = Number(process.env.WOODS_PERF_SECONDS || 20);
const port = Number(process.env.WOODS_PERF_PORT || 9460);
let proc, ws, fixtureTimer;
const exceptions = [];
async function connect(url) {
  ws = new WebSocket(url); await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
  let id=0;const pending=new Map();
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error||m.result?.exceptionDetails?p.reject(Error(JSON.stringify(m.error||m.result.exceptionDetails))):p.resolve(m.result);}};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject,timer:setTimeout(()=>reject(Error(method+' timed out')),20000)});ws.send(JSON.stringify({id:key,method,params}));});
  await command('Runtime.enable');await command('Performance.enable');
  const evaluate=async expression=>(await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
  const invoke=(name,args={})=>evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
  return {command,evaluate,invoke};
}
async function run(label,source) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),`woods-perf-${label}-`)),data=path.join(directory,'data');await fs.mkdir(data);
  const exe=path.join(directory,'woods-island.exe');await fs.copyFile(source,exe);
  await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({autostart:false,obsStatus:false,showClock:true,clockSeconds:false,character:'liquid',liquidWith:false,lyrics:false,mediaPill:'normal',checkUpdates:false,moduleWeather:false}));
  proc=spawn(exe,[],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,WOODS_ISLAND_DATA_DIR:data,WOODS_ISLAND_AGENT_HOME:path.join(directory,'agent-home'),WOODS_ISLAND_MUSIC_PORT:String(port+1),WOODS_ISLAND_STEAM_PATH:path.join(directory,'steam'),WOODS_ISLAND_PASSIVE_QA:'1',WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
  let pages;for(let i=0;i<100;i++){try{pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();if(pages.some(p=>p.url==='http://tauri.localhost/'))break;}catch{}await pause(200);}
  const client=await connect(pages.find(p=>p.url==='http://tauri.localhost/').webSocketDebuggerUrl);
  for(let i=0;i<100;i++){if(await client.evaluate('!!document.querySelector("[data-island]")'))break;await pause(100);}
  assert(await client.evaluate('!!document.querySelector("[data-island]")'));
  await pause(8000);
  await client.evaluate(`(async()=>{window.__perfEvents={};for(const event of ['media:bands','media:level','downloads:update','agents:update','controls:changed']){window.__perfEvents[event]=0;const handler=window.__TAURI_INTERNALS__.transformCallback(()=>window.__perfEvents[event]++);await window.__TAURI_INTERNALS__.invoke('plugin:event|listen',{event,target:{kind:'Any'},handler});}})()`);
  const result={sha256:createHash('sha256').update(await fs.readFile(source)).digest('hex'),scenarios:{}};
  for(const phase of ['idle','music']) {
    if(phase==='music') {
      const at=Date.now();const publish=()=>fetch(`http://127.0.0.1:${port+1}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'performance-fixture',title:'Performance fixture',artist:'Woods',duration:300000,progress:Date.now()-at,isPlaying:true})}).catch(()=>{});
      await publish();fixtureTimer=setInterval(publish,1000);await pause(3500);
      await client.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});await pause(3500);
      await client.invoke('settings_set',{settings:{mediaPill:'title'}});await pause(500);
      assert(await client.evaluate('document.body.textContent.includes("Performance fixture")'),
        'The music fixture must reach the rendered pill before measuring');
      await client.invoke('settings_set',{settings:{mediaPill:'normal'}});await pause(1000);
    }
    await client.evaluate('Object.keys(window.__perfEvents).forEach(k=>window.__perfEvents[k]=0)');
    const before=await client.command('Performance.getMetrics');
    const file=path.join(directory,phase+'.json');
    const sampler=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/sample-process-tree.ps1'),'-RootProcessId',String(proc.pid),'-Seconds',String(seconds),'-OutFile',file],{windowsHide:true,stdio:'pipe'});
    let stderr='';sampler.stderr.on('data',data=>stderr+=data);const code=await new Promise(resolve=>sampler.on('exit',resolve));assert.equal(code,0,stderr);
    const after=await client.command('Performance.getMetrics');
    const samples=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
    const list=Array.isArray(samples)?samples:[samples],sum=list.reduce((a,s)=>a+s.cpuSeconds,0),duration=list.reduce((a,s)=>a+s.seconds,0);
    const metric=(values,name)=>values.metrics.find(m=>m.name===name)?.value||0;
    const mean=key=>list.reduce((a,s)=>a+s[key],0)/list.length;
    const events=await client.evaluate('window.__perfEvents');
    assert(list.length>=10 && list.every(s=>s.processes>=3),'Whole process tree must include WebView2');
    assert(sum>0,'CPU accounting must preserve fractional processor time');
    result.scenarios[phase]={durationSeconds:duration,cpuMachinePercent:100*sum/duration/os.cpus().length,cpuOneCorePercent:100*sum/duration,meanWorkingMiB:mean('workingBytes')/1048576,meanPrivateMiB:mean('privateBytes')/1048576,maxWorkingMiB:Math.max(...list.map(s=>s.workingBytes))/1048576,processes:Math.max(...list.map(s=>s.processes)),names:[...new Set(list.flatMap(s=>s.names))],jsTaskSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration'),jsHeapMiB:metric(after,'JSHeapUsedSize')/1048576,events,samples:list};
    console.log(`${label}/${phase}: CPU ${result.scenarios[phase].cpuMachinePercent.toFixed(3)}%, private ${result.scenarios[phase].meanPrivateMiB.toFixed(1)} MiB; ${list[0].processes} processes`);
  }
  clearInterval(fixtureTimer);fixtureTimer=null;
  await client.evaluate('void window.__TAURI_INTERNALS__.invoke("quit");true');
  for(let i=0;i<100&&proc.exitCode===null;i++)await pause(100);assert.equal(proc.exitCode,0);ws.close();ws=null;proc=null;await pause(1000);
  return result;
}
(async()=>{
  assert(baseline,'Provide the preserved baseline executable');
  const previous=await run('baseline',baseline),current=await run('candidate',candidate);
  const report={date:new Date().toISOString(),logicalProcessors:os.cpus().length,method:'Sequential isolated profiles. CPU sums the native app and every descendant including hidden WebView2 windows. Music uses a loopback metadata fixture; the existing Windows audio output is observed without changing playback or volume.',baseline:previous,candidate:current,frontendExceptions:exceptions};
  await fs.writeFile(path.join(root,'docs/performance-20261112.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(exceptions.length,0,'No frontend exceptions');
  for(const scenario of ['idle','music']) {
    const a=previous.scenarios[scenario],b=current.scenarios[scenario];
    assert(b.cpuMachinePercent<=a.cpuMachinePercent*1.5+0.5,`${scenario} CPU regression`);
    assert(b.meanPrivateMiB<=a.meanPrivateMiB*1.3+50,`${scenario} memory regression`);
    assert(b.cpuMachinePercent<5,`${scenario} CPU budget`);
    assert.equal(b.events['downloads:update'],0,'No repeating unchanged download events');
  }
  console.log('PASS process tree performance budgets; docs/performance-20261112.json');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{clearInterval(fixtureTimer);ws?.close();if(proc)proc.kill();});
