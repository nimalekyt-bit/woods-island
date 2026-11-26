// Local presentation only: no chat reads, storage, navigation or network calls.
(() => {
  if (window.top !== window || window.__woodsWebAiSurface) return;
  const allowed = new Set(['gemini.google.com', 'chat.deepseek.com', 'chatgpt.com', 'claude.ai', 'grok.com', 'chat.qwen.ai', '127.0.0.1']);
  let settings = null;
  const render = () => {
    const root = document.documentElement;
    if (!root || !settings) return;
    const id = 'woods-web-ai-surface';
    const isChatGpt = location.hostname === 'chatgpt.com'
      || (location.hostname === '127.0.0.1' && location.pathname === '/chatgpt');
    const embedded = settings.embedded && allowed.has(location.hostname);
    if (!embedded && !isChatGpt) {
      root.removeAttribute('data-woods-ai-theme');
      root.removeAttribute('data-woods-ai-scrollbars');
      document.getElementById(id)?.remove();
      return;
    }
    const light = settings.theme === 'light';
    if (embedded) root.dataset.woodsAiTheme = light ? 'light' : 'dark';
    else root.removeAttribute('data-woods-ai-theme');
    root.dataset.woodsAiScrollbars = 'hidden';
    let style = document.getElementById(id);
    if (!style) { style = document.createElement('style'); style.id = id; (document.head || root).append(style); }
    const scope = 'html[data-woods-ai-theme]';
    const scroll = 'html[data-woods-ai-scrollbars="hidden"]';
    const background = light ? '#f6f6f7' : '#17191c';
    const ink = light ? '#22252c' : '#e8eaf0';
    const css = `
      ${scope} { color-scheme: ${light ? 'light' : 'dark'} !important; background-color: ${background} !important; }
      ${scope} body { background-color: ${background} !important; color: ${ink} !important; }
      ${scroll}, ${scroll} * { scrollbar-width: none !important; scrollbar-gutter: auto !important; }
      ${scroll}::-webkit-scrollbar, ${scroll} *::-webkit-scrollbar { display: none !important; }
    `;
    if (style.textContent !== css) style.textContent = css;
  };
  window.__woodsWebAiSurface = { apply(value) { settings = value; render(); } };
  document.addEventListener('DOMContentLoaded', render, { once: true });
})();
