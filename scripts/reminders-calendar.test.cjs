const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {calendarDate,shiftReminder,weekdayChoices,validRepeat}=load('runtime/reminders/calendar.ts');
const now=new Date(2026,10,18,12,0);
const fields=date=>[date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes()];
test('Named dates handle Russian and English order, ordinals, abbreviations and explicit years',()=>{
  for(const expression of ['19 ноября в 16','19-го ноября в 16','November 19th at 16','on the 19th of Nov. at 16'])assert.deepEqual(fields(calendarDate(expression,now)),[2026,11,19,16,0],expression);
  assert.deepEqual(fields(calendarDate('19 ноября 2027 в 16:30',now)),[2027,11,19,16,30]);
  assert.deepEqual(fields(calendarDate('19 ноября',now)),[2026,11,19,9,0]);
});
test('Invalid dates cannot roll into another month, and leap days find a valid year',()=>{
  for(const expression of ['31 ноября в 16','30 февраля 2028 в 9','29 февраля 2027','19 ноября в 24:00','19 ноября в 9:60','0 ноября','19 blah november','November nineteen'])assert.equal(calendarDate(expression,now),null,expression);
  assert.deepEqual(fields(calendarDate('29 февраля в 9',now)),[2028,2,29,9,0]);
  assert.deepEqual(fields(calendarDate('1 января в 9',now)),[2027,1,1,9,0]);
  assert.equal(calendarDate('через 15 минут',now),undefined);assert.equal(calendarDate('tomorrow at 9',now),undefined);
});
test('Day ordinals skip months without that day; naked numbers remain relative minutes',()=>{
  assert.deepEqual(fields(calendarDate('31-го в 10',now)),[2026,12,31,10,0]);
  assert.equal(calendarDate('19',now),undefined);
});
test('Calendar day shifts and weekly choices preserve the local hour across DST',()=>{
  const prior=process.env.TZ;process.env.TZ='Europe/London';
  try{
    const date=new Date(2027,2,27,9,30),shifted=shiftReminder(date,1440);
    assert.deepEqual(fields(shifted),[2027,3,28,9,30]);assert.equal(shifted-date,23*60*60*1000);
    assert.deepEqual(fields(shiftReminder(date,1455)),[2027,3,28,9,45]);
    assert.deepEqual(fields(shiftReminder(date,-15)),[2027,3,27,9,15]);
    const choices=weekdayChoices(date);assert.deepEqual(choices.later.map(fields),[[2027,4,3,9,30],[2027,4,10,9,30]]);
    assert.deepEqual(choices.weekly,{days:[6],h:9,m:30});
  }finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
});
test('Malformed persisted weekly hours and minutes are rejected before scheduling',()=>{
  assert(validRepeat({days:[1,3],h:23,m:59}));
  for(const value of [null,{}, {days:[],h:9,m:0},{days:[7],h:9,m:0},{days:[1],h:24,m:0},{days:[1],h:9,m:60},{days:[1],h:-1,m:0},{days:[1],h:9,m:0.5}])assert.equal(validRepeat(value),false);
});
