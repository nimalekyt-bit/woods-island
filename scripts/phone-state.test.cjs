const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {phoneUrl,phoneState,phoneLinked,shelfAge,shelfProvenance}=loadTypeScript('runtime/phone/state.ts');
const capability='a'.repeat(64);
test('QR targets accept only literal local HTTP pairing addresses, never external hosts or credentials',()=>{
  for(const address of ['192.168.1.3','10.0.0.5','172.16.1.4','127.0.0.1']){const url=`http://${address}:32145/phone/#${capability}`;assert.equal(phoneUrl(url),url);}
  for(const url of [`https://192.168.1.3:32145/phone/#${capability}`,`http://8.8.8.8:32145/phone/#${capability}`,`http://example.com:32145/phone/#${capability}`,`http://user:password@192.168.1.3:32145/phone/#${capability}`,`http://192.168.1.3:32145/phone/?token=else#${capability}`,`http://192.168.1.3:80/phone/#${capability}`,`http://192.168.1.3:32145/phone/#oops`])assert.equal(phoneUrl(url),null,url);
});
test('Malformed native state cannot produce actionable offers or an unverified pending phone',()=>{
  const state=phoneState({running:true,url:'javascript:alert(1)',pending:{id:'wrong',device:'Phone',expiresAt:Date.now()},offered:[{id:capability,name:'valid.pdf',size:23},{id:capability,name:'negative',size:-1},{id:'wrong',name:'unsafe',size:2}]});
  assert.equal(state.url,null);assert.equal(state.pending,null);assert.equal(state.offered.length,1);assert.equal(state.offered[0].taken,false);assert(!phoneLinked(state));
  assert(phoneLinked(phoneState({running:true,device:'Approved phone',connected:false})),'An approved phone can reopen its page; this is distinct from current connectivity');
});
test('Legacy shelf records retain unknown age and origin; explicit phone provenance is preserved',()=>{
  assert.deepEqual(shelfProvenance({}),{fromPhone:false,added:null});
  assert.deepEqual(shelfProvenance({fromPhone:true,added:1234}),{fromPhone:true,added:1234});
  assert.equal(shelfAge(null,100000,'ru'),'на полке');assert.equal(shelfAge(null,100000,'en'),'on the shelf');
  assert.equal(shelfAge(100000,100500,'en'),'now');assert.equal(shelfAge(100000,160500,'ru'),'1 мин назад');
  assert.equal(shelfAge(500000,100000,'en'),'on the shelf','Future/invalid timestamps must not pretend to be recent');
});
