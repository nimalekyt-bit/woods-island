export interface WebAiStatus {
  service: string;
  target: 'embedded' | 'window';
  phase: 'loading' | 'loaded' | 'error';
  code: number | null;
  navigation: number;
}
export function parseStatus(value: unknown): WebAiStatus | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as WebAiStatus;
  return typeof s.service === 'string' && ['embedded', 'window'].includes(s.target) &&
    ['loading', 'loaded', 'error'].includes(s.phase) && Number.isFinite(s.navigation) &&
    (s.code === null || Number.isInteger(s.code)) ? s : null;
}
export function statusText(status: WebAiStatus | null, slow = false, english = false): string {
  if (status?.phase === 'loaded') return english ? 'Website loaded' : 'Сайт загружен';
  if (status?.phase === 'error') {
    const code = status.code;
    if ([1, 2, 3, 4, 5].includes(code ?? 0)) return english ? 'Secure connection failed. Check the date and network.' : 'Ошибка защищённого соединения. Проверьте дату и сеть.';
    if (code === 7) return english ? 'Website is unreachable. Check your connection or open it in a browser.' : 'Сайт недоступен. Проверьте подключение или откройте его в браузере.';
    return english ? 'Could not load the website. Retry or open it in a browser.' : 'Не удалось загрузить сайт. Повторите попытку или откройте его в браузере.';
  }
  if (slow) return english ? 'Loading is taking longer than usual. You can retry or use a browser.' : 'Загрузка затянулась. Можно повторить попытку или открыть браузер.';
  return english ? 'Loading website…' : 'Загружаю сайт…';
}
