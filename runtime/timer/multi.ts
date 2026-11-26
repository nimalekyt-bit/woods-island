import { st as createStore } from "../compat/island-store.js";
import { H as t, O as api } from "../compat/shared.js";
import { ot as useIslandStore } from "../compat/island-store.js";
import { timerLabel } from "./model";

export interface ParallelTimer {
  id: string;
  label: string;
  base: number;
  total: number;
  endsAt: number | null;
  left: number | null;
  doneAt: number | null;
}

export interface PomodoroState {
  active: boolean;
  phase: "work" | "break";
  workMs: number;
  breakMs: number;
  cycles: number;
  endsAt: number | null;
  left: number | null;
}

const STORAGE_KEY = "woods_multi_timers_v1";
const MAX_EXTRA_TIMERS = 4; // + 1 primary timer = 5 parallel timers max

export function timerRemainingMs(item: { endsAt: number | null; left: number | null; doneAt?: number | null; base?: number }, now = Date.now()): number {
  if (item.doneAt) return 0;
  if (item.endsAt !== null) return Math.max(0, item.endsAt - now);
  if (item.left !== null) return Math.max(0, item.left);
  return item.base ?? 0;
}

export function formatClockMs(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const DEFAULT_POMODORO: PomodoroState = {
  active: false,
  phase: "work",
  workMs: 25 * 60_000,
  breakMs: 5 * 60_000,
  cycles: 0,
  endsAt: null,
  left: null,
};

function loadSaved(): { extras: ParallelTimer[]; pomodoro: PomodoroState } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { extras: [], pomodoro: { ...DEFAULT_POMODORO } };
    const parsed = JSON.parse(raw);
    const extras: ParallelTimer[] = Array.isArray(parsed?.extras)
      ? parsed.extras.slice(0, MAX_EXTRA_TIMERS).filter((x: any) => x && typeof x.id === "string" && typeof x.base === "number")
      : [];
    const p = parsed?.pomodoro;
    const pomodoro: PomodoroState =
      p && typeof p === "object"
        ? {
            active: p.active === true,
            phase: p.phase === "break" ? "break" : "work",
            workMs: typeof p.workMs === "number" && p.workMs >= 60_000 ? p.workMs : DEFAULT_POMODORO.workMs,
            breakMs: typeof p.breakMs === "number" && p.breakMs >= 60_000 ? p.breakMs : DEFAULT_POMODORO.breakMs,
            cycles: typeof p.cycles === "number" ? p.cycles : 0,
            endsAt: typeof p.endsAt === "number" ? p.endsAt : null,
            left: typeof p.left === "number" ? p.left : null,
          }
        : { ...DEFAULT_POMODORO };
    return { extras, pomodoro };
  } catch {
    return { extras: [], pomodoro: { ...DEFAULT_POMODORO } };
  }
}

function persist(extras: ParallelTimer[], pomodoro: PomodoroState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ extras, pomodoro }));
  } catch {}
}

export interface MultiTimerStoreState {
  extras: ParallelTimer[];
  pomodoro: PomodoroState;
  addExtra: (durationMs: number, label?: string) => void;
  pauseExtra: (id: string) => void;
  resumeExtra: (id: string) => void;
  adjustExtra: (id: string, deltaMs: number) => void;
  removeExtra: (id: string) => void;
  startPomodoro: (workMin?: number, breakMin?: number) => void;
  togglePomodoroPause: () => void;
  skipPomodoroPhase: () => void;
  stopPomodoro: () => void;
  tick: (now?: number) => void;
}

const initial = loadSaved();

