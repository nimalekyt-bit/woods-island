// Render the actual AI shell in a hidden browser, with local IPC fixtures.
// No native windows, account sessions, clipboard or external providers are used.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),os=require('node:os');
const esbuild=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite/package.json'))]}));
const {chromium}=require(process.env.WOODS_PLAYWRIGHT_MODULE||'playwright-core');
const {assertWebAiPaint,readWebAiPaintRects}=require('./web-ai-paint.cjs');
let scratch;
let browser,server;
(async()=>{
 const qaRoot=path.join(os.tmpdir(),'woodscorp_obs');
 await fs.mkdir(qaRoot,{recursive:true});
 scratch=await fs.mkdtemp(path.join(qaRoot,'web-ai-polish-'));
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
  const captureLoading=async service=>{
    await page.evaluate(()=>window.__webAiSettings({language:'ru',theme:'dark',reducedMotion:'full'}));
    const orbit=page.locator('[data-web-ai-loader]');
    assert.equal(await orbit.evaluate(el=>getComputedStyle(el).animationName),'webai-spin');
    // A fixed animation timeline makes the visual preview replay at the CSS speed.
    // This captures the browser-rendered component, without changing its geometry.
    const card=await page.locator('.webai-state-card').boundingBox();
    const clip={x:Math.floor(card.x-14),y:Math.floor(card.y-14),width:Math.ceil(card.width+28),height:Math.ceil(card.height+28)};
    const frames=[];
    for(let i=0;i<24;i++){
      await page.evaluate(ms=>document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=ms;}),i*100);
      const file=`${service}-loading-frame-${String(i).padStart(2,'0')}.png`;
      frames.push({file,durationMs:100});
      await page.screenshot({path:path.join(scratch,file),clip});
    }
    await fs.writeFile(path.join(scratch,`${service}-loading-frames.json`),JSON.stringify({frames},null,2));
    await page.evaluate(()=>document.getAnimations().forEach(animation=>animation.play()));
    await page.evaluate(()=>window.__webAiSettings({language:'ru',theme:'dark',reducedMotion:'reduce'}));
  };
  const captureSatin=async()=>{
    await page.evaluate(()=>window.__webAiSettings({language:'ru',theme:'dark',reducedMotion:'full'}));
    assert.equal(await page.locator('.webai-satin-sculpture').evaluate(el=>getComputedStyle(el).animationName),'webai-satin-flow');
    const frames=[],hashes=new Set(),crypto=require('node:crypto');
    for(let i=0;i<60;i++){
      await page.evaluate(ms=>document.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=ms;}),i*200);
      const file=`satin-frame-${String(i).padStart(2,'0')}.png`;
      await page.screenshot({path:path.join(scratch,file)});
      // Restrict this evidence to the background, excluding the rotating provider mark.
      const bg=await page.screenshot({clip:{x:720,y:205,width:205,height:500}});
      hashes.add(crypto.createHash('sha256').update(bg).digest('hex'));
      frames.push({file,durationMs:200});
    }
    // The 12-second motion goes out and back along the same path: 60 samples
    // contain 31 distinct poses. Require visible changes throughout a half-cycle.
    assert(hashes.size>=frames.length/2,'The background itself must visibly change throughout a half-cycle');
    await fs.writeFile(path.join(scratch,'satin-frames.json'),JSON.stringify({frames,distinctBackgroundFrames:hashes.size},null,2));
    await page.evaluate(()=>document.getAnimations().forEach(animation=>animation.play()));
    await page.evaluate(()=>window.__webAiSettings({language:'ru',theme:'dark',reducedMotion:'reduce'}));
  };
  await page.addInitScript(({theme})=>{
   let id=1;const callbacks=new Map(),subscriptions=new Map();
   const query=new URL(location.href).searchParams;
   let service=query.get('service')||'gemini',navigation=1,status={service,target:'window',phase:'loading',code:null,navigation};
   const emit=(event,payload)=>{for(const sub of subscriptions.values())if(sub.event===event)callbacks.get(sub.handler)?.({event,payload});};
   window.__webAiCalls=[];
   window.__webAiSettings=settings=>emit('settings:changed',settings);
   window.__webAiState=phase=>{status={service,target:'window',phase,code:phase==='error'?7:null,navigation:++navigation};emit('webai:status',status);};
   window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
   window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'web-ai-window'},currentWebview:{label:'web-ai-window'}},transformCallback:cb=>{const n=id++;callbacks.set(n,cb);return n;},unregisterCallback:n=>callbacks.delete(n),
    invoke:async(command,args={})=>{
     window.__webAiCalls.push({command,args});
     if(command==='plugin:event|listen'){const n=id++;subscriptions.set(n,args);return n;}
     if(command==='plugin:event|unlisten'){subscriptions.delete(args.eventId);return;}
     if(command==='web_ai_popped')return service;
     if(command==='settings_get'){await new Promise(resolve=>setTimeout(resolve,Number(query.get('settingsDelay')||0)));return {language:'ru',theme,reducedMotion:query.get('motion')||'reduce'};}
     if(command==='web_ai_status')return [status];
     if(command==='web_ai_window_attach')return true;
     if(command==='web_ai_window_present')return true;
     if(command==='web_ai_window_reveal'){window.__webAiCalls.push({command:'fixture:reveal',ms:performance.now(),navigation:args.navigation});return true;}
     if(command==='web_ai_window'){service=args.service;emit('webai:window-service',service);window.__webAiState('loading');return true;}
     if(command==='web_ai_reload'){window.__webAiState('loading');return true;}
     if(command==='web_ai_browser'||command==='web_ai_window_close')return true;
     throw Error('Unmocked command: '+command);
    }};
  },{theme});
  const firstPaint=[];
  for(const service of ['gemini','deepseek'])for(const motion of ['reduce','full'])for(const settingsDelay of [0,150]){
    const label=`${theme}-${width}-${service}-${motion}-${settingsDelay}-first`;
    await page.goto(`http://127.0.0.1:${server.address().port}/web-ai.html?service=${service}&motion=${motion}&settingsDelay=${settingsDelay}`);
    await page.locator('[data-preferences-ready=true]').waitFor();
    const geometry=await page.evaluate(readWebAiPaintRects);
    const png=await page.screenshot({path:path.join(scratch,label+'.png')});
    await fs.writeFile(path.join(scratch,label+'.json'),JSON.stringify(geometry,null,2));
    firstPaint.push({label,proof:assertWebAiPaint(png,geometry,label)});
  }
  await page.goto(`http://127.0.0.1:${server.address().port}/web-ai.html`);
  await page.locator('[data-web-ai-shell=gemini]').waitFor();
  const assertReadable=async()=>{
    await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
    await page.waitForFunction(theme=>getComputedStyle(document.querySelector('[data-web-ai-content]')).backgroundColor===(theme==='light'?'rgb(246, 246, 247)':'rgb(23, 25, 28)'),theme);
    const contrasts=await page.evaluate(()=>{
      const backgroundRgb=getComputedStyle(document.querySelector('[data-web-ai-content]')).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);
      const luminance=color=>{
        const channels=color.match(/[\d.]+/g).map(Number),alpha=channels[3]??1;
        const rgb=channels.slice(0,3).map((value,index)=>value*alpha+backgroundRgb[index]*(1-alpha)).map(value=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});
        return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
      };
      const background=luminance(getComputedStyle(document.querySelector('[data-web-ai-content]')).backgroundColor);
      return ['.webai-state-card h1','.webai-service-title','.webai-eyebrow','.webai-state-card p','.webai-resume','.webai-resume-hint'].map(selector=>{
        const color=getComputedStyle(document.querySelector(selector)).color,ink=luminance(color);
        return {selector,color,contrast:(Math.max(ink,background)+.05)/(Math.min(ink,background)+.05)};
      });
    });
    for(const result of contrasts)assert(result.contrast>=4.5,`${theme}/${width} ${result.selector} contrast ${result.contrast.toFixed(2)} (${result.color})`);
    assert(await page.locator('.webai-state-card').evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=148&&r.bottom<=innerHeight-12;}),'Loading text and return explanation must fit without clipping');
    return contrasts;
  };
  const geminiContrast=await assertReadable();
  assert.equal(await page.locator('.webai-brand-mark').count(),0,'Keep the stock logo without an added frame');
  assert(await page.locator('.webai-brand>img').evaluate(el=>{const s=getComputedStyle(el);return el.width>=40&&s.boxShadow==='none'&&s.borderTopWidth==='0px';}));
  assert(await page.locator('[data-web-ai-service=deepseek]').evaluate(el=>{const s=getComputedStyle(el);return s.backgroundImage!=='none'&&s.boxShadow!=='none';}),'Inactive services should retain a visible button surface');
  assert.equal(await page.locator('.webai-satin-sculpture').evaluate(el=>getComputedStyle(el).animationName),'none','Reduced motion must also stop the background');
  const loadingGeometry=await page.evaluate(readWebAiPaintRects);
  const loadingPng=await page.screenshot({path:path.join(scratch,`${theme}-${width}-loading.png`)});
  assertWebAiPaint(loadingPng,loadingGeometry,`${theme}-${width}-loading`);
  if(theme==='dark'&&width===960){
    // Negative control: the owner's defective preview must fail this gate.
    const bad=path.join(os.tmpdir(),'woodscorp_obs','web-ai-polish-XUpXd1','dark-960-loading.png');
    if(await fs.stat(bad).then(()=>true,()=>false))assert.throws(()=>assertWebAiPaint(require('node:fs').readFileSync(bad),loadingGeometry,'known-bad'),/missing rendered ink/);
  }
  assert.equal(await page.locator('[data-web-ai-loader]').evaluate(el=>getComputedStyle(el).animationName),'none');
  if(theme==='dark'&&width===960){
    await captureLoading('gemini');
  }
  await page.locator('[data-web-ai-inline-back]').focus();
  await page.keyboard.press('Enter');
  assert(await page.evaluate(()=>window.__webAiCalls.some(c=>c.command==='web_ai_window_close'&&c.args.returnToPill===true)),'Inline return must use the same state-preserving return command');
  await page.evaluate(()=>window.__webAiState('error'));
  await page.locator('[data-web-ai-status=error]').waitFor();
  await page.screenshot({path:path.join(scratch,`${theme}-${width}-error.png`)});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Window has horizontal overflow');
  assert(await page.locator('.webai-state-card').evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=64&&r.bottom<=innerHeight}),'State card must fit the viewport');
  assert.equal(await page.locator('[data-web-ai-retry] .lucide-refresh-cw').count(),1);
  assert.equal(await page.locator('[data-web-ai-browser] .lucide-external-link').count(),1);
  assert.equal(await page.locator('[data-web-ai-back] .lucide-arrow-left').count(),1);
  await page.locator('[data-web-ai-back]').click();
  assert(await page.evaluate(()=>window.__webAiCalls.some(c=>c.command==='web_ai_window_close'&&c.args.returnToPill===true)));
  await page.evaluate(()=>window.__webAiSettings({language:'en',theme:'light',reducedMotion:'full'}));
  await page.locator('[data-web-ai-back]').filter({hasText:'Back to island'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.woodsReducedMotion),'false');
  await page.evaluate(theme=>window.__webAiSettings({language:'ru',theme,reducedMotion:'reduce'}),theme);
  await page.locator('[data-web-ai-retry]').click();
  await page.locator('[data-web-ai-status=loading]').waitFor();
  await page.locator('[data-web-ai-service=deepseek]').click();
  await page.locator('[data-web-ai-shell=deepseek]').waitFor();
  const deepseekContrast=await assertReadable();
  await page.screenshot({path:path.join(scratch,`${theme}-${width}-deepseek-loading.png`)});
  if(theme==='dark'&&width===960)await captureLoading('deepseek');
  if(theme==='dark'&&width===960)await captureSatin();
  await page.locator('[data-web-ai-browser]').click();
  assert(await page.evaluate(()=>window.__webAiCalls.some(c=>c.command==='web_ai_browser'&&c.args.service==='deepseek')));
  assert.equal(await page.locator('.webai-loading-track').count(),0,'The orbit is the only animated loading indicator');
  await page.evaluate(theme=>window.__webAiSettings({language:'ru',theme,reducedMotion:'full'}),theme);
  const beforeReady=await page.evaluate(()=>performance.now());
  await page.evaluate(()=>window.__webAiState('loaded'));
  await page.locator('[data-web-ai-status=loaded]').waitFor();
  await page.locator('.webai-placeholder').waitFor({state:'detached'});
  assert.equal(await page.locator('.webai-satin-sculpture').evaluate(el=>getComputedStyle(el).animationPlayState),'paused','Do not animate a background covered by the provider WebView');
  const reveal=await page.evaluate(()=>window.__webAiCalls.filter(c=>c.command==='fixture:reveal').at(-1));
  assert(reveal.ms-beforeReady>=145,'The provider should reveal after the 160ms fade, not before it');
  // A loading state that interrupts a reveal must keep its own placeholder.
  await page.evaluate(()=>{window.__webAiState('loading');window.__webAiCalls.length=0;});
  await page.locator('[data-web-ai-loader]').waitFor();
  await page.evaluate(()=>window.__webAiState('loaded'));
  await page.evaluate(()=>window.__webAiState('loading'));
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.webai-placeholder').count(),1,'A superseded fade must not clear a newer loading state');
  assert.equal(await page.evaluate(()=>window.__webAiCalls.filter(c=>c.command==='fixture:reveal').length),0);
  await page.evaluate(theme=>window.__webAiSettings({language:'ru',theme,reducedMotion:'reduce'}),theme);
  await page.evaluate(()=>window.__webAiState('loaded'));
  await page.locator('.webai-placeholder').waitFor({state:'detached'});
  assert.equal(errors.length,0,errors.join('\n'));
  results.push({theme,width,errors,firstPaint,loadingAndError:true,icons:'Lucide',browserUsesSelectedService:true,returnToPill:true,livePreferences:true,stockLogo:true,serviceButtonSurfaces:true,satinReducedAndReady:true,geminiContrast,deepseekContrast});
  await context.close();
 }
 await fs.writeFile(path.join(scratch,'report.json'),JSON.stringify({results},null,2));
 console.log(`PASS ${results.length} UI scenarios; screenshots ${scratch}`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
