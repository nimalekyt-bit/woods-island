const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative) {
  const filename=path.resolve(__dirname,'..',relative);
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:filename}).outputText;
  const compiled=new Module(filename); compiled.filename=filename; compiled.paths=Module._nodeModulePaths(path.dirname(filename)); compiled._compile(output,filename); return compiled.exports;
}
const {updateState,updateActions,updateProgress,diagnosticSummary,supportReport,updateErrors}=load('runtime/components/reliability-state.ts');
const {weatherDate}=load('runtime/weather/date.ts');

test('Installation is offered only after verified ready state and for installed copies',()=>{
  for(const status of ['idle','checking','available','downloading','installing','upToDate','error']) assert.equal(updateActions(updateState({status,canInstall:true,version:'1.2.0'})).install,false,status);
  assert.equal(updateActions(updateState({status:'ready',canInstall:true})).install,true);
  assert.equal(updateActions(updateState({status:'ready',canInstall:false,reason:'portable'})).install,false);
  assert.equal(updateActions(updateState({status:'available',canInstall:false,reason:'portable'})).manual,true);
});
test('Download progress rejects malformed sizes and clamps overrun',()=>{
  assert.equal(updateProgress(updateState({downloaded:12,total:0})),null);
  assert.equal(updateProgress(updateState({downloaded:Infinity,total:100})),0);
  assert.equal(updateProgress(updateState({downloaded:500,total:100})),100);
  assert.equal(updateProgress(updateState({downloaded:-1,total:100})),0);
  assert.equal(updateProgress(updateState({downloaded:25,total:100})),25);
  assert.equal(updateActions(updateState({status:'downloading',canInstall:true})).cancel,true);
  assert.equal(updateActions(updateState({status:'downloading',canInstall:true})).check,false);
});
test('Support copy contains only allowed metadata and never arbitrary diagnostics',()=>{
  const summary=diagnosticSummary({version:'1.2.0',os:'Windows 11',webview:'145.0.1.2',apiKey:'secret-value',path:'E:/Personal',modules:[
    {id:'ai',status:'notConfigured',detail:'secret-value E:/Personal'},
    {id:'unknown-with-private-data',status:'ready'},
    {id:'obs',status:'secret-value'},
  ],recovery:[{kind:'settings',message:'E:/Personal'}]});
  const report=supportReport(summary);
  assert.match(report,/Woods Island 1\.2\.0/); assert.match(report,/ai: notConfigured/); assert.match(report,/Recovered files: 1/);
  for(const sensitive of ['secret-value','E:/Personal','unknown-with-private-data','apiKey']) assert.ok(!report.includes(sensitive),sensitive);
  assert.equal(supportReport(diagnosticSummary({version:'1 secret-value',os:'Windows E:/Personal',webview:'secret-value'})), 'Woods Island unknown\nOS: Windows\nWebView2: unknown\nRecovered files: 0');
});
test('Every updater machine error has actionable Russian and English copy',()=>{
  for(const code of ['offline','configuration','signature','downloadFailed','invalidRelease','packageTooLarge','storage','notInstalled','checkFirst','downloadFirst','installFailed','busy']) {
    assert.equal(updateErrors[code]?.length,2,code); assert.match(updateErrors[code][0],/[А-Яа-я]/); assert.match(updateErrors[code][1],/[A-Za-z]/);
  }
});
test('Weather wall clock follows DST per timestamp and half-hour zones',()=>{
  const seconds=value=>Date.parse(value)/1000;
  assert.equal(weatherDate(seconds('2026-03-08T06:30:00Z'),'America/New_York').toISOString(),'2026-03-08T01:30:00.000Z');
  assert.equal(weatherDate(seconds('2026-03-08T07:30:00Z'),'America/New_York').toISOString(),'2026-03-08T03:30:00.000Z');
  assert.equal(weatherDate(seconds('2026-11-01T05:30:00Z'),'America/New_York').getUTCHours(),1);
  assert.equal(weatherDate(seconds('2026-11-01T06:30:00Z'),'America/New_York').getUTCHours(),1);
  assert.equal(weatherDate(seconds('2026-11-14T00:00:00Z'),'Asia/Kolkata').toISOString(),'2026-11-14T05:30:00.000Z');
  assert.equal(weatherDate(seconds('2026-11-14T00:00:00Z'),'+03:00').getUTCHours(),3);
  assert.equal(weatherDate(seconds('2026-11-14T00:00:00Z'),10800).getUTCHours(),3);
});
test('Every shared settings switch is labelled by its setting row or explicitly',()=>{
  const filename=path.resolve(__dirname,'../runtime/compat/settings.js');
  const source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const failures=[]; let checked=0;
  function visit(node){
    if(ts.isCallExpression(node)&&node.arguments[0]?.getText(source)==='Y'){
      checked++;
      const explicit=node.arguments[1]?.properties?.some(property=>property.name?.getText(source)==='label');
      let parent=node.parent,hasRow=false;
      while(parent){if(ts.isCallExpression(parent)&&parent.arguments[0]?.getText(source)==='J'){hasRow=true;break;}parent=parent.parent;}
      if(!explicit&&!hasRow)failures.push(source.getLineAndCharacterOfPosition(node.pos).line+1);
    }
    ts.forEachChild(node,visit);
  }
  visit(source); assert.ok(checked>30); assert.deepEqual(failures,[]);
});
