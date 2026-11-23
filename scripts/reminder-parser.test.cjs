const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const helpers=load('runtime/reminders/calendar.ts');
const source=fs.readFileSync(path.join(__dirname,'../runtime/compat/island.js'),'utf8');
// Execute the production parser, including its integration with the typed calendar helpers.
const block=source.slice(source.indexOf('var Ri ='),source.indexOf('var ia ='));
assert(block.includes('function Ki(')&&block.includes('function $i('));
const parser=vm.createContext({...helpers,Date, t:()=> 'ru',o:(ru)=>ru,h:()=> 'ru-RU'});
vm.runInContext(block,parser);
vm.runInContext(source.slice(source.indexOf('function oa('),source.indexOf('function sa(')),parser);
const now=new Date(2026,10,18,12),fields=date=>[date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes()];
test('The production reminder parser reads named dates at either end of the task',()=>{
  for(const [text,title]of [['позвонить маме 19 ноября в 16','позвонить маме'],['19 ноября в 16 позвонить маме','позвонить маме'],['call mum on November 19th at 4 pm','call mum']]){
    const parsed=parser.$i(text,now);assert(parsed,text);assert.equal(parsed.text,title);assert.deepEqual(fields(parsed.at),[2026,11,19,16,0]);
  }
  assert.deepEqual(fields(parser.Ki('19 ноября в 4 вечера',now)),[2026,11,19,16,0]);
});
test('Weekday alternatives are only offered for a one-time weekday expression',()=>{
  const once=parser.$i('позвонить в пятницу в 16',now);assert.equal(once.weekday,true);assert.deepEqual(fields(once.at),[2026,11,20,16,0]);
  const weekly=parser.$i('позвонить каждую пятницу в 16',now);assert(weekly.repeat);assert.equal(weekly.weekday,undefined);
  assert.equal(parser.$i('позвонить завтра в 16',now).weekday,false);
});
test('Relative times, recurring days and edit text keep their existing behavior',()=>{
  assert.equal(parser.Ki('через 20 минут',now)-now,1200000);
  assert.equal(parser.Ki('полчаса',now)-now,1800000);
  assert.equal(parser.$i('позвонить через 10.30 минут',now).at-now,618000);
  const weekly=parser.$i('таблетки каждый день в 23:00',now);assert.deepEqual(Array.from(weekly.repeat.days),[0,1,2,3,4,5,6]);
  const edit=parser.ta(weekly.text,weekly.at.getTime(),weekly.repeat,now);const restored=parser.$i(edit,now);
  assert.equal(restored.text,'таблетки');assert.deepEqual(Array.from(restored.repeat.days),[0,1,2,3,4,5,6]);
  assert.equal(parser.Ki('31.11.2026 в 9',now),null);
  assert.equal(parser.$i('позвонить 31 ноября в 16',now),null,'An invalid full date must not become a reminder at 16 with the invalid date kept as task text');
  assert.equal(parser.$i('31.11.2026 в 9 позвонить',now),null);
  assert.equal(parser.oa({id:1,text:'bad',at:Date.now(),repeat:{days:[1],h:24,m:0}}).repeat,undefined);
});
