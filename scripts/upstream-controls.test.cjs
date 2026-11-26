const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {latestWriter}=load('runtime/controls/latest-write.ts');
const {compactDevice,compactIndicatorWidth,loadParts,percent,speed}=load('runtime/controls/indicator-model.ts');
test('Slow slider calls are serialized; final pending value wins and disposal drops pending writes',async()=>{
  const calls=[],resolvers=[];
  const writer=latestWriter(value=>{calls.push(value);return new Promise(resolve=>resolvers.push(resolve));},error=>{throw error;},1000);
  writer.push(10,true);writer.push(20,true);writer.push(30,true);assert.deepEqual(calls,[10]);
  resolvers.shift()();await Promise.resolve();await Promise.resolve();assert.deepEqual(calls,[10,30]);
  writer.push(40,true);writer.dispose();resolvers.shift()();await Promise.resolve();await Promise.resolve();assert.deepEqual(calls,[10,30]);
});
test('Compact device chooses the lowest fresh visible battery and load widths stay stable',()=>{
  const device=(id,percent,batteryStatus='available')=>({id,name:id,present:true,connected:true,percent,batteryStatus});
  const snapshot={devices:[device('stale',1,'stale'),device('unknown',null),device('low',15),device('other',80)],revision:1};
  assert.equal(compactDevice({deviceBattery:'always'},snapshot).id,'low');assert.equal(compactDevice({deviceBattery:'low',deviceBatteryLow:10},snapshot),null);
  assert.equal(compactDevice({deviceBattery:'always',peripheralHidden:['low']},snapshot).id,'other');assert.equal(compactDevice({deviceBattery:'off'},snapshot),null);
  assert.deepEqual(loadParts({loadInPill:['gpu','cpu','cpu','invalid']}),['cpu','gpu']);assert.equal(compactIndicatorWidth({loadInPill:['cpu','ram']}),122);
  assert.equal(percent(null),'—');assert.equal(percent(0),'0%');assert.equal(speed(0),'0 B/s');assert.equal(speed(null),'—');
});
