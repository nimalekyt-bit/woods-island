import { React } from "../react";
import type { CSSProperties } from "react";
import { invoke } from "../ipc/client";
import { H as t } from "../compat/shared.js";
import { useVisibleControls, holdControl } from "./useVisibleControls";
import { latestWriter } from "./latest-write";
interface Monitor {
  id: string;
  name: string;
  level: number | null;
}
function readMonitors(value: unknown): Monitor[] {
  return (Array.isArray(value) ? value : []).filter(
    (monitor): monitor is Monitor =>
      monitor &&
      typeof monitor.id === "string" &&
      typeof monitor.name === "string" &&
      (monitor.level === null || (typeof monitor.level === "number" &&
      Number.isFinite(monitor.level) &&
      monitor.level >= 0 &&
      monitor.level <= 100)),
  );
}
function MonitorRow({ monitor, named }: { monitor: Monitor; named: boolean }) {
  const alive = React.useRef(true),
    held = React.useRef(false);
  const hold = (value: boolean) => {
    if (held.current === value) return;
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
  const available = monitor.level !== null;
  const [level, setLevel] = React.useState(monitor.level ?? 0),
    [error, setError] = React.useState(false);
  const writer = React.useMemo(
    () =>
      latestWriter<number>(
        async (value) => {
          await invoke("brightness_set", { id: monitor.id, level: value });
          if (alive.current) setError(false);
        },
        () => { if (alive.current) setError(true); },
        180,
      ),
    [monitor.id],
  );
  React.useEffect(() => () => writer.dispose(), [writer]);
  React.useEffect(() => {
    if(monitor.level !== null && !held.current&&!writer.isBusy())setLevel(monitor.level);
  }, [monitor.level,writer]);
  return (
    <div data-monitor-brightness={monitor.id} className="wi-brightness-row">
      <span
        className="wi-brightness-caption"
        title={
          !available
            ? t("Яркость недоступна. Проверь DDC/CI в меню монитора.", "Brightness unavailable. Check DDC/CI in the monitor menu.")
            : error
            ? t(
                "Монитор не принял яркость. Попробуй ещё раз.",
                "The monitor did not accept this brightness. Try again.",
              )
            : monitor.name
        }
      >
        <span className={error ? "text-danger" : ""}>
          {error && available
            ? t("Не удалось", "Failed")
            : named
              ? monitor.name
              : t("Яркость", "Brightness")}
        </span>
        <span className="tabular">{available ? `${level}%` : "—"}</span>
      </span>
      {available ? <input
        aria-label={t(
          `Яркость: ${monitor.name}`,
          `Brightness: ${monitor.name}`,
        )}
        type="range"
        min="0"
        max="100"
        value={level}
        className="wi-brightness-slider"
        style={{ "--brightness-level": `${level}%` } as CSSProperties}
        onChange={(event) => {
          const value = Number(event.target.value);
          setLevel(value);
          writer.push(value);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          hold(true);
        }}
        onPointerUp={(event) => {
          writer.flush();
          hold(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          writer.flush();
          hold(false);
        }}
        onLostPointerCapture={() => {
          writer.flush();
          hold(false);
        }}
        onKeyUp={() => writer.flush()}
        onBlur={() => {
          writer.flush();
          hold(false);
        }}
        onWheel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const value = Math.max(
            0,
            Math.min(100, level + (event.deltaY < 0 ? 5 : -5)),
          );
          setLevel(value);
          writer.push(value, true);
        }}
      /> : <span className="wi-brightness-unavailable">{t("Недоступно", "Unavailable")}</span>}
    </div>
  );
}
export function BrightnessControls() {
  const active = useVisibleControls("controls"),
    [monitors, setMonitors] = React.useState<Monitor[] | null>(null),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(false),
    [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    let alive = true;
    let reading = false;
    const refresh = () => {
    if (reading) return Promise.resolve();
    reading = true;
    setBusy(true);
    return invoke("brightness_get", {})
      .then((value) => {
        if (alive) {
          setMonitors(readMonitors(value));
          setError(false);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        reading = false;
        if (alive) setBusy(false);
      });
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, revision]);
  return (
    <section
      data-brightness-controls
      className="wi-brightness-controls bg-tile"
      title={
        monitors?.length === 0
          ? t(
              "Монитор не сообщает яркость. Проверь DDC/CI в его меню.",
              "The monitor does not report brightness. Check DDC/CI in its menu.",
            )
          : undefined
      }
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="wi-brightness-sun"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </svg>
      <div className="wi-brightness-monitors">
        {monitors?.map((monitor) => (
          <MonitorRow
            key={`${monitor.id}:${revision}`}
            monitor={monitor}
            named={monitors.length > 1}
          />
        ))}
        {!monitors && !error && (
          <p className="wi-brightness-empty">
            {t("Яркость · проверяю…", "Brightness · checking…")}
          </p>
        )}
        {monitors?.length === 0 && (
          <p className="wi-brightness-empty">
            {t("Яркость недоступна", "Brightness unavailable")}
          </p>
        )}
        {error && (
          <p role="status" className="wi-brightness-empty text-danger">
            {t("Монитор не ответил", "Monitor did not respond")}
          </p>
        )}
      </div>
      <button
        aria-label={t("Обновить мониторы", "Refresh monitors")}
        disabled={busy}
        onClick={() => setRevision((value) => value + 1)}
        className="press wi-brightness-refresh"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5" />
        </svg>
      </button>
    </section>
  );
}
