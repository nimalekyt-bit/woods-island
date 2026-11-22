import { React } from "../react";
import { H as t } from "../compat/shared.js";
import {
  readShortcut,
  modifiers,
  shortcutDisplay,
  shortcutConflict,
  type ShortcutBinding,
} from "./shortcuts";

export function HotkeyRecorder({
  value,
  onChange,
  label,
  bindings = [],
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  bindings?: ShortcutBinding[];
}) {
  const [active, setActive] = React.useState(false),
    [held, setHeld] = React.useState(""),
    [hint, setHint] = React.useState("");
  const hintId = React.useId();
  React.useEffect(() => {
    if (!active) return;
    const pause = (on: boolean) => {
      void window.__TAURI_INTERNALS__
        .invoke("hotkeys_recording", { on })
        .catch(() => {});
    };
    const focus = () => pause(true),
      blur = () => pause(false);
    pause(true);
    const lease = window.setInterval(() => {
      if (document.hasFocus()) pause(true);
    }, 10000);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    return () => {
      clearInterval(lease);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
      pause(false);
    };
  }, [active]);
  return (
    <div
      data-hotkey-recorder
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 4,
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
        onFocus={() => {
          setActive(true);
          setHint("");
          setHeld("");
        }}
        onBlur={() => {
          setActive(false);
          setHeld("");
        }}
        onKeyDown={(event) => {
          const result = readShortcut(event);
          if (result.kind === "navigate") return;
          event.preventDefault();
          event.stopPropagation();
          if (result.kind === "cancel") {
            setHint("");
            event.currentTarget.blur();
            return;
          }
          if (result.kind === "clear") {
            onChange("");
            setHint("");
            event.currentTarget.blur();
            return;
          }
          setHeld(result.value);
          if (result.kind === "modifier") {
            setHint("");
            return;
          }
          if (result.kind === "missingModifier") {
            setHint(
              t(
                "Добавь Ctrl, Alt, Shift или Win.",
                "Add Ctrl, Alt, Shift or Win.",
              ),
            );
            return;
          }
          if (result.kind === "unsupported") {
            setHint(
              t("Эта клавиша не поддерживается.", "This key is not supported."),
            );
            return;
          }
          const conflict = shortcutConflict(result.value, value, bindings);
          if (conflict) {
            setHint(
              t(`Уже назначено: ${conflict}`, `Already assigned: ${conflict}`),
            );
            return;
          }
          onChange(result.value);
          setHint("");
          event.currentTarget.blur();
        }}
        onKeyUp={(event) => {
          if (active) setHeld(modifiers(event).join("+"));
        }}
        className={`flex min-h-8 min-w-40 max-w-full flex-wrap items-center justify-center gap-1 rounded-lg px-2 py-1 text-[12px] outline-none ${active ? "bg-[#8ea2ff]/20 text-[#c9d2ff] ring-1 ring-[#8ea2ff]/60" : "bg-white/[0.07] text-white hover:bg-white/10"}`}
      >
        {active && !held ? (
          t("Нажми сочетание…", "Press a combination…")
        ) : (active ? held : value) ? (
          shortcutDisplay(active ? held : value).map((key, index) => (
            <kbd
              key={index}
              className="rounded bg-white/10 px-1.5 py-0.5 font-sans text-[11px]"
            >
              {key}
            </kbd>
          ))
        ) : (
          <span className="text-white/40">{t("не назначено", "not set")}</span>
        )}
      </button>
      {hint && (
        <span
          id={hintId}
          role="status"
          style={{
            fontSize: 11,
            lineHeight: "15px",
            color: "#ffdfac",
            maxWidth: 220,
            textAlign: "right",
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
