// Saved hook commands -> real native scanner -> production permission UI.
// Run only with verify-runtime's isolated agent home and passive QA profile.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
async function verifyAgentHooks({directory,home,profile,client,waitFor,listen}) {
  const notifyPath=path.join(home,'.codex/config.toml');
  const notify=await fs.readFile(notifyPath,'utf8');
  const settings=await client.invoke('settings_get');
  const children=[];
  let count=0;
  try {
    await client.invoke('settings_set',{settings:{agentsAsk:true,language:'en',character:'pixel'}});
    await client.invoke('agents_connect',{agent:'codex',on:true});
    assert.equal((await client.invoke('agents_connections')).codex,'on');
    const hooks=JSON.parse(await fs.readFile(path.join(home,'.codex/hooks.json'),'utf8'));
    const command=hooks.hooks.PermissionRequest.flatMap(group=>group.hooks).find(hook=>hook.command?.startsWith('powershell.exe '))?.command;
    assert(command,'The saved Codex permission command exists');
    for(const verdict of ['allow','deny','terminal']) {
      await client.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:false,peek:null,queue:[]}))`);
      await listen(client,'agents:ask');await listen(client,'agents:ask-done');
      const child=spawn('cmd.exe',['/d','/s','/c',command],{windowsHide:true,env:{...process.env,WOODS_ISLAND_NODE:process.execPath,WOODS_ISLAND_AGENT_HOME:home,WOODS_ISLAND_DATA_DIR:profile}});
      children.push(child);
      let output='',error='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>error+=chunk);
      const complete=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,output,error}));});
      child.stdin.end(JSON.stringify({session_id:'native-'+verdict,cwd:directory,tool_name:'exec_command',tool_input:{cmd:'Fixture 🌲 & $(literal): no requested tool runs'}}));
      await waitFor(client,`!!document.querySelector('[data-agent-ask=permission]')&&window.__woodsEvents['agents:ask']?.some(event=>event.agent==='codex')`,'Real Codex permission reaches the folded UI');
      const ask=await client.evaluate(`window.__woodsEvents['agents:ask'].find(event=>event.agent==='codex')`);
      assert.equal(ask.detail,'Fixture 🌲 & $(literal): no requested tool runs');
      assert((await client.evaluate(`document.querySelector('[data-agent-ask=permission]').textContent`)).includes('Codex'));
      const selector=verdict==='terminal'?'[data-ask-terminal]':`[data-agent-ask=permission] button[title="${verdict==='allow'?'Allow':'Deny'}"]`;
      assert(await client.evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(selector)});if(!button||button.disabled)return false;button.click();return true;})()`),'Production answer button is available');
      let timeout;
      const result=await Promise.race([complete,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Saved hook did not exit after UI answer')),10000);})]).finally(()=>clearTimeout(timeout));
      assert.equal(result.code,0,result.error);
      if(verdict==='terminal')assert.equal(result.output,'');
      else assert.equal(JSON.parse(result.output).hookSpecificOutput.decision.behavior,verdict);
      await waitFor(client,`window.__woodsEvents['agents:ask-done']?.includes(${JSON.stringify(ask.id)})&&!document.querySelector('[data-agent-ask=permission]')`,'Native completion removes the permission card');
      assert.equal(await fs.readFile(notifyPath,'utf8'),notify,'Other notify program is preserved');
      count++;
    }
    return {provider:'codex',savedShellCommand:true,realTauriScanner:true,productionUiReplies:count,notifyPreserved:true,requestedToolsExecuted:false};
  } finally {
    for(const child of children)if(child.exitCode===null)child.kill();
    await client.invoke('agents_connect',{agent:'codex',on:false});
    await client.invoke('settings_set',{settings:{agentsAsk:settings.agentsAsk,language:settings.language,character:settings.character}});
    await client.evaluate(`import('/assets/runtime-debug.js').then(({ot})=>ot.setState({expanded:false,peek:null,queue:[]}))`);
  }
}
module.exports={verifyAgentHooks};
