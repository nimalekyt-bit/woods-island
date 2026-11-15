// Render the actual AI shell in a hidden browser, with local IPC fixtures.
// No native windows, account sessions, clipboard or external providers are used.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const esbuild=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite/package.json'))]}));
const {chromium}=require(process.env.WOODS_PLAYWRIGHT_MODULE||'playwright');
const scratch=path.join(root,'.qa-temp','web-ai-shell');
let browser,server;
(async()=>{
 await fs.mkdir(scratch,{recursive:true});
 await esbuild.build({entryPoints:[path.join(root,'runtime/entries/web-ai.tsx')],bundle:true,outfile:path.join(scratch,'web-ai.js'),format:'esm',platform:'browser',jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',tsconfigRaw:{compilerOptions:{jsx:'react',jsxFactory:'React.createElement',jsxFragmentFactory:'React.Fragment'}},loader:{'.png':'dataurl','.svg':'dataurl'},logLevel:'silent'});
 server=http.createServer(async(req,res)=>{
  const resources={'/web-ai.js':['web-ai.js','application/javascript'],'/web-ai.css':['web-ai.css','text/css']};
  if(resources[req.url]){const [file,type]=resources[req.url];res.setHeader('Content-Type',type);res.end(await fs.readFile(path.join(scratch,file)));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ru"><head><meta charset="utf-8"><link rel="stylesheet" href="/web-ai.css"></head><body><div id="root"></div><script type="module" src="/web-ai.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 for(const theme of ['dark','light'])for(const width of [960,560]){
  const context=await browser.newContext({viewport:{width,height:width===960?760:420},locale:'ru'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({theme})=>{
   let id=1;const callbacks=new Map(),subscriptions=new Map();
   let service='gemini',navigation=1,status={service,target:'window',phase:'loading',code:null,navigation};
   const emit=(event,payload)=>{for(const sub of subscriptions.values())if(sub.event===event)callbacks.get(sub.handler)?.({event,payload});};
   window.__webAiCalls=[];
   window.__webAiState=phase=>{status={service,target:'window',phase,code:phase==='error'?7:null,navigation:++navigation};emit('webai:status',status);};
   window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
   window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'web-ai-window'},currentWebview:{label:'web-ai-window'}},transformCallback:cb=>{const n=id++;callbacks.set(n,cb);return n;},unregisterCallback:n=>callbacks.delete(n),
    invoke:async(command,args={})=>{
     window.__webAiCalls.push({command,args});
     if(command==='plugin:event|listen'){const n=id++;subscriptions.set(n,args);return n;}
     if(command==='plugin:event|unlisten'){subscriptions.delete(args.eventId);return;}
     if(command==='web_ai_popped')return service;
     if(command==='settings_get')return {language:'ru',theme};
     if(command==='web_ai_status')return [status];
     if(command==='web_ai_window_attach')return true;
     if(command==='web_ai_window'){service=args.service;emit('webai:popped',service);window.__webAiState('loading');return true;}
     if(command==='web_ai_reload'){window.__webAiState('loading');return true;}
     if(command==='web_ai_browser'||command==='web_ai_window_close')return true;
     throw Error('Unmocked command: '+command);
    }};
  },{theme});
  await page.goto(`http://127.0.0.1:${server.address().port}/web-ai.html`);
  await page.locator('[data-web-ai-shell=gemini]').waitFor();
  await page.screenshot({path:path.join(scratch,`${theme}-${width}-loading.png`)});
  await page.evaluate(()=>window.__webAiState('error'));
  await page.locator('[data-web-ai-status=error]').waitFor();
  await page.screenshot({path:path.join(scratch,`${theme}-${width}-error.png`)});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Window has horizontal overflow');
  assert(await page.locator('.webai-state-card').evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=64&&r.bottom<=innerHeight}),'State card must fit the viewport');
  assert.equal(await page.locator('[data-web-ai-retry] .lucide-refresh-cw').count(),1);
  assert.equal(await page.locator('[data-web-ai-browser] .lucide-external-link').count(),1);
  assert.equal(await page.locator('[data-web-ai-back] .lucide-arrow-left').count(),1);
  await page.locator('[data-web-ai-retry]').click();
  await page.locator('[data-web-ai-status=loading]').waitFor();
  await page.locator('[data-web-ai-service=deepseek]').click();
  await page.locator('[data-web-ai-shell=deepseek]').waitFor();
  await page.locator('[data-web-ai-browser]').click();
  assert(await page.evaluate(()=>window.__webAiCalls.some(c=>c.command==='web_ai_browser'&&c.args.service==='deepseek')));
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({theme,width,errors,loadingAndError:true,icons:'Lucide',browserUsesSelectedService:true});
  await context.close();
 }
 await fs.writeFile(path.join(scratch,'report.json'),JSON.stringify({results},null,2));
 console.log(`PASS ${results.length} UI scenarios; screenshots ${scratch}`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
