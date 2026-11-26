const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript:load}=require('./load-runtime-typescript.cjs');
const {normalizeVoiceCommand,canRunVoiceResult}=load('runtime/keyboard/voice-command.ts');
test('Spoken opening words and trailing punctuation preserve the intended command',()=>{
  assert.equal(normalizeVoiceCommand('Пожалуйста, открой Telegram!'),'Telegram');
  assert.equal(normalizeVoiceCommand('Open, please, Visual Studio Code, please.'),'Visual Studio Code');
  assert.equal(normalizeVoiceCommand('таймер 10 минут.'),'таймер 10 минут');
  assert.equal(normalizeVoiceCommand('please'),'please');
});
test('Voice runs recognized tools and matching app/actions, while ambiguous results remain reviewable',()=>{
  assert(canRunVoiceResult('timer','Timer: 10 min','таймер 10 минут'));
  assert(canRunVoiceResult('p:telegram','Telegram Desktop','Telegram'));
  assert(canRunVoiceResult('aSettings','Настройки Woods Island','Настройки'));
  assert(!canRunVoiceResult('p:telegram','Telegram','Tele'));
  assert(!canRunVoiceResult('aSettings','Настройки Woods Island','погода'));
  for(const key of ['web','ai','f:report','shell','shutdown'])assert(!canRunVoiceResult(key,'Open command','Open command'));
  assert(!canRunVoiceResult('p:app','A','A'));
});
test('Application filler is removed around spoken app names without changing ordinary queries',()=>{
  assert.equal(normalizeVoiceCommand('открой приложение Discord'),'Discord');
  assert.equal(normalizeVoiceCommand('open the Discord app'),'Discord');
  assert.equal(normalizeVoiceCommand('запусти игру Warface'),'Warface');
  assert.equal(normalizeVoiceCommand('Open Game Bar'),'Game Bar');
  assert.equal(normalizeVoiceCommand('Game Bar'),'Game Bar');
  assert.equal(normalizeVoiceCommand('таймер 30 мин игра'),'таймер 30 мин игра');
});
