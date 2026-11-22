import { React } from "../react";
import { invoke } from "../ipc/client";
import { H as t } from "../compat/shared.js";
import type { SettingRow } from "./ReliabilitySettings";

export function AiProxySettings({
  value,
  Row,
}: {
  value: string;
  Row: SettingRow;
}) {
  const [draft, setDraft] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [saved, setSaved] = React.useState(false);
  const save = async (proxy: string) => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await invoke("ai_proxy_set", { proxy });
      setDraft("");
      setSaved(true);
    } catch (reason) {
      setError(
        typeof reason === "string"
          ? reason
          : t("Не удалось сохранить прокси.", "Could not save the proxy."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Row
      title={t("Прокси для ИИ", "AI proxy")}
      hint={t(
        "Для запросов к API. Локальные модели подключаются напрямую.",
        "For API requests. Local models connect directly.",
      )}
      stacked
    >
      {value && <p className="break-all text-[12px] text-white/55">{value}</p>}
      <div data-ai-proxy className="flex w-full min-w-0 flex-wrap gap-2">
        <input
          aria-label={t("Адрес прокси ИИ", "AI proxy address")}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && draft.trim() && !busy) {
              event.preventDefault();
              void save(draft);
            }
          }}
          placeholder="socks5h://127.0.0.1:1080"
          className="h-9 min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 font-mono text-[12px] text-white/85 outline-none placeholder:text-white/30 focus:ring-1 focus:ring-white/20"
        />
        <button
          disabled={busy || !draft.trim()}
          onClick={() => void save(draft)}
          className="press h-9 rounded-lg bg-white/[0.08] px-3 text-[12px] hover:bg-white/[0.12] disabled:opacity-40"
        >
          {t("Сохранить", "Save")}
        </button>
        {value && (
          <button
            disabled={busy}
            onClick={() => void save("")}
            className="press h-9 rounded-lg px-3 text-[12px] text-[#ff9b9b] hover:bg-white/[0.08] disabled:opacity-40"
          >
            {t("Удалить", "Remove")}
          </button>
        )}
      </div>
      <p className="text-[11.5px] leading-snug text-white/40">
        {t(
          "HTTP или SOCKS5. Если нужна авторизация: схема://логин:пароль@адрес:порт. Логин и пароль хранятся зашифрованными Windows.",
          "HTTP or SOCKS5. For authentication: scheme://username:password@host:port. Windows encrypts the stored username and password.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-[12px] text-[#ff9b9b]">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-[12px] text-white/55">
          {t("Сохранено", "Saved")}
        </p>
      )}
    </Row>
  );
}
