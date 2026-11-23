const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {recurringDay,holidayDateActive,holidayPolicy,snowDensity}=loadTypeScript('runtime/holidays/model.ts');
const date=(month,day)=>new Date(2026,month-1,day,12);
test('Holiday dates include both boundaries and span New Year without an off-season interval',()=>{
  for(const [month,day] of [[12,15],[12,31],[1,1],[1,15]])assert(holidayDateActive(date(month,day)));
  for(const [month,day] of [[12,14],[1,16],[6,1]])assert(!holidayDateActive(date(month,day)));
  assert(holidayDateActive(date(6,5),'06-05','06-05'));
  assert(!holidayDateActive(date(6,6),'06-05','06-05'));
  assert.equal(recurringDay('2-29','12-15'),'02-29');
  for(const value of ['02-30','04-31','13-01','00-12','11-00',null])assert.equal(recurringDay(value,'12-15'),'12-15');
});
test('Hidden/fullscreen islands leave no snow or lights; motion preference stops snowfall and blinking',()=>{
  const settings={snow:'on',snowCap:true,snowFall:true,snowScreen:true,garland:'wave'};
  const context={date:date(6,1),visible:true,capsule:true,reducedMotion:false};
  const active=holidayPolicy(settings,context);assert(active.fall&&active.cap&&active.screen&&active.animateGarland);
  for(const changes of [{visible:false},{fullscreen:true}]){
    const policy=holidayPolicy(settings,{...context,...changes});
    assert(!policy.active&&!policy.fall&&!policy.cap&&!policy.screen);assert.equal(policy.garland,'off');
  }
  const reduced=holidayPolicy(settings,{...context,reducedMotion:true});
  assert(!reduced.fall&&!reduced.screen&&!reduced.animateGarland);assert(reduced.cap);
  assert(!holidayPolicy(settings,{...context,capsule:false}).cap);
  const onlyScreen=holidayPolicy({...settings,snowFall:false},context);
  assert(!onlyScreen.fall&&onlyScreen.screen,'The local snowfall switch must not disable the separate screen effect');
  assert(!holidayPolicy({...settings,snow:'off'},context).active);
});
test('Snow settings tolerate malformed legacy values and clamp density',()=>{
  assert.equal(snowDensity(NaN),1);assert.equal(snowDensity('300'),1);
  assert.equal(snowDensity(-5),.25);assert.equal(snowDensity(999),3);
  assert.equal(holidayPolicy({snow:'auto',snowFrom:'invalid',snowTo:'invalid',garland:'invalid'},{date:date(12,16),visible:true,capsule:true,reducedMotion:false}).garland,'off');
});
