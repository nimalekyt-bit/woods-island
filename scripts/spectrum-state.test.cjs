const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./load-runtime-typescript.cjs');
const {liquidSpectrumBands}=loadTypeScript('runtime/media/spectrum-state.ts');

test('Deduplicating a measured silence does not turn it into fallback music after 700 ms',()=>{
 const bands=Array(8).fill(0),snapshot={bands,bandsAt:1000,level:0,liquidSpectrum:true};
 assert.equal(liquidSpectrumBands(snapshot,true,1100),bands);
 assert.equal(liquidSpectrumBands(snapshot,true,60000),bands);
 const resumed={...snapshot,bands:[.2,.7,.1,0,0,0,0,0],level:.05,bandsAt:60050};
 assert.equal(liquidSpectrumBands(resumed,true,60070),resumed.bands);
 assert.equal(liquidSpectrumBands(resumed,true,62000),null,'A stale nonzero sample must not freeze a previous signal');
});

test('Unknown input and disabled or paused visualizers do not claim measured silence',()=>{
 const snapshot={bands:[],bandsAt:0,level:0,liquidSpectrum:true};
 assert.equal(liquidSpectrumBands(snapshot,true,5000),null);
 const silent={...snapshot,bands:Array(8).fill(0),bandsAt:1000};
 assert.equal(liquidSpectrumBands(silent,false,5000),null);
 assert.equal(liquidSpectrumBands({...silent,liquidSpectrum:false},true,5000),null);
 assert.equal(liquidSpectrumBands({...silent,bandsAt:NaN},true,5000),null);
});
