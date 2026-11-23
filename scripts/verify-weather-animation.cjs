// Real pinned React renderer with a deterministic frame clock; no weather network requests.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const scratch = path.resolve(process.env.WOODS_QA_TEMP || process.env.TEMP, 'woods-weather-animation');
const esbuild = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite/package.json'))] }));
const { chromium } = require('playwright-core');
let server, browser;
(async () => {
  await fs.mkdir(scratch, { recursive: true });
  const local = file => JSON.stringify(path.join(root, file).replace(/\\/g, '/'));
  await fs.writeFile(path.join(scratch, 'entry.tsx'), `
import {React} from ${local('runtime/react.ts')};
import {g} from ${local('runtime/vendor/react-foundation.js')};
import {AnimatedWeatherValue,useWeatherTween} from ${local('runtime/weather/AnimatedWeatherValue.tsx')};
import {setCharacterMotionPreference} from ${local('runtime/characters/scheduler.ts')};
import {WEATHER_GAUGE_TWEEN} from ${local('runtime/weather/animation.ts')};
window.motion=setCharacterMotionPreference;
function Values({target,delay}) {
 const angle=useWeatherTween(target+180,{...WEATHER_GAUGE_TWEEN,from:target+30,delay});
 return <div data-weather><div data-value><AnimatedWeatherValue value={target} delay={delay} format={value=>value.toFixed(3)}/></div>
 <svg viewBox="0 0 52 52" width="52" height="52"><g data-angle transform={'rotate('+angle+' 26 26)'}><path fill="currentColor" d="M26 4 L32 26 L26 21 L20 26 Z"/></g></svg></div>;
}
function Fixture(){const [state,setState]=React.useState({target:20,delay:70,visible:true});window.fixture=update=>setState(s=>({...s,...update}));return state.visible?<Values {...state}/>:null;}
g().createRoot(document.getElementById('root')).render(<Fixture/>);
`);
  await esbuild.build({entryPoints:[path.join(scratch,'entry.tsx')],outfile:path.join(scratch,'entry.js'),bundle:true,format:'esm',platform:'browser',jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',tsconfigRaw:{compilerOptions:{jsx:'react',jsxFactory:'React.createElement',jsxFragmentFactory:'React.Fragment'}},logLevel:'silent'});
  server=http.createServer(async(req,res)=>{if(req.url==='/entry.js'){res.setHeader('Content-Type','application/javascript');res.end(await fs.readFile(path.join(scratch,'entry.js')));return;}res.end('<html><body style="margin:0;color:var(--color-ink)"><div id="root"></div><script type="module" src="/entry.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'msedge',headless:true});
  const results=[], errors=[];
  for(const language of ['ru','en'])for(const reducedMotion of ['no-preference','reduce']) {
    const context=await browser.newContext({locale:language==='ru'?'ru-RU':'en-US',reducedMotion});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      let now=0,next=0,hidden=false;const frames=new Map();
      performance.now=()=>now;
      window.requestAnimationFrame=callback=>{const id=++next;frames.set(id,callback);return id;};
      window.cancelAnimationFrame=id=>frames.delete(id);
      Object.defineProperty(document,'hidden',{get:()=>hidden});
      window.frameCount=()=>frames.size;
      window.advance=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));};
      window.visibility=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('[data-value]').waitFor();
    const value=async()=>Number(await page.locator('[data-value]').textContent());
    const advance=async ms=>{await page.evaluate(ms=>window.advance(ms),ms);await page.waitForTimeout(20);};
    if(reducedMotion==='reduce') {
      assert.equal(await value(),20);assert.equal(await page.evaluate(()=>window.frameCount()),0);
      await page.evaluate(()=>window.fixture({target:42}));await page.waitForTimeout(20);assert.equal(await value(),42);
    } else {
      assert.equal(await value(),0);await advance(50);assert.equal(await value(),0);
      await advance(400);const halfway=await value();assert(halfway>0&&halfway<20);
      await page.evaluate(()=>window.fixture({target:40,delay:0}));await page.waitForTimeout(20);assert.equal(await value(),halfway);
      await advance(200);assert((await value())>halfway&&(await value())<40);
      await page.evaluate(()=>window.visibility(true));assert.equal(await page.evaluate(()=>window.frameCount()),0);
      const beforeHidden=await value();await advance(2000);assert.equal(await value(),beforeHidden);
      await page.evaluate(()=>window.visibility(false));await advance(16);assert.equal(await value(),40);
      await advance(1000);assert.equal(await page.evaluate(()=>window.frameCount()),0);
      await page.evaluate(()=>window.fixture({target:10}));await page.waitForTimeout(20);await advance(100);
      await page.evaluate(()=>window.motion('reduce'));await page.waitForTimeout(20);assert.equal(await value(),10);assert.equal(await page.evaluate(()=>window.frameCount()),0);
      await page.evaluate(()=>{window.motion('full');window.fixture({target:90});});await page.waitForTimeout(20);
      assert.equal(await page.evaluate(()=>window.frameCount()),1);
      await page.evaluate(()=>window.fixture({visible:false}));await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>window.frameCount()),0);
      await page.evaluate(()=>window.fixture({visible:true,target:25}));await page.waitForTimeout(20);await advance(3000);assert.equal(await value(),25);
    }
    for(const theme of ['dark','light'])for(const width of [300,480]) {
      await page.setViewportSize({width,height:180});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.style.setProperty('--color-ink',theme==='dark'?'#ededed':'#151515');document.body.style.background=theme==='dark'?'#151515':'#ededed';},theme);
      assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(scratch,`${language}-${reducedMotion}-${theme}-${width}.png`)});
    }
    results.push({language,reducedMotion,status:'PASS'});await context.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(scratch,'report.json'),JSON.stringify({status:'PASS',checks:['delay','continuous interrupted updates','hidden cancels frames and resumes at current time','OS reduced motion','Woods motion preference changes','unmount cleanup','shared single frame','RU/EN dark/light widths300/480'],results},null,2));
  console.log(JSON.stringify({status:'PASS',report:path.join(scratch,'report.json')}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
