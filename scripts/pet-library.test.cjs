const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { createPetLibraryClient } = loadTypeScript('runtime/characters/pet-library-state.ts');
const ready = (hash='a',available=true) => ({status:'ready',pets:[{id:'codex',available,sha256:hash,bytes:12}]});
const image = label => 'data:image/webp;base64,' + Buffer.from(label).toString('base64');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

test('Concurrent startup and force requests serialize, share pending work and clear for the next import',async()=>{
  const calls=[],first=deferred(),second=deferred(),third=deferred();
  const client=createPetLibraryClient({catalog:force=>{calls.push(force);return [first,second,third][calls.length-1].promise;},asset:async()=>image('a')});
  const regular=client.refresh();assert.equal(client.refresh(),regular);
  const forced=client.refresh(true);assert.equal(client.refresh(true),forced);
  assert.deepEqual(calls,[false]);first.resolve(ready());await regular;await Promise.resolve();
  assert.deepEqual(calls,[false,true]);second.resolve(ready('b'));await forced;
  await client.refresh();assert.equal(calls.length,2);
  const next=client.refresh(true);await Promise.resolve();assert.deepEqual(calls,[false,true,true]);
  third.resolve(ready('c'));assert.equal((await next).pets[0].sha256,'c');
});

test('A native changed event wins over an old catalog response without starting another import',async()=>{
  const pending=deferred();let imports=0,notifications=0;
  const client=createPetLibraryClient({catalog:async()=>{imports++;return pending.promise;},asset:async()=>image('a')});
  const remove=client.subscribe(()=>notifications++);
  const request=client.refresh();assert.ok(client.changed(ready('new')));
  pending.resolve(ready('old'));await request;
  assert.equal(client.getSnapshot().pets[0].sha256,'new');assert.equal(imports,1);assert.equal(notifications,1);
  assert.equal(client.changed({status:'ready',pets:[null]}),false);
  assert.equal(client.changed({status:'ready',pets:[...ready().pets,...ready().pets]}),false);
  assert.equal(client.getSnapshot().pets[0].sha256,'new');remove();client.changed(ready('latest'));assert.equal(notifications,1);
});

test('Changed hashes invalidate decoded URLs and missing artwork cannot use a stale cache',async()=>{
  let calls=0;
  const client=createPetLibraryClient({catalog:async()=>ready(),asset:async()=>image('image-'+ ++calls)});
  await client.refresh();const a=await client.asset('codex');assert.equal(await client.asset('codex'),a);assert.equal(calls,1);
  client.changed(ready('b'));const b=await client.asset('codex');assert.notEqual(a,b);assert.equal(calls,2);
  client.changed(ready('b',false));await assert.rejects(client.asset('codex'),/unavailable/);
  await assert.rejects(client.asset('../private-file'),/Unknown/);
});

test('A superseded in-flight atlas is discarded and pending requests share the refreshed version',async()=>{
  const old=deferred(),fresh=deferred();let calls=0;
  const client=createPetLibraryClient({catalog:async()=>ready(),asset:async()=>{calls++;return calls===1?old.promise:fresh.promise;}});
  await client.refresh();const original=client.asset('codex');const shared=client.asset('codex');assert.equal(calls,1);
  client.changed(ready('b'));old.resolve(image('old'));await Promise.resolve();await Promise.resolve();
  fresh.resolve(image('fresh'));assert.equal(await original,image('fresh'));assert.equal(await shared,image('fresh'));assert.equal(calls,2);
});

test('Failed atlas loads can retry after re-import and each force publishes new entry objects',async()=>{
  let calls=0;
  const client=createPetLibraryClient({catalog:async()=>ready(),asset:async()=>{if(++calls===1)throw Error('corrupt');return image('restored');}});
  await client.refresh();const before=client.getSnapshot().pets[0];await assert.rejects(client.asset('codex'),/corrupt/);
  await client.refresh(true);assert.notEqual(client.getSnapshot().pets[0],before);
  assert.equal(await client.asset('codex'),image('restored'));assert.equal(calls,2);
});
