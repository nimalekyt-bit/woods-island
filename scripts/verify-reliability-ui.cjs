// Browser-only acceptance of the actual production Settings shell.
// No native process, real credentials, clipboard or external service is touched.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const esbuild=require(require.resolve('esbuild',{paths:[path.dirname(require.resolve('vite/package.json'))]}));
const {chromium}=require(process.env.WOODS_PLAYWRIGHT_MODULE||'playwright-core');
const scratch=path.join(root,'.qa-temp','reliability-shell');
let browser,server;
(async()=>{
 await fs.mkdir(scratch,{recursive:true});
 const rust=await fs.readFile(path.join(root,'src-tauri/src/lib.rs'),'utf8');
 const defaults=JSON.parse(rust.match(/fn default_settings\(\)[\s\S]*?r###"([\s\S]*?)"###/)[1]);
 await esbuild.build({entryPoints:[path.join(root,'runtime/entries/settings.ts')],bundle:true,outfile:path.join(scratch,'settings.js'),format:'esm',platform:'browser',jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',tsconfigRaw:{compilerOptions:{jsx:'react',jsxFactory:'React.createElement',jsxFragmentFactory:'React.Fragment'}},loader:{'.png':'dataurl'},logLevel:'silent'});
 server=http.createServer(async(req,res)=>{
  const resources={'/settings.js':['settings.js','application/javascript'],'/settings.css':['settings.css','text/css'],'/runtime.css':[path.join(root,'runtime/styles/runtime.css'),'text/css']};
  if(resources[req.url]){const [file,type]=resources[req.url];res.setHeader('Content-Type',type);res.end(await fs.readFile(path.isAbsolute(file)?file:path.join(scratch,file)));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/runtime.css"><link rel="stylesheet" href="/settings.css"></head><body><div id="root"></div><script type="module" src="/settings.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 for(const lang of ['ru','en']){
  const context=await browser.newContext({viewport:{width:820,height:720},locale:lang});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error('UI exception:',error.message);});
  page.on('console',message=>{if(message.type()==='error')console.error('UI console:',message.text());});
  await page.addInitScript(({defaults,lang})=>{
   let next=1;const callbacks=new Map(),subscriptions=new Map();
   window.calls=[];window.saved={...defaults,language:lang,onboardingCompleted:false,hotkeyToggle:'Alt+I',hotkeyPalette:'Ctrl+Space',uploadService:'imgbb'};
   window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
   window.updateFixture={status:'ready',version:'1.2.1',downloaded:100,total:100,canInstall:true,error:null,reason:null};
   const emit=(event,payload)=>{for(const item of subscriptions.values())if(item.event===event)callbacks.get(item.handler)?.({event,payload});};
   window.setUpdate=value=>{window.updateFixture={...window.updateFixture,...value};emit('update:state',window.updateFixture);};
   window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'settings'},currentWebview:{label:'settings'}},
    transformCallback:callback=>{const id=next++;callbacks.set(id,callback);return id;},unregisterCallback:id=>callbacks.delete(id),
    invoke:async(command,args={})=>{
     window.calls.push({command,args});
     if(command==='plugin:event|listen'){const id=next++;subscriptions.set(id,args);return id;}
     if(command==='plugin:event|unlisten'){subscriptions.delete(args.eventId);return;}
     if(command==='settings_get')return window.saved;
     if(command==='settings_set'){window.saved={...window.saved,...args.settings};emit('settings:changed',window.saved);return [];}
     if(command==='media_sources')return [{id:'fixture.music',name:'Fixture Music',title:'Fixture track',playing:true,hidden:window.saved.mediaHidden.includes('fixture.music')}];
     if(command==='hotkeys_recording')return true;
     if(command==='installed_browsers')return ['chrome.exe','msedge.exe'];
     if(command==='open_programs')return [{executable:'code.exe',name:'Code',title:'Fixture project'},{executable:'chrome.exe',name:'Chrome',title:'Fixture page'}];
     if(command==='ai_proxy_set'){window.saved={...window.saved,aiProxy:args.proxy};emit('settings:changed',window.saved);return true;}
     if(command==='plugin:app|version')return '1.2.0';
     if(command==='license_status')return {pro:true,active:true};
     if(command==='pets_catalog')return {status:'ready',pets:[]};
     if(['hotkeys_check','audio_devices','audio_inputs','launcher_list','ai_models'].includes(command))return [];
     if(command==='monitors_list')return [{name:'DISPLAY1',width:1920,height:1080,left:0,top:0,primary:true}];
     if(command==='agents_connections')return {claude:'off',codex:'off',opencode:'off'};
     if(command==='launcher_hotkeys_get')return '{}';
     if(['settings_target','runs_as_admin','news_get'].includes(command))return null;
     if(['obs_password_status','ai_key_status','stt_key_status','prtsc_taken','notifications_access','upload_key_status'].includes(command))return false;
     if(command==='update_status')return window.updateFixture;
     if(command==='update_install'){window.setUpdate({status:'installing'});return true;}
     if(command==='update_check'){window.setUpdate({status:'upToDate',version:null});return null;}
     if(command==='update_download'){window.setUpdate({status:'downloading',downloaded:25,total:100});return true;}
     if(command==='update_cancel'){window.setUpdate({status:'available',downloaded:0});return true;}
     if(command==='diagnostics_summary')return {version:'1.2.0',os:'Windows 11',webview:'145.0.1.2',modules:[
      {id:'webview',status:'ready',detail:lang==='ru'?'Интерфейс работает на WebView2.':'The interface runs on WebView2.'},
      {id:'media',status:'ready',detail:lang==='ru'?'Плеер публикует медиасессию Windows.':'The player publishes a Windows media session.'},
      {id:'yandex',status:'unavailable',detail:lang==='ru'?'Для дополнительного коннектора запусти поддерживаемый плеер.':'Start a supported player for the optional connector.'},
      {id:'ffmpeg',status:'ready',detail:lang==='ru'?'Инструменты записи входят в комплект.':'Recording tools are included.'},
      {id:'ai',status:'ready',detail:lang==='ru'?'Проверку ответа модели запускай в настройках ИИ. Здесь проверена только конфигурация.':'Run the model response test in AI settings. Only the configuration is checked here.'},
      {id:'obs',status:'notConfigured',detail:lang==='ru'?'Включи интеграцию в настройках событий.':'Enable integration in event settings.'},
      {id:'notifications',status:'notConfigured'},{id:'agents',status:'notConfigured'},{id:'hotkeys',status:'ready'},{id:'clipboard',status:'ready'}],recovery:[],private:'must-not-copy'};
     if(command==='upload_key_set')return !!args.key;
     if(command==='clip_set_text'){window.copied=args.text;return true;}
     if(command==='open_path'){window.opened=args.path;return true;}
     throw new Error('Unmocked command: '+command);
    }
   };
  },{defaults,lang});
  await page.goto(`http://127.0.0.1:${server.address().port}/settings.html`);
  const pick=(ru,en)=>lang==='ru'?ru:en;
  const screenshot=async(name)=>{
   const selected=await page.locator('[data-nav][data-now=true]').all();
   assert.equal(selected.length,1,'Exactly one section must be active');
   const size=page.viewportSize();await page.mouse.move(size.width-8,size.height-8);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForTimeout(220); // Let the sidebar colour transition settle.
   await page.screenshot({path:path.join(scratch,`${lang}-${name}.png`)});
  };
  await page.locator('[data-connection=clipboard]').waitFor();
  assert.equal(await page.locator('[data-settings-nav]').evaluate(node=>Math.round(node.getBoundingClientRect().width)),212);
  assert.equal(await page.locator('[data-connection-settings] kbd').count(),0,'Introduction is opt-in');
  await screenshot('connections');
  await page.locator('[data-connection=ai] button').first().click();
  await page.locator('[data-connection=ai] .wi-connection-detail').waitFor();
  await screenshot('connection-detail');
  await page.getByRole('button',{name:pick('Показать','Show'),exact:true}).click();
  assert.match(await page.locator('.wi-guide').innerText(),/Alt\+I/);assert.match(await page.locator('.wi-guide').innerText(),/Ctrl\+Space/);
  await page.getByRole('button',{name:pick('Свернуть','Collapse'),exact:true}).click();
  await page.getByRole('button',{name:pick('Сведения','Details'),exact:true}).click();
  await page.getByRole('button',{name:pick('Скопировать','Copy'),exact:true}).click();
  assert.ok((await page.evaluate(()=>window.copied)).includes('ai: ready'));assert.ok(!(await page.evaluate(()=>window.copied)).includes('must-not-copy'));
  await page.locator('[data-nav=updates]').click();await page.locator('[data-update-settings]').waitFor();
  await page.getByRole('button',{name:pick('Установить','Install update'),exact:true}).waitFor();
  assert.equal(await page.locator('[data-update-settings] input[type=checkbox]').count(),0);
  assert.equal(await page.locator('[data-update-settings] [role=switch]').count(),2);
  await screenshot('updates-ready');
  await page.evaluate(()=>window.setUpdate({status:'downloading',downloaded:25,total:100}));
  await page.getByRole('progressbar').waitFor();assert.equal(await page.getByRole('progressbar').getAttribute('value'),'25');
  await screenshot('updates-downloading');
  await page.getByRole('button',{name:pick('Отмена','Cancel'),exact:true}).click();
  await page.getByRole('button',{name:pick('Скачать обновление','Download update'),exact:true}).waitFor();
  await page.evaluate(()=>window.setUpdate({status:'error',error:'signature'}));await page.locator('[data-update-settings] [role=alert]').waitFor();
  await screenshot('updates-error');
  await page.evaluate(()=>window.setUpdate({status:'available',error:null,canInstall:false,reason:'portable'}));
  await page.getByRole('button',{name:pick('Открыть выпуск','Open release'),exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:pick('Скачать обновление','Download update'),exact:true}).count(),0);
  const automatic=page.getByRole('switch',{name:pick('Скачивать автоматически','Download automatically'),exact:true});
  assert.equal(await automatic.isDisabled(),true);assert.equal(await automatic.getAttribute('aria-checked'),'false');
  await screenshot('updates-portable');
  await page.locator('[data-nav=weather]').click();
  await page.getByRole('button',{name:pick('Указать вручную','Set manually'),exact:true}).click();
  const zone=page.getByRole('textbox',{name:pick('Часовой пояс города','City time zone')});await zone.fill('Europe/London');
  await page.getByRole('button',{name:pick('Применить','Apply'),exact:true}).click();assert.equal(await page.evaluate(()=>window.saved.weatherTimezone),'Europe/London');
  await screenshot('weather');
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('settings_set',{settings:{weatherCity:'Tokyo',weatherLat:35.68,weatherLon:139.69,weatherTimezone:'Asia/Tokyo',weatherPlaces:JSON.stringify([{name:'Tokyo',lat:35.68,lon:139.69,timezone:'Asia/Tokyo'},{name:'London',lat:51.5,lon:0,timezone:'Europe/London'},{name:'Очень длинное имя города для проверки узкого окна настроек',lat:3,lon:4}])}}));
  const cities=page.locator('[data-weather-places]');await cities.waitFor();
  assert.equal(await cities.getByRole('button',{name:'Tokyo',exact:true}).getAttribute('aria-pressed'),'true');
  await cities.getByRole('button',{name:'London',exact:true}).click();
  await page.waitForFunction(()=>window.saved.weatherCity==='London'&&window.saved.weatherTimezone==='Europe/London');
  assert.equal(await cities.getByRole('button',{name:'London',exact:true}).getAttribute('aria-pressed'),'true');
  const placeSave=await page.evaluate(()=>window.calls.filter(call=>call.command==='settings_set').at(-1).args.settings);
  assert.equal(placeSave.weatherUtcOffset,null);assert(!Object.hasOwn(placeSave,'autostart'),'City selection sends only changed settings');
  for(const width of [820,660]){
   await page.setViewportSize({width,height:720});
   const overflow=await cities.evaluate(group=>{const r=group.getBoundingClientRect();return group.scrollWidth>group.clientWidth+1||[...group.querySelectorAll('button')].some(button=>button.getBoundingClientRect().right>r.right+1);});
   assert.equal(overflow,false,'City controls fit settings width');await screenshot('weather-cities-'+width);
  }
  await page.setViewportSize({width:820,height:720});
  await page.locator('[data-nav=general]').click();
  const mediaVisibility=page.locator('[data-media-visibility]');
  const player=mediaVisibility.getByRole('switch',{name:'Fixture Music',exact:true});await player.waitFor();
  await player.click();await page.waitForFunction(()=>window.saved.mediaHidden.includes('fixture.music'));
  await player.click();await page.waitForFunction(()=>!window.saved.mediaHidden.includes('fixture.music'));
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('settings_set',{settings:{mediaHidden:[null,17,'fixture.music']}}));
  await page.waitForFunction(()=>document.querySelector('[data-media-visibility] [role=switch]')?.getAttribute('aria-checked')==='false');
  await player.click();await page.waitForFunction(()=>window.saved.mediaHidden.length===0);
  await screenshot('media-visibility');
  await page.locator('[data-hide-browsers]').click();
  await page.waitForFunction(()=>window.saved.hideForApps.includes('chrome.exe')&&window.saved.hideForApps.includes('msedge.exe'));
  await page.locator('[data-hide-browsers]').click();assert.equal(await page.evaluate(()=>window.saved.hideForApps.filter(name=>name==='chrome.exe').length),1);
  await page.locator('[data-app-list-picker]').getByRole('button',{name:pick('Выбрать из открытых','Pick from open apps'),exact:true}).click();
  await page.locator('[data-open-apps] button').filter({hasText:'code.exe'}).click();await page.waitForFunction(()=>window.saved.hideForApps.includes('code.exe'));
  await page.locator('[data-open-apps] button').filter({hasText:'code.exe'}).click();await page.waitForFunction(()=>!window.saved.hideForApps.includes('code.exe'));
  await screenshot('app-visibility');
  for(const [ru,en,key] of [['Прятать, только когда окно под островом','Hide only while a window is under the island','hideOnlyUnder'],['Выход от верхнего края над полным экраном','Reveal from the top edge over fullscreen apps','fullscreenEdge'],['Отпускать клавиши программе на весь экран','Release shortcuts to fullscreen apps','releaseHotkeysInFullscreen']]){
   const control=page.getByRole('switch',{name:pick(ru,en),exact:true});await control.click();await page.waitForFunction(key=>window.saved[key]===true,key);
  }
  await page.locator('[data-nav=hotkeys]').click();
  const recorder=page.locator('[data-hotkey-recorder]').first(),recordButton=recorder.getByRole('button');
  await recordButton.focus();await page.keyboard.down('Control');assert.equal(await recorder.getByText('Ctrl',{exact:true}).count(),1);await page.keyboard.up('Control');
  await page.keyboard.press('Control+Space');
  await recorder.getByRole('status').waitFor();assert.match(await recorder.getByRole('status').innerText(),lang==='ru'?/Командная строка/:/Command bar/);
  assert.equal(await page.evaluate(()=>window.saved.hotkeyToggle),'Alt+I');
  await page.keyboard.press('a');assert.match(await recorder.getByRole('status').innerText(),/Ctrl, Alt, Shift/);
  await page.keyboard.press('Control+Shift+F8');await page.waitForFunction(()=>window.saved.hotkeyToggle==='Ctrl+Shift+F8');
  await recordButton.focus();await page.keyboard.press('Alt+Space');await page.waitForFunction(()=>window.saved.hotkeyToggle==='Alt+Space');
  assert((await page.evaluate(()=>window.calls)).some(call=>call.command==='hotkeys_recording'&&call.args.on===true),'Recording releases native shortcuts');
  await page.waitForFunction(()=>window.calls.some(call=>call.command==='hotkeys_recording'&&call.args.on===false));
  await screenshot('hotkeys');
  await page.locator('[data-nav=ai]').click();
  await page.locator('[data-web-ai-open=chatgpt]').waitFor();
  assert.equal(await page.locator('[data-web-ai-open=chatgpt]').innerText(),'ChatGPT');
  const proxy=page.locator('[data-ai-proxy]');await proxy.waitFor();
  const proxyInput=proxy.getByLabel(pick('Адрес прокси ИИ','AI proxy address'));assert.equal(await proxyInput.getAttribute('type'),'password');
  await proxyInput.fill('socks5h://127.0.0.1:1080');await proxy.getByRole('button',{name:pick('Сохранить','Save'),exact:true}).click();
  await page.waitForFunction(()=>window.saved.aiProxy==='socks5h://127.0.0.1:1080');await page.waitForFunction(()=>document.querySelector('[data-ai-proxy] input').value==='');
  await screenshot('ai-proxy');
  await proxy.getByRole('button',{name:pick('Удалить','Remove'),exact:true}).click();await page.waitForFunction(()=>window.saved.aiProxy==='');
  await page.locator('[data-nav=clipboard]').click();
  const key=page.locator('[data-upload-key]');await key.waitFor();assert.equal(await key.getAttribute('type'),'password');
  await key.fill('fixture-key');await page.locator('[data-upload]').getByRole('button',{name:pick('Сохранить','Save'),exact:true}).click();
  await page.locator('[data-upload]').getByRole('button',{name:pick('Удалить','Remove'),exact:true}).waitFor();assert.equal(await key.inputValue(),'');
  await page.evaluate(()=>{document.querySelector('[data-settings-nav]').nextElementSibling.scrollTop=99999;});
  await screenshot('upload-key');
  await page.setViewportSize({width:660,height:600});
  await page.locator('[data-nav=connections]').click();await page.locator('[data-connection=clipboard]').waitFor();
  await screenshot('connections-narrow');
  await page.locator('[data-nav=updates]').click();await page.evaluate(()=>window.setUpdate({status:'ready',version:'1.2.1',canInstall:true,reason:null,error:null}));
  await page.getByRole('button',{name:pick('Установить','Install update'),exact:true}).waitFor();
  const clipped=await page.locator('[data-update-settings] button').evaluateAll(buttons=>buttons.some(button=>{const rect=button.getBoundingClientRect();return rect.width>0&&(rect.left<212||rect.right>innerWidth);}));assert.equal(clipped,false);
  await screenshot('updates-narrow');
  // Exercise peripheral preferences through the same production rows and switches
  // as the other modules. IPC remains a browser fixture, with no hardware access.
  await page.locator('[data-nav=modules]').click();
  const batteries=page.getByRole('region',{name:pick('Заряд устройств','Device batteries'),exact:true});
  await batteries.waitFor();
  const show=batteries.getByRole('switch',{name:pick('Показывать на главной','Show on Home'),exact:true});
  if(await show.getAttribute('aria-checked')==='false')await show.click();
  const alerts=batteries.getByRole('switch',{name:pick('Уведомления устройств','Device notifications'),exact:true});
  if(await alerts.getAttribute('aria-checked')==='false')await alerts.click();
  await batteries.getByRole('switch',{name:pick('Отключение устройства','Device disconnected'),exact:true}).waitFor();
  assert.equal(await batteries.locator('input[type=checkbox]').count(),0);
  assert.equal(await batteries.getByRole('switch').count(),10);
  const connection=batteries.getByRole('switch',{name:pick('Подключение устройства','Device connected'),exact:true});
  await connection.click();assert.equal(await page.evaluate(()=>window.saved.peripheralNotifyConnection),true);
  const disconnection=batteries.getByRole('switch',{name:pick('Отключение устройства','Device disconnected'),exact:true});
  await disconnection.click();assert.equal(await page.evaluate(()=>window.saved.peripheralNotifyDisconnection),true);
  const limit=batteries.getByRole('combobox',{name:pick('Устройств в компактной строке','Devices in the compact row'),exact:true});
  await limit.selectOption('6');assert.equal(await page.evaluate(()=>window.saved.peripheralLimit),6);
  await batteries.getByRole('combobox',{name:pick('Порядок устройств','Device order'),exact:true}).selectOption('charge');
  assert.equal(await page.evaluate(()=>window.saved.peripheralSort),'charge');
  await batteries.getByRole('combobox',{name:pick('Порог низкого заряда','Low battery threshold'),exact:true}).selectOption('15');
  assert.equal(await page.evaluate(()=>window.saved.peripheralLowThreshold),15);
  await alerts.click();assert.equal(await page.evaluate(()=>window.saved.peripheralAlerts),false);
  assert.equal(await disconnection.count(),0);
  await alerts.click();await disconnection.waitFor();assert.equal(await disconnection.getAttribute('aria-checked'),'true');
  await show.click();assert.equal(await page.evaluate(()=>window.saved.showPeripherals),false);
  assert.equal(await batteries.getByRole('switch').count(),1);
  await show.focus();await page.keyboard.press('Space');await alerts.waitFor();
  assert.equal(await page.evaluate(()=>window.saved.showPeripherals),true);
  for(const width of [820,660]){
   await page.setViewportSize({width,height:720});
   const geometry=await batteries.evaluate(section=>{
    const rect=section.getBoundingClientRect(),parent=section.parentElement.getBoundingClientRect();
    const controls=[...section.querySelectorAll('button[role=switch],select')];
    return {width:rect.width,parentWidth:parent.width,scrollWidth:section.scrollWidth,clientWidth:section.clientWidth,
     overflow:controls.some(control=>{const r=control.getBoundingClientRect();return r.left<rect.left||r.right>rect.right;}),
     switches:controls.filter(control=>control.getAttribute('role')==='switch').map(control=>{const r=control.getBoundingClientRect();return {width:r.width,height:r.height,label:control.getAttribute('aria-label')};})};
   });
   assert(Math.abs(geometry.width-geometry.parentWidth)<1,'Battery settings must use the whole module width');
   assert(geometry.scrollWidth<=geometry.clientWidth+1&&!geometry.overflow,'Battery controls must fit the narrow settings window');
   assert(geometry.switches.every(control=>control.width===44&&control.height===24&&control.label),'Battery switches must match the shared accessible module controls');
   await show.scrollIntoViewIfNeeded();await screenshot('peripherals-'+width);
   await disconnection.scrollIntoViewIfNeeded();await screenshot('peripheral-notifications-'+width);
  }
  await page.locator('[data-nav=updates]').click();
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('settings_set',{settings:{language:window.saved.language==='ru'?'en':'ru'}}));
  await page.locator('[data-nav=updates][data-now=true]').waitFor();
  await page.getByRole('button',{name:pick('Install update','Установить'),exact:true}).waitFor();
  assert.equal(await page.locator('[data-update-settings]').count(),1,'Changing language preserves the active section');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);results.push({language:lang,shell:['820x720','660x600'],verified:['Existing settings flows','Weather city switching with per-city timezone','Weather city controls at 820/660px','Visibility preference persistence','Held modifiers, conflict action names and Alt+Space recording','Peripheral switch and selector persistence','Conditional notification settings','Keyboard switch activation','Full-width layout and 44x24 accessible switches at 820/660px'],errors:0,overflow:false});
  await context.close();
 }
 await fs.writeFile(path.join(scratch,'report.json'),JSON.stringify({pass:true,results},null,2));console.log(JSON.stringify({pass:true,languages:2,peripheralWidths:[820,660],report:path.join(scratch,'report.json')}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
