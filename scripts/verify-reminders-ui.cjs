// Render production reminder controls with Woods' pinned React renderer.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'.qa-temp','reminder-controls');
const esbuild=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite/package.json'))]}));
const {chromium}=require('playwright-core');let browser,server;
(async()=>{
  await fs.mkdir(scratch,{recursive:true});
  const modulePath=file=>JSON.stringify(path.join(root,file).replace(/\\/g,'/'));
  await fs.writeFile(path.join(scratch,'entry.tsx'),`
import { React } from ${modulePath('runtime/react.ts')};
import { g } from ${modulePath('runtime/vendor/react-foundation.js')};
import { ReminderAdjustments } from ${modulePath('runtime/reminders/ReminderAdjustments.tsx')};
import { shiftReminder } from ${modulePath('runtime/reminders/calendar.ts')};
function Fixture(){
  const [date,setDate]=React.useState(new Date(2027,10,19,16,0)),[language,setLanguage]=React.useState('ru');
  window.setLanguage=setLanguage;window.date=date.getTime();
  return <div style={{width:232,padding:8,display:'flex',flexDirection:'column',gap:6}}><ReminderAdjustments date={date} weekday={true} language={language}
    onShift={minutes=>setDate(value=>shiftReminder(value,minutes))} onSave={(date,repeat)=>{window.saved={at:date.getTime(),repeat};}}/></div>;
}
g().createRoot(document.getElementById('root')).render(<Fixture/>);`);
  await esbuild.build({entryPoints:[path.join(scratch,'entry.tsx')],bundle:true,outfile:path.join(scratch,'entry.js'),format:'esm',platform:'browser',jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',tsconfigRaw:{compilerOptions:{jsx:'react',jsxFactory:'React.createElement',jsxFragmentFactory:'React.Fragment'}},logLevel:'silent'});
  const manifest=JSON.parse(await fs.readFile(path.join(root,'dist/runtime-manifest.json'),'utf8'));
  const style=manifest.files.find(file=>/^assets\/runtime-.*\.css$/.test(file.path)).path;
  server=http.createServer(async(req,res)=>{if(req.url==='/entry.js'){res.setHeader('Content-Type','application/javascript');res.end(await fs.readFile(path.join(scratch,'entry.js')));return;}
    if(req.url==='/runtime.css'){res.setHeader('Content-Type','text/css');res.end(await fs.readFile(path.join(root,'dist',style)));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html><head><link rel="stylesheet" href="/runtime.css"></head><body style="background:#121217;color:white"><div id="root"></div><script type="module" src="/entry.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:260,height:160}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  try { await page.locator('[data-reminder-nudge]').waitFor(); } catch (error) { throw new Error(`Reminder render failed: ${JSON.stringify(errors)}`, {cause:error}); }
  assert.equal(await page.locator('[data-reminder-shift]').count(),4);
  const initial=await page.evaluate(()=>window.date);await page.locator('[data-reminder-shift="15"]').click();await page.waitForFunction(initial=>window.date===initial+900000,initial);
  await page.locator('[data-reminder-shift="1440"]').click();await page.waitForFunction(initial=>window.date===initial+86400000+900000,initial);
  for(const language of ['ru','en']){
    await page.evaluate(language=>window.setLanguage(language),language);await page.getByRole('button',{name:language==='ru'?'На день раньше':'A day earlier',exact:true}).waitFor();
    await page.locator('[data-reminder-weekly]').click();const saved=await page.evaluate(()=>window.saved);assert.equal(saved.repeat.h,16);assert.equal(saved.repeat.m,15);
    assert.equal(saved.repeat.days[0],new Date(saved.at).getDay());
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('button')].some(button=>{const rect=button.getBoundingClientRect();return rect.right>innerWidth||rect.bottom>innerHeight;}));assert(!overflow);
    await page.screenshot({path:path.join(scratch,`${language}.png`)});
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(scratch,'report.json'),JSON.stringify({pass:true,languages:['ru','en'],pinnedRenderer:true,shiftControls:true,weekly:true,overflow:false}));
  console.log('Reminder controls: pinned renderer, RU/EN, day/minute shifts and weekly recurrence passed');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
