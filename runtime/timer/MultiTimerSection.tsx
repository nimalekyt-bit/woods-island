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
    <div data-multi-timers className="mt-1 flex flex-col gap-1.5 border-t border-white/[0.07] pt-2">
      {/* Pomodoro Focus bar */}
      <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.045] px-2.5 py-1.5">
        {pomodoro.active ? (
          <>
            <span
              className={`size-2 shrink-0 rounded-full ${pomodoro.phase === "work" ? "bg-[#8ea2ff]" : "bg-[#6be2a8]"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                <span>
                  {pomodoro.phase === "work"
                    ? t(`Фокус #${pomodoro.cycles + 1}`, `Focus #${pomodoro.cycles + 1}`)
                    : t("Перерыв", "Break")}
                </span>
                <span className="tabular font-semibold text-[#b8c7ff]">
                  {formatClockMs(pomLeft)}
                </span>
              </div>
              <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${pomodoro.phase === "work" ? "bg-[#8ea2ff]" : "bg-[#6be2a8]"}`}
                  style={{ width: `${pomPct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={togglePomodoroPause}
              className="press rounded-md bg-white/8 px-2 py-0.5 text-[10.5px] text-ink hover:bg-white/15"
            >
              {pomodoro.endsAt !== null ? t("Пауза", "Pause") : t("Пуск", "Go")}
            </button>
            <button
              type="button"
              title={t("Следующая фаза", "Next phase")}
              onClick={skipPomodoroPhase}
              className="press rounded-md bg-white/6 px-1.5 py-0.5 text-[10.5px] text-ink-2 hover:bg-white/12 hover:text-ink"
            >
              ⏭
            </button>
            <button
              type="button"
              title={t("Остановить Pomodoro", "Stop Pomodoro")}
              onClick={stopPomodoro}
              className="press rounded-md bg-white/6 px-1.5 py-0.5 text-[10.5px] text-ink-3 hover:bg-white/12 hover:text-ink"
            >
              ×
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-[11px] text-ink-2">
              {t("Режим фокуса (Pomodoro 25/5)", "Focus mode (Pomodoro 25/5)")}
            </span>
            <button
              type="button"
              data-pomodoro-start
              onClick={() => startPomodoro(25, 5)}
              className="press rounded-full bg-[#8ea2ff]/20 px-2.5 py-0.5 text-[10.5px] font-medium text-[#c8d4ff] hover:bg-[#8ea2ff]/30"
            >
              {t("Старт", "Start")}
            </button>
          </>
        )}
      </div>

      {/* Extra parallel timers list */}
      {extras.map((item) => {
        const rem = timerRemainingMs(item, now);
        const running = item.endsAt !== null;
        const done = item.doneAt !== null;
        return (
          <div
            key={item.id}
            data-extra-timer={item.id}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-[11px]"
          >
            <span className={`min-w-0 flex-1 truncate font-medium ${done ? "text-timer" : "text-ink"}`}>
              {item.label || t("Таймер", "Timer")}
            </span>
            <span className={`tabular font-semibold ${done ? "text-timer" : "text-ink-2"}`}>
              {done ? t("Готово", "Done") : formatClockMs(rem)}
            </span>
            {!done && (
              <>
                <button
                  type="button"
                  onClick={() => (running ? pauseExtra(item.id) : resumeExtra(item.id))}
                  className="press rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-ink hover:bg-white/15"
                >
                  {running ? "⏸" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={() => adjustExtra(item.id, 60_000)}
                  className="press rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-ink-2 hover:bg-white/12 hover:text-ink"
                >
                  +1м
                </button>
                <button
                  type="button"
                  onClick={() => adjustExtra(item.id, 300_000)}
                  className="press rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-ink-2 hover:bg-white/12 hover:text-ink"
                >
                  +5м
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => removeExtra(item.id)}
              className="press rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-ink-3 hover:bg-white/12 hover:text-ink"
            >
              ×
            </button>
          </div>
        );
      })}

      {/* Add parallel timer button / form */}
      {extras.length < 4 && (
        adding ? (
          <div className="flex items-center gap-1">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onMouseDown={() => api.takeFocus()}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitExtra();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder={t("Название (чай, билд…)", "Label (tea, build…)")}
              maxLength={32}
              className="h-7 min-w-0 flex-1 rounded-lg bg-tile px-2 text-[11px] text-ink outline-none placeholder:text-ink-3"
            />
            <input
              value={newMin}
              onChange={(e) => setNewMin(e.target.value)}
              onMouseDown={() => api.takeFocus()}
              onKeyDown={(e) => e.key === "Enter" && submitExtra()}
              className="h-7 w-11 rounded-lg bg-tile px-1.5 text-center text-[11px] text-ink outline-none"
              title={t("Минуты", "Minutes")}
            />
            <button
              type="button"
              onClick={submitExtra}
              className="press h-7 rounded-lg bg-[#8ea2ff]/25 px-2.5 text-[11px] font-medium text-white hover:bg-[#8ea2ff]/35"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="press h-7 rounded-lg bg-white/6 px-2 text-[11px] text-ink-3 hover:text-ink"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-add-extra-timer
            onClick={() => setAdding(true)}
            className="press self-start rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10.5px] text-ink-2 hover:bg-white/12 hover:text-ink"
          >
            + {t("Ещё таймер", "Add timer")} ({extras.length + 1}/5)
          </button>
        )
      )}
    </div>
  );
}
