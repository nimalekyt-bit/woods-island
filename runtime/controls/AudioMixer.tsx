import { React } from "../react";
import { invoke } from "../ipc/client";
import { H as t } from "../compat/shared.js";
import { ot as useIslandStore } from "../compat/island-store.js";
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

function formatAppName(app: AudioApp): string {
  if (app.id === "system" || app.name === "System Sounds" || app.name.startsWith("@%")) {
    return t("Системные звуки", "System Sounds");
  }
  return app.name;
}

function DeviceGlyph({ name, input }: { name: string; input: boolean }) {
  if (input) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    );
  }
  const low = name.toLowerCase();
  if (/hdmi|display|monitor|монитор|\blg\b|samsung|benq|asus|nvidia|amd/.test(low)) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  if (/head|наушн|airpods|earbuds|earphones|buds|hyperx|cloud|гарнитур|jbl|sony wh|logitech g/.test(low)) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MixerRow({ app, refresh }: { app: AudioApp; refresh: () => void }) {
  const alive = React.useRef(true),
    held = React.useRef(false);
  const hold = (value: boolean) => {
    held.current = value;
    holdControl(value);
  };
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (held.current) holdControl(false);
    };
  }, []);
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
          if (alive.current) setError(false);
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
    mute = muted ?? app.muted,
    pct = Math.round(volume * 100),
    peakPct = Math.round(Math.min(volume, app.peak) * 100),
    displayName = formatAppName(app),
    isSystem = app.id === "system" || app.name === "System Sounds" || app.name.startsWith("@%"),
    isAudible = !mute && app.peak > 0.02;

  return (
    <div data-mixer-app={app.id} data-muted={mute ? "true" : "false"}>
      <span className={`wi-mixer-icon-wrap${isSystem ? " system" : ""}`} aria-hidden="true">
        {app.icon ? (
          <img src={app.icon} alt="" />
        ) : isSystem ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          displayName[0]
        )}
        {isAudible && <span className="wi-mixer-live-dot" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            title={displayName}
            className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink"
          >
            {displayName}
          </span>
          <span className="tabular text-[11px] font-semibold text-ink-2">
            {mute ? t("Выкл", "Muted") : `${pct}%`}
          </span>
        </div>
        <div className="wi-mixer-slider-box">
          <div className="wi-mixer-track">
            <div className="wi-mixer-fill" style={{ width: `${pct}%` }} />
            <div
              data-audio-peak
              className="wi-mixer-peak-bar"
              style={{ width: `${mute ? 0 : peakPct}%` }}
            />
          </div>
          <input
            aria-label={t(`Громкость: ${displayName}`, `Volume: ${displayName}`)}
            className="relative h-5 w-full cursor-pointer"
            type="range"
            min="0"
            max="100"
            step="1"
            value={pct}
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
            ? t(`Включить звук: ${displayName}`, `Unmute: ${displayName}`)
            : t(`Выключить звук: ${displayName}`, `Mute: ${displayName}`)
        }
        aria-pressed={mute}
        onClick={() => {
          setMuted(!mute);
          writer.push({ level: volume, mute: !mute }, true);
        }}
        className="press wi-mixer-mute-btn"
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

interface AudioEndpoint {
  id: string;
  name: string;
  default: boolean;
}

function readEndpoints(value: unknown): AudioEndpoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.name !== "string") return [];
    return [{ id: e.id, name: e.name, default: e.default === true }];
  });
}

/** Button inside the Home volume strip that switches the pill body to AudioMixerView. */
export function AudioMixer() {
  const open: boolean = useIslandStore((s: any) => s.overlayView === "audio");
  const toggle = useIslandStore((s: any) => s.toggleOverlayView);

  return (
    <button
      type="button"
      data-audio-mixer-toggle
      title={t("Микшер и устройства звука", "Mixer & audio devices")}
      aria-label={t("Микшер и устройства звука", "Mixer & audio devices")}
      aria-expanded={open}
      onClick={() => toggle?.("audio")}
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
  );
}

