export interface RecentEventEntry {
  id: number;
  kind: string;
  at: number;
  title: string;
  sub?: string;
  path?: string;
  copyText?: string;
  url?: string;
  tab?: string;
}

const IGNORED_KINDS = new Set([
  "volume",
  "layout",
  "caps",
  "micMuted",
  "device",
  "copied",
  "pro",
]);

export function summarizePeekEvent(
  peek: Record<string, any>,
  id: number,
  now = Date.now(),
  en = false,
): RecentEventEntry | null {
  if (!peek || typeof peek.kind !== "string" || IGNORED_KINDS.has(peek.kind)) {
    return null;
  }
  const t = (ru: string, english: string) => (en ? english : ru);
  switch (peek.kind) {
    case "download": {
      const f = peek.file || {};
      return {
        id,
        kind: "download",
        at: now,
        title: f.name || t("Загрузка завершена", "Download complete"),
        sub: t("Скачанный файл", "Downloaded file"),
        path: typeof f.path === "string" ? f.path : undefined,
      };
    }
    case "screenshot":
      return {
        id,
        kind: "screenshot",
        at: now,
        title: t("Скриншот сохранён", "Screenshot saved"),
        sub: peek.width && peek.height ? `${peek.width}×${peek.height}` : undefined,
        path: typeof peek.path === "string" ? peek.path : undefined,
      };
    case "ocr":
      return {
        id,
        kind: "ocr",
        at: now,
        title: t("Текст с экрана (OCR)", "Screen text (OCR)"),
        sub: String(peek.text || "").slice(0, 80),
        copyText: typeof peek.text === "string" ? peek.text : undefined,
      };
    case "qr":
      return {
        id,
        kind: "qr",
        at: now,
        title: t("QR-код распознан", "QR code scanned"),
        sub: String(peek.text || peek.url || "").slice(0, 80),
        url: typeof peek.url === "string" ? peek.url : undefined,
        copyText: typeof peek.text === "string" ? peek.text : undefined,
      };
    case "color":
      return {
        id,
        kind: "color",
        at: now,
        title: t(`Цвет ${peek.hex || ""}`, `Color ${peek.hex || ""}`),
        sub: typeof peek.rgb === "string" ? peek.rgb : undefined,
        copyText: typeof peek.hex === "string" ? peek.hex : undefined,
      };
    case "timer":
      return {
        id,
        kind: "timer",
        at: now,
        title: peek.label
          ? t(`Таймер: ${peek.label}`, `Timer: ${peek.label}`)
          : t("Таймер завершён", "Timer finished"),
        sub: t("Время вышло", "Time is up"),
        tab: "home",
      };
    case "reminder":
      return {
        id,
        kind: "reminder",
        at: now,
        title: t("Напоминание", "Reminder"),
        sub: String(peek.text || "").slice(0, 80),
        tab: "home",
      };
    case "chat":
      return {
        id,
        kind: "chat",
        at: now,
        title: t("Ответ ИИ", "AI reply"),
        sub: String(peek.text || "").slice(0, 80),
        copyText: typeof peek.text === "string" ? peek.text : undefined,
        tab: "chat",
      };
    case "notification": {
      const note = peek.note || {};
      return {
        id,
        kind: "notification",
        at: now,
        title: note.app || note.title || t("Уведомление", "Notification"),
        sub: String(note.body || note.title || "").slice(0, 80),
        copyText: typeof note.body === "string" ? note.body : undefined,
      };
    }
    case "phone":
      return {
        id,
        kind: "phone",
        at: now,
        title:
          peek.direction === "received"
            ? t("Получено с телефона", "Received from phone")
            : t("Забрано на телефон", "Sent to phone"),
        sub: String(peek.name || peek.text || "").slice(0, 80),
        copyText: typeof peek.text === "string" ? peek.text : undefined,
        tab: "shelf",
      };
    case "shelf":
      return {
        id,
        kind: "shelf",
        at: now,
        title: t("Положено на полку", "Added to shelf"),
        sub: String(peek.name || "").slice(0, 80),
        tab: "shelf",
      };
    case "agent":
    case "agentAsk":
      return {
        id,
        kind: peek.kind,
        at: now,
        title: peek.agent?.name || peek.ask?.agent || t("ИИ-агент", "AI agent"),
        sub: String(peek.agent?.message || peek.ask?.message || "").slice(0, 80),
      };
    case "vpn":
      return {
        id,
        kind: "vpn",
        at: now,
        title: peek.vpn?.active ? t("VPN подключён", "VPN connected") : t("VPN отключён", "VPN disconnected"),
        sub: peek.vpn?.ip || peek.vpn?.country || undefined,
        tab: "controls",
      };
    case "done":
      return {
        id,
        kind: "done",
        at: now,
        title: String(peek.label || t("Готово", "Done")).slice(0, 80),
      };
    case "error":
      return {
        id,
        kind: "error",
        at: now,
        title: t("Ошибка", "Error"),
        sub: String(peek.message || "").slice(0, 80),
      };
    default:
      return null;
  }
}

export function appendRecentEvent(
  list: RecentEventEntry[],
  entry: RecentEventEntry | null,
  limit = 10,
): RecentEventEntry[] {
  if (!entry) return list;
  return [entry, ...list.filter((item) => item.id !== entry.id)].slice(0, limit);
}
