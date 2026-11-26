import { React } from "../react";
import { invoke } from "../ipc/client";
import { H as t } from "../compat/shared.js";

export function SitePermissions({
  service = null,
  compact = false,
  english,
  className = "",
}: {
  service?: string | null;
  compact?: boolean;
  english?: boolean;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [error, setError] = React.useState(""),
    alive = React.useRef(true),
    generation = React.useRef(0),
    timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  React.useEffect(() => {
    generation.current++;
    setState("idle");
    setError("");
    clearTimeout(timer.current);
  }, [service]);
  const text = (ru: string, en: string) =>
    english === undefined ? t(ru, en) : english ? en : ru;
  const reset = async () => {
    if (state === "busy") return;
    const current = generation.current;
    setState("busy");
    setError("");
    clearTimeout(timer.current);
    try {
      await invoke("web_ai_permissions_reset", { service });
      if (alive.current && current === generation.current) setState("done");
    } catch (reason) {
      if (alive.current && current === generation.current) {
        setState("error");
        setError(
          typeof reason === "string"
            ? reason
            : text(
                "Не удалось сбросить разрешения.",
                "Could not reset permissions.",
              ),
        );
      }
    }
    if (alive.current && current === generation.current)
      timer.current = setTimeout(() => {
        if (alive.current && current === generation.current) setState("idle");
      }, 3000);
  };
  const label = text(
    "Сбросить разрешения сайта: микрофон, камера, уведомления",
    "Reset site permissions: microphone, camera, notifications",
  );
  return (
    <button
      type="button"
      data-web-ai-permissions={compact ? (service ?? "all") : undefined}
      data-web-ai-permissions-reset={!compact || undefined}
      disabled={state === "busy"}
      title={error || label}
      aria-label={label}
      onClick={() => void reset()}
      className={
        className ||
        `press flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 text-[12px] text-ink-2 hover:bg-white/15 disabled:opacity-50`
      }
    >
      {compact ? (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" />
          {state === "done" ? (
            <path d="m8 12 3 3 5-6" />
          ) : (
            <path d="M9 10a3 3 0 1 1 0 4m0-4v-2m0 2h2" />
          )}
        </svg>
      ) : state === "busy" ? (
        text("Сбрасываю…", "Resetting…")
      ) : state === "done" ? (
        text("Сброшено", "Reset")
      ) : state === "error" ? (
        text("Не вышло", "Try again")
      ) : (
        text("Сбросить", "Reset")
      )}
    </button>
  );
}
