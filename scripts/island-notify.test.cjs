const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { agentRecord, questionAnswers, decisionFor } = require('./island-notify.cjs');

test('Codex completion and OpenCode idle preserve real session and project fields', () => {
  const record = agentRecord({ 'thread-id':'abc', cwd:'E:\\Workspace\\woods-island', 'last-assistant-message':'готово' }, 'codex', 'agent-turn-complete');
  assert.equal(record.agent, 'codex');
  assert.equal(record.state, 'done');
  assert.equal(record.project, 'woods-island');
  assert.equal(record.message, 'готово');
  assert.equal(agentRecord({ sessionID:'abc',status:{type:'idle'} },'opencode','session.status').state,'done');
});

test('Claude permission waits for a matching reply and emits the native decision', async () => {
  const root = path.join(os.tmpdir(), 'woodscorp_obs');
  await fs.mkdir(root,{recursive:true});
  const directory = await fs.mkdtemp(path.join(root, 'woods-hook-test-'));
  try {
    await fs.mkdir(path.join(directory,'agents','answers'),{recursive:true});
    await fs.writeFile(path.join(directory,'agents','heartbeat.json'),JSON.stringify({at:Date.now()}));
    const child = spawn(process.execPath,[path.join(__dirname,'island-notify.cjs'),'--provider','claude','--event','PermissionRequest'],{
      env:{...process.env,WOODS_ISLAND_DATA_DIR:directory},windowsHide:true,
    });
    let output=''; child.stdout.on('data',data=>{output+=data;});
    const exited = new Promise(resolve=>child.once('exit',resolve));
    child.stdin.end(JSON.stringify({session_id:'fixture',cwd:'E:\\Test',tool_name:'Read',tool_input:{file_path:'example.txt'}}));
    let ask;
    for(let attempt=0;attempt<40&&!ask;attempt++){
      for(const file of await fs.readdir(path.join(directory,'agents'))){
        if(file.endsWith('.json')&&file!=='heartbeat.json'){
          const record=JSON.parse(await fs.readFile(path.join(directory,'agents',file),'utf8'));ask=record.ask;
        }
      }
      if(!ask)await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert(ask,'The hook must publish a request before waiting');
    assert.equal(ask.tool,'Read');
    assert.equal(ask.detail,'example.txt');
    await fs.writeFile(path.join(directory,'agents','answers',`${ask.id}.json`),JSON.stringify({verdict:'deny'}));
    assert.equal(await exited,0);
    assert.equal(JSON.parse(output).hookSpecificOutput.decision.behavior,'deny');
  } finally {
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));
    await fs.rm(directory,{recursive:true,force:true});
  }
});

const questions = [
  { question:'Какой режим?',header:'Режим',options:[{label:'Быстро',description:'Сразу'},{label:'Качественно',description:'Подробно'}],multiSelect:false },
  { question:'Что добавить?',header:'Выбор',options:[{label:'A, B'},{label:'C'},{label:'D'}],multiSelect:true },
];

test('Claude question selection validates exact keys, labels and single/multi cardinality', () => {
  assert.deepEqual({...questionAnswers(questions,{'Какой режим?':'Быстро','Что добавить?':['A, B','C']})},{'Какой режим?':'Быстро','Что добавить?':'A, B, C'});
  assert.deepEqual({...questionAnswers(questions,{'Какой режим?':['Качественно'],'Что добавить?':'C, D'})},{'Какой режим?':'Качественно','Что добавить?':'C, D'});
  for (const answers of [
    {'Какой режим?':'Быстро'},
    {'Какой режим?':'Быстро','Другой':'C'},
    {'Какой режим?':['Быстро','Качественно'],'Что добавить?':['C']},
    {'Какой режим?':'Быстро','Что добавить?':['C','C']},
    {'Какой режим?':'Быстро','Что добавить?':['unknown']},
    {'Какой режим?':'Быстро','Что добавить?':[]},
    {'Какой режим?':true,'Что добавить?':['C']},
    {'Какой режим?':'Быстро','Что добавить?':['C'],extra:'D'},
  ]) assert.throws(()=>questionAnswers(questions,answers));
  assert.throws(()=>decisionFor({verdict:'answer',answers:{}},{kind:'permission'},{}));
  assert.throws(()=>decisionFor({verdict:'allow'},{kind:'question'},{}));
  assert.equal(decisionFor({verdict:'terminal'},{kind:'question'},{}),null);
});

