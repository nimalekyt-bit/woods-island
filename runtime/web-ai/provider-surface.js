// Local presentation only: no chat reads, storage, navigation or network calls.
(() => {
  if (window.top !== window || window.__woodsWebAiSurface) return;
  const allowed = new Set(['gemini.google.com', 'chat.deepseek.com', 'chatgpt.com', 'claude.ai', 'grok.com', 'chat.qwen.ai', '127.0.0.1']);
  let settings = null;
  const render = () => {
    const root = document.documentElement;
    if (!root || !settings) return;
    const id = 'woods-web-ai-surface';
    if (!settings.embedded || !allowed.has(location.hostname)) {
      root.removeAttribute('data-woods-ai-theme');
      document.getElementById(id)?.remove();
      return;
    }
    const light = settings.theme === 'light';
    root.dataset.woodsAiTheme = light ? 'light' : 'dark';
    let style = document.getElementById(id);
    if (!style) { style = document.createElement('style'); style.id = id; (document.head || root).append(style); }
    const scope = 'html[data-woods-ai-theme]';
    const background = light ? '#f6f6f7' : '#17191c';
    const ink = light ? '#22252c' : '#e8eaf0';
    const thumb = light ? '#9399a7' : '#666d7c';
    const hover = light ? '#757d8e' : '#8c95a6';
    style.textContent = `
      ${scope} { color-scheme: ${light ? 'light' : 'dark'} !important; background-color: ${background} !important; }
      ${scope} body { background-color: ${background} !important; color: ${ink} !important; }
      ${scope}, ${scope} * { scrollbar-color: auto !important; scrollbar-width: auto !important; }
      ${scope}::-webkit-scrollbar, ${scope} *::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
      ${scope}::-webkit-scrollbar-track, ${scope} *::-webkit-scrollbar-track { background: transparent !important; }
      ${scope}::-webkit-scrollbar-thumb, ${scope} *::-webkit-scrollbar-thumb { background-color: ${thumb} !important; background-clip: padding-box !important; border: 2px solid transparent !important; border-radius: 999px !important; min-height: 28px !important; }
      ${scope}::-webkit-scrollbar-thumb:hover, ${scope} *::-webkit-scrollbar-thumb:hover { background-color: ${hover} !important; }
      ${scope}::-webkit-scrollbar-corner, ${scope} *::-webkit-scrollbar-corner { background: transparent !important; }
      ${scope}::-webkit-scrollbar-button, ${scope} *::-webkit-scrollbar-button { display: none !important; }
    `;
  };
  window.__woodsWebAiSurface = { apply(value) { settings = value; render(); } };
  document.addEventListener('DOMContentLoaded', render, { once: true });
})();
