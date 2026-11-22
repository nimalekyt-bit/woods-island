import { React } from "../react";
import { invoke } from "../ipc/client";
import { H as t } from "../compat/shared.js";
interface OpenApp {
  executable: string;
  name: string;
  title: string;
}
export function AppListPicker({
  mode,
  value,
  onChange,
}: {
  mode: "hide" | "keep";
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [apps, setApps] = React.useState<OpenApp[] | null>(null),
    [busy, setBusy] = React.useState(false),
    [message, setMessage] = React.useState("");
  const contains = (name: string) =>
    value.some((item) => item.toLowerCase() === name.toLowerCase());
  const pick = async () => {
    if (apps) {
      setApps(null);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      setApps((await invoke("open_programs")) as unknown as OpenApp[]);
    } catch {
      setMessage(
        t(
          "Не удалось получить открытые программы.",
          "Could not read open apps.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const browsers = async () => {
    setBusy(true);
    setMessage("");
    try {
      const names = await invoke("installed_browsers");
      const added = names.filter((name) => !contains(name));
      if (added.length) onChange([...value, ...added]);
      setMessage(
        added.length
          ? t(
              `Добавлено браузеров: ${added.length}`,
              `Browsers added: ${added.length}`,
            )
          : names.length
            ? t("Браузеры уже в списке.", "Browsers are already listed.")
            : t(
                "Установленные браузеры не найдены.",
                "No installed browsers found.",
              ),
      );
    } catch {
      setMessage(
        t(
          "Не удалось получить список браузеров.",
          "Could not read installed browsers.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-app-list-picker className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => void pick()}
          className="press h-8 rounded-lg bg-white/[0.08] px-3 text-[12px] hover:bg-white/[0.12] disabled:opacity-40"
        >
          {apps
            ? t("Свернуть список", "Close list")
            : t("Выбрать из открытых", "Pick from open apps")}
        </button>
        {mode === "hide" && (
          <button
            disabled={busy}
            data-hide-browsers
            onClick={() => void browsers()}
            className="press h-8 rounded-lg bg-white/[0.08] px-3 text-[12px] hover:bg-white/[0.12] disabled:opacity-40"
          >
            {t("Браузеры", "Browsers")}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="text-[12px] text-white/45">
          {message}
        </p>
      )}
      {apps && (
        <div
          data-open-apps
          className="scroll-thin flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg bg-black/30 p-1"
        >
          {!apps.length && (
            <p className="p-2 text-[12px] text-white/45">
              {t(
                "Открытых окон программ не найдено.",
                "No open app windows found.",
              )}
            </p>
          )}
          {apps.map((app) => (
            <button
              key={app.executable}
              aria-pressed={contains(app.executable)}
              onClick={() =>
                onChange(
                  contains(app.executable)
                    ? value.filter(
                        (name) =>
                          name.toLowerCase() !== app.executable.toLowerCase(),
                      )
                    : [...value, app.executable],
                )
              }
              className="press flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10"
            >
              <span
                aria-hidden
                style={{ width: 16, flexShrink: 0, opacity: 0.7 }}
              >
                {contains(app.executable) ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px]">{app.name}</span>
                <span className="block truncate text-[11px] text-white/40">
                  {app.title}
                </span>
              </span>
              <span title={app.executable} className="max-w-[35%] shrink-0 truncate text-[10px] text-white/40">
                {app.executable}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
