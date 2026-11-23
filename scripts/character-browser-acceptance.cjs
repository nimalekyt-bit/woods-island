// Real renderer in an isolated Edge profile, with a controlled animation clock.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
async function verifyCharacterBrowser({directory,liquidOnly=false}={}) {
  directory||=await fs.mkdtemp(path.join(os.tmpdir(),'woods-character-browser-'));
  await fs.mkdir(directory,{recursive:true});
  const {createServer}=await import('vite');
  const server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},
    esbuild:{jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'},
    plugins:[{name:'woods-character-fixture',configureServer(s){s.middlewares.use((req,res,next)=>{
      if(req.url!=='/characters/')return next();
      res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/character-ui.tsx"></script></body></html>');
    });}}]});
  let browser;
  try {
    await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    browser=await chromium.launch({executablePath:process.env.WOODS_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu','--no-first-run']});
    const snapshots=[],exceptions=[],clipping=[];let actualLiquidClip=false,actualLiquidSquash=false;
    for(const theme of ['dark','light']) {
      const context=await browser.newContext({viewport:{width:1024,height:740},reducedMotion:'no-preference'});
      await context.addInitScript(()=>{
        let time=1000,id=0,frames=new Map();
        performance.now=()=>time;
        window.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};
        window.cancelAnimationFrame=handle=>frames.delete(handle);
        window.stepCharacterFrame=(dt=16)=>{time+=dt;const current=[...frames.values()];frames.clear();current.forEach(callback=>callback(time));return current.length;};
        window.characterFrameCount=()=>frames.size;
      });
      const page=await context.newPage();page.on('pageerror',error=>exceptions.push(error.message));
      await page.goto(origin+'/characters/');await page.locator('svg[data-character="snowman"] path').first().waitFor();
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const inspect=async(frame,mood,scope)=>page.evaluate(({frame,mood,scope})=>{
        const failures=[];
        for(const svg of document.querySelectorAll('svg[data-character]')) {
          const view=svg.viewBox.baseVal,inverse=svg.getScreenCTM().inverse(),id=svg.dataset.character;
          for(const node of svg.querySelectorAll('path,circle,ellipse,line,polyline,polygon,rect,text')) {
            if(node.closest('defs')||getComputedStyle(node).display==='none'||getComputedStyle(node).visibility==='hidden'||!node.getScreenCTM())continue;
            if(node.closest('[style*="display: none"]'))continue;
            const box=node.getBBox();if(!box.width&&!box.height)continue;
            const stroke=getComputedStyle(node).stroke==='none'?0:parseFloat(getComputedStyle(node).strokeWidth||'0')/2;
            const matrix=inverse.multiply(node.getScreenCTM());
            const points=[[box.x-stroke,box.y-stroke],[box.x+box.width+stroke,box.y-stroke],[box.x-stroke,box.y+box.height+stroke],[box.x+box.width+stroke,box.y+box.height+stroke]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
            let left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
            const outside=()=>left<view.x-.15||right>view.x+view.width+.15||top<view.y-.15||bottom>view.y+view.height+.15;
            if(outside()&&node.tagName==='path'&&(Math.abs(matrix.b)>.001||Math.abs(matrix.c)>.001)) {
              const length=node.getTotalLength(),samples=[];
              for(let i=0;i<=128;i++){const p=node.getPointAtLength(length*i/128);samples.push(new DOMPoint(p.x,p.y).matrixTransform(matrix));}
              const padX=stroke*Math.hypot(matrix.a,matrix.c)+.1,padY=stroke*Math.hypot(matrix.b,matrix.d)+.1;
              left=Math.min(...samples.map(p=>p.x))-padX;right=Math.max(...samples.map(p=>p.x))+padX;
              top=Math.min(...samples.map(p=>p.y))-padY;bottom=Math.max(...samples.map(p=>p.y))+padY;
            }
            if(outside()&&['circle','ellipse'].includes(node.tagName)) {
              const cx=Number(node.getAttribute('cx')),cy=Number(node.getAttribute('cy')),rx=Number(node.getAttribute(node.tagName==='circle'?'r':'rx'))+stroke,ry=Number(node.getAttribute(node.tagName==='circle'?'r':'ry'))+stroke;
              const center=new DOMPoint(cx,cy).matrixTransform(matrix),ex=Math.hypot(matrix.a*rx,matrix.c*ry),ey=Math.hypot(matrix.b*rx,matrix.d*ry);
              left=center.x-ex;right=center.x+ex;top=center.y-ey;bottom=center.y+ey;
            }
            for(let ancestor=node.parentElement;ancestor&&ancestor!==svg;ancestor=ancestor.parentElement) {
              const reference=/url\(#([^)]*)\)/.exec(ancestor.getAttribute('clip-path')||'');
              const mask=reference&&document.getElementById(reference[1]);if(!mask)continue;
              const shapes=[...mask.children].filter(shape=>typeof shape.getBBox==='function');if(!shapes.length)continue;
              const boxes=shapes.map(shape=>shape.getBBox()),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
              const box={x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y},matrix=inverse.multiply(ancestor.getScreenCTM());
              const pts=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
              left=Math.max(left,Math.min(...pts.map(p=>p.x)));right=Math.min(right,Math.max(...pts.map(p=>p.x)));
              top=Math.max(top,Math.min(...pts.map(p=>p.y)));bottom=Math.min(bottom,Math.max(...pts.map(p=>p.y)));
            }
            if(left<view.x-.15||right>view.x+view.width+.15||top<view.y-.15||bottom>view.y+view.height+.15)failures.push({id,tag:node.tagName,frame,mood,scope,size:svg.getAttribute('width')+'x'+svg.getAttribute('height'),bounds:[left,top,right,bottom],view:[view.x,view.y,view.width,view.height]});
          }
        }
        return failures;
      },{frame,mood,scope});
      if(!liquidOnly) {
      for(const scope of ['seasonal','all']) {
        await page.evaluate(all=>window.setCharacterScope(all),scope==='all');
        await page.waitForFunction(count=>document.querySelectorAll('svg[data-character]').length===count,scope==='seasonal'?15:78,{polling:20});
        for(const mood of ['idle','music','think','happy','eat','attn','sad','sleep']) {
          await page.evaluate(mood=>window.setCharacterMood(mood),mood);
          await page.waitForFunction(mood=>document.querySelector('[data-fixture-mood]').textContent===mood,mood,{polling:20});
          for(let frame=0;frame<180;frame+=6) {
            await page.evaluate(()=>{for(let i=0;i<6;i++)window.stepCharacterFrame(24);});
            clipping.push(...await inspect(frame,mood,scope));
          }
          if(scope==='seasonal'&&['idle','music','think','happy','attn','sleep'].includes(mood)) {
            const screenshot=path.join(directory,`${scope}-${theme}-${mood}.png`);await page.screenshot({path:screenshot});snapshots.push(screenshot);
          }
        }
      }
      const flags=await page.evaluate(()=>[...document.querySelectorAll('svg[data-color-art]')].map(e=>({id:e.dataset.character,filter:getComputedStyle(e).filter,ink:e.hasAttribute('data-ink-art')})));
      assert.equal(flags.length,15);assert(flags.every(f=>f.filter==='none'&&!f.ink),'Seasonal Woods colors must survive both themes');
      await page.evaluate(()=>window.setCharactersStill(true));await page.waitForFunction(()=>window.characterFrameCount()===0,undefined,{polling:20});
      const frozen=await page.locator('svg[data-character="snowman"]').first().innerHTML();
      assert.equal(await page.evaluate(()=>{let count=0;for(let i=0;i<20;i++)count+=window.stepCharacterFrame();return count;}),0);
      assert.equal(await page.locator('svg[data-character="snowman"]').first().innerHTML(),frozen,'Still renderer must remain unchanged without RAF');
      await page.evaluate(()=>{window.setCharactersStill(false);window.setCharacterMotionPreference('reduce');});
      await page.waitForFunction(()=>window.characterFrameCount()===0,undefined,{polling:20});assert.equal(await page.evaluate(()=>window.stepCharacterFrame()),0);
      await page.evaluate(()=>window.setCharacterMotionPreference('full'));await page.waitForFunction(()=>window.characterFrameCount()>0,undefined,{polling:20});
      assert.equal(await page.evaluate(()=>window.stepCharacterFrame()),1,'All animated characters must share one RAF');
      }
      await page.setViewportSize({width:1024,height:1050});
      await page.addStyleTag({content:`main:has([data-liquid-demo]) {background:${theme==='dark'?'#303835':'#d9e3dd'} !important}`});
      await page.evaluate(()=>{window.setLiquidDemo(true);window.setCharacterMood('happy');});
      await page.locator('[data-liquid-demo] svg path').first().waitFor();
      for(let frame=0;frame<180;frame++) {
        const state=await page.evaluate(()=>{
          window.stepCharacterFrame(24);
          return [...document.querySelectorAll('[data-liquid-demo]')].map(parent=>{
            const svg=parent.querySelector('svg'),body=svg.children[2],box=body.getBBox(),view=svg.viewBox.baseVal;
            const clip=parent.querySelector('[data-liquid-clip]'),squash=parent.querySelector('[data-liquid-squash]');
            return {path:body.getAttribute('d'),width:parent.getBoundingClientRect().width,height:parent.getBoundingClientRect().height,box:[box.x,box.y,box.width,box.height],view:[view.x,view.y,view.width,view.height],clip:clip.style.clipPath,parsedClip:getComputedStyle(clip).clipPath,squash:squash.style.transform};
          });
        });
        for(const item of state) {
          assert(!/NaN|Infinity/.test(item.path));
          assert(item.box[0]>=-item.width/2-.1&&item.box[0]+item.box[2]<=item.width/2+.1,'Liquid quarter circles remain inside the actual SVG width');
          assert(item.box[1]>=-.1&&item.box[1]+item.box[3]<=item.view[3]+.1,'Liquid wave remains inside the actual SVG height');
          if(item.clip){actualLiquidClip=true;assert.notEqual(item.parsedClip,'none','Chromium must parse and apply the real CSS content clip');assert.match(item.clip,/ A ?[\d.]+[, ]+[\d.]+ /);}
          if(item.squash)actualLiquidSquash=true;
        }
      }
      let screenshot=path.join(directory,`liquid-${theme}-expanded.png`);await page.screenshot({path:screenshot});snapshots.push(screenshot);
      const animatedFold=await page.evaluate(()=>{
        let squashed=false;const parent=[...document.querySelectorAll('[data-liquid-demo]')].at(-1);
        for(const height of [336,332,320,296,260,216,172,132,98,72,54,44]) {
          parent.style.height=height+'px';window.stepCharacterFrame(16);
          squashed||=getComputedStyle(parent.querySelector('[data-liquid-squash]')).transform!=='none';
        }
        window.setLiquidFold(true);return squashed;
      });
      actualLiquidSquash||=animatedFold;
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-liquid-demo]')].at(-1).getBoundingClientRect().height===44,undefined,{polling:20});
      for(let frame=0;frame<100;frame++) {
        actualLiquidSquash||=await page.evaluate(()=>{window.stepCharacterFrame(16);return [...document.querySelectorAll('[data-liquid-squash]')].some(e=>getComputedStyle(e).transform!=='none');});
        if(actualLiquidSquash)await page.evaluate(()=>window.stepCharacterFrame(16));
      }
      screenshot=path.join(directory,`liquid-${theme}-folded.png`);await page.screenshot({path:screenshot});snapshots.push(screenshot);
      await context.close();
    }
    assert.deepEqual(exceptions,[]);
    const seasonalClipping=clipping.filter(f=>f.scope==='seasonal');
    await fs.writeFile(path.join(directory,'clipping.json'),JSON.stringify(clipping,null,2)+'\n');
    assert.deepEqual(seasonalClipping.slice(0,12),[],'All seasonal paint, gestures and badges must fit the sprite at every size/mood');
    const legacyClipping=clipping.filter(f=>f.scope==='all'&&!['snowman','frost','bullfinch','ginger','deer'].includes(f.id));
    assert.deepEqual(legacyClipping.slice(0,12),[],'Existing character steam, sparks, text and badges must fit too');
    assert(actualLiquidClip&&actualLiquidSquash,'Real liquid demo must exercise both CSS content clipping and fold squash');
    const report={scope:liquidOnly?'liquid':'all',themes:['dark','light'],sizes:['60x34','80x44','100x100'],moods:8,sampledFrames:180,seasonalBounds:!liquidOnly,legacyBounds:!liquidOnly,seasonalColors:!liquidOnly,stillAndReducedMotionStopRaf:!liquidOnly,singleSharedRaf:!liquidOnly,actualLiquidClip,actualLiquidSquash,exceptions,legacyClipping,snapshots};
    await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');return report;
  }finally{await browser?.close();await server.close();}
}
module.exports={verifyCharacterBrowser};
if(require.main===module)verifyCharacterBrowser({directory:process.argv[2],liquidOnly:process.argv.includes('--liquid-only')}).then(report=>console.log(JSON.stringify({...report,legacyClipping:report.legacyClipping.length},null,2))).catch(error=>{console.error(error.stack);process.exitCode=1;});
