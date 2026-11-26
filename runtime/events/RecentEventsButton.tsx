import { React } from "../react";
import { H as t, O as api } from "../compat/shared.js";
import { ot as useIslandStore } from "../compat/island-store.js";
import type { RecentEventEntry } from "./recent-events";

function formatAge(at: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000));
  if (sec < 45) return t("сейчас", "now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t(`${min} мин`, `${min}m`);
  const hr = Math.floor(min / 60);
  return t(`${hr} ч`, `${hr}h`);
}

export function RecentEventsButton() {
  const events: RecentEventEntry[] = useIslandStore((s: any) => s.recentEvents ?? []);
  const clear = useIslandStore((s: any) => s.clearRecentEvents);
  const setTab = useIslandStore((s: any) => s.setTab);
  const closeIsland = useIslandStore((s: any) => s.close);
  const [open, setOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const now = Date.now();
  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        data-recent-events-toggle
        aria-expanded={open}
        title={t("Последние события", "Recent events")}
        onClick={() => setOpen((v) => !v)}
        className={`press relative grid size-7 place-items-center rounded-lg transition-colors ${open ? "bg-white/15 text-ink" : "text-ink-3 hover:bg-white/10 hover:text-ink"}`}
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
        {events.length > 0 && (
          <span className="pointer-events-none absolute -top-0.5 -right-0.5 grid min-w-[14px] place-items-center rounded-full bg-[#8ea2ff] px-1 text-[9px] leading-[14px] font-bold text-[#0b0d14]">
            {events.length}
          </span>
        )}
      </button>
      {open && (
        <div
          data-recent-events-panel
          className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-[310px] flex-col overflow-hidden rounded-2xl bg-[#16171d]/95 p-2 shadow-2xl ring-1 ring-white/12 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-[11.5px] font-semibold text-ink">
              {t("Последние события", "Recent events")}
            </span>
            {events.length > 0 && (
              <button
                type="button"
                onClick={() => clear?.()}
                className="press rounded-md px-1.5 py-0.5 text-[10.5px] text-ink-3 hover:bg-white/8 hover:text-ink"
              >
                {t("Очистить", "Clear")}
              </button>
            )}
          </div>
          <div className="scroll-thin flex max-h-[215px] flex-col gap-1 overflow-y-auto">
            {events.length === 0 ? (
              <div className="px-3 py-5 text-center text-[11.5px] text-ink-3">
                {t(
                  "Пока тихо. Здесь появятся последние загрузки, скриншоты, таймеры, ответы ИИ и уведомления.",
                  "Quiet so far. Recent downloads, screenshots, timers, AI replies and alerts will appear here.",
                )}
              </div>
            ) : (
              events.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 hover:bg-white/[0.07]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-3">
                        {formatAge(item.at, now)}
                      </span>
                    </div>
                    {item.sub && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-3">
                        {item.sub}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.path && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              closeIsland?.();
                              void api.openPath(item.path!);
                            }}
                            className="press rounded-md bg-white/10 px-2 py-0.5 text-[10.5px] text-ink hover:bg-white/15"
                          >
                            {t("Открыть", "Open")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              closeIsland?.();
                              void api.openPath(item.path!, true);
                            }}
                            className="press rounded-md bg-white/6 px-2 py-0.5 text-[10.5px] text-ink-2 hover:bg-white/12 hover:text-ink"
                          >
                            {t("В папке", "Folder")}
                          </button>
                        </>
                      )}
                      {item.url && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            closeIsland?.();
                            void api.openPath(item.url!);
                          }}
                          className="press rounded-md bg-white/10 px-2 py-0.5 text-[10.5px] text-ink hover:bg-white/15"
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
                          className="press rounded-md bg-white/8 px-2 py-0.5 text-[10.5px] text-ink-2 hover:bg-white/15 hover:text-ink"
                        >
                          {copiedId === item.id ? t("Скопировано", "Copied") : t("Копировать", "Copy")}
                        </button>
                      )}
                      {item.tab && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            setTab?.(item.tab);
                          }}
                          className="press rounded-md bg-[#8ea2ff]/18 px-2 py-0.5 text-[10.5px] text-[#c8d4ff] hover:bg-[#8ea2ff]/28"
                        >
                          {t("Перейти", "Go")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
