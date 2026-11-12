// Stable, lazy entry used by native acceptance. No page imports it at startup.
export { ot, A as characterCatalog, k as setCharacterCursor } from './compat/island-store.js';
export { s as lyricsStore } from './compat/home.js';
export { api as O } from './ipc/legacy-api';
export { suspendCharacterAnimations } from './characters/scheduler';
