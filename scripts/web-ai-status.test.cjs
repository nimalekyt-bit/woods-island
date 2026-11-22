const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { parseStatus, statusText } = loadTypeScript('runtime/web-ai/status.ts');
const state = (phase, code = null) => ({ service: 'gemini', target: 'window', phase, code, navigation: 4 });

test('Web chat selection restores ChatGPT and existing providers, and rejects stale values',()=>{
  const {webChatService}=loadTypeScript('runtime/web-ai/providers.ts');
  for(const provider of ['chatgpt','gemini','deepseek'])assert.equal(webChatService(provider),provider);
  for(const provider of [null,'island','unknown','https://example.com'])assert.equal(webChatService(provider),'island');
});
test('Web AI accepts native status and rejects malformed events', () => {
  assert.deepEqual(parseStatus(state('error', 7)), state('error', 7));
  for (const value of [null, {}, state('unknown'), { ...state('loaded'), target: 'remote' }, { ...state('loaded'), navigation: NaN }, state('error', '7')]) assert.equal(parseStatus(value), null);
});
test('Web AI provides distinct loading, connection, certificate and slow-load feedback', () => {
  assert.match(statusText(null), /Загружаю/);
  assert.match(statusText(null, true), /затянулась/);
  assert.match(statusText(state('error', 7)), /подключение/);
  assert.match(statusText(state('error', 3)), /дату и сеть/);
  assert.match(statusText(state('error', -1)), /Повторите/);
  assert.equal(statusText(state('loaded'), true), 'Сайт загружен');
  assert.match(statusText(state('error', 7), false, true), /browser/);
});
test('Support report retains Web AI provider and numeric failure without chat data or URLs', () => {
  const { diagnosticSummary, supportReport } = loadTypeScript('runtime/components/reliability-state.ts');
  const report = supportReport(diagnosticSummary({ version: '1.2.0', os: 'Windows x86_64', webview: '145.0.1.2',
    webAi: [{ ...state('error', 7), url: 'https://private.example/chat', draft: 'secret' }, { ...state('loaded'), service: 'secret' }] }));
  assert.match(report, /Web AI gemini \(window\): error, code 7/);
  assert.doesNotMatch(report, /secret|https|private/);
});
