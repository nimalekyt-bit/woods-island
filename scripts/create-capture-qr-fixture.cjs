// Generate a reproducible test symbol with the encoder already shipped by Woods.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../runtime/compat/island.js'),'utf8');
const start=source.indexOf('var hk = s('),end=source.indexOf('  Uk =',start);
if(start<0||end<0)throw new Error('Shipped QR encoder boundary changed');
const chunk=source.slice(start,end).replace(/,\s*$/,';');
const encoder=vm.runInNewContext(chunk+'\nHk',{s:fn=>{let module;return()=>{if(!module){module={exports:{}};fn(module.exports,module);}return module.exports;};},k:value=>value,TextEncoder});
const text='https://woods.example/free/qr?source=capture&hello=privet',symbol=encoder.create(text,{errorCorrectionLevel:'H'});
const rows=Array.from({length:symbol.modules.size},(_,y)=>Array.from({length:symbol.modules.size},(_,x)=>symbol.modules.get(y,x)?'1':'0').join(''));
fs.writeFileSync(path.join(__dirname,'fixtures/capture-qr-matrix.json'),JSON.stringify({text,rows},null,2)+'\n');
console.log(`Woods capture QR fixture: ${rows.length} modules, ${text.length} characters`);
