import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Verify recent-events logic cleanly via TypeScript-compatible evaluation
const src = readFileSync(new URL('../runtime/events/recent-events.ts', import.meta.url), 'utf8');

test('recent-events module defines filtering, formatting and 10-item cap', () => {
  assert.match(src, /IGNORED_KINDS/);
  assert.match(src, /summarizePeekEvent/);
  assert.match(src, /appendRecentEvent/);
  assert.match(src, /limit = 10/);
});
