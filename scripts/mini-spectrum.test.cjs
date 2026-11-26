const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {MINI_BAR_COUNT,miniBandLevel,miniBarTarget}=loadTypeScript('runtime/media/mini-spectrum.ts');
test('Four mini bars partition 8-band and 24-band spectra cleanly across frequency zones',()=>{
  for(let band=0;band<8;band++){
    const sample=Array(8).fill(0);sample[band]=.6;
    const bars=Array.from({length:MINI_BAR_COUNT},(_,index)=>miniBandLevel(sample,index));
    assert.equal(bars.filter(value=>value===.6).length,1,'Band '+band+' must reach exactly one mini bar');
    assert.equal(bars[Math.floor(band/2)],.6);
    assert.equal(Math.max(...bars),.6);
  }
  for(let band=0;band<24;band++){
    const sample=Array(24).fill(0);sample[band]=.75;
    const bars=Array.from({length:MINI_BAR_COUNT},(_,index)=>miniBandLevel(sample,index));
    assert.equal(bars.filter(value=>value===.75).length,1,'24-band '+band+' must reach exactly one mini bar');
    assert.equal(bars[Math.floor(band/6)],.75);
  }
  assert.deepEqual([0,1,2,3].map(index=>miniBandLevel([NaN,-1,Infinity,0,0,0,0,0],index)),[0,0,0,0]);
  assert.equal(miniBarTarget([],1),0);
  assert(miniBarTarget([0,.2,0,0],1)>.2,'Quiet signal in 4-band input should still be visible');
  assert(miniBarTarget([0,0,.2,0,0,0,0,0],1)>.2,'Quiet signal in 8-band input should still be visible');
  const quiet24=Array(24).fill(0);quiet24[8]=.2;
  assert(miniBarTarget(quiet24,1)>.2,'Quiet signal in 24-band input should still be visible');
  assert(miniBarTarget(Array(24).fill(1),1)<=1);
});
