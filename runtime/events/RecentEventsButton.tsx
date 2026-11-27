import { React } from "../react";
import { H as t, O as api } from "../compat/shared.js";
import { ot as useIslandStore } from "../compat/island-store.js";
import type { RecentEventEntry } from "./recent-events";
import "./recent-events.css";

function formatAge(at: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 45) return t("только что", "just now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t(`${min} мин назад`, `${min}m ago`);
  const hr = Math.floor(min / 60);
  return t(`${hr} ч назад`, `${hr}h ago`);
}

function eventTone(kind: string): "ok" | "warn" | "danger" | "ai" | "info" {
  if (kind === "error") return "danger";
  if (kind === "timer" || kind === "reminder" || kind === "battery") return "warn";
  if (kind === "chat" || kind === "agent" || kind === "agentAsk") return "ai";
  if (kind === "done" || kind === "download" || kind === "screenshot" || kind === "phone" || kind === "shelf") return "ok";
  return "info";
}

function eventCategory(kind: string): string {
  switch (kind) {
    case "download":
    case "shelf":
      return t("Файлы", "Files");
    case "screenshot":
    case "ocr":
    case "qr":
    case "color":
      return t("Захват", "Capture");
    case "phone":
      return t("Телефон", "Phone");
    case "timer":
    case "reminder":
      return t("Время", "Time");
    case "chat":
    case "agent":
    case "agentAsk":
      return t("ИИ", "AI");
    case "vpn":
      return "VPN";
    case "error":
      return t("Внимание", "Alert");
    default:
      return t("Система", "System");
  }
}

function isFileKind(kind: string): boolean {
  return kind === "download" || kind === "shelf" || kind === "screenshot" || kind === "phone" || kind === "ocr" || kind === "qr";
}

function EventGlyph({ kind }: { kind: string }) {
  if (kind === "timer" || kind === "reminder") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 1.5" />
        <path d="M9 2h6" />
      </svg>
    );
  }
  if (kind === "screenshot") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    );
  }
  if (kind === "phone") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  if (kind === "download" || kind === "shelf") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  if (kind === "chat" || kind === "agent" || kind === "agentAsk") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Header button that toggles the in-pill Notifications view (never floats outside the pill). */
export function RecentEventsButton() {
  const count: number = useIslandStore((s: any) => (s.recentEvents ?? []).length);
  const open: boolean = useIslandStore((s: any) => s.overlayView === "events");
  const toggle = useIslandStore((s: any) => s.toggleOverlayView);

  return (
    <button
      type="button"
      data-recent-events-toggle
      data-open={open ? "true" : "false"}
      aria-expanded={open}
      title={t("Уведомления и события", "Notifications & events")}
      onClick={() => toggle?.("events")}
      className="press wi-events-btn"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && <span className="wi-events-badge">{count}</span>}
    </button>
  );
}

/** Full in-pill Notifications center rendered directly inside the expanded island body. */
export function RecentEventsView() {
  const events: RecentEventEntry[] = useIslandStore((s: any) => s.recentEvents ?? []);
  const clear = useIslandStore((s: any) => s.clearRecentEvents);
  const remove = useIslandStore((s: any) => s.removeRecentEvent);
  const closeOverlay = useIslandStore((s: any) => s.closeOverlayView);
  const setTab = useIslandStore((s: any) => s.setTab);
  const closeIsland = useIslandStore((s: any) => s.close);
  const [filter, setFilter] = React.useState<"all" | "files" | "system">("all");
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeOverlay?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closeOverlay]);

  const now = Date.now();
  const visible =
    filter === "all"
      ? events
      : filter === "files"
        ? events.filter((e) => isFileKind(e.kind))
        : events.filter((e) => !isFileKind(e.kind));

  return (
    <div data-recent-events-panel className="wi-events-view">
      <div className="wi-events-topbar">
        <button
          type="button"
          onClick={() => closeOverlay?.()}
          className="press wi-pill-back"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>{t("Назад", "Back")}</span>
        </button>

        <div className="wi-events-title-wrap">
          <span className="wi-events-title">{t("Уведомления", "Notifications")}</span>
          {events.length > 0 && <span className="wi-events-count">{events.length}</span>}
        </div>

        <div className="wi-events-filters">
          {events.length >= 2 &&
            (
              [
                ["all", t("Все", "All")],
                ["files", t("Файлы", "Files")],
                ["system", t("Система", "System")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className="press wi-events-filter"
              >
                {label}
              </button>
            ))}
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => clear?.()}
              className="press wi-events-clear"
            >
              {t("Очистить всё", "Clear all")}
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="wi-events-empty">
          <span className="wi-events-empty-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </span>
          <span className="wi-events-empty-title">
            {t("Новых событий нет", "No new events")}
          </span>
          <span className="wi-events-empty-sub">
            {t(
              "Здесь собираются последние скриншоты, загрузки, файлы с телефона, таймеры, ответы ИИ и уведомления.",
              "Recent screenshots, downloads, phone transfers, timers, AI replies and alerts appear here.",
            )}
          </span>
        </div>
      ) : (
        <div
          className="scroll-thin wi-events-grid"
          data-single={visible.length === 1 ? "true" : "false"}
        >
          {visible.map((item) => {
            const hasActions = Boolean(item.path || item.url || item.copyText || item.tab);
            const tone = eventTone(item.kind);
            return (
              <div key={item.id} className="wi-events-item" data-tone={tone}>
                <span className="wi-events-dot">
                  <EventGlyph kind={item.kind} />
                </span>
                <div className="wi-events-body">
                  <div className="wi-events-meta">
                    <span className="wi-events-cat">{eventCategory(item.kind)}</span>
                    <span className="wi-events-age">· {formatAge(item.at, now)}</span>
                    {remove && (
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        title={t("Скрыть событие", "Dismiss")}
                        aria-label={t("Скрыть событие", "Dismiss")}
                        className="wi-events-dismiss"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="wi-events-item-title">{item.title}</div>
                  {item.sub && <div className="wi-events-sub">{item.sub}</div>}
                  {hasActions && (
                    <div className="wi-events-actions">
                      {item.path && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              closeOverlay?.();
                              closeIsland?.();
                              void api.openPath(item.path!);
                            }}
                            className="press wi-events-act accent"
                          >
                            {t("Открыть", "Open")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeOverlay?.();
                              closeIsland?.();
                              void api.openPath(item.path!, true);
                            }}
                            className="press wi-events-act"
                          >
                            {t("В папке", "Folder")}
                          </button>
                        </>
                      )}
                      {item.url && (
                        <button
                          type="button"
                          onClick={() => {
                            closeOverlay?.();
                            closeIsland?.();
                            void api.openPath(item.url!);
                          }}
                          className="press wi-events-act accent"
                        >
                          {t("Открыть ссылку", "Open link")}
                        </button>
                      )}
                      {item.copyText && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(item.copyText!).catch(() => {});
                            setCopiedId(item.id);
                            setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 1400);
                          }}
                          className="press wi-events-act"
                        >
                          {copiedId === item.id ? t("Скопировано ✓", "Copied ✓") : t("Копировать", "Copy")}
                        </button>
                      )}
                      {item.tab && (
                        <button
                          type="button"
                          onClick={() => {
                            closeOverlay?.();
                            setTab?.(item.tab);
                          }}
                          className="press wi-events-act accent"
                        >
                          {t("Перейти →", "Go →")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