/** Full in-pill Audio Mixer & Output/Mic Switcher rendered directly inside the expanded island. */
export function AudioMixerView() {
  const closeOverlay = useIslandStore((s: any) => s.closeOverlayView);
  const active = useVisibleControls();
  const [mode, setMode] = React.useState<"apps" | "outputs" | "inputs">("apps");
  const [apps, setApps] = React.useState<AudioApp[] | null>(null);
  const [outputs, setOutputs] = React.useState<AudioEndpoint[] | null>(null);
  const [inputs, setInputs] = React.useState<AudioEndpoint[] | null>(null);
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const [revision, setRevision] = React.useState(0);

  const refresh = React.useCallback(
    () => setRevision((value) => value + 1),
    [],
  );

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

  React.useEffect(() => {
    if (!active || mode === "apps") return;
    let alive = true;
    const cmd = mode === "outputs" ? "audio_devices" : "audio_inputs";
    void invoke(cmd)
      .then((res) => {
        if (!alive) return;
        const list = readEndpoints(res);
        if (mode === "outputs") setOutputs(list);
        else setInputs(list);
        setError(false);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [active, mode, revision]);

  const pickDevice = async (id: string) => {
    setSwitchingId(id);
    try {
      await invoke("audio_set_default", { id });
      refresh();
    } catch {
      setError(true);
    } finally {
      setSwitchingId(null);
    }
  };

  React.useEffect(() => {
    if (!active || mode !== "apps") return;
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
  }, [active, mode, revision]);

  const activeList = mode === "outputs" ? outputs : inputs;
  const itemCount = mode === "apps" ? (apps?.length ?? 0) : (activeList?.length ?? 0);

  return (
    <section
      data-audio-mixer
      role="region"
      aria-label={t("Микшер и аудиоустройства", "Audio mixer & devices")}
    >
      <div className="wi-mixer-head">
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

        <div className="wi-mixer-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "apps"}
            data-audio-tab="apps"
            onClick={() => setMode("apps")}
            className="press wi-mixer-tab"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true">
              <path d="M5 3v18m7-18v18m7-18v18M2 8h6m1 8h6m1-9h6" />
            </svg>
            <span>{t("Микшер", "Mixer")}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "outputs"}
            data-audio-tab="outputs"
            onClick={() => setMode("outputs")}
            className="press wi-mixer-tab"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
            </svg>
            <span>{t("Вывод", "Output")}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "inputs"}
            data-audio-tab="inputs"
            onClick={() => setMode("inputs")}
            className="press wi-mixer-tab"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>{t("Микрофон", "Mic")}</span>
          </button>
        </div>

        <button type="button" onClick={refresh} className="press wi-mixer-refresh" title={t("Обновить", "Refresh")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          <span>{t("Обновить", "Refresh")}</span>
        </button>
      </div>

      <div
        data-mixer-list
        className="scroll-thin wi-mixer-list"
        data-single={itemCount <= 1 ? "true" : "false"}
        tabIndex={0}
      >
        {mode === "apps" ? (
          <>
            {apps?.map((app) => (
              <MixerRow key={app.id} app={app} refresh={refresh} />
            ))}
            {!apps && !error && (
              <div className="wi-mixer-empty">
                {t("Загружаю программы…", "Loading applications…")}
              </div>
            )}
            {apps?.length === 0 && (
              <div className="wi-mixer-empty">
                {t(
                  "Открой программу и включи в ней звук.",
                  "Open an application and play some audio.",
                )}
              </div>
            )}
          </>
        ) : !activeList ? (
          <div className="wi-mixer-empty">
            {t("Загружаю устройства…", "Loading devices…")}
          </div>
        ) : activeList.length === 0 ? (
          <div className="wi-mixer-empty">
            {t("Устройства не найдены.", "No devices found.")}
          </div>
        ) : (
          activeList.map((dev) => (
            <button
              key={dev.id}
              type="button"
              data-audio-endpoint={dev.id}
              aria-pressed={dev.default}
              disabled={switchingId === dev.id}
              onClick={() => void pickDevice(dev.id)}
              className="press wi-mixer-endpoint"
            >
              <span className="wi-mixer-dev-ico">
                <DeviceGlyph name={dev.name} input={mode === "inputs"} />
              </span>
              <span className="wi-mixer-dev-copy">
                <span className="wi-mixer-dev-name">{dev.name}</span>
                {dev.default && (
                  <span className="wi-mixer-dev-sub">
                    {t("Устройство по умолчанию", "Default device")}
                  </span>
                )}
              </span>
              {dev.default && (
                <span className="wi-mixer-check" aria-hidden="true">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {error && (
        <button
          onClick={refresh}
          role="status"
          className="p-1 text-left text-[12px] text-danger"
        >
          {t(
            "Не удалось прочитать звук. Попробовать снова",
            "Could not read audio. Try again",
          )}
        </button>
      )}
    </section>
  );
}
