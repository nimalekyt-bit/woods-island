const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {qrCommand,brightnessCommand,keepPlayingMusic}=load('runtime/keyboard/quick-commands.ts');
test('QR actions preserve Unicode and links, reject empty commands',()=>{
  assert.equal(qrCommand('qr https://woodslab.top/?q=Привет'),'https://woodslab.top/?q=Привет');
  assert.equal(qrCommand('Кьюар код: Работа завтра'),'Работа завтра');
  assert.equal(qrCommand('qr first\nsecond'),'first\nsecond');
  for(const value of ['qr','qr code','qr-код','text qr link'])assert.equal(qrCommand(value),null);
});
test('Brightness commands accept boundary percentages and reject unrelated or invalid input',()=>{
  assert.equal(brightnessCommand('яркость 0'),0);assert.equal(brightnessCommand('brightness to 100%'),100);
  for(const value of ['яркость 101','яркость -1','яркость 5.5','brightness','яркость 50 extra'])assert.equal(brightnessCommand(value),null);
});
test('Music holds auto-hide only for enabled, live, playing media',()=>{
  const state={settings:{autoHideMusic:true},mediaLive:true,media:{playing:true}};
  assert(keepPlayingMusic(state));assert(!keepPlayingMusic({...state,media:{playing:false}}));
  assert(!keepPlayingMusic({...state,settings:{autoHideMusic:true,moduleMedia:false}}));
});