test('Claude AskUserQuestion returns updatedInput preserving questions and original fields', async () => {
  const root = path.join(os.tmpdir(),'woodscorp_obs');
  await fs.mkdir(root,{recursive:true});
  const directory = await fs.mkdtemp(path.join(root,'woods-question-test-'));
  let child;
  let heartbeat;
  try {
    await fs.mkdir(path.join(directory,'agents','answers'),{recursive:true});
    const beat = ()=>fs.writeFile(path.join(directory,'agents','heartbeat.json'),JSON.stringify({at:Date.now()}));
    await beat();
    heartbeat = setInterval(()=>beat().catch(()=>{}),1000);
    child = spawn(process.execPath,[path.join(__dirname,'island-notify.cjs'),'--provider','claude','--event','PermissionRequest'],{env:{...process.env,WOODS_ISLAND_DATA_DIR:directory},windowsHide:true});
    let output=''; let error='';
    child.stdout.on('data',data=>{output+=data;}); child.stderr.on('data',data=>{error+=data;});
    const exited = new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    const toolInput = {questions,metadata:{real:'preserve'},answers:{old:'overwritten'}};
    child.stdin.end(JSON.stringify({session_id:'question-fixture',cwd:'E:\\Test',tool_name:'AskUserQuestion',tool_input:toolInput}));
    let ask;
    for(let attempt=0;attempt<60&&!ask;attempt++){
      for(const file of await fs.readdir(path.join(directory,'agents'))){
        if(file.endsWith('.json')&&file!=='heartbeat.json'){
          const record=JSON.parse(await fs.readFile(path.join(directory,'agents',file),'utf8'));ask=record.ask;
        }
      }
      if(!ask)await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert(ask,'The hook must publish question choices');
    assert.equal(ask.kind,'question'); assert.deepEqual(ask.questions,questions);
    const answerFile=path.join(directory,'agents','answers',`${ask.id}.json`);
    await fs.writeFile(answerFile,JSON.stringify({verdict:'answer',answers:{'Какой режим?':'Быстро','Что добавить?':['unknown']}}));
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(output,'','An invalid choice must never approve the tool');
    await fs.writeFile(answerFile,JSON.stringify({verdict:'answer',answers:{'Какой режим?':['Качественно'],'Что добавить?':['A, B','C']}}));
    const code=await Promise.race([exited,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Question hook did not complete')),5000);timer.unref();})]);
    assert.equal(code,0,error);
    assert.deepEqual(JSON.parse(output),{hookSpecificOutput:{hookEventName:'PermissionRequest',decision:{behavior:'allow',updatedInput:{...toolInput,answers:{'Какой режим?':'Качественно','Что добавить?':'A, B, C'}}}}});
    const records=(await fs.readdir(path.join(directory,'agents'))).filter(file=>file.endsWith('.json')&&file!=='heartbeat.json');
    assert.equal(JSON.parse(await fs.readFile(path.join(directory,'agents',records[0]),'utf8')).ask,undefined);
  } finally {
    clearInterval(heartbeat); if(child&&child.exitCode===null)child.kill();
    assert(path.resolve(directory).startsWith(path.resolve(root)+path.sep));
    await fs.rm(directory,{recursive:true,force:true});
  }
});

test('Codex beside chaining keeps original arguments and JSON literal and reports prior failure', async () => {
  const root = path.join(os.tmpdir(), 'woodscorp_obs');
  await fs.mkdir(root,{recursive:true});
  const directory = await fs.mkdtemp(path.join(root, 'woods-chain-test-'));
  try {
    const original = path.join(directory,'prior notify.cjs');
    const captured = path.join(directory,'captured.json');
    await fs.writeFile(original,"require('node:fs').writeFileSync(process.argv[2],JSON.stringify(process.argv.slice(3)));process.exitCode=7;");
    const literal = 'spaces & `literal` $(untouched)';
    await fs.writeFile(path.join(directory,'codex-notify-chain.json'),JSON.stringify([process.execPath,original,captured,literal]));
    const payload = {'thread-id':'chain-session',cwd:'E:\\Test','last-assistant-message':'verified'};
    const child = spawn(process.execPath,[path.join(__dirname,'island-notify.cjs'),'--provider','codex',JSON.stringify(payload)],{
      env:{...process.env,WOODS_ISLAND_DATA_DIR:directory},windowsHide:true,stdio:'ignore',
    });
    const code = await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    assert.equal(code,7);
    const args = JSON.parse(await fs.readFile(captured,'utf8'));
    assert.equal(args[0],literal);
    assert.deepEqual(JSON.parse(args[1]),payload);
    const eventFiles=(await fs.readdir(path.join(directory,'agents'))).filter(file=>file.endsWith('.json'));
    assert.equal(eventFiles.length,1);
    const record=JSON.parse(await fs.readFile(path.join(directory,'agents',eventFiles[0]),'utf8'));
    assert.equal(record.state,'done');
    assert.equal(record.message,'verified');
  } finally {
    assert(path.resolve(directory).startsWith(path.resolve(root)+path.sep));
    await fs.rm(directory,{recursive:true,force:true});
  }
});
