// Desktop entry points are separate from the website and Stage previews.
if (window.top !== window) {
  window.stop();
  document.documentElement.replaceChildren();
  throw new Error("Woods desktop cannot run inside an embedded page.");
}
export {};
