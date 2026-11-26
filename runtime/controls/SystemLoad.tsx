import { React } from "../react";
import { invoke } from "../ipc/client";
import { ot as useIslandStore } from "../compat/island-store.js";
import { H as t } from "../compat/shared.js";
import { useVisibleControls, islandStore } from "./useVisibleControls";
import { percent, speed, type SystemLoad } from "./indicator-model";
export function SystemLoadPanel() {
  const active = useVisibleControls("controls"),
    load: SystemLoad | null = useIslandStore((state: any) => state.systemLoad);
  React.useEffect(() => {
    if (!active) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await invoke("system_load_get", {});
        if (alive && data) islandStore.setState({ systemLoad: data });
      } catch {}
      if (alive) timer = setTimeout(() => void refresh(), 1100);
    };
    void refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [active]);
  const fresh = load && Date.now() - load.observedAt < 5000;
  return (
    <button
      type="button"
      data-system-load
      data-task-manager
      title={t("Открыть Диспетчер задач", "Open Task Manager")}
      aria-label={t(
        "Нагрузка CPU, памяти, GPU и сети. Открыть Диспетчер задач.",
        "CPU, memory, GPU and network load. Open Task Manager.",
      )}
      onClick={() => {
        islandStore.getState().close();
        void invoke("task_manager_open", {}).catch(() =>
          islandStore
            .getState()
            .pushPeek({
              kind: "error",
              message: t(
                "Не удалось открыть Диспетчер задач.",
                "Could not open Task Manager.",
              ),
            }),
        );
      }}
      className="press wi-system-load bg-tile text-left hover:bg-tile-hover"
    >
      {(["cpu", "memory", "gpu"] as const).map((key) => (
        <span
          key={key}
          data-load-meter={key}
          className="wi-load-meter"
          title={
            key === "memory" && fresh
              ? `${Math.round((load.memoryUsed ?? 0) / 1048576)} / ${Math.round((load.memoryTotal ?? 0) / 1048576)} MB`
              : undefined
          }
        >
          <strong className="tabular">
            {percent(fresh ? load[key] : null)}
          </strong>
          <span className="wi-load-track">
            <span
              style={{
                width: `${fresh && load[key] !== null ? Math.max(0, Math.min(100, load[key]!)) : 0}%`,
                background:
                  fresh && (load[key] ?? 0) >= 90 ? "#ff654f" : "#8ea2ff",
              }}
            />
          </span>
          <small>
            {key === "memory"
              ? t("Память", "Memory")
              : key === "cpu"
                ? t("Процессор", "CPU")
                : t("Видеокарта", "GPU")}
          </small>
        </span>
      ))}
      <span data-load-meter="net" className="wi-load-network tabular">
        <strong>↓ {speed(fresh ? load.down : null)}</strong>
        <span>↑ {speed(fresh ? load.up : null)}</span>
        <small>{t("Сеть", "Network")}</small>
      </span>
    </button>
  );
}
