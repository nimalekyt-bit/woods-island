// Isolated browser fixtures for the real Woods components and mobile assets.
// No Windows clipboard, user browser profile, firewall, or native app is used.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const token = 'a'.repeat(64), root = path.resolve(__dirname, '..');
async function verifyPhoneBrowser({directory} = {}) {
  directory ||= await fs.mkdtemp(path.join(os.tmpdir(),'woods-phone-browser-'));
  await fs.mkdir(directory,{recursive:true});
  const { createServer } = await import('vite');
  const mobile = path.join(root,'src-tauri/src/phone');
  let approved = false, receivedText = '', acknowledgments = 0, uploads = 0, aborted = 0, holdUpload = false;
  const ticket = 'b'.repeat(64), name = '<img src=x onerror=window.phoneXss=true>.txt';
  const server = await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},
    esbuild:{jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'},
    plugins:[{name:'woods-phone-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{
      const url = new URL(req.url,'http://fixture');
      if(url.pathname==='/desktop/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/phone-ui.tsx"></script></body></html>');return;}
      const asset = {'/phone/':'page.html','/phone/style.css':'page.css','/phone/app.js':'page.js'}[url.pathname];
      if(asset){res.setHeader('Content-Type',asset.endsWith('html')?'text/html; charset=utf-8':asset.endsWith('css')?'text/css':'text/javascript');res.end(await fs.readFile(path.join(mobile,asset)));return;}
      if(!/^\/(pair|approval|state|text|file|files\/|taken\/|disconnect)/.test(url.pathname))return next();
      const json=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
      if(url.pathname==='/pair')return json(200,{ticket});
      if(req.headers.authorization!=='Bearer '+ticket)return json(403,{error:'not_approved'});
      if(url.pathname==='/approval')return json(200,{status:approved?'approved':'pending'});
      if(url.pathname==='/state')return json(200,{offered:[{id:token,name,size:4,taken:acknowledgments>0}]});
      if(url.pathname==='/text'){const bytes=[];for await(const byte of req)bytes.push(byte);receivedText=Buffer.concat(bytes).toString();return json(200,{ok:true});}
      if(url.pathname.startsWith('/files/')){res.setHeader('Content-Type','application/octet-stream');res.end('test');return;}
      if(url.pathname.startsWith('/taken/')){acknowledgments++;return acknowledgments===1?json(404,{error:'missing_file'}):json(200,{ok:true});}
      if(url.pathname==='/file'){uploads++;req.on('aborted',()=>aborted++);for await(const byte of req){}if(holdUpload){res.on('close',()=>aborted++);return;}return json(200,{ok:true,clipboard:true});}
      return json(200,{ok:true});
    });}}]});
  let browser;
  try {
    await server.listen();
    const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    browser=await chromium.launch({executablePath:process.env.WOODS_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu','--no-first-run']});
    const snapshots=[], exceptions=[];
    for(const language of ['ru-RU','en-US']) for(const theme of ['dark','light']) {
      const context=await browser.newContext({locale:language,colorScheme:theme,viewport:{width:960,height:360},reducedMotion:'reduce'}),page=await context.newPage();
      page.on('pageerror',error=>exceptions.push(error.message));
      await page.goto(origin+'/desktop/');await page.locator('[data-phone-open]').waitFor();
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      await page.waitForFunction(color=>getComputedStyle(document.querySelector('[data-phone-panel]')).color===color,theme==='dark'?'rgb(255, 255, 255)':'rgb(23, 23, 26)');
      const stoppedColor=await page.locator('[data-phone-panel]').evaluate(e=>getComputedStyle(e).color);
      assert.equal(stoppedColor,theme==='dark'?'rgb(255, 255, 255)':'rgb(23, 23, 26)');
      await page.evaluate(value=>{window.phoneNext=value;}, {running:true,url:`http://127.0.0.1:32145/phone/#${token}`,network:'Woods Wi-Fi'});
      await page.locator('[data-phone-open]').click();await page.locator('[data-phone-qr] img').waitFor();
      assert.equal((await page.evaluate(()=>window.phoneCalls))[0].command,'phone_start');
      await page.evaluate(value=>window.setPhoneState(value),{running:true,pending:{id:token,device:name,expiresAt:Date.now()+120000}});
      await page.locator('[data-phone-allow]').waitFor();assert.equal(await page.locator('.wi-phone-panel header strong').textContent(),name);
      await page.locator('[data-phone-allow]').click();assert.equal((await page.evaluate(()=>window.phoneCalls)).at(-1).args.id,token);
      await page.evaluate(value=>window.setPhoneState(value),{running:true,pending:{id:token,device:name,expiresAt:Date.now()+120000}});
      await page.locator('[data-phone-deny]').click();assert.equal((await page.evaluate(()=>window.phoneCalls)).at(-1).command,'phone_deny');
      await page.evaluate(value=>window.setPhoneState(value),{running:true,connected:true,device:'Woods Phone',offered:[{id:token,name,size:4}]});
      await page.locator('[data-phone-offered]').waitFor();assert.equal(await page.locator('[data-phone-offered] span[title]').textContent(),name);
      assert.equal(await page.evaluate(()=>!!window.phoneXss),false);
      await page.locator('[data-phone-offered] button').click();assert.equal((await page.evaluate(()=>window.phoneCalls)).at(-1).command,'phone_unsend');
      await page.evaluate(()=>{window.phoneNext={running:false};});
      await page.locator('[data-phone-stop]').click();assert.equal((await page.evaluate(()=>window.phoneCalls)).at(-1).command,'phone_stop');
      await page.evaluate(()=>{window.phoneFail='fixture connection failure';});await page.locator('[data-phone-open]').click();await page.locator('[role=alert]').waitFor();
      assert.match(await page.locator('[role=alert]').textContent(),/fixture connection failure/);
      const row=page.locator('.wi-shelf-row');await page.locator('.wi-shelf-print[data-shape=wide]').waitFor();
      assert.equal(await page.locator('.wi-shelf-print[data-shape=tall]').count(),1);assert.equal(await page.locator('.wi-shelf-print[data-shape=square]').count(),1);
      assert.equal(await page.locator('[data-shelf-item="Нет миниатюры.jpg"] .wi-shelf-icon').count(),1);
      assert.equal(await page.locator('[data-shelf-item="Папка.png"] .wi-shelf-print').count(),0);
      const item=page.locator('[data-shelf-item="План.pdf"]');await item.hover();
      await item.locator('button[data-tone=phone]').click();assert.deepEqual((await page.evaluate(()=>window.shelfCalls)).at(-1),{action:'send',id:4});
      assert.equal((await page.evaluate(()=>window.shelfCalls)).filter(call=>call.action==='drag').length,0,'Toolbar pointer down must not start native drag');
      await item.focus();await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.shelfCalls)).at(-1).action,'open');
      await page.keyboard.press('Delete');assert.equal((await page.evaluate(()=>window.shelfCalls)).at(-1).action,'remove');
      const before=await row.evaluate(e=>e.scrollLeft);await row.hover();await page.mouse.wheel(0,250);await page.waitForFunction(before=>document.querySelector('.wi-shelf-row').scrollLeft>before,before);
      assert.equal(await page.evaluate(()=>window.parentWheel||0),0,'Shelf scroll must not bubble to the pill volume handler');
      await page.evaluate(()=>{document.querySelector('.wi-shelf-row').scrollLeft=0;});
      const screenshot=path.join(directory,`desktop-${language}-${theme}.png`);await page.screenshot({path:screenshot});snapshots.push(screenshot);
      await page.evaluate(()=>window.setShelfEmpty(true));await page.locator('.wi-shelf-empty').waitFor();await context.close();
      approved=false;acknowledgments=0;receivedText='';
      const mobileContext=await browser.newContext({locale:language,colorScheme:theme,viewport:{width:320,height:780},reducedMotion:'reduce'}),phone=await mobileContext.newPage();
      phone.on('pageerror',error=>exceptions.push(error.message));
      await phone.goto(origin+'/phone/#'+token);await phone.waitForFunction(()=>document.getElementById('connection-title').textContent.includes(document.documentElement.lang==='ru'?'Подтверди':'Approve'));
      assert.equal(await phone.locator('#send-text').isDisabled(),true);
      approved=true;await phone.locator('#send-text').waitFor({state:'visible'});await phone.waitForFunction(()=>!document.getElementById('send-text').disabled);
      assert.equal(await phone.locator('#offered strong').textContent(),name);assert.equal(await phone.evaluate(()=>!!window.phoneXss),false);
      await phone.locator('#text').fill('Woods: привет 你好');await phone.locator('#send-text').click();await phone.waitForFunction(()=>document.getElementById('text').value==='');assert.equal(receivedText,'Woods: привет 你好');
      await phone.locator('#offered button').click();await phone.waitForFunction(()=>document.getElementById('message').textContent.includes('<img'));assert.equal(acknowledgments,2,'Mobile acknowledgment retries only the short sender-record race');
      await phone.locator('#files').setInputFiles({name:'Документ 你好.txt',mimeType:'text/plain',buffer:Buffer.from('hello')});await phone.waitForFunction(()=>document.getElementById('message').textContent.includes('Документ'));assert(uploads>0);
      holdUpload=true;await phone.locator('#files').setInputFiles({name:'Cancel.txt',mimeType:'text/plain',buffer:Buffer.alloc(256*1024,65)});await phone.locator('#upload-progress:not([hidden])').waitFor();await phone.locator('#cancel-upload').click();await phone.waitForFunction(()=>document.getElementById('upload-progress').hidden && !document.getElementById('pick-files').disabled);assert.match(await phone.locator('#message').textContent(),/отменена|canceled/i);holdUpload=false;
      assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile 320px layout must not scroll horizontally');
      const mobileScreenshot=path.join(directory,`mobile-${language}-${theme}.png`);await phone.screenshot({path:mobileScreenshot,fullPage:true});snapshots.push(mobileScreenshot);
      await phone.locator('#disconnect').click();await phone.waitForFunction(()=>document.getElementById('send-text').disabled);await mobileContext.close();
    }
    assert.deepEqual(exceptions,[]);
    const report={desktopApproval:true,desktopRpcControls:true,themes:['dark','light'],languages:['ru','en'],shelfArtwork:true,shelfKeyboardAndToolbar:true,shelfHorizontalWheel:true,mobile320px:true,mobileTextAndFile:true,mobileDownloadAck:true,mobileCancellation:true,xssEscaping:true,exceptions,snapshots};
    await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');return report;
  } finally {await browser?.close();await server.close();}
}
module.exports={verifyPhoneBrowser};
if(require.main===module)verifyPhoneBrowser({directory:process.argv[2]}).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(error.stack);process.exitCode=1;});
