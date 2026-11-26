// Imported by the central native acceptance runner; this starts only its
// isolated passive-QA receiver and never touches the owner's clipboard/firewall.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(origin,route,{method='GET',body=Buffer.alloc(0),ticket,headers={}}={}){
  if(typeof body==='string')body=Buffer.from(body);
  return new Promise((resolve,reject)=>{
    const target=new URL(route,origin),req=http.request(target,{method,headers:{...(ticket?{Authorization:'Bearer '+ticket}:{}),...(method==='POST'?{'Content-Length':body.length}:{}),...headers}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const bytes=Buffer.concat(chunks);let json;try{json=JSON.parse(bytes.toString('utf8'));}catch{}resolve({status:res.statusCode,headers:res.headers,body:bytes,json});});
    });req.setTimeout(15000,()=>req.destroy(new Error('Phone QA request timed out')));req.on('error',reject);req.end(body);
  });
}
async function partialUpload(origin,ticket){
  const req=http.request(new URL('/file?name=cancelled-upload.txt',origin),{method:'POST',headers:{Authorization:'Bearer '+ticket,'Content-Length':1024*1024}},res=>res.resume());
  req.on('error',()=>{});req.setTimeout(10000,()=>req.destroy());
  await new Promise((resolve,reject)=>req.write(Buffer.alloc(4096,65),error=>error?reject(error):resolve()));
  return req;
}
async function folderNames(folder){return (await fs.readdir(folder).catch(()=>[])).sort();}
async function verifyPhoneTransport({invoke,directory,profile=process.env.WOODS_PHONE_QA_PROFILE}){
  const priorShelf=await invoke('shelf_list');const before=await invoke('phone_state');assert.equal(before.running,false,'Isolated QA must not start a sharing listener automatically');
  let receiver;
  try{
    receiver=await invoke('phone_start');assert(receiver.running&&receiver.url);
    const link=new URL(receiver.url);assert.equal(link.hostname,'127.0.0.1','Phone acceptance requires WOODS_PHONE_QA_LOOPBACK=1 on a passive QA process');
    const token=link.hash.slice(1),origin=link.origin;
    const androidHeaders={'User-Agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8','Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate','Sec-Fetch-Site':'none'};
    const page=await request(origin,'/phone/',{headers:androidHeaders});assert.equal(page.status,200);assert(page.body.toString().includes('Woods Island'));assert.match(page.headers['content-security-policy'],/script-src 'self'/);assert(!page.body.toString().includes('https://'));
    assert.equal(page.headers['content-type'],'text/html; charset=utf-8','Android navigation must render a page');
    assert.equal(page.headers['content-disposition'],undefined,'The pairing page must never be downloaded as a file');
    assert.equal(page.headers.location,undefined,'The QR landing page must not redirect to a file');
    for(const [route,mime] of [['/phone/app.js','application/javascript'],['/phone/style.css','text/css']]){
      const asset=await request(origin,route,{headers:androidHeaders});assert.equal(asset.status,200);assert(asset.headers['content-type'].startsWith(mime));assert.equal(asset.headers['content-disposition'],undefined);assert(asset.body.length>100);
    }
    assert.equal((await request(origin,'/state')).status,403);
    assert.equal((await request(origin,'/pair',{method:'POST',body:JSON.stringify({token,device:'Woods QA phone'}),headers:{Origin:'http://external.example'}})).status,403);
    assert.equal((await request(origin,'/phone/',{headers:{Host:'external.example'}})).status,403);
    const pair=await request(origin,'/pair',{method:'POST',body:JSON.stringify({token,device:'Woods QA phone'})});assert.equal(pair.status,200);const ticket=pair.json.ticket;
    assert.equal((await request(origin,'/approval',{ticket})).json.status,'pending');
    assert.equal((await request(origin,'/text',{method:'POST',ticket,body:'Must not arrive before approval'})).status,403);
    const pending=await invoke('phone_state');assert(pending.pending&&pending.pending.device==='Woods QA phone');
    await assert.rejects(()=>invoke('phone_allow',{id:'wrong-pair'}));await invoke('phone_allow',{id:pending.pending.id});
    assert.equal((await request(origin,'/approval',{ticket})).json.status,'approved');
    assert.equal((await request(origin,'/pair',{method:'POST',body:JSON.stringify({token,device:'Second phone'})})).status,403,'The QR code must be single-use');
    assert.equal((await request(origin,'/file?name='+encodeURIComponent('../outside.txt'),{method:'POST',ticket,body:'outside'})).status,400);
    const text='Woods QA: текст с телефона 你好';assert.equal((await request(origin,'/text',{method:'POST',ticket,body:text})).status,200);
    if(profile)assert.equal(await fs.readFile(path.join(profile,'phone-qa-text.txt'),'utf8'),text);
    const filename='Фото и документ 你好.txt',payload=Buffer.from('Woods local transfer payload — 你好');
    const incoming=await request(origin,'/file?name='+encodeURIComponent(filename),{method:'POST',ticket,body:payload});assert.equal(incoming.status,200);assert.equal(incoming.json.clipboard,false,'Passive QA must never change the owner clipboard');
    const shelf=await invoke('shelf_list'),added=shelf.find(item=>item.name===filename&&!priorShelf.some(prior=>prior.id===item.id));assert(added&&added.fromPhone===true&&added.added>0);assert.deepEqual(await fs.readFile(added.path),payload);
    const inbox=path.dirname(path.dirname(added.path)),priorFolders=await folderNames(inbox),partial=await partialUpload(origin,ticket);await pause(150);partial.destroy();
    let removed=false;for(let attempt=0;attempt<40;attempt++){if(JSON.stringify(await folderNames(inbox))===JSON.stringify(priorFolders)){removed=true;break;}await pause(50);}assert(removed,'Canceled upload must remove its staging file and directory');assert(!(await invoke('shelf_list')).some(item=>item.name==='cancelled-upload.txt'),'Canceled files must never reach the shelf');
    const offeredPath=path.join(directory,'phone-offered-你好.txt'),outgoing=Buffer.from('Woods outgoing bytes 你好');await fs.writeFile(offeredPath,outgoing);
    const offered=await invoke('phone_send',{paths:[offeredPath]});assert.equal(offered.offered.length,1);const item=offered.offered[0];
    const downloaded=await request(origin,'/files/'+item.id,{ticket});assert.equal(downloaded.status,200);assert.deepEqual(downloaded.body,outgoing);assert.match(downloaded.headers['content-disposition'],/attachment/);
    let acknowledged;for(let i=0;i<10;i++){acknowledged=await request(origin,'/taken/'+item.id,{method:'POST',ticket});if(acknowledged.status===200)break;await pause(50);}assert.equal(acknowledged.status,200);assert.equal((await invoke('phone_state')).offered[0].taken,true);
    await invoke('phone_unsend',{id:item.id});assert.equal((await request(origin,'/files/'+item.id,{ticket})).status,404);
    const changing=path.join(directory,'phone-changed.txt');await fs.writeFile(changing,'first');const changedOffer=(await invoke('phone_send',{paths:[changing]})).offered[0];await fs.writeFile(changing,'changed-and-longer');assert.equal((await request(origin,'/files/'+changedOffer.id,{ticket})).status,409,'Files changed after desktop selection must be offered again');await invoke('phone_unsend',{id:changedOffer.id});
    const renewed=await invoke('phone_renew');assert(renewed.url&&renewed.url!==receiver.url);assert.equal((await request(origin,'/state',{ticket})).status,403);
    const longDevice='Declined QA phone with an unusually long device name';
    const nextToken=new URL(renewed.url).hash.slice(1),nextPair=await request(origin,'/pair',{method:'POST',body:JSON.stringify({token:nextToken,device:longDevice})});assert.equal(nextPair.status,200);
    const nextPending=await invoke('phone_state');assert.equal(nextPending.pending?.device,longDevice);
    await invoke('phone_deny',{id:nextPending.pending.id});assert.equal((await request(origin,'/approval',{ticket:nextPair.json.ticket})).status,410);
    await invoke('phone_stop');assert.equal((await invoke('phone_state')).running,false);
    // The nonblocking listener observes stop on its next bounded accept tick.
    let closed=false;for(let attempt=0;attempt<20;attempt++){try{await request(origin,'/phone/');}catch{closed=true;break;}await pause(30);}assert(closed,'Stop must close the listener promptly');
    const restarted=await invoke('phone_start');assert(restarted.running&&restarted.url!==receiver.url,'Stopped sharing must restart with a fresh capability');assert.equal((await request(new URL(restarted.url).origin,'/phone/')).status,200);await invoke('phone_stop');
    return {localHttp:true,androidNavigationMime:true,pageIsNotAttachment:true,mobileAssets:true,desktopApproval:true,expiredAndRevokedCapabilities:true,localHostAndOriginChecks:true,pathTraversalRejected:true,unicodeTextAndFiles:true,shelfProvenance:true,bidirectionalBytes:true,takenAcknowledgment:true,unsend:true,cancelledUploadCleanup:true,changedFileRejected:true,stopClosesListener:true,freshRestart:true,clipboard:'isolated text fixture; actual Windows clipboard pending',firewall:'not modified',realPhone:'pending'};
  }finally{
    await invoke('phone_stop').catch(()=>{});
    const shelf=await invoke('shelf_list');for(const item of shelf)if(!priorShelf.some(prior=>prior.id===item.id))await invoke('shelf_remove',{id:item.id});
  }
}
module.exports={verifyPhoneTransport,request};
