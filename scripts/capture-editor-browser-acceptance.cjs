// Actual Woods editor, isolated browser profile and IPC fixture; no clipboard or user file writes.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
async function verifyCaptureEditor({directory}={}) {
  directory||=await fs.mkdtemp(path.join(os.tmpdir(),'woods-editor-browser-'));await fs.mkdir(directory,{recursive:true});
  const {createServer}=await import('vite'),root=path.resolve(__dirname,'..');
  const server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'woods-editor-fixture',configureServer(s){s.middlewares.use((req,res,next)=>{
    if(req.url!=='/editor/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/runtime/styles/runtime.css"></head><body><div id="root"></div><script type="module" src="/runtime/entries/editor.ts"></script></body></html>');
  });}}]});let browser;
  try {
    await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    browser=await chromium.launch({executablePath:process.env.WOODS_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu','--no-first-run']});
    const exceptions=[],snapshots=[];
    for(const language of ['ru','en']) {
      const context=await browser.newContext({locale:language==='ru'?'ru-RU':'en-US',viewport:{width:1000,height:600}});
      await context.addInitScript(language=>{
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=320;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#dbe7df';ctx.fillRect(0,0,640,320);ctx.fillStyle='#789483';ctx.fillRect(0,240,640,80);
        const base=canvas.toDataURL('image/png');let id=0;
        window.editorCalls=[];window.editorExports=[];window.editorCloses=0;window.editorImageTexts=new Map();
        const clear=CanvasRenderingContext2D.prototype.clearRect,fill=CanvasRenderingContext2D.prototype.fillText,encode=HTMLCanvasElement.prototype.toDataURL;
        CanvasRenderingContext2D.prototype.clearRect=function(...args){this.canvas.fixtureTexts=[];return clear.apply(this,args);};
        CanvasRenderingContext2D.prototype.fillText=function(text,...args){(this.canvas.fixtureTexts||=[]).push(text);return fill.call(this,text,...args);};
        HTMLCanvasElement.prototype.toDataURL=function(...args){const result=encode.apply(this,args);window.editorImageTexts.set(result,[...(this.fixtureTexts||[])]);return result;};
        window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'editor'}},transformCallback:()=>++id,unregisterCallback:()=>{},invoke:async(command,args)=>{
          window.editorCalls.push({command,args});
          if(command==='editor_image')return {dataUrl:base};
          if(command==='settings_get')return {language,clockFormat:'24',reducedMotion:'reduce'};
          if(command==='editor_save'){window.editorExports.push({copy:args.copy,texts:window.editorImageTexts.get(args.dataUrl)||[],dataUrl:args.dataUrl});return true;}
          if(command==='plugin:window|close'){window.editorCloses++;return null;}
          return 0;
        }};
      },language);
      const page=await context.newPage();page.on('pageerror',error=>exceptions.push(error.message));
      await page.goto(origin+'/editor/');await page.locator('canvas').waitFor();await page.locator('[data-editor-copy]:not([disabled])').waitFor();
      const textTool=page.locator('button[title="'+(language==='ru'?'Текст (T)':'Text (T)')+'"]');await textTool.click();
      await page.locator('canvas').click({position:{x:100,y:100}});await page.locator('textarea').fill('Woods · привет 你好');
      assert.equal(await page.locator('textarea').evaluate(e=>document.activeElement===e),true,'Text tool must preserve focus');
      // A programmatic click leaves the textarea focused and tests the pending-draft export path.
      await page.locator('[data-editor-copy]').evaluate(e=>e.click());await page.waitForFunction(()=>window.editorExports.length===1);
      let exported=(await page.evaluate(()=>window.editorExports)).at(-1);assert.equal(exported.copy,true);assert.deepEqual(exported.texts,['Woods · привет 你好']);assert.equal(await page.evaluate(()=>window.editorCloses),0);
      await page.locator('canvas').click({position:{x:210,y:150}});await page.locator('textarea').fill('Вторая строка\nSecond line');
      await page.locator('[data-editor-save]').evaluate(e=>e.click());await page.waitForFunction(()=>window.editorExports.length===2&&window.editorCloses===1);
      exported=(await page.evaluate(()=>window.editorExports)).at(-1);assert.equal(exported.copy,false);assert.deepEqual(exported.texts,['Woods · привет 你好','Вторая строка','Second line']);
      await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelector('canvas').fixtureTexts.length===1);
      await page.keyboard.press('Control+y');await page.waitForFunction(()=>document.querySelector('canvas').fixtureTexts.length===3);
      const screenshot=path.join(directory,`editor-${language}.png`);await page.screenshot({path:screenshot});snapshots.push(screenshot);
      await context.close();
    }
    assert.deepEqual(exceptions,[]);const report={languages:['ru','en'],actualEditor:true,textToolFocus:true,focusedDraftExport:true,copyDoesNotClose:true,saveWritesThenCloses:true,pendingTextExactlyOnce:true,undoRedo:true,exceptions,snapshots};
    await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');return report;
  }finally{await browser?.close();await server.close();}
}
module.exports={verifyCaptureEditor};
if(require.main===module)verifyCaptureEditor({directory:process.argv[2]}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
