import "../frame-guard";
import "../compat/island.js";
import "../web-ai/embedded.css";
import { warmGarlandSprites } from "../holidays/garland-paint";

// Silently pre-warm heavy lazy chunks & sprite atlas while idle after boot so
// the very first open / tab switch never stalls on JS parsing or GPU texture setup.
const warm = () => {
  try { warmGarlandSprites(); } catch {}
  void import("../components/NoteEditorCompat.js").catch(() => {});
};
if (typeof window !== "undefined") {
  window.setTimeout(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(warm, { timeout: 2000 });
    else warm();
  }, 1400);
}
