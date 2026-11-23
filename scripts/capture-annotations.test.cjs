const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {screenshotAnnotations,screenshotExport}=loadTypeScript('runtime/capture/annotation-state.ts');
test('Immediate export includes the still-focused Unicode text and freezes the actual save/copy intent',()=>{
  const existing=[{t:'rect',a:{x:1,y:2},b:{x:50,y:20},color:'#ff453a',w:3}],pending={at:{x:17,y:29},text:'Woods · привет 你好\nВторая строка'};
  const save=screenshotExport(existing,pending,'#ffffff',32,true);
  assert.equal(save.copy,false);assert.equal(save.close,true);assert.equal(save.annotations.length,2);
  assert.deepEqual(save.annotations[1],{t:'text',at:{x:17,y:29},text:pending.text,color:'#ffffff',size:32});
  pending.text='Edited later';pending.at.x=900;
  assert.equal(save.annotations[1].text,'Woods · привет 你好\nВторая строка');assert.equal(save.annotations[1].at.x,17);
  assert.equal(existing.length,1,'Saving a snapshot must not mutate React history');
  const copy=screenshotExport(save.annotations,null,'#fff',32,false);assert.equal(copy.copy,true);assert.equal(copy.close,false);assert.equal(copy.annotations.length,2,'Committed text is not added again');
});
test('Empty drafts disappear and committing text can be undone as one annotation',()=>{
  const existing=[{t:'pen',pts:[{x:0,y:0},{x:10,y:10}],color:'#ff0000',w:3}];
  assert.equal(screenshotAnnotations(existing,{at:{x:0,y:0},text:' \n\t'},'#fff',20),existing);
  const result=screenshotAnnotations(existing,{at:{x:3,y:8},text:' Text '},'#fff',20);
  assert.equal(result[1].text,' Text ');assert.deepEqual(result.slice(0,-1),existing);assert.equal(existing.length,1);
});
