import { React } from "../react";
import { H as t, O as api } from "../compat/shared.js";
import { ot as useIslandStore } from "../compat/island-store.js";
import type { RecentEventEntry } from "./recent-events";
import "./recent-events.css";

function formatAge(at: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 45) return t("только что", "just now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t(`${min} мин`, `${min}m`);
  const hr = Math.floor(min / 60);
  return t(`${hr} ч`, `${hr}h`);
}

function eventTone(kind: string): "ok" | "warn" | "danger" | "neutral" {
  if (kind === "error") return "danger";
  if (kind === "timer" || kind === "reminder" || kind === "battery") return "warn";
  if (kind === "done" || kind === "download" || kind === "screenshot" || kind === "phone" || kind === "shelf" || kind === "vpn") return "ok";
  return "neutral";
}

function isFileKind(kind: string): boolean {
  return kind === "download" || kind === "shelf" || kind === "screenshot" || kind === "phone" || kind === "ocr" || kind === "qr";
}

function EventGlyph({ kind }: { kind: string }) {
  if (kind === "timer" || kind === "reminder") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 1.5" />
        <path d="M9 2h6" />
      </svg>
    );
  }
  if (kind === "screenshot") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    );
  }
  if (kind === "phone") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }
  if (kind === "download" || kind === "shelf") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  }
  if (kind === "chat" || kind === "agent" || kind === "agentAsk") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>
    );
  }
  if (kind === "ocr") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M7 9h10" />
        <path d="M7 13h10" />
        <path d="M7 17h6" />
      </svg>
    );
  }
  if (kind === "qr") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v3h-3M14 20h6" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      data-has-count={count > 0 ? "true" : "false"}
      aria-expanded={open}
      title={t("Уведомления и события", "Notifications & events")}
      onClick={() => toggle?.("events")}
      className="press wi-events-btn"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.95"
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

/** Full in-pill Notifications center styled identically to native Woods Island peek cards. */
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

  const openPrimary = (item: RecentEventEntry) => {
    if (item.path) {
      closeOverlay?.();
      closeIsland?.();
      void api.openPath(item.path);
    } else if (item.url) {
      closeOverlay?.();
      closeIsland?.();
      void api.openPath(item.url);
    } else if (item.tab) {
      closeOverlay?.();
      setTab?.(item.tab);
    }
  };

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
              {t("Очистить", "Clear")}
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
              "Скриншоты, загрузки, файлы с телефона, таймеры и системные события появляются здесь.",
              "Screenshots, downloads, phone transfers, timers and system notices appear here.",
            )}
          </span>
        </div>
      ) : (
        <div
          className="scroll-thin wi-events-grid"
          data-single={visible.length === 1 ? "true" : "false"}
        >
          {visible.map((item) => {
            const tone = eventTone(item.kind);
            const clickable = Boolean(item.path || item.url || item.tab);
            const isShot = item.kind === "screenshot" && Boolean(item.path);
            return (
              <div
                key={item.id}
                className={`wi-events-item${clickable ? " clickable" : ""}`}
                data-tone={tone}
                onClick={clickable ? () => openPrimary(item) : undefined}
              >
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt=""
                    draggable={false}
                    className="wi-events-thumb"
                  />
                ) : (
                  <span className="wi-events-dot" aria-hidden="true">
                    <EventGlyph kind={item.kind} />
                  </span>
                )}

                <div className="wi-events-body">
                  <div className="wi-events-item-title" title={item.title}>
                    {item.title}
                  </div>
                  {item.sub && (
                    <div className="wi-events-sub" title={item.sub}>
                      {item.sub}
                    </div>
                  )}
                  <div className="wi-events-age">{formatAge(item.at, now)}</div>
                </div>

                <div
                  className="wi-events-icon-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isShot && item.path && (
                    <>
                      <button
                        type="button"
                        title={t("Разметить: стрелки, текст", "Mark up: arrows, text")}
                        aria-label={t("Разметить скриншот", "Mark up screenshot")}
                        onClick={() => {
                          closeOverlay?.();
                          closeIsland?.();
                          void api.editorOpen(item.path!);
                        }}
                        className="press wi-events-icon-btn primary"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title={t("Показать в папке", "Show in folder")}
                        aria-label={t("Показать в папке", "Show in folder")}
                        onClick={() => {
                          closeOverlay?.();
                          closeIsland?.();
                          void api.openPath(item.path!, true);
                        }}
                        className="press wi-events-icon-btn"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                        </svg>
                      </button>
                    </>
                  )}

                  {!isShot && item.path && (
                    <>
                      <button
                        type="button"
                        title={t("Открыть файл", "Open file")}
                        aria-label={t("Открыть файл", "Open file")}
                        onClick={() => {
                          closeOverlay?.();
                          closeIsland?.();
                          void api.openPath(item.path!);
                        }}
                        className="press wi-events-icon-btn primary"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 3h6v6" />
                          <path d="M10 14 21 3" />
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title={t("Показать в папке", "Show in folder")}
                        aria-label={t("Показать в папке", "Show in folder")}
                        onClick={() => {
                          closeOverlay?.();
                          closeIsland?.();
                          void api.openPath(item.path!, true);
                        }}
                        className="press wi-events-icon-btn"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                        </svg>
                      </button>
                    </>
                  )}

                  {item.url && (
                    <button
                      type="button"
                      title={t("Открыть ссылку", "Open link")}
                      aria-label={t("Открыть ссылку", "Open link")}
                      onClick={() => {
                        closeOverlay?.();
                        closeIsland?.();
                        void api.openPath(item.url!);
                      }}
                      className="press wi-events-icon-btn primary"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 17 17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </button>
                  )}

                  {item.copyText && (
                    <button
                      type="button"
                      title={copiedId === item.id ? t("Скопировано", "Copied") : t("Скопировать", "Copy")}
                      aria-label={t("Скопировать", "Copy")}
                      onClick={() => {
                        void navigator.clipboard?.writeText(item.copyText!).catch(() => {});
                        setCopiedId(item.id);
                        setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 1400);
                      }}
                      className={`press wi-events-icon-btn${copiedId === item.id ? " copied" : ""}`}
                    >
                      {copiedId === item.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  )}

                  {!item.path && !item.url && item.tab && (
                    <button
                      type="button"
                      title={t("Открыть раздел", "Open section")}
                      aria-label={t("Открыть раздел", "Open section")}
                      onClick={() => {
                        closeOverlay?.();
                        setTab?.(item.tab);
                      }}
                      className="press wi-events-icon-btn"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>

                {remove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(item.id);
                    }}
                    title={t("Скрыть", "Dismiss")}
                    aria-label={t("Скрыть", "Dismiss")}
                    className="press wi-events-dismiss"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
