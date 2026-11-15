const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { focusInputAfterActivation } = loadTypeScript('runtime/island/input-focus.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Input focus waits for native activation and preserves scroll position', async () => {
  const calls = [];
  let activateDone;
  const cancel = focusInputAfterActivation(() => ({ focus: options => calls.push(['focus', options]) }),
    () => { calls.push(['activate']); return new Promise(resolve => { activateDone = resolve; }); });
  await flush();
  assert.deepEqual(calls, [['activate']]);
  activateDone(); await flush();
  assert.deepEqual(calls, [['activate'], ['focus', { preventScroll: true }]]);
  cancel();
});

test('Closing before activation completes prevents focus returning to the closed input', async () => {
  let activateDone, focused = 0;
  const cancel = focusInputAfterActivation(() => ({ focus: () => { focused++; } }),
    () => new Promise(resolve => { activateDone = resolve; }));
  await flush(); cancel(); activateDone(); await flush();
  assert.equal(focused, 0);
});

test('Immediate close cancels native activation; activation failure keeps DOM input usable', async () => {
  let activated = 0, focused = 0;
  const input = () => ({ focus: () => { focused++; } });
  focusInputAfterActivation(input, async () => { activated++; })();
  await flush(); assert.equal(activated, 0); assert.equal(focused, 0);
  focusInputAfterActivation(input, async () => { throw new Error('Native focus unavailable'); });
  await flush(); assert.equal(focused, 1);
});

test('A delayed WebView focus event restores the input and stops after the panel closes', async () => {
  const events = new EventTarget(); let focused = 0;
  const cancel = focusInputAfterActivation(() => ({ focus: () => { focused++; } }), async () => {}, events);
  await flush(); assert.equal(focused, 1);
  events.dispatchEvent(new Event('focus')); assert.equal(focused, 2);
  cancel(); events.dispatchEvent(new Event('focus')); assert.equal(focused, 2);
});
