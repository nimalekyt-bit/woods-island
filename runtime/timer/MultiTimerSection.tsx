import { React } from "../react";
import { H as t, O as api } from "../compat/shared.js";
import {
  useMultiTimerStore,
  timerRemainingMs,
  formatClockMs,
  type MultiTimerStoreState,
  type ParallelTimer,
  type PomodoroState,
} from "./multi";
import "./multi-timer.css";

export function MultiTimerSection() {
  const extras: ParallelTimer[] = useMultiTimerStore((s: MultiTimerStoreState) => s.extras);
  const pomodoro: PomodoroState = useMultiTimerStore((s: MultiTimerStoreState) => s.pomodoro);
  const addExtra = useMultiTimerStore((s: MultiTimerStoreState) => s.addExtra);
  const pauseExtra = useMultiTimerStore((s: MultiTimerStoreState) => s.pauseExtra);
  const resumeExtra = useMultiTimerStore((s: MultiTimerStoreState) => s.resumeExtra);
  const adjustExtra = useMultiTimerStore((s: MultiTimerStoreState) => s.adjustExtra);
  const removeExtra = useMultiTimerStore((s: MultiTimerStoreState) => s.removeExtra);
  const startPomodoro = useMultiTimerStore((s: MultiTimerStoreState) => s.startPomodoro);
  const togglePomodoroPause = useMultiTimerStore((s: MultiTimerStoreState) => s.togglePomodoroPause);
  const skipPomodoroPhase = useMultiTimerStore((s: MultiTimerStoreState) => s.skipPomodoroPhase);
  const stopPomodoro = useMultiTimerStore((s: MultiTimerStoreState) => s.stopPomodoro);

  const [adding, setAdding] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newMin, setNewMin] = React.useState("5");
  const [, forceTick] = React.useState(0);

  const anyRunning =
    extras.some((item) => item.endsAt !== null) ||
    (pomodoro.active && pomodoro.endsAt !== null);

  React.useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => forceTick((v) => v + 1), 500);
    return () => clearInterval(id);
  }, [anyRunning]);

  const now = Date.now();
  const pomTotal = pomodoro.phase === "work" ? pomodoro.workMs : pomodoro.breakMs;
  const pomLeft = pomodoro.active ? timerRemainingMs(pomodoro, now) : 0;
  const pomPct = pomTotal > 0 ? Math.min(100, Math.max(0, Math.round((1 - pomLeft / pomTotal) * 100))) : 0;

  const submitExtra = () => {
    const mins = parseFloat(newMin.replace(",", "."));
    if (!Number.isFinite(mins) || mins <= 0) return;
    addExtra(mins * 60_000, newLabel.trim());
    setNewLabel("");
    setNewMin("5");
    setAdding(false);
  };

  return (
    <div data-multi-timers className="wi-mt-root">
      {pomodoro.active ? (
        <div className="wi-mt-pomo-active" data-phase={pomodoro.phase}>
          <span className="wi-mt-dot" />
          <div className="wi-mt-pomo-info">
            <div className="wi-mt-pomo-top">
              <span className="wi-mt-pomo-label">
                {pomodoro.phase === "work"
                  ? t(`Фокус #${pomodoro.cycles + 1}`, `Focus #${pomodoro.cycles + 1}`)
                  : t("Перерыв", "Break")}
              </span>
              <span className="wi-mt-pomo-clock">{formatClockMs(pomLeft)}</span>
            </div>
            <div className="wi-mt-track">
              <div className="wi-mt-fill" style={{ width: `${pomPct}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={togglePomodoroPause}
            title={pomodoro.endsAt !== null ? t("Пауза", "Pause") : t("Продолжить", "Resume")}
            className="press wi-mt-mini-btn"
          >
            {pomodoro.endsAt !== null ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            title={t("Следующая фаза", "Next phase")}
            onClick={skipPomodoroPhase}
            className="press wi-mt-mini-btn"
          >
            ⏭
          </button>
          <button
            type="button"
            title={t("Остановить Pomodoro", "Stop Pomodoro")}
            onClick={stopPomodoro}
            className="press wi-mt-mini-btn"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="wi-mt-bar">
          <button
            type="button"
            data-pomodoro-start
            onClick={() => startPomodoro(25, 5)}
            title={t("Запустить режим фокуса Pomodoro (25 мин работа / 5 мин перерыв)", "Start Pomodoro focus (25m work / 5m break)")}
            className="press wi-mt-chip focus"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>{t("Фокус 25/5", "Focus 25/5")}</span>
          </button>
          {extras.length < 4 && !adding && (
            <button
              type="button"
              data-add-extra-timer
              onClick={() => setAdding(true)}
              title={t("Добавить параллельный таймер", "Add a parallel timer")}
              className="press wi-mt-chip"
            >
              <span>+ {t("Таймер", "Timer")} ({extras.length + 1}/5)</span>
            </button>
          )}
        </div>
      )}

      {pomodoro.active && extras.length < 4 && !adding && (
        <button
          type="button"
          data-add-extra-timer
          onClick={() => setAdding(true)}
          className="press wi-mt-chip"
        >
          + {t("Ещё таймер", "Add timer")} ({extras.length + 1}/5)
        </button>
      )}

      {adding && (
        <div className="wi-mt-form">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onMouseDown={() => api.takeFocus()}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitExtra();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder={t("Название…", "Label…")}
            maxLength={32}
            className="wi-mt-input-name"
          />
          <input
            value={newMin}
            onChange={(e) => setNewMin(e.target.value)}
            onMouseDown={() => api.takeFocus()}
            onKeyDown={(e) => e.key === "Enter" && submitExtra()}
            className="wi-mt-input-min"
            title={t("Минуты", "Minutes")}
          />
          <button type="button" onClick={submitExtra} className="press wi-mt-ok">
            OK
          </button>
          <button type="button" onClick={() => setAdding(false)} className="press wi-mt-cancel">
            ×
          </button>
        </div>
      )}

      {extras.length > 0 && (
        <div className="scroll-thin wi-mt-list">
          {extras.map((item) => {
            const rem = timerRemainingMs(item, now);
            const running = item.endsAt !== null;
            const done = item.doneAt !== null;
            return (
              <div
                key={item.id}
                data-extra-timer={item.id}
                data-done={done ? "true" : "false"}
                className="wi-mt-row"
              >
                <span className="wi-mt-row-name" title={item.label || t("Таймер", "Timer")}>
                  {item.label || t("Таймер", "Timer")}
                </span>
                <span className="wi-mt-row-time">
                  {done ? t("Готово", "Done") : formatClockMs(rem)}
                </span>
                {!done && (
                  <>
                    <button
                      type="button"
                      onClick={() => (running ? pauseExtra(item.id) : resumeExtra(item.id))}
                      className="press wi-mt-mini-btn"
                    >
                      {running ? "⏸" : "▶"}
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExtra(item.id, 60_000)}
                      className="press wi-mt-mini-btn"
                      title={t("+1 минута", "+1 minute")}
                    >
                      +1м
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => removeExtra(item.id)}
                  className="press wi-mt-mini-btn"
                  title={t("Удалить", "Remove")}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
