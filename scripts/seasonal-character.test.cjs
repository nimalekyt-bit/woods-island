const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {seasonalDefinitions}=loadTypeScript('runtime/characters/seasonal.ts');
const {seasonalFrame,seasonalBeat,seasonalArm,SEASONAL_IDS}=loadTypeScript('runtime/characters/seasonal-motion.ts');
const {createCharacterCatalog}=loadTypeScript('runtime/characters/catalog.ts');
const {approvedDefinitions}=loadTypeScript('runtime/characters/approved.ts');
const {isFreeCharacter,selectCharacter}=loadTypeScript('runtime/characters/selection.ts');
function fixture(){let allocations=0;class Node{constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.style={};allocations++;}setAttribute(name,value){this.attrs[name]=String(value);}appendChild(child){this.children.push(child);return child;}}const root=new Node('g');return{root,document:{createElementNS:(_ns,tag)=>new Node(tag)},allocations:()=>allocations,walk(fn,node=root){fn(node);node.children.forEach(child=>this.walk(fn,child));}};}
test('Five seasonal selections are free, translated and coexist with all 20 Woods/Codex bitmap pets',()=>{
  let language='ru';const catalog=createCharacterCatalog({creatures:[],things:[],renderers:{},language:()=>language,additions:approvedDefinitions});
  assert.deepEqual(seasonalDefinitions.map(d=>d.id),SEASONAL_IDS);assert.equal(approvedDefinitions.length,20);
  for(const pet of approvedDefinitions)assert.equal(catalog.find(pet.id).bitmap,pet.bitmap);
  for(const definition of seasonalDefinitions){assert(isFreeCharacter(definition.id));assert.equal(selectCharacter({character:definition.id},false,false),definition.id);assert.equal(selectCharacter({character:'none',characterMusic:definition.id},false,true),definition.id);assert.equal(catalog.find(definition.id),definition);assert.equal(definition.group,'holiday');assert(definition.colorArt&&definition.generic);language='en';assert.notEqual(catalog.describe(definition).name,definition.name);}
});
test('Seasonal gestures keep the upstream 545ms beat, alert, sleep and celebration semantics',()=>{
  const pose={s:'music',c:'#aabbcc',lx:-2,ly:1,blink:1,poke:0,h:30,face:true};
  assert.equal(seasonalBeat(0),0);assert.equal(seasonalBeat(272.5),1);assert.equal(seasonalBeat(545),0);
  const snow=seasonalFrame('snowman',pose,272.5,0);assert.equal(snow.carrot,-1);assert.equal(snow.hat,-4);assert.equal(snow.accent,pose.c);
  assert.equal(seasonalArm('attn',0,0,1),-14);assert.equal(seasonalArm('sleep',0,0,-1),-16);
  const bird=seasonalFrame('bullfinch',pose,272.5,0);assert.equal(bird.beak,2.2);assert.equal(bird.wing,-10);assert.equal(bird.tail,-12);
  const deer=seasonalFrame('deer',{...pose,s:'sleep',blink:0},1000,0);assert.equal(deer.accent,'#d4b369');assert.equal(deer.ears,10);
  const frost=seasonalFrame('frost',{...pose,s:'sleep'},1000,0);assert.equal(frost.pom,3);
  for(const id of SEASONAL_IDS)for(const s of ['idle','music','think','done','attn','sleep'])for(let frame=0;frame<120;frame++){
    const values=seasonalFrame(id,{...pose,s,blink:frame%3/2},frame*37,frame*37);for(const value of Object.values(values))if(typeof value==='number')assert(Number.isFinite(value)&&Math.abs(value)<50);
  }
});
test('Woods seasonal drawings reuse nodes, remain finite, and own their gradient IDs and instance state',()=>{
  for(const definition of seasonalDefinitions){const f=fixture();global.document=f.document;const frame=definition.puppet.create(f.root,5),allocated=f.allocations();
    for(const s of ['idle','music','think','done','attn','sleep'])for(let i=0;i<120;i++){frame.draw({s,c:'#abc123',lx:i%9-4,ly:i%7-3,blink:i%3/2,poke:i%5/4,h:30,face:true},1000+i*37,i*37,.037);f.walk(node=>Object.values(node.attrs).forEach(value=>assert(!/NaN|Infinity/.test(value))));assert.equal(f.allocations(),allocated);}
    const snapshot=JSON.stringify(f.root),ids=[];f.walk(node=>{if(node.attrs.id)ids.push(node.attrs.id);});const other=fixture();global.document=other.document;const second=definition.puppet.create(other.root,5);second.draw({s:'sleep',c:'#fff',lx:0,ly:0,blink:0,poke:0,h:30,face:true},1000,0,.016);assert.equal(JSON.stringify(f.root),snapshot);other.walk(node=>{if(node.attrs.id)assert(!ids.includes(node.attrs.id),'Gradient IDs must remain unique even with reused seeds');});
  }
});
