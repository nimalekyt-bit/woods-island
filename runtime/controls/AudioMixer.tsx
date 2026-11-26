import { React } from "../react";
import { invoke } from "../ipc/client";
import { H as t } from "../compat/shared.js";
import { useVisibleControls, holdControl } from "./useVisibleControls";
import { latestWriter } from "./latest-write";
import "./controls.css";

interface AudioApp {
  id: string;
  name: string;
  icon: string | null;
  volume: number;
  muted: boolean;
  peak: number;
  sessions: number;
}
function readApps(value: unknown): AudioApp[] {
  return (Array.isArray(value) ? value : []).filter(
    (app): app is AudioApp =>
      app &&
      typeof app.id === "string" &&
      typeof app.name === "string" &&
      typeof app.volume === "number" &&
      Number.isFinite(app.volume) &&
      app.volume >= 0 &&
      app.volume <= 1 &&
      typeof app.peak === "number" &&
      Number.isFinite(app.peak) &&
      typeof app.muted === "boolean",
  );
}
function MixerRow({ app, refresh }: { app: AudioApp; refresh: () => void }) {
  const alive=React.useRef(true),held=React.useRef(false);
  const hold=(value:boolean)=>{held.current=value;holdControl(value);};
  React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(held.current)holdControl(false);};},[]);
  const [level, setLevel] = React.useState<number | null>(null),
    [muted, setMuted] = React.useState<boolean | null>(null),
    [error, setError] = React.useState(false);
  const writer = React.useMemo(
    () =>
      latestWriter<{ level?: number; mute?: boolean }>(
        async (value) => {
          await invoke("audio_mixer_set", {
            id: app.id,
            level: value.level ?? null,
            mute: value.mute ?? null,
          });
          if(alive.current)setError(false);
        },
        () => {
          setError(true);
          setLevel(null);
          setMuted(null);
          refresh();
        },
      ),
    [app.id, refresh],
  );
  React.useEffect(() => () => writer.dispose(), [writer]);
  React.useEffect(() => {
    setLevel(null);
    setMuted(null);
  }, [app.volume, app.muted]);
  const volume = level ?? app.volume,
    mute = muted ?? app.muted;
  return (
    <div
      data-mixer-app={app.id}
      className="flex items-center gap-2 rounded-lg px-2 py-2"
    >
      {app.icon ? (
        <img src={app.icon} alt="" className="size-6 shrink-0 object-contain" />
      ) : (
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/10 text-[12px]">
          {app.name[0]}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            title={app.name}
            className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink"
          >
            {app.name}
          </span>
          <span className="tabular text-[11px] text-ink-3">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <div className="relative mt-1 flex h-5 items-center">
          <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              data-audio-peak
              style={{ width: `${Math.round(app.peak * 100)}%` }}
              className="h-full bg-emerald-400/50"
            />
          </div>
          <input
            aria-label={t(`Громкость: ${app.name}`, `Volume: ${app.name}`)}
            className="relative h-5 w-full cursor-pointer accent-white"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(volume * 100)}
            onPointerDown={() => hold(true)}
            onChange={(event) => {
              const value = Number(event.target.value) / 100;
              setLevel(value);
              writer.push({ level: value });
            }}
            onPointerUp={() => {
              writer.flush();
              hold(false);
            }}
            onPointerCancel={() => {
              writer.flush();
              hold(false);
            }}
            onKeyUp={() => writer.flush()}
          />
        </div>
        {error && (
          <p role="status" className="text-[11px] text-danger">
            {t(
              "Не удалось изменить звук. Обнови список.",
              "Could not change the audio. Refresh the list.",
            )}
          </p>
        )}
      </div>
      <button
        aria-label={
          mute
            ? t(`Включить звук: ${app.name}`, `Unmute: ${app.name}`)
            : t(`Выключить звук: ${app.name}`, `Mute: ${app.name}`)
        }
        aria-pressed={mute}
        onClick={() => {
          setMuted(!mute);
          writer.push({ level: volume, mute: !mute }, true);
        }}
        className="press grid size-7 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-white/10"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H3v6h3l5 4Z" />
          {mute ? (
            <path d="m16 9 6 6m0-6-6 6" />
          ) : (
            <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
          )}
        </svg>
      </button>
    </div>
  );
}
export function AudioMixer() {
  const toggle = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLElement>(null);
  const active = useVisibleControls(),
    [open, setOpen] = React.useState(false),
    [apps, setApps] = React.useState<AudioApp[] | null>(null),
    [error, setError] = React.useState(false),
    [revision, setRevision] = React.useState(0);
  const refresh = React.useCallback(
    () => setRevision((value) => value + 1),
    [],
  );
  React.useEffect(() => {
    if (!open || !active) return;
    let alive = true,
      first = true,
      timer: ReturnType<typeof setTimeout>;
    const query = async () => {
      try {
        const value = readApps(
          await invoke("audio_mixer_get", { refresh: first }),
        );
        first = false;
        if (alive) {
          setApps((previous) =>
            JSON.stringify(previous) === JSON.stringify(value)
              ? previous
              : value,
          );
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
      if (alive) timer = setTimeout(() => void query(), 350);
    };
    void query();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, active, revision]);
  React.useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  React.useLayoutEffect(() => {
    const button = toggle.current;
    const popup = panel.current;
    const strip = button?.closest<HTMLElement>("[data-volume-strip]");
    const home = strip?.closest<HTMLElement>("[data-home]");
    if (!open || !strip || !home || !popup) return;

    const align = () => {
      const anchor = strip.getBoundingClientRect();
      const bounds = home.getBoundingClientRect();
      const scale = anchor.height / strip.offsetHeight || 1;
      const above = (anchor.top - bounds.top) / scale - 6;
      const below = (bounds.bottom - anchor.bottom) / scale - 6;
      const belowStrip = above < 115 && below > above;
      popup.dataset.placement = belowStrip ? "below" : "above";
      popup.style.maxHeight = `${Math.max(0, belowStrip ? below : above)}px`;
    };
    const observer = new ResizeObserver(align);
    observer.observe(home);
    observer.observe(strip);
    home.addEventListener("scroll", align, { passive: true });
    align();
    return () => {
      observer.disconnect();
      home.removeEventListener("scroll", align);
    };
  }, [open]);
  const close = () => {
    setOpen(false);
    toggle.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <button
        ref={toggle}
        data-audio-mixer-toggle
        title={t("Микшер программ", "Application mixer")}
        aria-label={t("Микшер программ", "Application mixer")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`press grid size-7 shrink-0 place-items-center rounded-lg ${open ? "bg-white/15 text-ink" : "text-ink-2 hover:bg-white/10"}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M5 3v18m7-18v18m7-18v18" />
          <path d="M2 8h6m1 8h6m1-9h6" />
        </svg>
      </button>
      {open && (
        <section
          ref={panel}
          data-audio-mixer
          role="region"
          aria-label={t("Громкость программ", "Application volume")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="flex shrink-0 items-center gap-1 px-2 pb-1 text-[12px] font-semibold text-ink">
            <span className="flex-1">
              {t("Громкость программ", "Application volume")}
            </span>
            <button
              onClick={close}
              aria-label={t("Закрыть", "Close")}
              className="press grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-tile"
            >
              ×
            </button>
          </div>
          <div data-mixer-list className="scroll-none min-h-0 max-h-[220px] overflow-y-auto" tabIndex={0}>
            {apps?.map((app) => (
              <MixerRow key={app.id} app={app} refresh={refresh} />
            ))}
            {!apps && !error && (
              <p className="p-3 text-[12px] text-ink-3">
                {t("Загружаю…", "Loading…")}
              </p>
            )}
            {apps?.length === 0 && (
              <p className="p-3 text-[12px] text-ink-3">
                {t(
                  "Открой программу и включи в ней звук.",
                  "Open an application and play some audio.",
                )}
              </p>
            )}
          </div>
          {error && (
            <button
              onClick={refresh}
              role="status"
              className="p-2 text-left text-[12px] text-danger"
            >
              {t(
                "Не удалось прочитать звук. Попробовать снова",
                "Could not read audio. Try again",
              )}
            </button>
          )}
        </section>
      )}
    </>
  );
}
