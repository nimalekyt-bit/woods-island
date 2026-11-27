const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {qrCommand,brightnessCommand,volumeCommand,keepPlayingMusic}=load('runtime/keyboard/quick-commands.ts');
test('QR actions preserve Unicode and links, reject empty commands',()=>{
  assert.equal(qrCommand('qr https://woodslab.top/?q=Привет'),'https://woodslab.top/?q=Привет');
  assert.equal(qrCommand('Кьюар код: Работа завтра'),'Работа завтра');
  assert.equal(qrCommand('qr first\nsecond'),'first\nsecond');
  for(const value of ['qr','qr code','qr-код','text qr link'])assert.equal(qrCommand(value),null);
});
test('Brightness and volume commands accept digits and spoken words within 0..100',()=>{
  assert.equal(brightnessCommand('яркость 0'),0);assert.equal(brightnessCommand('brightness to 100%'),100);
  assert.equal(brightnessCommand('яркость пятьдесят'),50);
  assert.equal(brightnessCommand('яркость на пятьдесят процентов'),50);
  assert.equal(volumeCommand('громкость 45'),45);
  assert.equal(volumeCommand('звук на тридцать процентов'),30);
  assert.equal(volumeCommand('громкость тридцать'),30);
  assert.equal(volumeCommand('volume to 80%'),80);
  for(const value of ['яркость 101','яркость -1','яркость 5.5','brightness','яркость 50 extra','громкость 101'])assert.equal(value.startsWith('громк')?volumeCommand(value):brightnessCommand(value),null);
});
test('Music holds auto-hide only for enabled, live, playing media',()=>{
  const state={settings:{autoHideMusic:true},mediaLive:true,media:{playing:true}};
  assert(keepPlayingMusic(state));assert(!keepPlayingMusic({...state,media:{playing:false}}));
  assert(!keepPlayingMusic({...state,settings:{autoHideMusic:true,moduleMedia:false}}));
});
