// Real WebView2/Tauri acceptance. All writes go to an isolated temporary profile.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { assertWebAiPaint, readWebAiPaintRects } = require('./web-ai-paint.cjs');
const { verifyPhoneTransport } = require('./phone-native-acceptance.cjs');
const { verifyAgentHooks } = require('./agent-tauri-acceptance.cjs');

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
let webAiServer;
let failWebAi = false;
let delayWebAi = 0;
let holdWebAi = false;
const heldWebAiResponses = [];

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

function minimizeOwnedWindow(label) {
  const title=require(path.join(root,'src-tauri/tauri.conf.json')).app.windows.find(window=>window.label===label)?.title;
  assert(title&&Number.isInteger(proc.pid),'Only a configured window of this QA process can be minimized');
  const source=`Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class WoodsQaMinimize {
 public delegate bool Callback(IntPtr hwnd, IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback, IntPtr data);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int length);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
 public static void Minimize(uint pid, string title) {
  var matches=new List<IntPtr>();
  EnumWindows((hwnd,data)=>{uint owner;GetWindowThreadProcessId(hwnd,out owner);var text=new StringBuilder(512);GetWindowText(hwnd,text,512);if(owner==pid&&text.ToString()==title)matches.Add(hwnd);return true;},IntPtr.Zero);
  if(matches.Count!=1)throw new Exception("Owned settings HWND is ambiguous");
  ShowWindow(matches[0],6);
 }
}
'@
[WoodsQaMinimize]::Minimize(${proc.pid},'${title.replaceAll("'","''")}')`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(source,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
}

// Read the HWND rectangle independently of the provider's CDP screenshot and
// of the application's cached surface proof. This also runs against old EXEs.
function readWebAiHosts() {
  const source = `
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class WoodsQaHosts {
  public delegate bool Callback(IntPtr hwnd, IntPtr data);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int x,y; }
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb,IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hwnd,Callback cb,IntPtr data);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd,out Rect rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd,ref Point point);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtrW(IntPtr hwnd,int index);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder text,int size);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int size);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int left,int top,int right,int bottom);
  [DllImport("user32.dll")] static extern int GetWindowRgn(IntPtr hwnd,IntPtr region);
  [DllImport("gdi32.dll")] static extern int GetRgnBox(IntPtr region,out Rect rect);
  [DllImport("gdi32.dll")] static extern bool PtInRegion(IntPtr region,int x,int y);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr region);
  public class Host { public long hwnd,parent,root; public string title; public bool ownVisible,rootVisible,topCut,bottomCut; public int[] screen,origin,client,rootScreen,region; }
  public static List<Host> Read(uint pid) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    var hosts=new List<Host>();
    EnumWindows((root,data)=>{ uint owner; GetWindowThreadProcessId(root,out owner); if(owner!=pid)return true;
      var title=new StringBuilder(256);GetWindowText(root,title,256);Rect rootScreen;GetWindowRect(root,out rootScreen);
      EnumChildWindows(root,(hwnd,unused)=>{
        var name=new StringBuilder(256);GetClassName(hwnd,name,256);
        if(name.ToString()!="WRY_WEBVIEW")return true;
        var parent=GetParent(hwnd);Rect screen,client;var origin=new Point();
        if(!GetWindowRect(hwnd,out screen)||!GetClientRect(parent,out client)||!ClientToScreen(parent,ref origin))throw new Exception("Cannot read native host geometry");
        var region=CreateRectRgn(0,0,0,0);var hasRegion=GetWindowRgn(hwnd,region)>0;Rect box;GetRgnBox(region,out box);
        var topCut=hasRegion&&!PtInRegion(region,0,0);var bottomCut=hasRegion&&!PtInRegion(region,0,screen.bottom-screen.top-1);DeleteObject(region);
        hosts.Add(new Host{hwnd=hwnd.ToInt64(),parent=parent.ToInt64(),root=root.ToInt64(),title=title.ToString(),ownVisible=(GetWindowLongPtrW(hwnd,-16).ToInt64()&0x10000000)!=0,rootVisible=IsWindowVisible(root),topCut=topCut,bottomCut=bottomCut,region=hasRegion?new[]{box.left,box.top,box.right,box.bottom}:null,screen=new[]{screen.left,screen.top,screen.right-screen.left,screen.bottom-screen.top},origin=new[]{origin.x,origin.y},client=new[]{client.right,client.bottom},rootScreen=new[]{rootScreen.left,rootScreen.top}});return true;
      },IntPtr.Zero);return true;
    },IntPtr.Zero);return hosts;
  }
}`;
  const command=`$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${source}\n'@; ConvertTo-Json -Depth 5 -Compress -InputObject @([WoodsQaHosts]::Read(${proc.pid}))`;
  const result=spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  return JSON.parse(result.stdout.trim());
}
async function sampleWebAiHostOnce(client,service,target) {
  const selector=target==='embedded'?`[data-web-ai-slot="${service}"]`:'[data-web-ai-content]';
  const dom=await client.evaluate(`(()=>{const slot=document.querySelector(${JSON.stringify(selector)}),r=slot?.getBoundingClientRect(),style=slot&&getComputedStyle(slot);return r?{rect:[r.x,r.y,r.width,r.height],viewport:[innerWidth,innerHeight],border:style.borderTopColor,background:style.backgroundColor}:null})()`);
  assert(dom&&dom.rect[2]>0&&dom.rect[3]>0,'Real provider slot is missing');
  const windowPosition=await client.invoke('plugin:window|outer_position',{label:target==='embedded'?'main':'web-ai-window'});
  const observedHosts=readWebAiHosts();
  // Enumerating HWNDs starts a separate process. Read the live controller after
  // that enumeration so its result cannot predate a delayed layout/resize.
  const surface=(await client.invoke('web_ai_status')).find(row=>row.service===service&&row.target===target)?.surface;
  // Passive QA deliberately keeps the shell root hidden. Its child HWND still
  // has authoritative physical coordinates and must carry its own visible bit.
  const hosts=observedHosts.filter(h=>h.rootScreen[0]===windowPosition.x&&h.rootScreen[1]===windowPosition.y&&h.parent===h.root&&(!surface?.hwnd||h.hwnd===surface.hwnd));
  const candidates=hosts.map(host=>{
    const factor=host.client[0]/dom.viewport[0];
    const expected=dom.rect.map((value,i)=>Math.round(value*factor)+(i<2?host.origin[i]:0));
    return {host,dom,factor,expected,delta:host.screen.map((value,i)=>value-expected[i])};
  });
  const match=candidates.find(row=>row.delta.every(value=>Math.abs(value)<=2)&&row.host.ownVisible&&row.host.topCut===(target==='embedded')&&row.host.bottomCut&&row.host.region?.[0]===0&&row.host.region?.[1]===0&&Math.abs(row.host.region[2]-row.host.screen[2])<=1&&Math.abs(row.host.region[3]-row.host.screen[3])<=1);
  const controllerMatches=!surface?.controller_bounds||(surface.parent_matches&&surface.controller_bounds[0]===0&&surface.controller_bounds[1]===0&&surface.controller_bounds[2]===surface.width&&surface.controller_bounds[3]===surface.height);
  const controllerFitsHost=!surface?.controller_bounds||!!match&&surface.controller_bounds[2]===match.host.screen[2]&&surface.controller_bounds[3]===match.host.screen[3];
  return {service,target,match:!!match&&controllerMatches&&controllerFitsHost,candidates,surface,...(!match?{windowPosition,observedHosts}:{})};
}
async function sampleWebAiHost(client,service,target){
  const deadline=Date.now()+4000;let result,attempts=0;
  do{result=await sampleWebAiHostOnce(client,service,target);attempts++;if(result.match)break;await pause(100);}while(Date.now()<deadline);
  return {...result,attempts};
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
  const {snapshot,...bounds}=native;
  assert(contains([0,0,native.width,native.height]),'Attached paint clipped by WebView canvas: '+JSON.stringify({label,sample,native:bounds}));
  assert(contains(native.visualBounds),'Attached paint clipped by native region: '+JSON.stringify({label,sample,native:bounds}));
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
  const executionContexts=new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if(message.method==='Runtime.executionContextCreated')executionContexts.set(message.params.context.id,message.params.context);
    if(message.method==='Runtime.executionContextDestroyed')executionContexts.delete(message.params.executionContextId);
    if(message.method==='Runtime.executionContextsCleared')executionContexts.clear();
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
  return { ws, evaluate, invoke, command, executionContexts };
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
  const attempts = process.env.CI ? 225 : 120;
  for (let i = 0; i < attempts; i++) {
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
  return client.evaluate(`(async() => {
    const name=${JSON.stringify(name)};
    window.__woodsEvents ??= {};window.__woodsEventSubscriptions ??= {};
    const prior=window.__woodsEventSubscriptions[name];
    if(prior){await window.__TAURI_INTERNALS__.invoke('plugin:event|unlisten',{event:name,eventId:prior.eventId});window.__TAURI_INTERNALS__.unregisterCallback(prior.handler);}
    window.__woodsEvents[name]=[];
    const handler=window.__TAURI_INTERNALS__.transformCallback(e=>window.__woodsEvents[name].push(e.payload));
    const eventId=await window.__TAURI_INTERNALS__.invoke('plugin:event|listen',{event:name,target:{kind:'Any'},handler});
    window.__woodsEventSubscriptions[name]={eventId,handler};return eventId;
  })()`);
}
async function quit(client) {
  await client.evaluate('void window.__TAURI_INTERNALS__.invoke("quit"); true').catch(()=>{});
  for(let i=0;i<100 && proc.exitCode===null;i++) await pause(100);
  assert.equal(proc.exitCode,0);
  for(const ws of connections) ws.close();
  connections=[];
}

(async () => {
  const tempRoot = process.env.WOODS_QA_TEMP || path.join(process.env.CARGO_TARGET_DIR || path.join(root,'src-tauri','target'), 'qa-temp', 'woodscorp_obs');
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
      if(query.get('track_name')==='Plain only'){
        res.end(JSON.stringify({id:45,plainLyrics:'Только обычный текст\n'.repeat(25),syncedLyrics:'',instrumental:false}));return;
      }
      if(query.get('track_name')==='Geometry Motion'){
        res.end(JSON.stringify({id:44,plainLyrics:'',syncedLyrics:'[00:00.00]Да\n[00:10.00]Эта длинная строка проверяет плавную смену текста и перенос внутри музыкальной пилюли\n[00:15.00]Сверхдлинноесловобезпробелов'+'продолжениесловабезразрывов'.repeat(8),instrumental:false}));return;
      }
      if(query.get('track_name')==='Geometry'){
        res.end(JSON.stringify({id:43,plainLyrics:'',syncedLyrics:'[00:00.00]Да\n[00:04.00]Эта длинная строка проверяет плавную смену текста и перенос внутри музыкальной пилюли\n[00:08.00]Сверхдлинноесловобезпробелов'.repeat(1)+'продолжениесловабезразрывов'.repeat(8),instrumental:false}));return;
      }
      res.end(JSON.stringify({id:42,plainLyrics:'Первая строка\nВторая строка\nТретья строка',syncedLyrics:'[00:00.00]Первая строка\n[00:04.00]Вторая строка\n[00:08.00]Третья строка',instrumental:false}));return;
    }
    weatherRequests++;
    if(req.url.startsWith('/sun')){
      const query=new URL(req.url,'http://localhost').searchParams;
      const date=query.get('date'),offset=query.get('offset');
      res.end(JSON.stringify({properties:{sunrise:{time:`${date}T08:26${offset}`},sunset:{time:`${date}T16:33${offset}`}}}));
    }else res.end(JSON.stringify(weatherFixture));
  });
  await new Promise(resolve=>weatherServer.listen(0,'127.0.0.1',resolve));
  const weatherUrl=`http://127.0.0.1:${weatherServer.address().port}/forecast`;
  webAiServer=http.createServer((req,res)=>{
    if(failWebAi){req.socket.destroy();return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const html=`<!doctype html><html><head><title>Isolated Web AI</title></head><body style="background:#fff;color:#111"><h1 data-provider="${req.url.slice(1)}">${req.url.slice(1)}</h1><input aria-label="Draft" /><div data-scroll-fixture tabindex="0" style="width:160px;height:100px;overflow:auto"><div style="width:400px;height:500px"></div></div><div style="height:2200px"></div><script>window.fixtureInstance=crypto.randomUUID();</script></body></html>`;
    if(holdWebAi)heldWebAiResponses.push(()=>res.end(html));
    else if(delayWebAi)setTimeout(()=>res.end(html),delayWebAi);else res.end(html);
  });
  await new Promise(resolve=>webAiServer.listen(0,'127.0.0.1',resolve));
  const webAiUrl=`http://127.0.0.1:${webAiServer.address().port}`;
  await fs.writeFile(path.join(dataDir,'weather.json'),JSON.stringify({lat:53.2424,lon:34.3668,fetchedAt:Date.now(),now:{temp:2,code:'cloudy'},hours:[{time:weatherStart*1000}]}));
  const agentHome=path.join(directory,'agent-home');
  const agentConfigs=[['.claude/settings.json',JSON.stringify({permissions:{allow:['Read']},hooks:{Stop:[{hooks:[{type:'command',command:'fixture-notify.exe'}]}]}})],['.codex/config.toml','# untouched fixture\nnotify = ["fixture-notify.exe"]\nmodel = "fixture"\n'],['.config/opencode/opencode.json','{}']];
  for(const [name,content]of agentConfigs){const file=path.join(agentHome,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);}
  async function launch(){
    proc = spawn(exe, [], { cwd: directory, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env, TEMP:scratchDir, TMP:scratchDir, APPDATA: path.join(directory, 'appdata'), WOODS_ISLAND_DATA_DIR: dataDir, WOODS_ISLAND_AGENT_HOME:agentHome, WOODS_ISLAND_NODE:process.execPath, WOODS_ISLAND_STEAM_PATH:path.join(directory,'steam'), WOODS_ISLAND_MUSIC_PORT:String(musicPort), WOODS_ISLAND_WEATHER_URL:weatherUrl, WOODS_ISLAND_LYRICS_URL:weatherUrl.replace('/forecast','/lyrics'), WOODS_ISLAND_WEBAI_TEST_URL:webAiUrl, WOODS_ISLAND_PASSIVE_QA:'1', WOODS_QA_SKIP_CLIPBOARD:'1', WOODS_PHONE_QA_LOOPBACK:'1', WEBVIEW2_USER_DATA_FOLDER:path.join(directory,'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
    proc.stdout.on('data', data => process.stdout.write(data));
    proc.stderr.on('data', data => process.stderr.write(data));
    proc.on('exit', (code, signal) => console.log(`Native process exited: code=${code}, signal=${signal}`));
    await new Promise((resolve, reject) => { proc.once('spawn', resolve); proc.once('error', reject); });
    await assertQaMusicBridge();
  }
  await launch();
  const pages = await pagesReady();
  let main = await attach(pages.find(p => p.url === 'http://tauri.localhost/'));
  try{await waitFor(main,'!!document.querySelector("[data-island]")','Main UI');}
  catch(error){
    const diagnostic=await main.evaluate("({ready:document.readyState,url:location.href,html:document.documentElement.outerHTML.slice(0,9000),tauri:!!window.__TAURI_INTERNALS__,resources:performance.getEntriesByType('resource').map(x=>({name:x.name,duration:x.duration,size:x.transferSize}))})");
    const frames=await main.command('Page.getFrameTree').catch(error=>({error:String(error)}));
    const bootFailure={diagnostic,frames,contexts:[...main.executionContexts.values()],errors};await fs.writeFile(path.join(directory,'startup-failure.json'),JSON.stringify(bootFailure,null,2));
    console.error('STARTUP DIAGNOSTIC '+JSON.stringify({directory,ready:diagnostic.ready,tauri:diagnostic.tauri,resources:diagnostic.resources,errors}).slice(0,4000));
    throw error;
  }
  for(let i=0;i<100;i++){if(await main.invoke('window_diagnostics'))break;await pause(100);}
  // A human can change the host keyboard layout/volume during local QA.
  // Keep those unrelated live notices out of geometry and pet-paint fixtures.
  await main.invoke('settings_set',{settings:{showLayout:false,showCaps:false,showVolume:false,peripheralAlerts:false,weatherAlerts:false}});
  await pause(400);
  const persisted = new Map();
  const fixture = path.join(directory,'fixture.txt');
  await fs.writeFile(fixture,'Woods Island acceptance · Проверка');
  await check('Main UI mounts', async () => { assert(await main.evaluate('!!document.querySelector("[data-island]")')); });
  await check('First Alt+Space event and subsequent openings animate the palette',async()=>{
    const prior=await main.invoke('settings_get');
    const measure=()=>main.evaluate(`new Promise(async resolve=>{
      const {ot}=await import('/assets/runtime-debug.js');
      const pill=document.querySelector('[data-island]'), before=pill.getBoundingClientRect().width;
      const samples=[], start=performance.now();
      const tick=()=>{
        samples.push(pill.getBoundingClientRect().width);
        if(performance.now()-start<850)requestAnimationFrame(tick);
        else resolve({before,samples,mounted:!!document.querySelector('[data-palette-input]'),open:ot.getState().palette});
      };
      requestAnimationFrame(tick);
      void window.__TAURI_INTERNALS__.invoke('plugin:event|emit',{event:'island:palette',payload:null});
    })`);
    try{
      await main.invoke('settings_set',{settings:{reducedMotion:'full',openOnHover:false,autoHide:false}});
      const openings=[];
      for(let attempt=0;attempt<2;attempt++){
        await waitFor(main,`import('/assets/runtime-debug.js').then(({ot})=>!ot.getState().palette&&!ot.getState().expanded)`,'Folded island before the hotkey');
        await pause(500);
        const sample=await measure(),end=sample.samples.at(-1);
        assert(sample.mounted&&sample.open&&end>sample.before+100,JSON.stringify(sample));
        assert(new Set(sample.samples.filter(width=>width>sample.before+5&&width<end-5)).size>=3,JSON.stringify(sample));
        openings.push({before:sample.before,end,frames:sample.samples.length});
        await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.getState().closePalette())`);
      }
      return {openings,nativeEvent:true};
    }finally{await main.invoke('settings_set',{settings:prior});}
  });
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
    try{const vpn=await main.invoke('vpn_refresh');assert.equal(vpn.ip,null);assert(vpn.active===null||typeof vpn.active==='boolean');}finally{await main.invoke('settings_set',{settings:{vpnLookupIp:prior.vpnLookupIp}});}
    const controls=await main.invoke('controls_get');assert(Array.isArray(controls.vpns));
    assert(Array.isArray(await main.invoke('bt_devices')));
    return {notifications:await main.invoke('notifications_access'),vpnProfiles:controls.vpns.length};
  });
  await check('Upstream controls read real sessions and monitors and release idle load collectors',async()=>{
    const prior=await main.invoke('settings_get');
    try{
      await main.invoke('settings_set',{settings:{loadInPill:[]}});
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,tab:"home",palette:false,peek:null,queue:[]});})()');
      await pause(4200);const before=await main.invoke('system_load_status');await pause(1400);const idle=await main.invoke('system_load_status');
      assert.equal(idle.collecting,false);assert.equal(idle.samples,before.samples);
      const apps=await main.invoke('audio_mixer_get',{refresh:true});assert(Array.isArray(apps));
      for(const app of apps){assert.equal(typeof app.id,'string');assert.equal(typeof app.name,'string');assert(app.volume>=0&&app.volume<=1);assert(app.peak>=0&&app.peak<=1);}
      await assert.rejects(()=>main.invoke('audio_mixer_set',{id:'missing-owned-fixture',level:1.1,mute:null}));
      await assert.rejects(()=>main.invoke('brightness_set',{id:'all',level:101}));
      let monitors,monitorReadError;
      try{monitors=await main.invoke('brightness_get');for(const monitor of monitors){assert(monitor.level===null || Number.isFinite(monitor.level)&&monitor.level>=0&&monitor.level<=100);assert.equal(typeof monitor.id,'string');}}catch(error){monitorReadError=String(error);}
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"controls",peek:null,queue:[]});})()');
      await waitFor(main,'!!document.querySelector("[data-system-load]")&&!!document.querySelector("[data-brightness-controls]")','Native load and monitor controls');
      await pause(2600);const active=await main.invoke('system_load_status');assert(active.collecting);assert(active.samples>idle.samples);assert(active.gpuExpansions-idle.gpuExpansions<=1);
      const readings=await main.invoke('system_load_get');assert(readings.cpu===null||readings.cpu>=0&&readings.cpu<=100);assert(readings.memory>=0&&readings.memory<=100);
      const requestStart=(await main.invoke('system_load_status')).samples;
      for(let i=0;i<10;i++){await main.invoke('system_load_get');await pause(40);}
      assert((await main.invoke('system_load_status')).samples-requestStart<=1,'Cache reads must not accelerate the sampler');
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false});})()');await pause(4200);
      const stopped=await main.invoke('system_load_status');assert.equal(stopped.collecting,false);await pause(1400);assert.equal((await main.invoke('system_load_status')).samples,stopped.samples);
      return {sessionGroups:apps.length,monitorCount:monitors?.length??null,monitorReadError:monitorReadError??null,idleSamples:idle.samples,activeSamples:active.samples,stoppedSamples:stopped.samples,gpu:readings.gpu,physicalWrites:false};
    }finally{await main.invoke('settings_set',{settings:prior});}
  });
  await check('Control Center matches the reference card, 48px strip and power layout in native themes and scale',async()=>{
    const prior=await main.invoke('settings_get');const samples=[];
    try{
      await main.invoke('settings_set',{settings:{openOnHover:false,hideInFullscreen:false,showVpn:true}});
      for(const theme of ['dark','light'])for(const scale of [80,100,150,200]){
        await main.invoke('settings_set',{settings:{theme,scale}});
        await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"controls",palette:false,pinned:true,peek:null,queue:[],holdOpen:false,hovered:false});})()');
        await waitFor(main,'!!document.querySelector("[data-control-center]")','Control Center mount');await pause(1000);
        const layout=await main.evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};const center=document.querySelector('[data-control-center]'),grid=center.querySelector('[data-control-grid]'),strip=center.querySelector('[data-controls-strip]');return {center:rect(center),grid:rect(grid),strip:rect(strip),load:rect(center.querySelector('[data-system-load]')),brightness:rect(center.querySelector('[data-brightness-controls]')),cards:Array.from(grid.querySelectorAll('[data-control]')).map(e=>({id:e.dataset.control,...rect(e)})),power:Array.from(center.querySelectorAll('[data-power]')).map(e=>({id:e.dataset.power,...rect(e)}))};})()`);
        assert(Math.abs(layout.strip.h-48)<.1,JSON.stringify(layout));assert(layout.grid.h>=95.9);
        assert(layout.grid.bottom<=layout.strip.y+.1);assert(layout.load.right<=layout.brightness.x+.1);
        assert.equal(layout.power.length,4);assert(layout.power.every(item=>item.h>=75.9&&item.w>60&&item.bottom<=layout.center.bottom+.1),JSON.stringify(layout));
        assert(layout.cards.length>=3,JSON.stringify(layout));assert(layout.cards.every(card=>card.h>=95.9&&card.bottom<=layout.strip.y+.1),JSON.stringify(layout));
        if(scale===100){const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,`controls-reference-${theme}.png`),Buffer.from(shot.data,'base64'));}
        samples.push({theme,scale,...layout});
      }
      await fs.writeFile(path.join(directory,'controls-reference-layout.json'),JSON.stringify(samples,null,2));return {themes:['dark','light'],scales:[80,100,150,200],stripHeight:48,samples};
    }finally{await main.invoke('settings_set',{settings:prior});await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,tab:"home",pinned:false,peek:null,queue:[]});})()');}
  });
  await check('Physical monitor brightness changes only its selected display and restores the original level',async()=>{
    if(process.env.WOODS_TEST_MONITOR_WRITES!=='1')return {skipped:true,reason:'Physical write acceptance is explicitly enabled on the owner workstation'};
    const monitors=await main.invoke('brightness_get'),supported=monitors.filter(m=>Number.isFinite(m.level));
    if(!supported.length)return {skipped:true,reason:'No display exposes brightness controls',monitors};
    const changes=[];
    for(const selected of supported){
      const target=selected.level===100?99:selected.level+1;
      try{
        await main.invoke('brightness_set',{id:selected.id,level:target});const changed=await main.invoke('brightness_get');
        assert(Math.abs(changed.find(m=>m.id===selected.id).level-target)<=1);
        for(const monitor of monitors.filter(m=>m.id!==selected.id))assert.equal(changed.find(m=>m.id===monitor.id)?.level,monitor.level,'Another monitor changed');
        changes.push({name:selected.name,before:selected.level,changed:target});
      }finally{
        await main.invoke('brightness_set',{id:selected.id,level:selected.level});
        const after=await main.invoke('brightness_get');
        assert(Math.abs(after.find(m=>m.id===selected.id)?.level-selected.level)<=1,'Original brightness must be restored');
      }
    }
    return {monitors,changes,independent:true,restored:true};
  });
  await check('Home mixer stays inside the visible panel at supported scales',async()=>{
    const prior=await main.invoke('settings_get');
    const render=async scale=>{
      await main.invoke('settings_set',{settings:{scale,showVolume:true,homeHidden:[],reducedMotion:'reduce'}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:true,palette:false,tab:'home',holdOpen:true,peek:null,queue:[]}))`);
      await waitFor(main,'!!document.querySelector("[data-audio-mixer-toggle]")','Home volume strip');
      await main.evaluate('document.querySelector("[data-audio-mixer-toggle]").click()');
      await waitFor(main,'!!document.querySelector("[data-audio-mixer][data-placement]")','Mixer panel positioned');
      const proof=await main.evaluate(`(()=>{const popup=document.querySelector('[data-audio-mixer]'),home=popup.closest('[data-home]'),a=popup.getBoundingClientRect(),b=home.getBoundingClientRect(),list=popup.querySelector('[data-mixer-list]');return {top:a.top-b.top,bottom:b.bottom-a.bottom,width:a.width,height:a.height,scrollbar:getComputedStyle(list).scrollbarWidth,placement:popup.dataset.placement};})()`);
      assert(proof.top>=-1&&proof.bottom>=-1&&proof.width>150&&proof.height>=40,JSON.stringify({scale,proof}));
      assert.equal(proof.scrollbar,'none');
      await main.evaluate('document.querySelector("[data-audio-mixer] > div > button").click()');
      return proof;
    };
    try{
      const samples=[];
      for(const scale of [100,150,200])samples.push({scale,...await render(scale)});
      return {samples};
    }finally{
      await main.invoke('settings_set',{settings:prior});
      await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:false,holdOpen:false}))`);
    }
  });
  await check('VPN picker fits common providers and keeps keyboard access without bars',async()=>{
    const prior=await main.invoke('settings_get');
    const profiles=['AmneziaWG','Hiddify','Proton VPN','Radmin VPN','Другой клиент'].map((name,index)=>({id:'app:qa-'+index,name,ready:false,on:false,launchPath:null}));
    try{
      await main.invoke('settings_set',{settings:{showVpn:true}});
      await main.evaluate(`(async()=>{const {ot,O}=await import('/assets/runtime-debug.js');window.__qaControlsGet=O.controlsGet;const live=await O.controlsGet();O.controlsGet=async()=>({...live,vpns:${JSON.stringify(profiles)}});ot.setState({expanded:true,tab:'controls',holdOpen:true,peek:null,queue:[]});})()`);
      await waitFor(main,'document.querySelector("[data-vpn-list]")?.disabled===false','VPN clients button');
      await main.evaluate('document.querySelector("[data-vpn-list]").click()');
      await waitFor(main,'document.querySelectorAll("[data-vpn-pick]").length===5','All VPN options visible');
      const layout=await main.evaluate(`(()=>{const list=document.querySelector('.wi-vpn-items');return {bar:getComputedStyle(list).scrollbarWidth,vertical:list.scrollHeight-list.clientHeight,horizontal:list.scrollWidth-list.clientWidth};})()`);
      assert.deepEqual(layout,{bar:'none',vertical:0,horizontal:0});
      await main.evaluate(`document.querySelector('[data-vpn-choice]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      await waitFor(main,'!document.querySelector("[data-vpn-choice]")','Escape closes VPN list');
      return {providers:profiles.length,...layout};
    }finally{
      await main.evaluate(`import('/assets/runtime-debug.js').then(({ot,O})=>{if(window.__qaControlsGet){O.controlsGet=window.__qaControlsGet;delete window.__qaControlsGet;}ot.setState({expanded:false,holdOpen:false,tab:'home'});})`);
      await main.invoke('settings_set',{settings:prior});
    }
  });
  await check('Clipboard search uses a rounded focus surface and accepts typing',async()=>{
    try{
      await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.getState().open('click','clipboard'))`);
      const search='document.querySelector(\'input[placeholder="Поиск по истории"],input[placeholder="Search history"]\')';
      await waitFor(main,`!!${search}`,'Clipboard search');
      const focus=await main.evaluate(`(()=>{const input=${search};input.focus();const row=input.closest('label');return {outline:getComputedStyle(input).outlineStyle,radius:parseFloat(getComputedStyle(row).borderRadius),focused:document.activeElement===input};})()`);
      assert(focus.focused&&focus.outline==='none'&&focus.radius>=10,JSON.stringify(focus));
      await main.command('Input.insertText',{text:'Woods clipboard search'});
      assert.equal(await main.evaluate(`${search}.value`),'Woods clipboard search');
      return focus;
    }finally{
      await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.getState().close())`);
    }
  });
  await check('Launcher shortcuts use their genuine Windows icons and save them',async()=>{
    const shortcut=path.join(directory,'Native launcher shortcut.lnk');
    const command="$shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut($env:WOODS_QA_LINK); $link.TargetPath=$env:WOODS_QA_EXE; $link.IconLocation=$env:WOODS_QA_EXE+',0'; $link.Save()";
    const created=spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,env:{...process.env,WOODS_QA_LINK:shortcut,WOODS_QA_EXE:exe}});assert.equal(created.status,0,created.stderr);
    const before=await main.invoke('launcher_list');const items=await main.invoke('launcher_add',{paths:[shortcut,exe]});
    for(const target of [shortcut,exe]){const item=items.find(item=>item.path===target);assert(item);assert.match(item.icon,/^data:image\/png;base64,/);const image=rgbaPng(Buffer.from(item.icon.split(',')[1],'base64'));assert(image.width>=24&&image.height>=24);}
    const saved=JSON.parse(await fs.readFile(path.join(dataDir,'launcher.json'),'utf8'));assert(saved.some(item=>item.path===shortcut&&item.icon));
    for(const item of items.filter(item=>!before.some(previous=>previous.id===item.id)))await main.invoke('launcher_remove',{id:item.id});
    return {shortcutAndExecutable:true,persistedPng:true,onlyOwnedFixtures:true};
  });
  await check('Holiday garland follows capsule and MacBook notch edges with glowing lamps in native modes',async()=>{
    const prior=await main.invoke('settings_get');let playing=false,timer;const samples=[];
    const send=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'holiday-contour-fixture',title:'Geometry',artist:'Fixture',duration:20000,progress:1000,isPlaying:playing})});
    const reset=()=>main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,pinned:false,holdOpen:false,hovered:false,peek:null,queue:[],tab:"home"});})()');
    try{
      await main.invoke('settings_set',{settings:{snow:'on',snowFall:false,snowCap:false,garland:'wave',reducedMotion:'full',character:'liquid',characterMusic:'liquid',mediaPill:'normal',openOnHover:false,hideInFullscreen:false}});
      await reset();await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});timer=setInterval(()=>void send().catch(()=>{}),300);
      for(const style of ['notch','capsule'])for(const mode of ['idle','controls','music','chat','palette','notice'])for(const scale of [100,200]){
        playing=mode==='music';await send();await main.invoke('settings_set',{settings:{style,scale}});await reset();
        if(mode==='controls')await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"controls"});})()');
        if(mode==='chat')await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"chat",tall:true});})()');
        if(mode==='palette')await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:true});})()');
        if(mode==='notice')await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,peek:{kind:"done",label:"Проверка гирлянды"}});})()');
        await pause(mode==='idle'?3400:1300);
        await waitFor(main,'!!document.querySelector("[data-garland=wave]")','Native garland');
        const measure=()=>main.evaluate(`(async()=>{const node=document.querySelector('canvas[data-garland=wave]'),pill=node.closest('[data-island]'),rect=pill.getBoundingClientRect(),pixels=node.getContext('2d').getImageData(0,0,node.width,node.height).data,ratio=node.width/parseFloat(node.style.width),pad=-parseFloat(node.style.left),points=(await import('/assets/runtime-debug.js')).garlandPoints(rect.width,rect.height,${style==='capsule'},parseFloat(pill.style.borderBottomLeftRadius));let hash=2166136261,painted=0,topInk=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>20){painted++;hash=Math.imul(hash^pixels[i]^pixels[i+1]^pixels[i+2]^pixels[i+3],16777619);}}for(let y=0;y<Math.min(node.height,9*ratio);y++)for(let x=Math.floor((rect.width/4+pad)*ratio);x<(rect.width*.75+pad)*ratio;x++){const i=(y*node.width+x)*4;if(pixels[i+3]>20&&Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>20)topInk++;}return {width:rect.width,height:rect.height,points,painted,topInk,hash};})()`);
        const before=await measure();await pause(160);const after=await measure();
        assert(after.painted>100,'Native canvas must paint the garland');assert(after.points.length>8);assert.equal(after.topInk>0,style==='capsule','Top lights belong only to the capsule');
        assert(before.hash!==after.hash,'Wave brightness must change real canvas pixels');
        samples.push({style,mode,scale,...after});
        if(scale===100){const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,`garland-${style}-${mode}.png`),Buffer.from(shot.data,'base64'));}
      }
      await fs.writeFile(path.join(directory,'garland-native-layout.json'),JSON.stringify(samples,null,2));return {styles:['notch','capsule'],modes:['idle','controls','music','chat','palette','notice'],scales:[100,200],glowingLamps:true,sideAndTopEdges:true,samples};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await reset();await pause(3400);}
  });
  await check('Holiday settings preview follows selected island shape and saves all light modes',async()=>{
    const prior=await main.invoke('settings_get');let settings,timer;
    try{
      await main.invoke('settings_set',{settings:{snow:'on',snowFall:false,snowCap:false,garland:'wave',reducedMotion:'full',character:'liquid',characterMusic:'liquid',mediaPill:'title'}});
      let previewTitle='Native preview track';
      const send=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:previewTitle,title:previewTitle,artist:'Native fixture',duration:180000,progress:1000,isPlaying:true})});
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});timer=setInterval(()=>void send().catch(()=>{}),300);
      await main.invoke('open_settings',{section:'holidays'});
      const pages=await pagesReady(page=>page.url.endsWith('/settings.html'));settings=await attach(pages.find(page=>page.url.endsWith('/settings.html')));
      await waitFor(settings,'!!document.querySelector("[data-holiday-live-preview] [data-stage-actual]")','Live production holiday preview');
      await waitFor(settings,'document.querySelector("[data-holiday-live-preview]")?.textContent.includes("Native preview track")','Native media reaches the real preview');
      assert.equal(await settings.evaluate('!!document.querySelector(".wi-holiday-preview-pill")'),false,'Static holiday prototype was removed');
      const samples=[];
      for(const style of ['notch','capsule'])for(const theme of ['dark','light'])for(const garland of ['blink','wave','music','off']){
        await main.invoke('settings_set',{settings:{style,theme,garland}});
        await waitFor(settings,`document.querySelector('[data-holiday-live-preview] [data-island]')?.dataset.islandStyle===${JSON.stringify(style)}&&document.querySelector('[data-holiday-live-preview] [data-island]')?.dataset.islandTheme===${JSON.stringify(theme)}&&${garland==='off'?"!document.querySelector('[data-holidays-settings] [data-garland]')":`!!document.querySelector('[data-holidays-settings] [data-garland=${garland}]')`}`,'Selected preview style and light mode');
        await pause(200);
        const layout=await settings.evaluate(`(()=>{const pill=document.querySelector('[data-holiday-live-preview] [data-island]'),canvas=pill.querySelector('canvas'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)ink++;return {ink,radius:getComputedStyle(pill).borderTopLeftRadius,scrolls:document.documentElement.scrollWidth>innerWidth};})()`);
        assert.equal(layout.scrolls,false);assert.equal(layout.ink>0,garland!=='off');assert.equal(layout.radius==='0px',style==='notch');samples.push({style,theme,garland,...layout});
        if(garland==='wave'){const shot=await settings.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,`garland-settings-${style}-${theme}.png`),Buffer.from(shot.data,'base64'));}
      }
      await main.invoke('plugin:window|hide',{label:'settings'});
      await waitFor(settings,`(async()=>{const {isCharacterAnimationSuspended}=await import('/assets/runtime-debug.js');return !await window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible',{label:'settings'})&&isCharacterAnimationSuspended();})()`,'Hidden native settings suspend preview frames');
      await pause(150);
      previewTitle='Native preview after reopening';await send();
      await waitFor(main,`(async()=>{const {ot}=await import('/assets/runtime-debug.js');return ot.getState().media?.title==='Native preview after reopening';})()`,'Main receives the next native track');
      await pause(500);
      const hiddenTitle=await settings.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');return ot.getState().media?.title;})()`);
      assert.equal(hiddenTitle,'Native preview track','Hidden preview must unsubscribe from media events');
      await main.invoke('open_settings',{section:'holidays'});
      await waitFor(settings,`(async()=>{const {isCharacterAnimationSuspended}=await import('/assets/runtime-debug.js');return await window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible',{label:'settings'})&&!isCharacterAnimationSuspended();})()`,'Visible native settings resume preview frames');
      await waitFor(settings,'document.querySelector("[data-holiday-live-preview]")?.textContent.includes("Native preview after reopening")','Reopened preview bootstraps current native media');
      minimizeOwnedWindow('settings');
      await waitFor(settings,`(async()=>{const {isCharacterAnimationSuspended}=await import('/assets/runtime-debug.js');return await window.__TAURI_INTERNALS__.invoke('plugin:window|is_minimized',{label:'settings'})&&isCharacterAnimationSuspended();})()`,'Minimized native settings suspend preview frames');
      previewTitle='Native preview after restore';await send();await pause(800);
      assert.equal(await settings.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');return ot.getState().media?.title;})()`),'Native preview after reopening','Minimized preview must unsubscribe from media events');
      await main.invoke('open_settings',{section:'holidays'});
      await waitFor(settings,'document.querySelector("[data-holiday-live-preview]")?.textContent.includes("Native preview after restore")','Restored preview bootstraps current native media');
      await main.invoke('settings_set',{settings:{snow:'auto',snowFrom:'12-15',snowTo:'01-15'}});
      const seasonal=await settings.evaluate('!!document.querySelector("[data-snow-now]")');
      if(seasonal){await settings.evaluate('document.querySelector("[data-snow-now]").click()');await waitFor(settings,'!document.querySelector("[data-snow-now]")','Turn on now saved');assert.equal((await main.invoke('settings_get')).snow,'on');}
      return {samples,shapes:['notch','capsule'],modes:['off','blink','wave','music'],themes:['dark','light'],turnOnNow:seasonal,hiddenUnsubscribed:true,reopenedCurrentMedia:true,minimizedUnsubscribed:true,restoredCurrentMedia:true};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});if(settings)await main.invoke('plugin:window|hide',{label:'settings'});}
  });
  await check('Weather cities and visibility preferences survive native settings saves',async()=>{
    const prior=await main.invoke('settings_get');
    const keys=['weatherCity','weatherLat','weatherLon','weatherTimezone','weatherUtcOffset','weatherPlaces','hideOnlyUnder','fullscreenEdge','releaseHotkeysInFullscreen'];
    try{
      await main.invoke('settings_set',{settings:{weatherCity:'Tokyo',weatherLat:35.68,weatherLon:139.76,weatherTimezone:'Asia/Tokyo',weatherUtcOffset:null}});
      await main.invoke('settings_set',{settings:{weatherCity:'London',weatherLat:51.5,weatherLon:-0.12,weatherTimezone:'Europe/London',weatherUtcOffset:3600,hideOnlyUnder:true,fullscreenEdge:true,releaseHotkeysInFullscreen:true}});
      const saved=await main.invoke('settings_get'),cities=JSON.parse(saved.weatherPlaces);
      assert.equal(cities[0].name,'London');assert.equal(cities[1].name,'Tokyo');assert.equal(cities[1].timezone,'Asia/Tokyo');
      assert.equal(saved.hideOnlyUnder,true);assert.equal(saved.fullscreenEdge,true);assert.equal(saved.releaseHotkeysInFullscreen,true);
      await main.invoke('settings_set',{settings:{weatherUtcOffset:null}});assert.equal((await main.invoke('settings_get')).weatherUtcOffset,null);
      await main.invoke('settings_set',{settings:{weatherUtcOffset:999999}});assert.equal((await main.invoke('settings_get')).weatherUtcOffset,null);
      const disk=JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8'));assert.equal(disk.weatherTimezone,'Europe/London');
      return {recentCities:true,timezone:true,nullableOffset:true,preferences:true};
    }finally{
      const patch=Object.fromEntries(keys.map(key=>[key,prior[key]]));
      await main.invoke('settings_set',{settings:patch});
      await main.invoke('settings_set',{settings:{weatherPlaces:prior.weatherPlaces}});
    }
  });
  await check('AI proxy keeps credentials in Windows encryption and rejects invalid addresses',async()=>{
    const prior=await main.invoke('settings_get');
    try{
      await main.invoke('ai_proxy_set',{proxy:'http://fixture-user:fixture-password@127.0.0.1:7890'});
      assert.equal((await main.invoke('settings_get')).aiProxy,'http://127.0.0.1:7890/');
      const encrypted=await fs.readFile(path.join(dataDir,'ai-proxy.key'));
      assert(!encrypted.includes(Buffer.from('fixture-password')));assert(!encrypted.includes(Buffer.from('fixture-user')));
      await main.invoke('settings_set',{settings:{opacityRest:93}});
      for(const file of ['settings.json','settings.json.bak']){
        const saved=await fs.readFile(path.join(dataDir,file),'utf8');assert(!saved.includes('fixture-password'));assert(!saved.includes('fixture-user'));
      }
      await assert.rejects(main.invoke('ai_proxy_set',{proxy:'http://example.com/private?password=secret'}));
      assert.equal((await main.invoke('settings_get')).aiProxy,'http://127.0.0.1:7890/');
      await main.invoke('ai_proxy_set',{proxy:''});assert.equal((await main.invoke('settings_get')).aiProxy,'');
      await assert.rejects(fs.access(path.join(dataDir,'ai-proxy.key')));
      return {encryptedCredentials:true,publicSettings:true,invalidRejected:true,remove:true};
    }finally{await main.invoke('ai_proxy_set',{proxy:prior.aiProxy});}
  });
  await check('Open application and browser inventory returns process names',async()=>{
    const browsers=await main.invoke('installed_browsers'),apps=await main.invoke('open_programs');
    assert(Array.isArray(browsers)&&Array.isArray(apps));
    assert(browsers.every(name=>typeof name==='string'&&name.endsWith('.exe')&&!name.includes('\\')));
    assert(apps.every(app=>typeof app.executable==='string'&&typeof app.name==='string'&&typeof app.title==='string'));
    return {browsers:browsers.length,apps:apps.length};
  });
  await check('Bundled runtime matches the validated production resource manifest',async()=>{
    const expected=JSON.parse(await fs.readFile(path.join(root,'dist','runtime-manifest.json'),'utf8'));
    const actual=await main.evaluate('fetch("/runtime-manifest.json").then(response=>response.json())');
    assert(JSON.stringify(actual)===JSON.stringify(expected),'The executable must embed the latest validated runtime');
    const hashes=await main.evaluate(`(async()=>{
      const files=${JSON.stringify(expected.files)};const result=[];
      for(const file of files){const response=await fetch('/'+file.path);if(!response.ok)throw Error('Bundled file unavailable: '+file.path);
        const bytes=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
        result.push({path:file.path,bytes:bytes.byteLength,sha256:[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')});}
      return result;
    })()`);
    assert.deepEqual(hashes,expected.files);return {files:hashes.length,embeddedHashes:true};
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
  await check('Cross-PC candidate embeds the final built runtime resources', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'dist', 'runtime-manifest.json'), 'utf8'));
    const files = (manifest.files || manifest).filter(file => !file.path.endsWith('.html'));
    for (const file of files) {
      const actual = await main.evaluate(`(async()=>{const r=await fetch(${JSON.stringify('/' + file.path)});if(!r.ok)return {status:r.status};const b=await r.arrayBuffer();return {bytes:b.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(v=>v.toString(16).padStart(2,'0')).join('')};})()`);
      assert.equal(actual.bytes, file.bytes, `Embedded resource size: ${file.path}`);
      assert.equal(actual.sha256, file.sha256, `Embedded resource SHA: ${file.path}`);
    }
    return { resources: files.length, exactFinalDist: true };
  });
  await check('Cross-PC settings retain scroll when saving an unavailable hotkey', async () => {
    const prior = await main.invoke('settings_get');
    await main.invoke('open_settings', { section: 'hotkeys' });
    const pages = await pagesReady(page => page.url.endsWith('/settings.html'));
    const settings = await attach(pages.find(page => page.url.endsWith('/settings.html')));
    await waitFor(settings, 'document.querySelector("[data-nav=hotkeys]")?.dataset.now==="true"', 'Hotkey settings');
    const settingsScroll = 'document.querySelector("[data-settings-content]")';
    assert.deepEqual(await settings.evaluate(`[getComputedStyle(${settingsScroll}).scrollbarWidth,getComputedStyle(document.querySelector("[data-settings-nav-list]")).scrollbarWidth]`),['none','none']);
    await settings.evaluate(`${settingsScroll}.scrollTop=180`);
    await pause(120);
    const before = await settings.evaluate(`${settingsScroll}.scrollTop`);
    assert(before > 100, 'Hotkey settings must overflow for this regression');
    try {
      await settings.invoke('settings_set', { settings: { hotkeyPalette: 'UnavailableKey' } });
      await pause(300);
      const after = await settings.evaluate(`${settingsScroll}.scrollTop`);
      assert.equal(after, before, 'Changing settings must not reset the section scroll');
      await settings.evaluate('document.querySelector("[data-nav=general]").click()');
      await pause(100);
      assert.equal(await settings.evaluate(`${settingsScroll}.scrollTop`), 0);
      return { before, after, sectionNavigationResetsScroll: true, passive: true };
    } finally {
      await settings.invoke('settings_set', { settings: { hotkeyPalette: prior.hotkeyPalette } });
      await main.invoke('plugin:window|close', { label: 'settings' });
      await waitForWindowClosed('/settings.html');
    }
  });
  await check('Cross-PC weather pill accepts text and persists the chosen city', async () => {
    const prior = await main.invoke('settings_get');
    await main.invoke('settings_set', { settings: { weatherCity: '', weatherLat: 0, weatherLon: 0, moduleWeather: true } });
    try {
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({palette:false,expanded:true,tab:"weather"});})()');
      await waitFor(main, 'document.activeElement?.placeholder?.startsWith("Город:")', 'Weather city input focus');
      await main.command('Input.insertText', { text: 'Брянск' });
      await main.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Найти").click()');
      await waitFor(main, 'Array.from(document.querySelectorAll("button")).some(b=>b.querySelector("span")?.textContent==="Брянск")', 'City search result');
      await main.evaluate('(async()=>{const {O}=await import("/assets/runtime-debug.js");window.__crossPcSettingsSet=O.settingsSet;O.settingsSet=()=>Promise.reject("Fixture weather save denied");})()');
      try {
        await main.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.querySelector("span")?.textContent==="Брянск").click()');
        await waitFor(main, 'Array.from(document.querySelectorAll("[role=alert]")).some(e=>e.textContent.includes("Fixture weather save denied"))', 'Visible city save error');
        assert.equal((await main.invoke('settings_get')).weatherCity, '', 'Failed save must keep the prior city');
      } finally {
        await main.evaluate('(async()=>{const {O}=await import("/assets/runtime-debug.js");O.settingsSet=window.__crossPcSettingsSet;delete window.__crossPcSettingsSet;})()');
      }
      await main.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.querySelector("span")?.textContent==="Брянск").click()');
      await waitFor(main, '(async()=>{const s=await window.__TAURI_INTERNALS__.invoke("settings_get");return s.weatherCity==="Брянск"&&s.weatherLat===53.2424;})()', 'Saved city');
      const saved = JSON.parse(await fs.readFile(path.join(dataDir, 'settings.json'), 'utf8'));
      assert.equal(saved.weatherCity, 'Брянск'); assert.equal(saved.weatherLon, 34.3668);
      await waitFor(main, '!!document.querySelector("[data-wx-now]")', 'Forecast after city selection');
      return { city: saved.weatherCity, persisted: true, enteredThroughPill: true, saveFailureVisibleAndRetryWorks: true, passive: true };
    } finally {
      await main.invoke('settings_set', { settings: { weatherCity: prior.weatherCity, weatherLat: prior.weatherLat, weatherLon: prior.weatherLon, moduleWeather: prior.moduleWeather } });
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.getState().close();})()');
    }
  });
  await check('Cross-PC palette focuses on every opening and accepts text without a click', async () => {
    const input = 'Array.from(document.querySelectorAll("input")).find(e=>e.placeholder.startsWith("Программа,"))';
    const samples = [];
    for (let cycle = 0; cycle < 8; cycle++) {
      await main.invoke('plugin:event|emit', { event: 'island:palette', payload: null });
      await waitFor(main, `document.activeElement===(${input})`, 'Palette input focus');
      await main.command('Input.insertText', { text: cycle % 2 ? 'поиск' : '12*34' });
      assert.equal(await main.evaluate(`(${input}).value`), cycle % 2 ? 'поиск' : '12*34');
      if (cycle === 0) samples.push(...await main.evaluate('new Promise(resolve=>{const frames=[],start=performance.now();const tick=()=>{const r=document.querySelector("[data-island]").getBoundingClientRect();frames.push({ms:Math.round(performance.now()-start),w:r.width,h:r.height});if(performance.now()-start<500)requestAnimationFrame(tick);else resolve(frames);};requestAnimationFrame(tick);})'));
      await main.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await main.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await waitFor(main, `!(${input})`, 'Palette closed');
    }
    assert(samples.length > 2 && samples.every(s => Number.isFinite(s.w) && Number.isFinite(s.h)));
    const foreground = await assertPassiveForeground(main);
    return { opens: 8, textWithoutClicks: true, samples, foreground, nativeKeyboardActivation: 'Not exercised in passive QA' };
  });
  await check('Cross-PC browser cover arrives through metadata without a separate cover event', async () => {
    const cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const payload = { key: 'cross-pc-browser', app: 'browser-fixture', title: 'Browser fixture', artist: 'Fixture', playing: true, positionMs: 0, durationMs: 300000, cover };
    const publish = () => main.invoke('plugin:event|emit', { event: 'media:update', payload });
    const timer = setInterval(() => { void publish().catch(() => {}); }, 100);
    try {
      await publish();
      await waitFor(main, `(async()=>{const {ot}=await import("/assets/runtime-debug.js");const s=ot.getState();return s.media?.key==="cross-pc-browser"&&s.cover===${JSON.stringify(cover)};})()`, 'Embedded browser thumbnail');
      return { metadataOnly: true, coverApplied: true, browserFixture: true };
    } finally { clearInterval(timer); }
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
  await check('ChatGPT is selectable in the native chat and opens its isolated provider page',async()=>{
    try{
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"chat",chatService:"island",peek:null,queue:[]});})()');
      await waitFor(main,'!!document.querySelector("[data-chat-service=chatgpt]")','ChatGPT selector');
      await main.evaluate('document.querySelector("[data-chat-service=chatgpt]").click()');
      await waitFor(main,'localStorage.getItem("island-chat-service")==="chatgpt"','Persisted ChatGPT selection');
      await pagesReady(page=>page.url===webAiUrl+'/chatgpt');
      await waitFor(main,'window.__TAURI_INTERNALS__.invoke("web_ai_status").then(items=>items.some(item=>item.service==="chatgpt"&&item.phase==="loaded"))','ChatGPT native navigation');
      assert.equal((await main.invoke('license_status')).source,'free');
      return {visibleSelector:true,persistedSelection:true,nativeNavigation:true,free:true,providerFixture:true};
    }finally{
      await main.evaluate('document.querySelector("[data-chat-service=island]")?.click()');
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,tab:"home",chatService:"island"});})()');
    }
  });
  await check('Hidden media sources cannot replace the selected player and can be restored',async()=>{
    const prior=await main.invoke('settings_get'),id='ru.yandex.desktop.music.mod.connector';
    let timer;
    const publish=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'visibility-fixture',title:'Visibility fixture',artist:'Fixture',duration:300000,progress:10000,isPlaying:true})});
    try{
      await main.invoke('settings_set',{settings:{mediaHidden:[]}});
      const response=await publish();assert(response.ok);timer=setInterval(()=>void publish().catch(()=>{}),1000);
      await main.invoke('media_pick',{id});assert.equal((await main.invoke('bootstrap')).media.app,id);
      // Only the source count is a UI fixture; Hide still uses the real native
      // source and settings commands in this isolated profile.
      await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({expanded:true,tab:'home',peek:null,queue:[]});
        window.__woodsSourceCountFixture=setInterval(()=>{const media=ot.getState().media;if(media)ot.setState({media:{...media,sources:2}});},20);})()`);
      await waitFor(main,'!!document.querySelector("[data-media-choose]")','Source picker button');
      await main.evaluate('document.querySelector("[data-media-choose]").click()');
      await waitFor(main,'!!document.querySelector("[data-media-sources] > div button:last-child")','Source hide button');
      await main.evaluate('clearInterval(window.__woodsSourceCountFixture);document.querySelector("[data-media-sources] > div button:last-child").click()');
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('settings_get').then(settings=>settings.mediaHidden.includes(${JSON.stringify(id)}))`,'Source hidden from its picker');
      await main.invoke('settings_set',{settings:{mediaHidden:[id.toUpperCase()]}});
      assert.notEqual((await main.invoke('bootstrap')).media?.app,id);
      const sources=await main.invoke('media_sources');assert.equal(sources.find(source=>source.id===id).hidden,true);
      await assert.rejects(main.invoke('media_pick',{id}));
      const onDisk=JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8'));assert.deepEqual(onDisk.mediaHidden,[id.toUpperCase()]);
      await main.invoke('open_settings',{section:'general'});
      const pages=await pagesReady(page=>page.url.endsWith('/settings.html'));
      const settings=await attach(pages.find(page=>page.url.endsWith('/settings.html')));
      await waitFor(settings,'!!document.querySelector("[data-media-visibility] [role=switch]")','Player visibility settings');
      await settings.evaluate('document.querySelector("[data-media-visibility] [role=switch]").click()');
      await waitFor(main,'window.__TAURI_INTERNALS__.invoke("settings_get").then(settings=>settings.mediaHidden.length===0)','Player restored');
      await main.invoke('media_pick',{id});assert.equal((await main.invoke('bootstrap')).media.app,id);
      await main.invoke('plugin:window|close',{label:'settings'});await waitForWindowClosed('/settings.html');
      return {hiddenFromPicker:true,hiddenFromSelection:true,caseInsensitive:true,persisted:true,restoredFromSettings:true,sourceCountFixture:true};
    }finally{
      await main.evaluate('clearInterval(window.__woodsSourceCountFixture)');
      clearInterval(timer);await main.invoke('media_pick',{id:null});
      await main.invoke('settings_set',{settings:{mediaHidden:prior.mediaHidden}});
      await publish();
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false,pinned:false,holdOpen:false,tab:"home"});})()');
    }
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
    const prior=await main.invoke('settings_get');let progress=1000,playing=true,at=Date.now(),timer,phase='bootstrap',title='Test Slowed',trackId='lyrics-fixture';
    const publishEvents=[];
    await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');const trace={started:performance.now(),samples:[]};window.__woodsLyricsQaTrace=trace;trace.timer=setInterval(()=>{const state=ot.getState(),pill=document.querySelector('[data-media-pill]');trace.samples.push({at:performance.now()-trace.started,media:state.media,mediaLive:state.mediaLive,expanded:state.expanded,hovered:state.hovered,holdOpen:state.holdOpen,pinned:state.pinned,tab:state.tab,peek:state.peek?.kind,settings:{mediaPill:state.settings?.mediaPill,lyrics:state.settings?.lyrics,lyricsInHome:state.settings?.lyricsInHome,lyricsInPlayer:state.settings?.lyricsInPlayer},dom:{mode:pill?.dataset.mediaPill,now:Array.from(document.querySelectorAll('[data-lyrics-now]')).map(e=>e.textContent),folded:Array.from(document.querySelectorAll('[data-lyrics-line]')).map(e=>e.textContent),paused:!!document.querySelector('[data-media-paused]')}});if(trace.samples.length>1000)trace.samples.shift();},50);})()`);
    const saveTrace=async outcome=>{
      const browser=await main.evaluate(`(()=>{const trace=window.__woodsLyricsQaTrace;return {started:trace.started,samples:trace.samples};})()`);
      const tracePath=path.join(directory,'lyrics-timing-proof.json');
      await fs.writeFile(tracePath,JSON.stringify({outcome,phase,publishEvents,browser},null,2));
      return tracePath;
    };
    const publish=async()=>{
      const frame={trackId,title,artist:'Fixture',duration:12000,progress:Math.min(12000,progress+(playing?Date.now()-at:0)),isPlaying:playing};
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
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[],hovered:false,pinned:false,holdOpen:false,tab:"home"});})()');
      await waitFor(main,'document.querySelector("[data-media-pill=lyrics] [data-lyrics-line]")?.textContent.includes("Третья строка")','Folded lyrics mode');
      await main.evaluate('(async()=>{const m=await import("/assets/runtime-debug.js");m.ot.setState({expanded:true,tab:"home"});})()');
      phase='home lyrics';
      await waitFor(main,'document.querySelector("[data-home] [data-lyrics-now]")?.textContent === "Третья строка"','Home lyrics mode');
      phase='plain text after switching tracks';
      trackId='plain-fixture';title='Plain only';progress=1500;at=Date.now();await publish();
      await waitFor(main,'!!document.querySelector("[data-home] [data-lyrics-static]")','Unsynced lyrics panel');
      const plain=await main.evaluate(`(()=>{const el=document.querySelector('[data-home] [data-lyrics-static]');el.scrollTop=50;return {text:el.textContent,scroll:el.scrollTop,active:!!document.querySelector('[data-lyrics-now]')}})()`);
      assert.match(plain.text,/Текст без синхронизации|Unsynced lyrics/);assert.match(plain.text,/Только обычный текст/);
      assert(plain.scroll>0);assert.equal(plain.active,false);
      phase='clear plain text on missing track';
      trackId='missing-fixture';title='Missing';await publish();
      await waitFor(main,`import('/assets/runtime-debug.js').then(({lyricsStore})=>lyricsStore.getState().status==='none'&&lyricsStore.getState().lyrics===null&&!document.querySelector('[data-lyrics-static],[data-lyrics-now]'))`,'Missing track clears lyrics');
      assert(lyricsRequests>=6);const timingProof=await saveTrace('passed');return {milliseconds:true,highlight:true,advance:true,pause:true,seekBothDirections:true,foldedLyrics:true,homeLyrics:true,plainText:true,missing404:true,retryable503:true,isolatedBridge:true,timingProof};
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
  await check('Lyrics fit the current short, wrapped and unbroken line with a stable height',async()=>{
    const prior=await main.invoke('settings_get');let position=1000,positionAt=Date.now(),timer;
    const send=async()=>{
      const response=await fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'geometry-fixture',title:'Geometry Motion',artist:'Fixture',duration:20000,progress:position+Date.now()-positionAt,isPlaying:true})});assert.equal(response.status,200);
    };
    try{
      await main.invoke('settings_set',{settings:{lyrics:true,mediaPill:'normal',character:'liquid',liquidWith:false,showClock:false,showBattery:false,showWeather:false,showCaps:false,showPrivacy:false,agentsStatus:false,obsStatus:false,moduleShelf:false,downloadsInPill:'off',deviceBattery:'off',loadInPill:[],layoutInPill:false,desktopInPill:false}});
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[]});})()');
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});timer=setInterval(()=>void send().catch(()=>{}),200);
      await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().media?.title==="Geometry Motion";})()','Geometry track selected before measuring mode transition');
      await main.evaluate(`(()=>{window.__lyricMotion=[];const start=performance.now();function tick(){const p=document.querySelector('[data-island]')?.getBoundingClientRect();window.__lyricMotion.push({t:performance.now()-start,width:p?.width,height:p?.height});if(performance.now()-start<2500)requestAnimationFrame(tick);}requestAnimationFrame(tick);})()`);
      await main.invoke('settings_set',{settings:{mediaPill:'lyrics'}});
      await waitFor(main,'document.querySelector("[data-lyrics-line]")?.textContent === "Да"','Short geometry line');await pause(1000);
      const frames=await main.evaluate(`new Promise(resolve=>{const samples=[],start=performance.now();function tick(){const pill=document.querySelector('[data-island]'),viewport=document.querySelector('[data-lyrics-viewport]');const p=pill?.getBoundingClientRect(),v=viewport?.getBoundingClientRect();samples.push({t:performance.now()-start,width:p?.width,height:p?.height,viewportHeight:v?.height,text:document.querySelector('[data-lyrics-line]')?.textContent});if(performance.now()-start<1800)requestAnimationFrame(tick);else resolve(samples);}requestAnimationFrame(tick);})`);
      await fs.writeFile(path.join(directory,'lyrics-steady-frames.json'),JSON.stringify(frames));
      const opening=await main.evaluate('window.__lyricMotion');
      await fs.writeFile(path.join(directory,'lyrics-motion.json'),JSON.stringify(opening));
      assert(frames.length>15);const width=frames.at(-1).width,height=frames.at(-1).height;
      assert(Math.max(...frames.map(f=>f.width))-Math.min(...frames.map(f=>f.width))<1,'Short line width did not settle: '+JSON.stringify({first:frames[0],last:frames.at(-1)}));
      // Width is quantized to 2 physical pixels; very close RAF timestamps
      // must not amplify that harmless rounding into a fictitious large jump.
      const normalizedSteps=opening.slice(1).map((frame,i)=>Math.abs(frame.width-opening[i].width)*16/Math.max(4,frame.t-opening[i].t));
      await fs.writeFile(path.join(directory,'lyrics-motion.json'),JSON.stringify(opening));
      assert(Math.max(...normalizedSteps)<70,'Lyrics width must animate rather than jump: '+JSON.stringify(opening.filter((f,i)=>i&&normalizedSteps[i-1]>=70)));
      assert(Math.max(...opening.map(f=>f.width))<=Math.max(width,opening[0].width)+2,'Lyrics transition must not overshoot its starting or final width');
      const lines=[];
      for(const next of [10900,15900,1000]){
        position=next;positionAt=Date.now();await send();await pause(1150);
        const sample=await main.evaluate(`(()=>{const p=document.querySelector('[data-island]').getBoundingClientRect(),v=document.querySelector('[data-lyrics-viewport]').getBoundingClientRect(),line=Array.from(document.querySelectorAll('[data-lyrics-line]')).find(e=>Number(getComputedStyle(e).opacity)>.99),text=line?.lastElementChild;return {width:p.width,height:p.height,viewportHeight:v.height,textHeight:text?.getBoundingClientRect().height,wrap:text?getComputedStyle(text).overflowWrap:null,lineCount:document.querySelectorAll('[data-lyrics-line]').length,text:line?.textContent};})()`);
        await fs.writeFile(path.join(directory,`lyrics-${next}-layout.json`),JSON.stringify({baseline:{width,height},sample}));
        assert(sample.width>=width-1&&sample.width<=680,JSON.stringify(sample));assert(Math.abs(sample.height-height)<1,JSON.stringify({height,next,sample}));
        if(next===10900)assert(sample.width>width+30,'A long line must get more room than a short line');
        if(next===1000)assert(Math.abs(sample.width-width)<2,'Returning to the short line must release the long line width: '+JSON.stringify({width,sample}));
        assert.equal(sample.viewportHeight,30);assert(sample.textHeight<=30);assert.equal(sample.lineCount,1);assert.equal(sample.wrap,'anywhere');lines.push({position:next,...sample,text:undefined});
        if(next===10900){const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'lyrics-wrapped.png'),Buffer.from(shot.data,'base64'));}
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
    const trace=[];
    const sample=async()=>{
      const value=await main.evaluate('(async()=>{const {lyricsStore,ot}=await import("/assets/runtime-debug.js"),state=ot.getState(),p=document.querySelector("[data-island]").getBoundingClientRect(),v=document.querySelector("[data-lyrics-viewport]")?.getBoundingClientRect();return {width:p.width,height:p.height,viewportHeight:v?.height,lineW:lyricsStore.getState().lineW,wrap:lyricsStore.getState().wrap,pill:document.querySelector("[data-media-pill]")?.dataset.mediaPill,playing:state.media?.playing,mediaLive:state.mediaLive,source:state.media?.app,key:state.media?.key,settingsPill:state.settings?.mediaPill,scale:state.settings?.scale,character:state.settings?.character,characterMusic:state.settings?.characterMusic,expanded:state.expanded,palette:state.palette,peek:state.peek?.kind};})()');
      trace.push({at:Date.now(),...value});await fs.writeFile(path.join(directory,'typed-geometry-trace.json'),JSON.stringify(trace,null,2));return value;
    };
    // WebView2 rounds layout coordinates to subpixels when page zoom is 80%.
    const heightIs=(value,expected)=>assert(Math.abs(value-expected)<0.05,`Height ${value}, expected ${expected}: ${JSON.stringify(trace.at(-1))}`);
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
        position=8500;await send();await pause(900);const long=await sample();assert(long.width>lyrics.width+30&&long.width<=681,JSON.stringify({scale,lyrics,long}));assert.equal(long.height,lyrics.height);
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
        await assertPassiveForeground(main);
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
        assert(Math.abs(sample.badge.width-11)<.05&&Math.abs(sample.badge.height-11)<.05);assert.equal(sample.position,'absolute');assert.equal(sample.bars,2);assert.equal(sample.color,'rgb(255, 255, 255)');
        measurements.push({scale,mode,...sample});
        if(scale===100&&mode==='title'){
          const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'pause-badge-fixed.png'),Buffer.from(shot.data,'base64'));
          const p=sample.pill;const crop=await main.command('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,p.left-3),y:Math.max(0,p.top),width:p.width+6,height:p.height,scale:3}});await fs.writeFile(path.join(directory,'pause-badge-fixed-detail.png'),Buffer.from(crop.data,'base64'));
        }
      }
      return {measurements,insideCover:true,insidePill:true,twoBarsVisible:true,highContrast:true,scales:[80,100,150,200],modes:['title','normal','lyrics']};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await pause(3400);}
  });
  await check('Timer and reminder cards render the selected attention character in both native themes',async()=>{
    const before=await main.invoke('settings_get');const samples=[];
    try{
      for(const theme of ['dark','light'])for(const character of ['pixel','coffee','ginger','liquid'])for(const kind of ['timer','reminder']){
        await main.invoke('settings_set',{settings:{theme,character,characterMusic:'',snow:'off'}});
        await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:false,holdOpen:false,mediaLive:false,peek:{id:'attention-fixture',kind:${JSON.stringify(kind)},at:Date.now(),length:60000,reminder:'attention-fixture',text:'Attention fixture'},queue:[]}))`);
        const selected=character!=='liquid';
        await waitFor(main,`(()=>{const card=document.querySelector('[data-${kind}-peek]');return !!card&&(!!card.querySelector('[data-character=${character}][data-character-mood=attn]')===${selected});})()`,'Attention card selection');
        const bounds=await main.evaluate(`(()=>{const card=document.querySelector('[data-${kind}-peek]'),p=card.getBoundingClientRect(),art=card.querySelector('[data-character]')?.getBoundingClientRect();return {hasCharacter:!!art,contained:!art||art.left>=p.left-1&&art.right<=p.right+1&&art.top>=p.top-1&&art.bottom<=p.bottom+1};})()`);
        assert(bounds.contained);samples.push({theme,character,kind,...bounds});
      }
      return {samples,syntheticPeeks:true,alarmNotTriggered:true};
    }finally{
      await main.invoke('settings_set',{settings:{theme:before.theme,character:before.character,characterMusic:before.characterMusic,snow:before.snow}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:false,holdOpen:false,peek:null,queue:[]}))`);
    }
  });
  await check('Typed character engine renders 41 builtin and 9 optional characters, pause, sleep and cursor at every scale',async()=>{
    const prior=await main.invoke('settings_get');
    const measured=[];let playing=false,timer;
    const send=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'character-engine-fixture',title:'Character fixture',artist:'Fixture',duration:20000,progress:1000,isPlaying:playing})});
    try {
      await main.invoke('settings_set',{settings:{liquidWith:false,showClock:false,showBattery:false,showWeather:false,showCaps:false,layoutInPill:false,desktopInPill:false,agentsStatus:false,obsStatus:false,showPrivacy:false,downloadsInPill:'off',moduleShelf:false,openOnHover:false,lyrics:false,mediaPill:'normal',moduleMedia:true}});
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});
      timer=setInterval(()=>void send().catch(()=>{}),80);
      const catalog=await main.evaluate('(async()=>{const {characterCatalog}=await import("/assets/runtime-debug.js");return characterCatalog.map(({id,kind,bitmap})=>({id,kind,source:bitmap?.source}));})()');
      assert.equal(catalog.length,51);assert.equal(catalog.filter(c=>c.source==='codex').length,9);
      for(const id of ['snowman','frost','bullfinch','ginger','deer'])assert(catalog.some(c=>c.id===id),'Missing seasonal character '+id);
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
      return {builtinCharacters:41,optionalCodex:9,optionalStatus:library.status,plainOption:true,scales:[80,100,150,200],states:['idle','music','pause','sleep'],
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
    assert.equal(options.length,50);assert.equal(options.filter(p=>!p.id.startsWith('codex-pet-')).length,41);
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
  await check('Reliability settings show connections updates and named switches without focus',async()=>{
    const prior=await main.invoke('settings_get');
    let settings;
    try{
      await main.invoke('settings_set',{settings:{language:'ru',onboardingCompleted:false,reducedMotion:'reduce'}});
      await main.invoke('open_settings',{section:'connections'});
      const pages=await pagesReady(p=>p.url.endsWith('/settings.html'));
      settings=await attach(pages.find(p=>p.url.endsWith('/settings.html')));
      await waitFor(settings,'!!document.querySelector("[data-connection-settings]")','Connections screen');
      await waitFor(settings,'!!document.querySelector(".wi-connection")','Connection statuses');
      assert.equal(await settings.invoke('plugin:window|is_focused',{label:'settings'}),false);
      await waitFor(main,'document.documentElement.dataset.woodsReducedMotion==="true"','Main reduced motion');
      await waitFor(settings,'document.documentElement.dataset.woodsReducedMotion==="true"','Settings reduced motion');
      const labels=await settings.evaluate('Array.from(document.querySelectorAll("[role=switch]")).map(node=>node.getAttribute("aria-label"))');
      assert(labels.length>30);assert(labels.every(label=>typeof label==='string'&&label.trim()),JSON.stringify(labels));
      await settings.evaluate('Array.from(document.querySelectorAll("[data-connection-settings] button")).find(button=>button.textContent.trim()==="Сведения").click()');
      await waitFor(settings,'!!document.querySelector(".wi-report")','Support details');
      const report=await settings.evaluate('document.querySelector(".wi-report").textContent');
      const version=(await main.invoke('bootstrap')).version;
      assert(report.includes('Woods Island '+version));assert(!report.includes('\\'));assert(!report.includes('://'));
      const shot=await settings.command('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(directory,'reliability-connections.png'),Buffer.from(shot.data,'base64'));
      await settings.evaluate('document.querySelector("[data-nav=updates]").click()');
      await waitFor(settings,'!!document.querySelector("[data-update-settings]")','Update screen');
      const status=await main.invoke('update_status');assert.equal(typeof status.canInstall,'boolean');
      const actions=await settings.evaluate('Array.from(document.querySelector("[data-update-settings]").querySelectorAll("button")).map(button=>button.textContent)');
      if(status.status!=='ready')assert(!actions.includes('Установить'));
      await main.invoke('settings_set',{settings:{language:'en',reducedMotion:'full',onboardingCompleted:true}});
      await waitFor(settings,'document.documentElement.lang==="en" && document.documentElement.dataset.woodsReducedMotion==="false"','English and full motion');
      await waitFor(settings,'document.querySelector("[data-update-settings]")?.textContent.includes("Check for updates")','English update copy');
      assert.equal(await settings.evaluate('document.documentElement.scrollWidth > innerWidth'),false);
      return {namedSwitches:labels.length,connections:true,updater:true,languageSwitch:true,reducedMotion:true,focused:false,installInvoked:false};
    }finally{
      await main.invoke('settings_set',{settings:prior});
      if(settings){await settings.invoke('plugin:window|close',{label:'settings'}).catch(()=>{});await waitForWindowClosed('/settings.html');}
    }
  });
  await check('Weather IANA timezone refreshes without retaining the previous cached offset',async()=>{
    const prior=await main.invoke('settings_get');
    try{
      await main.invoke('settings_set',{settings:{weatherTimezone:'Asia/Kolkata'}});
      const data=await main.invoke('weather_get');
      assert(data);assert.equal(data.timezone,'Asia/Kolkata');assert.equal(data.utcOffset,19800);
      assert.equal(data.timezoneSource,'manual');assert.equal(data.timezoneWarning,false);
      await main.invoke('settings_set',{settings:{weatherTimezone:'Europe/London'}});
      const changed=await main.invoke('weather_get');assert.equal(changed.timezone,'Europe/London');
      assert.notEqual(changed.utcOffset,19800);
      return {manualIana:true,cacheInvalidated:true,halfHourOffset:true};
    }finally{await main.invoke('settings_set',{settings:prior});}
  });
  await check('Weather UV precipitation sun wind humidity and pressure cards use native forecast values',async()=>{
    const prior=await main.invoke('settings_get'),saved=structuredClone(weatherFixture);
    try{
      for(const [index,entry]of weatherFixture.properties.timeseries.entries()){entry.data.instant.details.ultraviolet_index_clear_sky=2.4+index%4;entry.data.instant.details.air_pressure_at_sea_level=1012+index*.2;}
      await main.invoke('settings_set',{settings:{weatherCity:'Брянск',weatherLat:53.2424,weatherLon:34.3668,weatherTimezone:'Europe/Moscow',weatherUnits:'metric',language:'ru'}});
      await main.invoke('weather_refresh');const forecast=await main.invoke('weather_get');assert.equal(forecast.now.uv,2.4);assert(forecast.days[0].uvMax>=2.4);assert.equal(forecast.now.humidity,80);assert(forecast.days[0].sunset>forecast.days[0].sunrise);
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:true,tab:"weather",palette:false,peek:null,queue:[]});})()');
      await waitFor(main,'["wind","humidity","pressure","sun","precip","uv"].every(mark=>!!document.querySelector(`[data-wx-tile="${mark}"]`))','All native weather cards');await pause(1800);
      const text=await main.evaluate('Object.fromEntries(["wind","humidity","pressure","sun","precip","uv"].map(mark=>[mark,document.querySelector(`[data-wx-tile="${mark}"]`).textContent]))');
      assert(!Object.values(text).some(value=>/NaN|undefined/.test(value)));assert(text.humidity.includes('80'));assert(text.pressure.includes(String(Math.round(forecast.now.pressure*.750062))),JSON.stringify(text));assert(!text.sun.includes('недоступны'));assert(!text.uv.includes('Нет данных'));
      const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'weather-all-cards.png'),Buffer.from(shot.data,'base64'));
      for(const entry of weatherFixture.properties.timeseries)delete entry.data.next_1_hours.details.precipitation_amount;
      await main.invoke('weather_refresh');await waitFor(main,'document.querySelector("[data-wx-tile=precip]")?.textContent.includes("Нет данных")','Absent precipitation is not fabricated zero');
      return {cards:Object.keys(text),nativeUvAndMax:true,sunTimes:true,humidity:true,pressure:true,precipitationMissingState:true,localForecastFixture:true};
    }finally{weatherFixture.properties.timeseries=saved.properties.timeseries;await main.invoke('settings_set',{settings:prior});if(prior.weatherCity)await main.invoke('weather_refresh');await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,tab:"home",peek:null,queue:[]});})()');}
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
  await check('Pill update action opens update settings without starting an installation',async()=>{
    const result=await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js'),{O:api}=await import('/assets/runtime-debug.js');const original=api.updateInstall,open=api.openSettings;let requests=0,section=null;try{api.updateInstall=()=>{requests++;return Promise.resolve(true);};api.openSettings=value=>{section=value;return Promise.resolve(true);};ot.setState({expanded:true,palette:false,peek:null,queue:[],updating:null});ot.getState().installUpdate();await new Promise(r=>setTimeout(r,150));return {requests,section,updating:ot.getState().updating,expanded:ot.getState().expanded};}finally{api.updateInstall=original;api.openSettings=open;ot.setState({expanded:false,peek:null,queue:[],updating:null});}})()`);
    assert.equal(result.requests,0);assert.equal(result.section,'updates');assert.equal(result.updating,null);assert.equal(result.expanded,false);return {...result,backendOpenMocked:true};
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
      assert(samples.every(s=>s.bands.length===24&&s.bands.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Number.isFinite(s.level)&&s.level>=0&&s.level<=1));
      assert(samples.every(s=>s.age<700||(s.level===0&&s.bands.every(v=>v===0))),
        'Nonzero live spectrum must remain fresh; silence may stop repeating events');
      const peak=Math.max(...samples.map(s=>s.level)),bandPeak=Math.max(...samples.flatMap(s=>s.bands)),paths=new Set(samples.map(s=>s.path)).size;
      if(process.env.WOODS_TEST_EXPECT_AUDIO==='1'){assert(peak>0.00001,'Expected playing audio must reach WASAPI');assert(bandPeak>0,'Expected spectrum must contain energy');}
      if(peak>0.00001)assert(paths>1,'The liquid contour must change with measured sound');
      const native=await main.invoke('window_diagnostics');
      const contourBottom=await main.evaluate(`(()=>{const p=document.querySelector('[data-island] > svg path');const box=p.getBBox();return new DOMPoint(0,box.y+box.height).matrixTransform(p.getScreenCTM()).y;})()`);
      assert(native.visualBounds[3]-native.bounds[3]>=30*native.pageFactor,'Native region reserves space below the hitbox for the stronger wave');
      assert(contourBottom*native.pageFactor<=native.visualBounds[3]+2,'Native region contains the liquid contour');
      assert(samples.every(s=>s.path));return {eightBands:true,liveSpectrumFresh:true,silenceMayBeDeduplicated:true,peak,bandPeak,distinctContours:paths,liveSoundDetected:peak>0.00001,explicitOutputPriority:true,nativeContourContained:true};
    }finally{
      clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:{audioOutput:prior.audioOutput,character:prior.character,characterMusic:prior.characterMusic,liquidWith:prior.liquidWith,liquidSpectrum:prior.liquidSpectrum,mediaPill:prior.mediaPill}});await pause(3400);
    }
  });
  await check('Mini equalizer follows actual WASAPI bands and track accent through all music modes',async()=>{
    const prior=await main.invoke('settings_get');let playing=true,timer;const samples=[];
    const send=()=>fetch(`http://127.0.0.1:${musicPort}/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId:'mini-spectrum',title:'Geometry',artist:'Fixture',duration:20000,progress:1000,isPlaying:playing})});
    try{
      await main.invoke('settings_set',{settings:{character:'none',characterMusic:'none',lyrics:true,openOnHover:false,reducedMotion:'full',mediaPill:'normal'}});
      await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({expanded:false,palette:false,peek:null,queue:[]});})()');
      await send();await main.invoke('media_pick',{id:'ru.yandex.desktop.music.mod.connector'});timer=setInterval(()=>void send().catch(()=>{}),150);
      await waitFor(main,'(async()=>{const {ot}=await import("/assets/runtime-debug.js");return ot.getState().media?.title==="Geometry";})()','Mini track selected');
      await pause(4200); // Let the missing-cover grace finish before checking explicit test accents.
      for(const mode of ['normal','title','lyrics','player']){
        await main.invoke('settings_set',{settings:{mediaPill:mode}});
        await waitFor(main,`!!document.querySelector('[data-media-pill=${mode}]')`,'Selected mini mode '+mode);
        await waitFor(main,'!!document.querySelector("[data-audio-glyph]")','Mini spectrum '+mode);
        assert.equal(await main.evaluate(`document.querySelector('[data-media-pill=${mode}]').querySelectorAll('[data-audio-glyph]').length`),1,'One mini spectrum in the active pill');
        await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({accent:"rgb(229, 72, 77)"});})()');
        await main.evaluate('(async()=>{window.__miniDebug=await import("/assets/runtime-debug.js");})()');
        const readings=await main.evaluate(`new Promise(resolve=>{const values=[],start=performance.now();function tick(){const glyph=document.querySelector('[data-audio-glyph]');const state=window.__miniDebug.ot.getState();values.push({playing:state.media?.playing,hidden:document.hidden,suspended:window.__miniDebug.isCharacterAnimationSuspended(),level:state.level,bands:state.bands,age:performance.now()-state.bandsAt,color:getComputedStyle(glyph).color,heights:Array.from(glyph.querySelectorAll('rect')).map(e=>Number(e.getAttribute('height')))});if(performance.now()-start<1600)setTimeout(tick,50);else resolve(values);}tick();})`);
        await fs.writeFile(path.join(directory,'mini-'+mode+'-readings.json'),JSON.stringify(readings,null,2));
        assert(readings.every(sample=>sample.color==='rgb(229, 72, 77)'&&sample.heights.length===4));
        const bands=await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");const s=ot.getState();return {level:s.level,bands:s.bands,age:performance.now()-s.bandsAt};})()');
        if(bands.level>.00001&&bands.age<700)assert(readings.some(sample=>sample.heights.some(height=>height>2.6)),'Actual sound must move mini bars');
        await main.evaluate('(async()=>{const {ot}=await import("/assets/runtime-debug.js");ot.setState({accent:"rgb(90, 184, 255)"});})()');
        await waitFor(main,'getComputedStyle(document.querySelector("[data-audio-glyph]")).color==="rgb(90, 184, 255)"','New track accent');
        samples.push({mode,bands,maxHeight:Math.max(...readings.flatMap(sample=>sample.heights)),distinctFrames:new Set(readings.map(sample=>JSON.stringify(sample.heights))).size});
      }
      playing=false;await send();await waitFor(main,'!!document.querySelector("[data-audio-glyph]")&&Array.from(document.querySelectorAll("[data-audio-glyph] rect")).every(e=>Number(e.getAttribute("height"))===2.5)','Paused mini spectrum');
      const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'mini-spectrum-native.png'),Buffer.from(shot.data,'base64'));
      return {samples,actualSoundDetected:samples.some(sample=>sample.bands.level>.00001),accentChanges:true,pauseReturnsToBaseline:true,noInventedAudio:true};
    }finally{clearInterval(timer);await main.invoke('media_pick',{id:null});await main.invoke('settings_set',{settings:prior});await pause(3400);}
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
        const fixturePixel=(a.pixels[offset]===185&&a.pixels[offset+1]===212&&a.pixels[offset+2]===56)||(a.pixels[offset]===89&&a.pixels[offset+1]===50&&a.pixels[offset+2]===146);
        if(fixturePixel)fixturePixels++;
        if(x>=bounds[0]-48&&x<=bounds[2]+48&&y<=bounds[3]+48)continue;
        // Only the owned stationary checkerboard proves tint. The owner's desktop
        // outside that window can animate between the hidden and visible captures.
        if(!fixturePixel)continue;
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
    assert.deepEqual(await main.invoke('agents_connections'),{claude:'off',codex:'off',opencode:'off'});
    assert(Array.isArray(await main.invoke('agents_now')));
    for(const [name,content]of agentConfigs)assert.equal(await fs.readFile(path.join(agentHome,name),'utf8'),content);
    const denied=await main.evaluate('window.__TAURI_INTERNALS__.invoke("agents_answer",{id:"../outside",verdict:"allow"}).then(()=>({ok:true}),error=>({ok:false,error:String(error)}))');
    assert.equal(denied.ok,false);assert.match(denied.error,/Invalid request ID/);
  });
  await check('Saved Codex hooks deliver permissions through real Tauri and production UI answers',async()=>{
    return verifyAgentHooks({directory,home:agentHome,profile:dataDir,client:main,waitFor,listen});
  });
  await check('Web AI first loading paint keeps provider text and view buttons visible',async()=>{
    const before=await main.invoke('settings_get'), samples=[];
    try {
      for(const theme of ['dark','light'])for(const reducedMotion of ['reduce','full'])for(const service of ['gemini','deepseek']){
        holdWebAi=true;
        await main.invoke('settings_set',{settings:{theme,reducedMotion}});
        // Reload the preserved provider in embedded mode, so reopening cannot
        // skip the loading UI by reusing an already completed navigation.
        if((await main.invoke('web_ai_status')).some(s=>s.service===service)){
          await main.invoke('web_ai_embed',{service,x:10,y:10,width:360,height:240});
          await main.invoke('web_ai_reload',{service,target:'embedded'});
        }
        await main.invoke('web_ai_window',{service});
        const pages=await pagesReady(p=>p.url.endsWith('/web-ai.html'));
        const shell=await attach(pages.find(p=>p.url.endsWith('/web-ai.html')));
        await waitFor(shell,`!!(document.querySelector('[data-preferences-ready=true][data-phase=loading]')&&document.querySelector('.webai-provider-mark>[data-provider-icon]'))`,'first loading paint');
        const geometry=await shell.evaluate(`(${readWebAiPaintRects.toString()})()`);
        const shot=Buffer.from((await shell.command('Page.captureScreenshot',{format:'png'})).data,'base64');
        const label=`web-ai-first-${theme}-${reducedMotion}-${service}`;
        await fs.writeFile(path.join(directory,label+'.png'),shot);
        await fs.writeFile(path.join(directory,label+'.json'),JSON.stringify(geometry,null,2));
        samples.push({label,proof:assertWebAiPaint(shot,geometry,label)});
        await assertPassiveForeground(main);
        holdWebAi=false;heldWebAiResponses.splice(0).forEach(release=>release());
        await waitFor(shell,`!document.querySelector('.webai-placeholder')`,'held provider reveal');
        await main.invoke('web_ai_window_close');
        await waitForWindowClosed('/web-ai.html');
      }
      return {samples,firstShow:true,delayedLocalPage:true};
    } finally {
      delayWebAi=0;
      holdWebAi=false;heldWebAiResponses.splice(0).forEach(release=>release());
      await main.invoke('web_ai_window_close');await waitForWindowClosed('/web-ai.html');
      await main.invoke('settings_set',{settings:{theme:before.theme,reducedMotion:before.reducedMotion}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(({O})=>O.webAiHide())`);
    }
  });
  await check('Web AI native host matches real DOM slot through scale and reparent',async()=>{
    const settings=await main.invoke('settings_get');
    const before=await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>{const s=ot.getState();return {expanded:s.expanded,tab:s.tab,chatService:s.chatService,holdOpen:s.holdOpen,license:s.license}})`);
    const samples=[];
    try{
      await main.invoke('settings_set',{settings:{reducedMotion:'reduce'}});
      const scales=process.env.WOODS_TEST_WEBAI_SCALES?process.env.WOODS_TEST_WEBAI_SCALES.split(',').map(Number):[80,100,125,150,200];
      assert(scales.length&&scales.every(scale=>[80,100,125,150,200].includes(scale)),'Invalid Web AI scale matrix');
      for(const theme of ['dark','light'])for(const service of ['gemini','deepseek'])for(const scale of scales){
        await main.invoke('settings_set',{settings:{scale,theme}});
        await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:true,tab:'chat',chatService:${JSON.stringify(service)},holdOpen:true,license:{...ot.getState().license,pro:true}}))`);
        await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(s=>s.some(s=>s.service===${JSON.stringify(service)}&&s.target==='embedded'&&s.phase==='loaded'))`,'real embedded slot');
        await pause(400);
        samples.push({theme,scale,stage:'embedded',...await sampleWebAiHost(main,service,'embedded')});
        await main.invoke('web_ai_window',{service});
        const pages=await pagesReady(p=>p.url.endsWith('/web-ai.html'));
        const shell=await attach(pages.find(p=>p.url.endsWith('/web-ai.html')));
        await waitFor(shell,`document.querySelector('[data-web-ai-status]')?.dataset.webAiStatus==='loaded'&&!document.querySelector('.webai-placeholder')`,'presented native host');
        await pause(200);
        samples.push({theme,scale,stage:'pop-out',...await sampleWebAiHost(shell,service,'window')});
        await shell.invoke('plugin:window|set_size',{label:'web-ai-window',value:{Logical:{width:640,height:480}}});
        await pause(250);
        samples.push({theme,scale,stage:'resized',...await sampleWebAiHost(shell,service,'window')});
        await shell.invoke('plugin:window|set_position',{label:'web-ai-window',value:{Physical:{x:120,y:160}}});
        await pause(200);
        samples.push({theme,scale,stage:'moved',...await sampleWebAiHost(shell,service,'window')});
        await main.invoke('web_ai_window_close',{returnToPill:true});await waitForWindowClosed('/web-ai.html');
        await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(s=>s.some(s=>s.service===${JSON.stringify(service)}&&s.target==='embedded'&&s.phase==='loaded'))`,'returned provider');
        await pause(400);
        samples.push({theme,scale,stage:'returned',...await sampleWebAiHost(main,service,'embedded')});
      }
      await assertPassiveForeground(main);
      await fs.writeFile(path.join(directory,'web-ai-native-geometry.json'),JSON.stringify(samples,null,2));
      assert(samples.every(row=>row.match),'Native host differs from real DOM slot: '+JSON.stringify(samples.filter(row=>!row.match)));
      for(const row of samples.filter(row=>row.target==='embedded'))for(const candidate of row.candidates){
        assert.equal(candidate.dom.border,row.theme==='light'?'rgb(216, 217, 221)':'rgb(59, 62, 67)','Embedded border must use its own theme colour');
        assert.equal(candidate.dom.background,row.theme==='light'?'rgb(246, 246, 247)':'rgb(23, 25, 28)','No black/white uncovered slot background');
      }
      return {samples,physicalTolerance:2,independentWin32:true};
    }finally{
      await fs.writeFile(path.join(directory,'web-ai-native-geometry.json'),JSON.stringify(samples,null,2));
      await main.invoke('web_ai_window_close');await waitForWindowClosed('/web-ai.html');
      await main.invoke('settings_set',{settings:{theme:settings.theme,scale:settings.scale,reducedMotion:settings.reducedMotion}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(async({ot,O})=>{ot.setState(${JSON.stringify(before)});await O.webAiHide()})`);
    }
  });
  await check('Web AI embedded surface clips native corners and follows theme without losing the draft',async()=>{
    const settings=await main.invoke('settings_get');
    const before=await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>{const s=ot.getState();return {expanded:s.expanded,tab:s.tab,chatService:s.chatService,holdOpen:s.holdOpen,license:s.license}})`);
    try{
      await main.invoke('settings_set',{settings:{theme:'dark',reducedMotion:'reduce'}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(async({ot,O})=>{ot.setState({expanded:true,tab:'chat',chatService:'gemini',holdOpen:true,license:{...ot.getState().license,pro:true}});await O.webAiEmbed('gemini',{x:10,y:10,width:360,height:240},false)})`);
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(s=>s.some(s=>s.service==='gemini'&&s.target==='embedded'&&s.phase==='loaded'&&s.surface?.corner_cut&&s.surface?.center_included))`,'native rounded embedded view');
      const pages=await pagesReady(p=>p.url.startsWith(webAiUrl+'/gemini'));
      const content=await attach(pages.find(p=>p.url.startsWith(webAiUrl+'/gemini')));
      await waitFor(content,`getComputedStyle(document.body).backgroundColor==='rgb(23, 25, 28)'`,'dark embedded page surface');
      const dark=await content.evaluate(`({theme:document.documentElement.dataset.woodsAiTheme,width:getComputedStyle(document.documentElement).scrollbarWidth,preferred:matchMedia('(prefers-color-scheme:dark)').matches})`);
      assert.deepEqual(dark,{theme:'dark',width:'none',preferred:true});
      await content.evaluate(`document.querySelector('input').value='Черновик при смене темы';scrollTo(0,400)`);
      const draft=await content.evaluate(`({value:document.querySelector('input').value,scroll:scrollY,instance:window.fixtureInstance})`);
      assert.equal(draft.scroll,400);
      const screenshot=await content.command('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(directory,'embedded-dark.png'),Buffer.from(screenshot.data,'base64'));
      await main.invoke('settings_set',{settings:{theme:'light'}});
      await waitFor(content,`getComputedStyle(document.body).backgroundColor==='rgb(246, 246, 247)'`,'live light embedded surface');
      assert.deepEqual(await content.evaluate(`({value:document.querySelector('input').value,scroll:scrollY,instance:window.fixtureInstance})`),draft);
      assert.equal(await content.evaluate(`matchMedia('(prefers-color-scheme:light)').matches`),true);
      const proof=(await main.invoke('web_ai_status')).find(s=>s.service==='gemini').surface;
      assert(proof.corner_cut&&proof.center_included&&proof.corner_radius>=12,'Native region must remove corners and retain the viewport centre');
      await main.invoke('settings_set',{settings:{theme:'dark',scale:150}});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(s=>s.some(s=>s.service==='gemini'&&s.surface?.corner_radius>=18&&s.surface?.corner_cut))`,'scaled rounded native view');
      return {nativeRegion:proof,hiddenScrollbars:true,darkAndLight:true,liveTheme:true,draftScrollAndInstancePreserved:true,scale150:true};
    }finally{
      await main.invoke('settings_set',{settings:{theme:settings.theme,scale:settings.scale,reducedMotion:settings.reducedMotion}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(async({ot,O})=>{ot.setState(${JSON.stringify(before)});await O.webAiHide()})`);
    }
  });
  await check('Web AI read contract and invalid service rejection',async()=>{
    assert.equal(await main.invoke('web_ai_popped'),null);
    const invalid=await main.evaluate('window.__TAURI_INTERNALS__.invoke("web_ai_embed",{service:"https://invalid.example",x:0,y:0,width:100,height:100,focus:false,word:0}).then(()=>({ok:true}),error=>({ok:false,error:String(error)}))');
    assert.equal(invalid.ok,false);assert.match(invalid.error,/Unknown AI website/);
  });
  await check('Web AI window creation failure keeps island context and rejects duplicate clicks',async()=>{
    try {
      await main.evaluate(`(async()=>{const {ot,O}=await import('/assets/runtime-debug.js');const s=ot.getState();window.__qaWebAiBefore={expanded:s.expanded,palette:s.palette,tab:s.tab,chatService:s.chatService,license:s.license,holdOpen:s.holdOpen};window.__qaWindow=O.webAiWindow;window.__qaCalls=0;O.webAiWindow=()=>{window.__qaCalls++;return new Promise((resolve,reject)=>window.__qaRejectWindow=reject)};ot.setState({palette:false,expanded:true,tab:'chat',chatService:'gemini',license:{...s.license,pro:true}})})()`);
      await waitFor(main,`!!document.querySelector('[data-web-ai-window]')`,'pop-out action');
      await main.evaluate(`document.querySelector('[data-web-ai-window]').click();document.querySelector('[data-web-ai-window]').click()`);
      await pause(200);
      assert.equal(await main.evaluate('window.__qaCalls'),1);
      assert.equal(await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.getState().holdOpen)`),true);
      assert.equal(await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.getState().expanded)`),true);
      await main.evaluate(`window.__qaRejectWindow('Fixture AI window creation failed')`);
      await waitFor(main,`document.querySelector('[data-web-ai-window-error]')?.textContent.includes('Fixture AI window creation failed')`,'window creation error');
      assert.equal(await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.getState().chatService)`),'gemini');
      assert.equal(await main.evaluate(`!!document.querySelector('[data-web-ai-window]')&&!document.querySelector('[data-web-ai-window]').disabled`),true);
      return {pendingKeepsIsland:true,oneAttempt:true,failureVisible:true,servicePreserved:true};
    } finally {
      await main.evaluate(`(async()=>{const {ot,O}=await import('/assets/runtime-debug.js');O.webAiWindow=window.__qaWindow;ot.setState({...window.__qaWebAiBefore,peek:null});delete window.__qaWindow;delete window.__qaWebAiBefore;delete window.__qaCalls;delete window.__qaRejectWindow;await O.webAiHide()})()`);
    }
  });
  await check('Web AI moves one page between pill and window with draft scroll session and reduced motion',async()=>{
    const settings=await main.invoke('settings_get');
    const state=await main.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>{const s=ot.getState();return {expanded:s.expanded,tab:s.tab,chatService:s.chatService,holdOpen:s.holdOpen,license:s.license}})`);
    try{
      await main.invoke('settings_set',{settings:{reducedMotion:'full'}});
      await listen(main,'webai:transition');
      await main.evaluate(`(async()=>{const {ot,O}=await import('/assets/runtime-debug.js');const s=ot.getState();ot.setState({expanded:true,tab:'chat',chatService:'gemini',holdOpen:true,license:{...s.license,pro:true}});await O.webAiEmbed('gemini',{x:10,y:10,width:360,height:240},false)})()`);
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(s=>s.some(s=>s.service==='gemini'&&s.target==='embedded'&&s.phase==='loaded'))`,'initial embedded Gemini');
      const pages=await pagesReady(p=>p.url===webAiUrl+'/gemini'),original=pages.find(p=>p.url===webAiUrl+'/gemini');
      const page=await attach(original);
      await page.evaluate(`document.querySelector('input').value='Черновик переноса';document.cookie='transfer_fixture=kept; SameSite=Lax';history.replaceState(null,'','#transfer');scrollTo(0,450)`);
      const read=()=>page.evaluate(`({draft:document.querySelector('input').value,scroll:scrollY,instance:window.fixtureInstance,url:location.href,cookie:document.cookie})`);
      const before=await read();assert.equal(before.scroll,450);
      console.log('Web AI transfer stage: pop-out');
      await main.invoke('web_ai_window',{service:'gemini'});
      const afterPages=await pagesReady(p=>p.url===webAiUrl+'/gemini#transfer');
      assert.equal(afterPages.find(p=>p.url===webAiUrl+'/gemini#transfer').id,original.id,'The page must retain its CDP identity');
      assert.equal(afterPages.filter(p=>p.url.startsWith(webAiUrl+'/gemini')).length,1,'Only one Gemini page may exist');
      console.log('Web AI transfer stage: read pop-out');
      assert.deepEqual(await read(),before,'Moving into the window must retain page state');
      console.log('Web AI transfer stage: return');
      await main.invoke('web_ai_window_close',{returnToPill:true});
      await waitForWindowClosed('/web-ai.html');
      await waitFor(main,`import('/assets/runtime-debug.js').then(({ot})=>{const s=ot.getState();return s.expanded&&s.tab==='chat'&&s.chatService==='gemini'})`,'return to pill');
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(s=>s.some(s=>s.service==='gemini'&&s.target==='embedded'))`,'returned native parent');
      console.log('Web AI transfer stage: read returned page');
      assert.deepEqual(await read(),before,'Returning must retain page state');
      const events=await main.evaluate(`window.__woodsEvents['webai:transition']`);
      for(const [target,start,end] of [['window',0,255],['pill',255,0]]){
        const frames=events.filter(e=>e.target===target&&e.phase==='frame');assert(frames.length>=3);
        assert.equal(frames.at(-1).alpha,end);assert(Math.abs(frames[0].alpha-start)<=2);
        for(let i=1;i<frames.length;i++)assert(target==='window'?frames[i].alpha>=frames[i-1].alpha:frames[i].alpha<=frames[i-1].alpha);
        assert(frames.at(-1).ms>=200&&frames.at(-1).ms<1500);assert(frames.every(e=>e.passive===true));
      }
      await main.invoke('settings_set',{settings:{reducedMotion:'reduce'}});
      console.log('Web AI transfer stage: reduced-motion reopen');
      await main.evaluate(`window.__woodsEvents['webai:transition']=[]`);
      await main.invoke('web_ai_window',{service:'gemini'});
      assert.deepEqual(await read(),before,'Reopening must retain page state');
      const shellPages=await pagesReady(p=>p.url.endsWith('/web-ai.html')),shell=await attach(shellPages.find(p=>p.url.endsWith('/web-ai.html')));
      // Closing destroys this JS context. Verify native closure below rather
      // than awaiting an IPC Promise whose document may already be gone.
      await shell.evaluate(`void window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'web-ai-window'}).catch(()=>{});true`).catch(()=>{});
      console.log('Web AI transfer stage: native close');
      await waitForWindowClosed('/web-ai.html');
      const reduced=await main.evaluate(`window.__woodsEvents['webai:transition']`);
      assert.equal(reduced.filter(e=>e.phase==='frame').length,0);
      assert.equal(reduced.filter(e=>e.phase==='end'&&e.duration===0).length,2);
      assert.deepEqual(await read(),before,'Closing via the native close request must retain page state');
      await assertPassiveForeground(main);
      await page.evaluate(`history.replaceState(null,'',location.pathname)`);
      return {singlePage:true,draftScrollUrlCookieAndInstancePreserved:true,returnToPill:true,nativeClosePreservesPage:true,reducedMotion:true,hiddenAlphaApiTraces:events,onscreenSmoothnessVerified:false};
    }finally{
      await main.invoke('web_ai_window_close');await waitForWindowClosed('/web-ai.html');
      await main.invoke('settings_set',{settings:{reducedMotion:settings.reducedMotion}});
      await main.evaluate(`import('/assets/runtime-debug.js').then(async({ot,O})=>{ot.setState(${JSON.stringify(state)});await O.webAiHide()})`);
    }
  });
  await check('Web AI pop-out shell loads switches retries and reopens without stealing focus',async()=>{
    try {
      assert.equal(await main.invoke('web_ai_window',{service:'gemini'}),true);
      let pages=await pagesReady(p=>p.url.endsWith('/web-ai.html'));
      let shell=await attach(pages.find(p=>p.url.endsWith('/web-ai.html')));
      const loaded=service=>waitFor(shell,`document.querySelector('[data-web-ai-shell]')?.dataset.webAiShell===${JSON.stringify(service)}&&document.querySelector('[data-web-ai-status]')?.dataset.webAiStatus==='loaded'&&!document.querySelector('.webai-placeholder')`,service+' presented after fade');
      await loaded('gemini');
      assert.equal(await main.invoke('web_ai_popped'),'gemini');
      await assertPassiveForeground(main);
      pages=await pagesReady(p=>p.url===webAiUrl+'/gemini');
      const gemini=await attach(pages.find(p=>p.url===webAiUrl+'/gemini'));
      assert.equal(await gemini.evaluate(`document.visibilityState`),'visible','The provider must be visible after the shell fade');
      assert.equal(await gemini.evaluate(`document.documentElement.hasAttribute('data-woods-ai-theme')`),false,'Embedded presentation must be removed in the pop-out');
      const popSurface=(await main.invoke('web_ai_status')).find(s=>s.service==='gemini').surface;
      assert.equal(popSurface.corner_cut,false,'The separate window must meet the toolbar with square top corners');
      assert.equal(popSurface.bottom_corner_cut,true,'Native bottom corners must follow the rounded shell frame');
      const currentNavigation=(await main.invoke('web_ai_status')).find(s=>s.service==='gemini'&&s.target==='window').navigation;
      assert.equal(await main.invoke('web_ai_window_reveal',{service:'gemini',navigation:currentNavigation+1}),false,'A stale navigation must not reveal a page');
      await gemini.evaluate(`document.querySelector('input').value='Сохранённый черновик'`);
      await shell.evaluate(`document.querySelector('[data-web-ai-service=deepseek]').click()`);
      await loaded('deepseek');
      await shell.evaluate(`document.querySelector('[data-web-ai-service=gemini]').click()`);
      await loaded('gemini');
      assert.equal(await gemini.evaluate(`document.querySelector('input').value`),'Сохранённый черновик');
      await shell.evaluate(`document.querySelector('[data-web-ai-service=chatgpt]').click()`);
      await loaded('chatgpt');assert.equal(await main.invoke('web_ai_popped'),'chatgpt');
      assert.equal(await shell.evaluate(`!!document.querySelector('[data-web-ai-service=chatgpt] [data-provider-icon=chatgpt]')`),true);
      const chatgptPages=await pagesReady(p=>p.url===webAiUrl+'/chatgpt');const chatgpt=await attach(chatgptPages.find(p=>p.url===webAiUrl+'/chatgpt'));
      const readChatGpt=()=>chatgpt.evaluate(`(()=>{const el=document.querySelector('[data-scroll-fixture]');return {draft:document.querySelector('input').value,scroll:scrollY,x:el.scrollLeft,y:el.scrollTop,width:getComputedStyle(el).scrollbarWidth,rootWidth:getComputedStyle(document.documentElement).scrollbarWidth,client:[el.clientWidth,el.clientHeight],instance:window.fixtureInstance}})()`);
      await chatgpt.evaluate(`document.querySelector('input').value='Черновик ChatGPT';document.querySelector('[data-scroll-fixture]').scrollTo(35,60);scrollTo(0,300)`);
      const chatgptState=await readChatGpt();
      assert.deepEqual({...chatgptState,instance:null},{draft:'Черновик ChatGPT',scroll:300,x:35,y:60,width:'none',rootWidth:'none',client:[160,100],instance:null});
      await shell.evaluate(`document.querySelector('[data-web-ai-back]').click()`);await waitForWindowClosed('/web-ai.html');
      assert.deepEqual(await readChatGpt(),chatgptState,'ChatGPT must preserve scrolling and draft in the pill');
      await main.invoke('web_ai_window',{service:'chatgpt'});pages=await pagesReady(p=>p.url.endsWith('/web-ai.html'));shell=await attach(pages.find(p=>p.url.endsWith('/web-ai.html')));await loaded('chatgpt');
      assert.deepEqual(await readChatGpt(),chatgptState,'ChatGPT must preserve scrolling and draft in the separate window');await assertPassiveForeground(main);
      const chatgptShot=await shell.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'chatgpt-separate-window.png'),Buffer.from(chatgptShot.data,'base64'));
      await shell.evaluate(`document.querySelector('[data-web-ai-service=gemini]').click()`);await loaded('gemini');
      failWebAi=true;
      await shell.evaluate(`document.querySelector('[data-web-ai-retry]').click()`);
      await waitFor(shell,`document.querySelector('[data-web-ai-status]')?.dataset.webAiStatus==='error'`,'Web AI error feedback');
      const diagnostic=await main.invoke('diagnostics_summary');
      assert(diagnostic.webAi.some(s=>s.service==='gemini'&&s.target==='window'&&s.phase==='error'&&Number.isInteger(s.code)));
      assert(!JSON.stringify(diagnostic.webAi).includes(webAiUrl),'Support statuses must not contain provider URLs');
      assert.match(await shell.evaluate(`document.querySelector('.webai-state-card').textContent`),/загрузить|недоступен/);
      assert.equal(await shell.evaluate(`!!document.querySelector('[data-web-ai-browser]')`),true);
      const screenshot=await shell.command('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(directory,'web-ai-error-960.png'),Buffer.from(screenshot.data,'base64'));
      await shell.invoke('plugin:window|set_size',{label:'web-ai-window',value:{Logical:{width:560,height:420}}});
      await pause(250);
      assert(await shell.evaluate(`document.documentElement.scrollWidth<=innerWidth&&Array.from(document.querySelectorAll('header button')).every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`),'Compact Web AI toolbar must fit the window');
      const compact=await shell.command('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(directory,'web-ai-error-560.png'),Buffer.from(compact.data,'base64'));
      await shell.invoke('plugin:window|set_size',{label:'web-ai-window',value:{Logical:{width:960,height:760}}});
      failWebAi=false;
      await shell.evaluate(`document.querySelector('[data-web-ai-retry]').click()`);
      await loaded('gemini');
      await main.invoke('web_ai_window_close');
      await waitForWindowClosed('/web-ai.html');
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_popped').then(s=>s===null)`,'pop-out close');
      await main.invoke('web_ai_window',{service:'deepseek'});
      pages=await pagesReady(p=>p.url.endsWith('/web-ai.html'));
      shell=await attach(pages.find(p=>p.url.endsWith('/web-ai.html')));
      await loaded('deepseek');
      await assertPassiveForeground(main);
      return {services:['gemini','deepseek','chatgpt'],localFixture:true,draftPreserved:true,chatgptSeparateWindowAndReturn:true,errorRetry:true,reopen:true,foregroundStolen:false};
    } catch(error) {
      console.log('Web AI pop-out primary failure:',error.message);
      console.log('Web AI native state:',JSON.stringify(await main.invoke('web_ai_status')));
      throw error;
    } finally {failWebAi=false;await main.invoke('web_ai_window_close');await waitForWindowClosed('/web-ai.html');}
  });
  await check('Web AI embedded navigation reports error and retry and stays hidden after collapse',async()=>{
    try {
      await main.evaluate(`import('/assets/runtime-debug.js').then(({O})=>O.webAiEmbed('gemini',{x:10,y:10,width:360,height:240},false))`);
      const phase=(phase,stage='')=>waitFor(main,`window.__TAURI_INTERNALS__.invoke('web_ai_status').then(states=>states.some(s=>s.service==='gemini'&&s.target==='embedded'&&s.phase===${JSON.stringify(phase)}))`,'embedded '+phase+' '+stage);
      await phase('loaded','initial');
      failWebAi=true;await main.invoke('web_ai_reload',{service:'gemini',target:'embedded'});await phase('error');
      failWebAi=false;await main.invoke('web_ai_reload',{service:'gemini',target:'embedded'});await phase('loaded','retry');
      delayWebAi=400;
      await main.invoke('web_ai_reload',{service:'gemini',target:'embedded'});
      await main.evaluate(`import('/assets/runtime-debug.js').then(({O})=>O.webAiHide())`);
      await pause(800);
      const pages=await pagesReady(p=>p.url===webAiUrl+'/gemini');
      const embedded=await attach(pages.find(p=>p.url===webAiUrl+'/gemini'));
      await waitFor(embedded,`document.visibilityState==='hidden'`,'AI view stays hidden during suspended navigation');
      await main.evaluate(`import('/assets/runtime-debug.js').then(({O})=>O.webAiEmbed('gemini',{x:10,y:10,width:360,height:240},false))`);
      await phase('loaded','after resume');
      await assertPassiveForeground(main);
      const before=await main.invoke('settings_get');
      try {
        const warnings=await main.invoke('settings_set',{settings:{scale:150}});
        assert(!warnings.some(w=>w.includes('Main window unavailable')));
        assert.equal(await main.invoke('set_island_hidden',{hidden:true}),true);
        assert.equal(await main.invoke('set_island_hidden',{hidden:false}),true);
      } finally {await main.invoke('settings_set',{settings:{scale:before.scale}});}
      return {localFixture:true,errorRetry:true,hiddenWhileLoading:true,resumeCompletesNavigation:true,mainWindowWorksAfterChild:true};
    } catch(error) {console.log('Web AI embedded primary failure:',error.message,JSON.stringify(await main.invoke('web_ai_status')));throw error;}
    finally {failWebAi=false;delayWebAi=0;await main.evaluate(`import('/assets/runtime-debug.js').then(({O})=>O.webAiHide())`);}
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
      if(data.messages.some(message=>JSON.stringify(message).includes('force-truncated'))){response.end('data: '+JSON.stringify({choices:[{delta:{content:'partial response'}}]})+'\n\n');return;}
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
      await main.invoke('settings_set',{settings:{aiBaseUrl:`http://127.0.0.1:${providerServer.address().port}/v1`,aiModel:'fixture-model',aiProxy:'socks5h://127.0.0.1:1'}});
      assert.deepEqual(await main.invoke('ai_models'),['fixture-model']);
      for(const name of ['ai:chunk','ai:done','ai:error'])await listen(main,name);
      const id=Date.now()*1000+1;
      await main.invoke('ai_chat',{id,messages:[{role:'user',content:'Fixture stream',attachments:attachmentId?[attachmentId]:[]}]});
      await waitFor(main,`window.__woodsEvents['ai:done'].includes(${id})||window.__woodsEvents['ai:error'].some(e=>e.id===${id})`,'AI streaming result');
      assert((await main.evaluate("window.__woodsEvents['ai:done']")).includes(id));
      const chunks=await main.evaluate("window.__woodsEvents['ai:chunk']");assert.equal(chunks.filter(e=>e.id===id).map(e=>e.text).join(''),'Проверка ✓');
      assert.equal(received[0].messages[0].role,'system');
      assert.match(received[0].messages[0].content,/Current local date and time.*\d{4}-\d{2}-\d{2}T/);
      if(attachmentId)assert(received[0].messages.some(message=>Array.isArray(message.content)&&message.content.some(c=>c.type==='text'&&c.text.includes('Проверка'))),'Attachment text must reach the provider');
      const failedId=id+1;
      await main.invoke('ai_chat',{id:failedId,messages:[{role:'user',content:'force-http-error'}]});
      await waitFor(main,`window.__woodsEvents['ai:error'].some(e=>e.id===${failedId})`,'AI error');
      const error=(await main.evaluate("window.__woodsEvents['ai:error']")).find(e=>e.id===failedId);assert.equal(typeof error.id,'number');assert.match(error.message,/лимит|limit/i);
      const truncatedId=id+3;await main.invoke('ai_chat',{id:truncatedId,messages:[{role:'user',content:'force-truncated'}]});
      await waitFor(main,`window.__woodsEvents['ai:error'].some(e=>e.id===${truncatedId})`,'Truncated stream is an error');
      assert(!(await main.evaluate("window.__woodsEvents['ai:done']")).includes(truncatedId));
      assert((await main.evaluate("window.__woodsEvents['ai:chunk']")).some(e=>e.id===truncatedId&&e.text==='partial response'));
      const cancelledId=id+2;
      await main.invoke('ai_chat',{id:cancelledId,messages:[{role:'user',content:'force-cancel'}]});
      await waitFor(main,`window.__woodsEvents['ai:chunk'].some(e=>e.id===${cancelledId})`,'AI cancellation fixture start');
      assert.equal(await main.invoke('ai_cancel',{id:cancelledId}),true);
      await pause(800);
      assert(!(await main.evaluate("window.__woodsEvents['ai:done']")).includes(cancelledId));
      assert(!(await main.evaluate("window.__woodsEvents['ai:error']")).some(e=>e.id===cancelledId));
    }finally{await main.invoke('settings_set',{settings:{aiBaseUrl:prior.aiBaseUrl,aiModel:prior.aiModel,aiProxy:prior.aiProxy}});await new Promise(resolve=>providerServer.close(resolve));providerServer=null;}
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
    const text=await main.invoke('ocr_file',{path:path.join(root,'tests','fixtures','ocr-fixture.png')});
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
      const ffprobe=process.env.WOODS_TEST_FFPROBE||process.env.WOODS_FFPROBE_PATH||path.join(root,'src-tauri','resources','bin','ffprobe.exe');
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
    assert.equal(characters.length,50);
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
    assert((await settings.evaluate('document.querySelector("[data-woods-about]").textContent')).includes('All features free'));
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
    const hit=await main.evaluate(`(()=>{const button=document.querySelector('[data-note-clear]'),box=button.getBoundingClientRect(),well=document.querySelector('[data-note-editor]').getBoundingClientRect(),target=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);return box.right<=well.right+1&&button.contains(target);})()`);
    assert(hit,'Clear note must be inside the editor column with an unobstructed hit area');
    await main.evaluate('document.querySelector("[data-note-clear]").click()');
    await waitFor(main,'window.__TAURI_INTERNALS__.invoke("note_get").then(value=>value==="")','Cleared note persisted');
    await main.invoke('note_set',{text:markdown});
    return {folder,clearButtonHitArea:true,clearedNotePersisted:true};
  });
  await check('Reminder named dates, time shifts and weekly choices save through the real native UI',async()=>{
    const prior=await main.invoke('settings_get');const before=await main.invoke('reminders_get');
    const fill=async text=>{await main.evaluate(`(()=>{const input=document.querySelector('[data-reminder-input]');input.focus();input.select();})()`);await main.command('Input.insertText',{text});};
    const data=async()=>JSON.parse(await main.invoke('reminders_get'));
    try{
      assert.deepEqual(JSON.parse(before),[],'Reminder acceptance uses an empty isolated profile');
      await main.invoke('note');await waitFor(main,'!!document.querySelector("[data-reminder-input]")','Native reminders UI');
      for(const language of ['ru','en']){
        await main.invoke('settings_set',{settings:{language}});
        await pause(200); // The language provider remounts its translated children.
        await main.evaluate("(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.getState().open('hotkey','note');ot.setState({holdOpen:true});})()");
        await waitFor(main,'!!document.querySelector("[data-reminder-input]")','Translated reminders UI');
        const title=language==='ru'?'Проверка даты':'Calendar check';
        await fill(language==='ru'?`${title} 19 ноября 2027 в 16`:`${title} November 19th 2027 at 4 pm`);
        await waitFor(main,'document.querySelectorAll("[data-reminder-shift]").length===4','Read time adjustment controls');
        await main.evaluate(`document.querySelector('[data-reminder-shift="15"]').click()`);
        await main.evaluate(`document.querySelector('[data-reminder-shift="1440"]').click()`);
        await main.evaluate('document.querySelector("[data-reminder-read]").click()');
        await waitFor(main,`window.__TAURI_INTERNALS__.invoke('reminders_get').then(json=>JSON.parse(json).some(item=>item.text===${JSON.stringify(title)}))`,'Named date persisted');
        const reminder=(await data()).find(item=>item.text===title),date=new Date(reminder.at);
        assert.deepEqual([date.getFullYear(),date.getMonth(),date.getDate(),date.getHours(),date.getMinutes()],[2027,10,20,16,15]);
        const weeklyTitle=language==='ru'?'Недельная проверка':'Weekly check';await fill(language==='ru'?`${weeklyTitle} в пятницу в 16`:`${weeklyTitle} on Friday at 16`);
        await waitFor(main,'document.querySelectorAll("[data-reminder-week]").length===2&&!!document.querySelector("[data-reminder-weekly]")','Weekday alternatives');
        const shot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,`reminders-${language}.png`),Buffer.from(shot.data,'base64'));
        await main.evaluate('document.querySelector("[data-reminder-weekly]").click()');
        await waitFor(main,`window.__TAURI_INTERNALS__.invoke('reminders_get').then(json=>JSON.parse(json).some(item=>item.text===${JSON.stringify(weeklyTitle)}))`,'Weekly reminder persisted');
        const weekly=(await data()).find(item=>item.text===weeklyTitle);assert.deepEqual(weekly.repeat,{days:[5],h:16,m:0});
        await main.evaluate(`Array.from(document.querySelectorAll('[data-reminder-row]')).find(row=>row.title===${JSON.stringify(weeklyTitle)}).querySelector('[data-reminder-edit]').click()`);
        await waitFor(main,'!!document.querySelector("[data-reminder-read]")&&!document.querySelector("[data-reminder-nudge]")','Edit retains weekly schedule');
        await main.evaluate('document.querySelector("[data-reminder-read]").click()');
        assert.deepEqual((await data()).find(item=>item.text===weeklyTitle).repeat,{days:[5],h:16,m:0});
        const overflow=await main.evaluate("(()=>{const el=document.querySelector('[data-time-side]');return el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1;})()");assert.equal(overflow,false,'Reminder controls fit the real note sidebar');
      }
      return {languages:['ru','en'],namedDates:true,dayAndMinuteShift:true,weekdayAlternatives:true,weeklyPersisted:true,editingPreservesRepeat:true,sidebarFits:true};
    }finally{
      await main.evaluate("document.querySelectorAll('[data-reminder-row]').forEach(row=>row.querySelector('button:last-child').click())").catch(()=>{});
      await main.invoke('reminders_set',{json:before});await main.invoke('settings_set',{settings:prior});
      await main.evaluate("(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({expanded:false,holdOpen:false,peek:null,queue:[]});})()");
    }
  });
  await check('Woods About and release history use current metadata in the native settings window',async()=>{
    const prior=await main.invoke('settings_get'),version=await main.invoke('plugin:app|version');let settings;
    try{
      await main.invoke('open_settings',{section:'pro'});
      settings=await attach((await pagesReady(page=>page.url.endsWith('/settings.html'))).find(page=>page.url.endsWith('/settings.html')));
      await waitFor(settings,"!!document.querySelector('[data-nav=pro]')",'Settings navigation');
      for(const language of ['ru','en']){
        await settings.invoke('settings_set',{settings:{language}});
        await settings.evaluate("if(document.querySelector('[data-nav=pro]')?.dataset.now!=='true')document.querySelector('[data-nav=pro]')?.click()");
        await waitFor(settings,`document.querySelector('[data-nav=pro]')?.dataset.now==='true'&&document.querySelector('[data-about-version]')?.textContent.includes(${JSON.stringify(version)})`,'About shows installed native version');
        const about=await settings.evaluate("document.querySelector('[data-woods-about]').textContent");
        assert(about.includes(language==='ru'?'Никита Кузнецов':'Nikita Kuznetsov'));
        assert(about.includes(language==='ru'?'Все функции бесплатно':'All features free'));
        assert(!/exuupery|exupery|399\s*₽|\$4\.99|\{\{/.test(about));
        assert(await settings.evaluate("(()=>{const img=document.querySelector('[data-woods-logo]');return img.complete&&img.naturalWidth>0;})()"),'Woods mascot loads from the bundled asset');
        assert.equal(await settings.evaluate("(()=>{const el=document.querySelector('[data-woods-about]');return el.scrollWidth>el.clientWidth+1;})()"),false);
        const shot=await settings.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,`about-canonical-${language}.png`),Buffer.from(shot.data,'base64'));
        await settings.evaluate("document.querySelector('[data-about-version]').click()");
        await waitFor(settings,`document.querySelector('[data-nav=updates]')?.dataset.now==='true'&&document.querySelector('[data-release]')?.dataset.release===${JSON.stringify(version)}`,'Version button opens the matching release history');
        const history=await settings.evaluate("document.querySelector('[data-whats-new]').textContent");
        assert(!history.includes('{{'));assert(history.includes(language==='ru'?'обычный опрос':'normal scans'));
        assert.equal(await settings.evaluate("(()=>{const el=document.querySelector('[data-whats-new]');return el.scrollWidth>el.clientWidth+1;})()"),false);
        const releaseShot=await settings.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,`releases-canonical-${language}.png`),Buffer.from(releaseShot.data,'base64'));
        await settings.evaluate("document.querySelector('[data-nav=pro]').click()");
      }
      return {languages:['ru','en'],version,ownAuthor:true,ownMascot:true,canonicalHistory:true,proseFixesVisible:true,placeholdersResolved:true,versionNavigation:true};
    }finally{
      await main.invoke('settings_set',{settings:prior});
      if(settings){await main.invoke('plugin:window|close',{label:'settings'});await waitForWindowClosed('/settings.html');}
    }
  });
  await check('Screen snow follows settings and motion in one hidden native surface without repeated visibility transitions',async()=>{
    const before=await main.invoke('settings_get');let snow;
    const keys=['snow','snowScreen','snowFall','snowAmount','reducedMotion'];
    try{
      await main.invoke('settings_set',{settings:{snow:'on',snowScreen:true,snowFall:false,snowAmount:200,reducedMotion:'full'}});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('snow_state').then(state=>state.reason==='qa'||state.reason==='fullscreen')`,'Native snow policy');
      const state=await main.invoke('snow_state');
      if(state.reason==='fullscreen')return {skipped:true,reason:'A real fullscreen program suppresses decorative snow'};
      assert(state.enabled&&!state.visible);assert.equal(state.amount,200);assert.equal(state.motion,'full');
      snow=await attach((await pagesReady(page=>page.url.endsWith('/snow.html'))).find(page=>page.url.endsWith('/snow.html')));
      const size=await main.invoke('plugin:window|outer_size',{label:'snow-screen'}),position=await main.invoke('plugin:window|outer_position',{label:'snow-screen'});
      assert.deepEqual([size.width,size.height],[state.width,state.height]);assert.deepEqual([position.x,position.y],[state.left,state.top]);
      assert.equal(await main.invoke('plugin:window|is_visible',{label:'snow-screen'}),false);
      await waitFor(snow,`window.__woodsSnow?.status().revision>=${state.revision}`,'Snow renderer received the native state');
      const renderer=await snow.evaluate('window.__woodsSnow.status()');assert(renderer.enabled&&renderer.density===2);
      const canvasResets = await snow.evaluate(`(()=>{const canvas=document.querySelector('#woods-snow'),observer=new MutationObserver(()=>{});observer.observe(canvas,{attributes:true,attributeFilter:['width','height']});for(let i=0;i<5;i++)dispatchEvent(new Event('resize'));const resets=observer.takeRecords().length;observer.disconnect();return resets;})()`);
      assert.equal(canvasResets,0,'A resize notification with identical dimensions must preserve the painted frame');
      await pause(1600);const unchanged=await main.invoke('snow_state');assert.equal(unchanged.revision,state.revision,'Idle polling must not repeat native changes');
      await main.invoke('settings_set',{settings:{reducedMotion:'reduce'}});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('snow_state').then(state=>!state.enabled&&state.reason==='motion')`,'Reduced motion stops screen snow');
      await waitFor(snow,`!window.__woodsSnow.status().enabled&&!window.__woodsSnow.status().running`,'Renderer stops after motion preference');
      await main.invoke('settings_set',{settings:{reducedMotion:'full',snowScreen:false}});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('snow_state').then(state=>!state.enabled&&state.reason==='setting')`,'Screen setting disables snow');
      return {realNativeSurface:true,geometry:[state.left,state.top,state.width,state.height],screenIndependentOfLocalFall:true,stableRevision:true,motionStops:true,passiveHidden:true,realDesktopSnowNotShown:true};
    }finally{
      await main.invoke('settings_set',{settings:Object.fromEntries(keys.map(key=>[key,before[key]]))});
    }
  });
  await check('Notch AppBar mode and fullscreen toggle follow native settings without altering desktop work area',async()=>{
    const before=await main.invoke('settings_get');
    const keys=['notchBar','notchLook','hideInFullscreen'];
    try{
      await main.invoke('settings_set',{settings:{notchBar:true,notchLook:'glass'}});
      await main.invoke('notch_pill',{height:44});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('notch_state').then(s=>s.reason==='qa'&&s.look==='glass'&&typeof s.height==='number'&&s.height>=44)`,'Native notch AppBar passive QA state');
      const state=await main.invoke('notch_state');
      assert.equal(state.active,false);assert.equal(state.visible,false);assert.equal(state.look,'glass');
      await main.invoke('settings_set',{settings:{notchLook:'wallpaper'}});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('notch_state').then(s=>s.reason==='qa'&&s.look==='wallpaper')`,'Notch strip switches to wallpaper look');
      await main.invoke('settings_set',{settings:{notchBar:false}});
      await waitFor(main,`window.__TAURI_INTERNALS__.invoke('notch_state').then(s=>s.reason==='setting'&&!s.active)`,'Notch mode disables cleanly');
      const toggled=await main.invoke('fullscreen_hide_toggle');
      assert.equal(toggled,!(before.hideInFullscreen!==false));
      const toggledBack=await main.invoke('fullscreen_hide_toggle');
      assert.equal(toggledBack,!toggled);
      return {notchHeight:state.height,passiveSafe:true,fullscreenToggleRoundtrip:true};
    }finally{
      await main.invoke('settings_set',{settings:Object.fromEntries(keys.map(key=>[key,before[key]]))});
    }
  });
  await check('Notification artwork comes from installed Windows apps and renders in the folded native pill',async()=>{
    const prior=await main.invoke('settings_get');
    try{
      assert.equal(await main.invoke('notifications_icon',{aumid:'bad\u0000id'}),null);
      const apps=(await main.invoke('palette_apps')).filter(app=>app.path.startsWith('shell:AppsFolder\\'));
      let icon,checked=0;
      for(const app of apps.slice(0,12)){
        checked++;const value=await main.invoke('notifications_icon',{aumid:app.path.slice('shell:AppsFolder\\'.length)});
        if(value){icon=value;break;}
      }
      assert(icon,'An installed registered Windows app should expose local artwork');
      assert(icon.startsWith('data:image/png;base64,'));
      const png=Buffer.from(icon.slice('data:image/png;base64,'.length),'base64');
      assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      assert(png.readUInt32BE(16)<=96&&png.readUInt32BE(20)<=96);
      await main.invoke('settings_set',{settings:{showNotifications:true}});
      await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({expanded:false,peek:null,queue:[]});})()`);
      await main.invoke('plugin:event|emit',{event:'notify:new',payload:{id:7771,app:'Woods fixture',aumid:'',title:'Artwork check',body:'Сайт и приложение',icon}});
      await waitFor(main,'!!document.querySelector("[data-notification] img")','Local notification icon in the folded pill');
      assert.equal(await main.evaluate('document.querySelector("[data-notification] img").getAttribute("src")'),icon);
      return {installedAppArtwork:true,checked,smallPng:true,syntheticNativeToast:true,windowsNotificationAccess:'not requested',liveSiteToast:'pending'};
    }finally{
      await main.invoke('settings_set',{settings:prior});
      await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({peek:null,queue:[]});})()`);
    }
  });
  await check('Phone page uses the actual native HTTP assets and shelf previews in mobile layouts',async()=>{
    const {chromium}=require('playwright-core');const prior=await main.invoke('settings_get'),shelfBefore=await main.invoke('shelf_list');let browser;
    try{
      await main.invoke('settings_set',{settings:{scale:100,theme:'dark',openOnHover:false}});
      await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({expanded:true,tab:'shelf',palette:false,peek:null,queue:[]});})()`);
      const imagePath=path.join(directory,'Снимок Woods.png'),notePath=path.join(directory,'Заметки.md');
      const actualImage=path.join(directory,'controls-reference-dark.png');
      await fs.copyFile(await fs.stat(actualImage).then(()=>actualImage).catch(()=>path.join(root,'src-tauri','icons','128x128.png')),imagePath);
      await fs.copyFile(path.join(root,'README.md'),notePath);
      const added=await main.invoke('shelf_add',{paths:[imagePath,notePath]});assert(added.find(item=>item.path===imagePath)?.preview);
      await waitFor(main,`!!document.querySelector(${JSON.stringify('[data-shelf-item="Снимок Woods.png"] .wi-shelf-print img')})`,'Actual native PNG preview');
      const receiver=await main.invoke('phone_start');assert.equal(new URL(receiver.url).hostname,'127.0.0.1');
      await waitFor(main,'!!document.querySelector("[data-phone-qr] img")','Native QR image');
      const qr=await main.evaluate(`(()=>{const r=document.querySelector('[data-phone-qr]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
      const rendered=await main.command('Page.captureScreenshot',{format:'png',clip:{...qr,scale:1}});await fs.writeFile(path.join(directory,'phone-rendered-94px-qr.png'),Buffer.from(rendered.data,'base64'));await fs.writeFile(path.join(directory,'phone-rendered-qr-link.txt'),receiver.url);
      const shown=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'shelf-real-files-and-qr.png'),Buffer.from(shown.data,'base64'));
      browser=await chromium.launch({executablePath:process.env.WOODS_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run']});
      const context=await browser.newContext({viewport:{width:390,height:844},locale:'ru-RU',isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}),phone=await context.newPage();const exceptions=[];phone.on('pageerror',error=>exceptions.push(error.message));
      const response=await phone.goto(receiver.url);assert(response.ok());assert.match(response.headers()['content-type'],/^text\/html/);assert.equal(response.headers()['content-disposition'],undefined);
      await phone.waitForFunction(()=>document.getElementById('connection-title').textContent.includes('Подтверди'));
      const pending=await main.invoke('phone_state');assert(pending.pending);await main.invoke('phone_allow',{id:pending.pending.id});
      await phone.waitForFunction(()=>!document.getElementById('send-text').disabled);
      await main.invoke('phone_send',{paths:[imagePath,notePath]});await phone.locator('#offered strong').filter({hasText:'Снимок Woods.png'}).waitFor();
      for(const width of [320,390,768]){
        await phone.setViewportSize({width,height:844});assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await phone.locator('#pick-files').isEnabled(),true);assert.equal(await phone.locator('#text').isEnabled(),true);
        await phone.screenshot({path:path.join(directory,`phone-native-page-${width}.png`),fullPage:true});
      }
      await phone.locator('#text').fill('Проверка нативной страницы Woods');await phone.locator('#send-text').click();await phone.waitForFunction(()=>document.getElementById('text').value==='');
      assert.equal(await fs.readFile(path.join(dataDir,'phone-qa-text.txt'),'utf8'),'Проверка нативной страницы Woods');assert.deepEqual(exceptions,[]);
      return {actualNativeHttpPage:true,actualPngPreview:true,actualMarkdownFile:true,renderedQrPixels:94,phoneWidths:[320,390,768],desktopApproval:true,textReachedIsolatedNativeSink:true,exceptions,realAndroid:'pending'};
    }finally{await browser?.close();await main.invoke('phone_stop');for(const item of await main.invoke('shelf_list'))if(!shelfBefore.some(previous=>previous.id===item.id))await main.invoke('shelf_remove',{id:item.id});await main.invoke('settings_set',{settings:prior});await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({expanded:false,tab:'home',peek:null,queue:[]});})()`);}
  });
  await check('Phone transfer uses desktop approval and the real isolated local HTTP server',async()=>{
    await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.getState().open('click','shelf');})()`);
    await waitFor(main,'!!document.querySelector("[data-phone-panel]")','Phone panel on the shelf');
    assert.equal(await main.evaluate('!!document.querySelector("[data-phone-open]")'),true);
    let states=0;
    const evidence=await verifyPhoneTransport({directory,profile:dataDir,invoke:async(command,args)=>{
      const result=await main.invoke(command,args);
      if(command==='phone_state' || command==='phone_start' || command==='phone_stop' || command==='phone_allow') {
        await waitFor(main,`(async()=>{const {ot}=await import('/assets/runtime-debug.js');const s=ot.getState().phone;return !!s&&s.running===${result.running}&&s.connected===${result.connected}&&s.pending?.id===${JSON.stringify(result.pending?.id)};})()`,'Phone state delivered to real UI');
        states++;
      }
      if(command==='phone_start'){
        await waitFor(main,'!!document.querySelector("[data-phone-qr] img")','Phone QR code generated');
        const source=await main.evaluate('document.querySelector("[data-phone-qr] img").src');
        assert.match(source,/^data:image\/png;base64,/);
        await fs.writeFile(path.join(directory,'phone-displayed-qr.png'),Buffer.from(source.split(',')[1],'base64'));
        await fs.writeFile(path.join(directory,'phone-displayed-qr-link.txt'),result.url);
        const layout=await main.evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {panel:rect(document.querySelector('[data-phone-panel]')),qr:rect(document.querySelector('[data-phone-qr]')),shelf:rect(document.querySelector('.wi-shelf-row-wrap'))};})()`);
        assert(Math.abs(layout.panel.width-184)<.05);assert(layout.qr.width>=76&&layout.qr.width<=94);assert(layout.panel.right<=layout.shelf.left+.05,'Phone panel must be to the left of the shelf');
        assert(layout.qr.top>=layout.panel.top&&layout.qr.bottom<=layout.panel.bottom,'QR must fit inside the card');
        assert(await main.evaluate(`(()=>{const url=document.querySelector('[data-phone-url]'),content=url.closest('.wi-phone-content');return url.getBoundingClientRect().bottom<=content.getBoundingClientRect().bottom+1;})()`),'QR instructions and link must fit');
        await fs.writeFile(path.join(directory,'phone-reference-layout.json'),JSON.stringify(layout,null,2));
        const screenshot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'phone-native-qr.png'),Buffer.from(screenshot.data,'base64'));
      }
      if(command==='phone_state'&&result.pending){
        await waitFor(main,'!!document.querySelector("[data-phone-allow]")','Desktop approval controls');
        const header=await main.evaluate(`(()=>{const el=document.querySelector('[data-phone-device]'),status=document.querySelector('[data-phone-status]'),box=el.closest('header');const fits=node=>{const range=document.createRange();range.selectNodeContents(node);const bounds=box.getBoundingClientRect();return [...range.getClientRects()].every(rect=>rect.left>=bounds.left-1&&rect.right<=bounds.right+1&&rect.bottom<=bounds.bottom+1);};return {device:el.textContent,status:status.textContent,deviceFits:fits(el),statusFits:fits(status),deviceLeft:el.getBoundingClientRect().left,statusLeft:status.getBoundingClientRect().left,headerWidth:box.clientWidth};})()`);
        assert.equal(header.device,result.pending.device);
        assert.match(header.status,/нужно подтверждение|needs approval/);
        assert(header.deviceFits&&header.statusFits&&Math.abs(header.statusLeft-header.deviceLeft)<=2,JSON.stringify(header));
        const approval=await main.evaluate(`(()=>{const buttons=Array.from(document.querySelectorAll('[data-phone-allow],[data-phone-deny]')),rect=buttons[0].closest('.wi-phone-content').getBoundingClientRect();return buttons.map(button=>{const bounds=button.getBoundingClientRect();return {top:bounds.top-rect.top,bottom:rect.bottom-bounds.bottom,right:rect.right-bounds.right};});})()`);
        const screenshot=await main.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'phone-native-approval.png'),Buffer.from(screenshot.data,'base64'));
        assert(approval.every(bounds=>bounds.top>=-1&&bounds.bottom>=-1&&bounds.right>=-1),JSON.stringify({header,approval}));
      }
      return result;
    }});
    await main.evaluate(`(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.getState().close();})()`);
    return {...evidence,sharedPanel:true,nativeStatesObserved:states};
  });
  await check('Free Woods features stay unlocked after legacy license events',async()=>{
    for(const command of ['license_status','license_activate','license_remove']){
      const status=await main.invoke(command,command==='license_activate'?{key:'ignored-qa-value'}:{});
      assert.equal(status.pro,true);assert.equal(status.source,'free');assert.equal(status.trialDaysLeft,null);
    }
    await main.invoke('plugin:event|emit',{event:'license:changed',payload:{pro:false,source:'expired',trialDaysLeft:0}});
    await waitFor(main,"(async()=>{const {ot}=await import('/assets/runtime-debug.js');return ot.getState().license.pro&&ot.getState().license.source==='free'&&ot.getState().license.trialDaysLeft===null;})()",'Legacy license cannot restrict Woods');
    return {backendFree:true,activationNeverRequired:true,legacyEventIgnored:true};
  });
  await check('Voice command results reach the real palette and execute recognized actions once',async()=>{
    const prior=await main.invoke('settings_get');
    const say=text=>main.invoke('plugin:event|emit',{event:'dictation:done',payload:{target:'command',text,pasted:false}});
    await main.evaluate("(async()=>{const {ot}=await import('/assets/runtime-debug.js');window.__qaVoiceOriginalOpen=ot.getState().open;window.__qaVoiceOpens=0;ot.setState({open:(...args)=>{if(args[1]==='weather')window.__qaVoiceOpens++;return window.__qaVoiceOriginalOpen(...args);}});})()");
    let expectedOpens=0;
    const opened=async()=>{
      expectedOpens++;
      await waitFor(main,`(async()=>{const {ot}=await import('/assets/runtime-debug.js');const s=ot.getState();return window.__qaVoiceOpens===${expectedOpens}&&s.expanded&&s.tab==='weather'&&!s.palette;})()`,'Spoken weather action executed once');
      await pause(500);assert.equal(await main.evaluate('window.__qaVoiceOpens'),expectedOpens);
    };
    try{
      assert.equal(prior.hotkeyVoiceCommand,'','Voice shortcut starts unassigned');
      for(const language of ['ru','en']){
        await main.invoke('settings_set',{settings:{language}});await pause(250);
        await say(language==='ru'?'Пожалуйста, открой Погода!':'Please, open Weather!');
        await opened();
        await say('Please open Definitely MissingWoodsQaApp!');
        await waitFor(main,"document.querySelector('[data-palette-input]')?.value==='Definitely MissingWoodsQaApp'",'Unmatched voice command remains in palette');
        await pause(300);
        const pending=await main.evaluate("(async()=>{const {ot}=await import('/assets/runtime-debug.js');return {palette:ot.getState().palette,seed:ot.getState().paletteSeed,query:document.querySelector('[data-palette-input]')?.value};})()");
        assert.deepEqual(pending,{palette:true,seed:null,query:'Definitely MissingWoodsQaApp'});
        // A second recognition updates the already mounted palette.
        await say(language==='ru'?'Открой Погода.':'Open Weather.');
        await opened();
        await say(language==='ru'?'Открой Погода.':'Open Weather.');
        await waitFor(main,"!!document.querySelector('[data-palette-input]')",'Voice preview can be cancelled');
        await main.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await pause(600);assert.equal(await main.evaluate('window.__qaVoiceOpens'),expectedOpens,'Closing the preview cancels automatic execution');
      }
      return {languages:['ru','en'],recognition:'synthetic native event',realCommandResolver:true,openAndMountedPalette:true,executedOnce:true,closingCancels:true,unmatchedCommandsRemainReviewable:true};
    }finally{
      await main.invoke('settings_set',{settings:prior});
      await main.evaluate("(async()=>{const {ot}=await import('/assets/runtime-debug.js');ot.setState({open:window.__qaVoiceOriginalOpen,expanded:false,palette:false,paletteSeed:null,holdOpen:false,peek:null,queue:[]});delete window.__qaVoiceOriginalOpen;delete window.__qaVoiceOpens;})()");
    }
  });
  await check('Torrent download setting and file owners reach the native pill without hiding browser downloads',async()=>{
    const prior=await main.invoke('settings_get');const folder=path.join(directory,'torrent-owner');
    const downloads=path.join(folder,'downloads');await fs.mkdir(downloads,{recursive:true});
    const writerExe=path.join(folder,'qbittorrent.exe');let writer,settings;
    const writerPath=path.join(downloads,'Архив.zip.part'),finalPath=path.join(downloads,'Архив.zip');
    const latest=()=>main.evaluate("window.__woodsEvents['downloads:update'].at(-1)??[]");
    try{
      assert.equal(prior.downloadsTorrents,false,'Torrent files are hidden by default');
      const compiled=spawnSync('rustc',['+1.98.1',path.join(root,'scripts/fixtures/download-writer.rs'),'-o',writerExe],{encoding:'utf8',windowsHide:true});
      assert.equal(compiled.status,0,compiled.stderr);
      await main.invoke('settings_set',{settings:{downloadsDir:downloads,downloadsTorrents:false,showDownloads:true,downloadsInPill:'badge'}});
      await listen(main,'downloads:done');await listen(main,'downloads:update');await pause(1300);
      writer=spawn(writerExe,[folder],{windowsHide:true,stdio:'ignore'});
      for(let i=0;i<100;i++){if(await fs.stat(path.join(folder,'ready')).catch(()=>false))break;await pause(50);}
      assert(await fs.stat(path.join(folder,'ready')).catch(()=>false),'Fixture writer did not start');
      await pause(1200);await fs.writeFile(path.join(folder,'grow'),'incoming fixture bytes');await pause(3000);
      assert(!(await latest()).some(file=>file.path===writerPath),'A confirmed torrent writer must be hidden');
      await main.invoke('open_settings',{section:'events'});
      settings=await attach((await pagesReady(page=>page.url.endsWith('/settings.html'))).find(page=>page.url.endsWith('/settings.html')));
      await waitFor(settings,'document.querySelector("[data-nav=events]")?.dataset.now==="true"','Downloads settings section');
      await settings.evaluate(`(()=>{const button=Array.from(document.querySelectorAll('[role=switch]')).find(el=>['Торрент-загрузки','Torrent downloads'].includes(el.getAttribute('aria-label')));if(!button)throw new Error('Torrent setting missing');button.click();})()`);
      await waitFor(main,"window.__TAURI_INTERNALS__.invoke('settings_get').then(settings=>settings.downloadsTorrents===true)",'Torrent setting enabled from UI');
      await waitFor(main,`window.__woodsEvents['downloads:update'].at(-1)?.some(file=>file.path===${JSON.stringify(writerPath)})`,'Opted in torrent appears');
      await waitFor(main,`(async()=>{const {ot}=await import('/assets/runtime-debug.js');return !ot.getState().expanded&&ot.getState().downloads.some(file=>file.path===${JSON.stringify(writerPath)})&&!!document.querySelector('[data-download-badge]');})()`,'Download badge in the folded pill');
      const browserFile=path.join(downloads,'browser.txt');await fs.writeFile(browserFile,'ordinary completed download');
      await waitFor(main,`window.__woodsEvents['downloads:done'].some(file=>file.path===${JSON.stringify(browserFile)})`,'Browser file completes with torrent client running');
      await main.invoke('settings_set',{settings:{downloadsTorrents:false}});await pause(1200);
      assert(!(await latest()).some(file=>file.path===writerPath));
      await fs.writeFile(path.join(folder,'close'),'');await new Promise((resolve,reject)=>{if(writer.exitCode!==null)return resolve();writer.once('exit',code=>code===0?resolve():reject(new Error('Writer exit '+code)));});
      await fs.rename(writerPath,finalPath);await pause(4500);
      const done=await main.evaluate("window.__woodsEvents['downloads:done']");assert(!done.some(file=>file.path===finalPath),'Hidden ownership survives temporary-name removal');
      await main.invoke('settings_set',{settings:{downloadsTorrents:true}});await pause(1300);
      assert(!(await main.evaluate("window.__woodsEvents['downloads:done']")).some(file=>file.path===finalPath),'Re-enabling must not notify for old files');
      assert.equal(JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8')).downloadsTorrents,true);
      return {nativeFileOwners:true,writer:'isolated fixture',hiddenByDefault:true,settingsUi:true,settingPersisted:true,ordinaryCompletion:true,renameRetained:true,noOldNotification:true};
    }finally{
      writer?.kill();if(settings){await settings.invoke('plugin:window|close',{label:'settings'}).catch(()=>{});await waitForWindowClosed('/settings.html');}
      await main.invoke('settings_set',{settings:prior});
    }
  });
  await check('Browser final-name download waits for its writer to close before completion',async()=>{
    const prior=await main.invoke('settings_get'),folder=path.join(directory,'browser-save-as'),downloads=path.join(folder,'downloads');let writer;
    await fs.mkdir(downloads,{recursive:true});const file=path.join(downloads,'Сохранить как.zip'),writerExe=path.join(folder,'chrome.exe');
    try{
      const compiled=spawnSync('rustc',['+1.98.1',path.join(root,'scripts/fixtures/download-writer.rs'),'-o',writerExe],{encoding:'utf8',windowsHide:true});assert.equal(compiled.status,0,compiled.stderr);
      await main.invoke('settings_set',{settings:{downloadsDir:downloads,showDownloads:true,downloadsTorrents:false}});
      await listen(main,'downloads:done');await listen(main,'downloads:update');await pause(1300);
      writer=spawn(writerExe,[folder,'Сохранить как.zip'],{windowsHide:true,stdio:'ignore'});
      for(let i=0;i<100;i++){if(await fs.stat(path.join(folder,'ready')).catch(()=>false))break;await pause(50);}
      assert(await fs.stat(path.join(folder,'ready')).catch(()=>false),'Browser fixture did not open final-name file');
      await pause(4500);
      assert(!(await main.evaluate("window.__woodsEvents['downloads:done']")).some(item=>item.path===file),'Open browser file was announced ready while Save As is still pending');
      await fs.writeFile(path.join(folder,'grow'),'new browser bytes');
      await waitFor(main,`window.__woodsEvents['downloads:update'].some(files=>files.some(item=>item.path===${JSON.stringify(file)}&&item.size>17))`,'Ordinary final-name writer appears as an active download');
      await fs.writeFile(path.join(folder,'close'),'');await new Promise((resolve,reject)=>{if(writer.exitCode!==null)return resolve();writer.once('exit',code=>code===0?resolve():reject(new Error('Browser writer exit '+code)));});
      await waitFor(main,`window.__woodsEvents['downloads:done'].some(item=>item.path===${JSON.stringify(file)})`,'Browser completion follows actual close');
      await pause(1500);assert.equal((await main.evaluate("window.__woodsEvents['downloads:done']")).filter(item=>item.path===file).length,1);
      return {writer:'isolated browser fixture',finalFilename:true,openFileNeverCompletes:true,activeProgress:true,completionAfterClose:true,notifiesOnce:true,realYandexBrowser:false};
    }finally{writer?.kill();await main.invoke('settings_set',{settings:prior});}
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
  if(webAiServer)webAiServer.close();
  if(obsServer){for(const client of obsServer.clients)client.terminate();obsServer.close();}
});
