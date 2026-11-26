const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {emptyTimer,startTimer,readTimer,parseTimerCommand,timerLabel}=load('runtime/timer/model.ts');
test('Old saved timers migrate without changing active time, and labels survive restart/reset/start',()=>{
 const old={base:60000,total:90000,endsAt:200000,left:null,doneAt:null};
 assert.deepEqual(readTimer(JSON.stringify(old)),{...old,label:''});
 const paused=readTimer(JSON.stringify({...old,endsAt:null,left:45000,label:'Работа\nс кодом'}));
 assert.equal(paused.left,45000);assert.equal(paused.label,'Работа с кодом');
 const started=startTimer(paused,300000);assert.equal(started.endsAt,360000);assert.equal(started.label,paused.label);
 assert.equal(emptyTimer(started.base,started.label).label,paused.label);
 assert.equal(readTimer('{broken').label,'');assert.equal(timerLabel('x'.repeat(100)).length,40);
});
test('Timer command supports either label position, Unicode case and invalid duration',()=>{
 const parse=s=>({'30 мин':1800000,'00:30':30000,'1.5 h':5400000}[s]??null);
 assert.deepEqual(parseTimerCommand('таймер 30 мин Моя Работа',60000,parse),{length:1800000,label:'Моя Работа'});
 assert.deepEqual(parseTimerCommand('timer Deep Work 1.5 h',60000,parse),{length:5400000,label:'Deep Work'});
 assert.deepEqual(parseTimerCommand('таймер',60000,parse),{length:60000,label:''});
 assert.equal(parseTimerCommand('таймер -3 мин Работа',60000,parse),null);
});