export const useMultiTimerStore: any = createStore((set: any, get: any): MultiTimerStoreState => ({
  extras: initial.extras,
  pomodoro: initial.pomodoro,

  addExtra: (durationMs, label = "") => {
    const state: MultiTimerStoreState = get();
    if (state.extras.length >= MAX_EXTRA_TIMERS) return;
    const now = Date.now();
    const clamped = Math.max(10_000, Math.min(86_400_000, Math.round(durationMs)));
    const item: ParallelTimer = {
      id: `mt_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      label: timerLabel(label),
      base: clamped,
      total: clamped,
      endsAt: now + clamped,
      left: null,
      doneAt: null,
    };
    const next = [...state.extras, item];
    set({ extras: next });
    persist(next, state.pomodoro);
  },

  pauseExtra: (id) => {
    const state: MultiTimerStoreState = get();
    const now = Date.now();
    const next = state.extras.map((item) =>
      item.id === id && item.endsAt !== null
        ? { ...item, left: Math.max(1000, item.endsAt - now), endsAt: null }
        : item,
    );
    set({ extras: next });
    persist(next, state.pomodoro);
  },

  resumeExtra: (id) => {
    const state: MultiTimerStoreState = get();
    const now = Date.now();
    const next = state.extras.map((item) =>
      item.id === id && item.left !== null
        ? { ...item, endsAt: now + item.left, left: null, doneAt: null }
        : item,
    );
    set({ extras: next });
    persist(next, state.pomodoro);
  },

  adjustExtra: (id, deltaMs) => {
    const state: MultiTimerStoreState = get();
    const now = Date.now();
    const next = state.extras.map((item) => {
      if (item.id !== id) return item;
      if (item.endsAt !== null) {
        const rem = Math.max(1000, item.endsAt - now + deltaMs);
        return { ...item, endsAt: now + rem, total: Math.max(item.total, rem) };
      }
      if (item.left !== null) {
        const rem = Math.max(1000, item.left + deltaMs);
        return { ...item, left: rem, total: Math.max(item.total, rem) };
      }
      return item;
    });
    set({ extras: next });
    persist(next, state.pomodoro);
  },

  removeExtra: (id) => {
    const state: MultiTimerStoreState = get();
    const next = state.extras.filter((item) => item.id !== id);
    set({ extras: next });
    persist(next, state.pomodoro);
  },

  startPomodoro: (workMin = 25, breakMin = 5) => {
    const state: MultiTimerStoreState = get();
    const now = Date.now();
    const workMs = Math.max(1, Math.min(90, workMin)) * 60_000;
    const breakMs = Math.max(1, Math.min(30, breakMin)) * 60_000;
    const pomodoro: PomodoroState = {
      active: true,
      phase: "work",
      workMs,
      breakMs,
      cycles: 0,
      endsAt: now + workMs,
      left: null,
    };
    set({ pomodoro });
    persist(state.extras, pomodoro);
  },

  togglePomodoroPause: () => {
    const state: MultiTimerStoreState = get();
    const p = state.pomodoro;
    if (!p.active) return;
    const now = Date.now();
    const next: PomodoroState =
      p.endsAt !== null
        ? { ...p, left: Math.max(1000, p.endsAt - now), endsAt: null }
        : { ...p, endsAt: now + (p.left ?? p.workMs), left: null };
    set({ pomodoro: next });
    persist(state.extras, next);
  },

  skipPomodoroPhase: () => {
    const state: MultiTimerStoreState = get();
    const p = state.pomodoro;
    if (!p.active) return;
    const now = Date.now();
    const nextPhase: "work" | "break" = p.phase === "work" ? "break" : "work";
    const nextDur = nextPhase === "work" ? p.workMs : p.breakMs;
    const next: PomodoroState = {
      ...p,
      phase: nextPhase,
      cycles: p.phase === "work" ? p.cycles + 1 : p.cycles,
      endsAt: now + nextDur,
      left: null,
    };
    set({ pomodoro: next });
    persist(state.extras, next);
  },

  stopPomodoro: () => {
    const state: MultiTimerStoreState = get();
    const pomodoro = { ...DEFAULT_POMODORO };
    set({ pomodoro });
    persist(state.extras, pomodoro);
  },

  tick: (now = Date.now()) => {
    const state: MultiTimerStoreState = get();
    let changed = false;

    const nextExtras = state.extras.map((item) => {
      if (item.endsAt !== null && item.endsAt <= now && item.doneAt === null) {
        changed = true;
        try { void api.chime(); } catch {}
        try {
          (useIslandStore as any).getState().pushPeek({
            kind: "timer",
            length: item.base,
            at: now,
            label: item.label || t("Таймер", "Timer"),
          });
        } catch {}
        return { ...item, endsAt: null, left: 0, doneAt: now };
      }
      return item;
    });

    let nextPomodoro = state.pomodoro;
    if (nextPomodoro.active && nextPomodoro.endsAt !== null && nextPomodoro.endsAt <= now) {
      changed = true;
      const wasWork = nextPomodoro.phase === "work";
      const nextPhase: "work" | "break" = wasWork ? "break" : "work";
      const nextDur = nextPhase === "work" ? nextPomodoro.workMs : nextPomodoro.breakMs;
      try { void api.chime(); } catch {}
      try {
        (useIslandStore as any).getState().pushPeek({
          kind: "done",
          label: wasWork
            ? t("Фокус завершён — пора на перерыв 5 мин", "Focus session complete — 5 min break")
            : t("Перерыв окончен — новый раунд фокуса", "Break over — starting next focus round"),
        });
      } catch {}
      nextPomodoro = {
        ...nextPomodoro,
        phase: nextPhase,
        cycles: wasWork ? nextPomodoro.cycles + 1 : nextPomodoro.cycles,
        endsAt: now + nextDur,
        left: null,
      };
    }

    if (changed) {
      set({ extras: nextExtras, pomodoro: nextPomodoro });
      persist(nextExtras, nextPomodoro);
    }
  },
}));

// Global lightweight 1s watcher for parallel timers & Pomodoro
if (typeof window !== "undefined") {
  window.setInterval(() => {
    const s: MultiTimerStoreState = useMultiTimerStore.getState();
    const hasRunning =
      s.extras.some((item) => item.endsAt !== null) ||
      (s.pomodoro.active && s.pomodoro.endsAt !== null);
    if (hasRunning) s.tick(Date.now());
  }, 1000);
}
