export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'upToDate' | 'error';
export interface UpdateState {
  status: UpdatePhase; version: string | null; downloaded: number; total: number | null;
  error: string | null; canInstall: boolean; reason: string | null;
}
export const INITIAL_UPDATE: UpdateState = { status: 'idle', version: null, downloaded: 0, total: null, error: null, canInstall: false, reason: null };
const phases = new Set<UpdatePhase>(['idle', 'checking', 'available', 'downloading', 'ready', 'installing', 'upToDate', 'error']);
export function updateState(value: unknown): UpdateState {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const amount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
  return {
    status: phases.has(data.status as UpdatePhase) ? data.status as UpdatePhase : 'idle',
    version: typeof data.version === 'string' ? data.version : null,
    downloaded: amount(data.downloaded), total: typeof data.total === 'number' && data.total > 0 ? amount(data.total) || null : null,
    error: typeof data.error === 'string' ? data.error : null,
    canInstall: data.canInstall === true, reason: typeof data.reason === 'string' ? data.reason : null,
  };
}
export function updateProgress(state: UpdateState): number | null {
  return state.total ? Math.min(100, Math.max(0, Math.floor(state.downloaded / state.total * 100))) : null;
}
export function updateActions(state: UpdateState) {
  return {
    check: !['checking', 'downloading', 'installing'].includes(state.status),
    download: state.canInstall && ['available', 'error'].includes(state.status) && !!state.version,
    install: state.canInstall && state.status === 'ready',
    cancel: state.status === 'downloading',
    manual: !state.canInstall && state.reason === 'portable',
  };
}
export interface DiagnosticModule { id: string; status: 'ready' | 'notConfigured' | 'unavailable' | 'error'; detail?: string }
export interface DiagnosticSummary {
  version: string; os: string; webview: string; modules: DiagnosticModule[];
  recovery: { kind: string; message: string }[];
}
export function diagnosticSummary(value: unknown): DiagnosticSummary {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const statuses = new Set(['ready', 'notConfigured', 'unavailable', 'error']);
  return { version: text(data.version), os: text(data.os), webview: text(data.webview),
    modules: Array.isArray(data.modules) ? data.modules.filter((v): v is DiagnosticModule => !!v && typeof v.id === 'string' && statuses.has(v.status)).map(v => ({ id: v.id, status: v.status, detail: text(v.detail) })) : [],
    recovery: Array.isArray(data.recovery) ? data.recovery.filter(v => v && typeof v.kind === 'string').map(v => ({kind: text(v.kind), message: text(v.message)})) : [],
  };
}
// Deliberate allowlist: do not copy arbitrary backend fields, paths, error text,
// content, endpoints, device names, credentials or clipboard history to reports.
export function supportReport(summary: DiagnosticSummary): string {
  const version = (value: string) => /^\d+(?:\.\d+){1,4}(?:[-+][0-9A-Za-z.-]+)?$/.test(value) ? value : 'unknown';
  const system = /^Windows(?: [0-9A-Za-z.+ _()-]{0,60})?$/.test(summary.os) ? summary.os : 'Windows';
  const safeModules = new Set(['media', 'yandex', 'obs', 'ai', 'speech', 'stt', 'ffmpeg', 'webview', 'notifications', 'hotkeys', 'agents', 'node', 'clipboard', 'storage', 'pets', 'updater']);
  return [ `Woods Island ${version(summary.version)}`, `OS: ${system}`, `WebView2: ${version(summary.webview)}`,
    ...summary.modules.filter(m => safeModules.has(m.id)).map(m => `${m.id}: ${m.status}`),
    `Recovered files: ${summary.recovery.length}`,
  ].join('\n');
}

export const updateErrors: Record<string, [string, string]> = {
  offline: ['Нет связи с сервером обновлений. Проверь интернет и попробуй ещё раз.', 'Cannot reach the update server. Check your connection and try again.'],
  configuration: ['Обновления для этой сборки не настроены. Открой официальный выпуск.', 'Updates are not configured for this build. Open the official release.'],
  signature: ['Подпись обновления не прошла проверку. Файл не будет установлен.', 'The update signature could not be verified. The file will not be installed.'],
  downloadFailed: ['Не удалось скачать обновление. Можно повторить загрузку.', 'The update could not be downloaded. You can try again.'],
  invalidRelease: ['Выпуск содержит некорректные сведения. Попробуй проверить позже.', 'The release contains invalid information. Try checking again later.'],
  packageTooLarge: ['Размер пакета превышает допустимый. Открой официальный выпуск.', 'The package exceeds the allowed size. Open the official release.'],
  storage: ['Не удалось сохранить обновление. Проверь свободное место и доступ к папке приложения.', 'The update could not be saved. Check free space and access to the app folder.'],
  notInstalled: ['Эта копия обновляется вручную. Открой официальный выпуск.', 'This copy updates manually. Open the official release.'],
  checkFirst: ['Сначала проверь наличие новой версии.', 'Check for a new version first.'],
  downloadFirst: ['Сначала скачай обновление и дождись проверки.', 'Download the update and wait for verification first.'],
  installFailed: ['Не удалось запустить установку. Закрой запись и попробуй ещё раз.', 'Installation could not start. Finish recording and try again.'],
  busy: ['Уже выполняется другая операция с обновлением.', 'Another update operation is already in progress.'],
  cancelled: ['Загрузка отменена. Текущая версия продолжает работать.', 'Download cancelled. Your current version keeps running.'],
};
