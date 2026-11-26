import { React } from "../react";
import { H as t } from "../compat/shared.js";
import {
  RefreshCw,
  Check,
  ExternalLink,
  Link2,
  Monitor,
} from "../components/settings-icons";
import {
  phoneState,
  phoneLinked,
  shelfAge,
  shelfProvenance,
  type PhoneState,
} from "./state";
import "./phone.css";

const call = (command: string, args?: object) =>
  window.__TAURI_INTERNALS__.invoke(command, args || {});

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1048576)
    return `${(bytes / 1048576).toFixed(1)} ${t("МБ", "MB")}`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} ${t("КБ", "KB")}`;
  return `${bytes} ${t("Б", "B")}`;
}

export function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </svg>
  );
}

type UploadProgress = {
  active: boolean;
  name?: string;
  received?: number;
  total?: number;
};

export function PhonePanel({
  state,
  onState,
  makeQr,
  onFocus,
  onWaiting,
}: {
  state: PhoneState | null;
  onState: (value: PhoneState) => void;
  makeQr: (url: string) => Promise<string>;
  onFocus?: () => void;
  onWaiting?: (waiting: boolean) => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null),
    [error, setError] = React.useState(""),
    [qr, setQr] = React.useState<string | null>(null),
    [help, setHelp] = React.useState(false),
    [copied, setCopied] = React.useState(false),
    [upload, setUpload] = React.useState<UploadProgress | null>(null);
  const mounted = React.useRef(true),
    version = React.useRef(0);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    const listen = (window as any).__TAURI__?.event?.listen;
    if (typeof listen !== "function") return;
    let unlisten: (() => void) | undefined;
    let alive = true;
    Promise.resolve(
      listen("phone:upload", (ev: { payload?: UploadProgress }) => {
        if (!alive) return;
        const p = ev?.payload;
        if (p && p.active) setUpload(p);
        else setUpload(null);
      }),
    )
      .then((fn) => {
        if (alive) unlisten = fn;
        else fn?.();
      })
      .catch(() => {});
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    setQr(null);
    if (!state?.url) return;
    makeQr(state.url)
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {
        if (active)
          setError(
            t(
              "Не удалось показать QR-код",
              "The QR code could not be displayed",
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [state?.url, makeQr]);

  const waiting = state?.running === true && !state.device;
  React.useEffect(() => {
    onWaiting?.(waiting);
    return () => onWaiting?.(false);
  }, [waiting, onWaiting]);

  async function act(command: string, args?: object) {
    if (busy) return false;
    const request = ++version.current;
    setBusy(command);
    setError("");
    try {
      const value = await call(command, args);
      if (mounted.current && version.current === request)
        onState(phoneState(value));
      return true;
    } catch (reason) {
      if (mounted.current) setError(String(reason));
      return false;
    } finally {
      if (mounted.current && version.current === request) setBusy(null);
    }
  }

  function copyLink() {
    if (!state?.url) return;
    try {
      navigator.clipboard?.writeText(state.url).catch(() => {});
      setCopied(true);
      window.setTimeout(() => {
        if (mounted.current) setCopied(false);
      }, 1500);
    } catch {}
  }

  const pending = state?.pending,
    linked = phoneLinked(state),
    running = state?.running === true;
  const label = pending
    ? pending.device
    : state?.device || t("Телефон", "Phone");
  const status = state?.permissionRequired
    ? t("нужно разрешение", "permission needed")
    : pending
      ? t("нужно подтверждение", "needs approval")
      : linked
        ? state?.connected
          ? t("на связи", "connected")
          : t("в ожидании", "standby")
        : running
          ? t("ждём телефон…", "waiting for phone…")
          : t("не подключён", "not connected");
  const badgeTone =
    pending || state?.permissionRequired
      ? "pending"
      : linked && state?.connected
        ? "connected"
        : running
          ? "waiting"
          : "idle";
  const networkHelp =
    (help || state?.permissionRequired === true) &&
    running &&
    !linked &&
    !pending;
  const fail = error || state?.problem || "";
  const uploadPct =
    upload?.active && upload.total && upload.total > 0
      ? Math.min(100, Math.round(((upload.received ?? 0) / upload.total) * 100))
      : 0;

  return (
    <aside data-phone-panel className="wi-phone-panel">
      <header>
        <span
          className="wi-phone-eyes"
          data-tone={badgeTone}
          aria-hidden="true"
        >
          <i />
          <i />
        </span>
        <div className="wi-phone-heading">
          <strong data-phone-device>{label}</strong>
          <span
            data-phone-status
            data-tone={badgeTone}
            data-connected={state?.connected === true}
          >
            <i aria-hidden="true" />
            <span>{status}</span>
          </span>
        </div>
      </header>
      <div className="wi-phone-content">
        {networkHelp ? (
          <div data-phone-notice className="wi-phone-notice">
            <strong>
              {state?.public
                ? t("Домашняя сеть", "Home network")
                : t("Нужно разрешение", "Permission needed")}
            </strong>
            <p>
              {state?.public
                ? t(
                    "Для домашней сети выбери «Частная сеть» в параметрах Windows.",
                    "Set your home network to Private in Windows settings.",
                  )
                : t(
                    "Разреши подключение из домашней сети в окне Windows.",
                    "Allow connections from your home network in the Windows prompt.",
                  )}
            </p>
            <p>
              {t(
                "Подключи телефон и ПК к одному роутеру.",
                "Connect the phone and PC to the same router.",
              )}
            </p>
            {!state?.permissionRequired && (
              <button className="wi-phone-help" onClick={() => setHelp(false)}>
                {t("Вернуться к коду", "Back to the code")}
              </button>
            )}
          </div>
        ) : pending ? (
          <div className="wi-phone-approval">
            <div className="wi-phone-approval-heading">
              <span className="wi-phone-approval-icon" aria-hidden="true">
                <PhoneIcon size={15} />
              </span>
              <strong>
                {t("Разрешить этому телефону?", "Allow this phone?")}
              </strong>
            </div>
            <p>
              {t(
                "Сможет отправлять на полку и получать выбранные файлы.",
                "It can send items to the shelf and receive selected files.",
              )}
            </p>
            <div className="wi-phone-approval-actions">
              <button
                data-phone-allow
                disabled={busy !== null}
                onClick={() => void act("phone_allow", { id: pending.id })}
              >
                {t("Разрешить", "Allow")}
              </button>
              <button
                data-phone-deny
                disabled={busy !== null}
                onClick={() => void act("phone_deny", { id: pending.id })}
              >
                {t("Отклонить", "Decline")}
              </button>
            </div>
          </div>
        ) : !running ? (
          <div className="wi-phone-empty">
            <div className="wi-phone-empty-icon">
              <PhoneIcon size={20} />
            </div>
            <p>
              {t(
                "Фото, файлы и текст с телефона — по QR-коду через твой Wi-Fi.",
                "Photos, files and text from your phone over your local Wi-Fi.",
              )}
            </p>
          </div>
        ) : !linked ? (
          <div className="wi-phone-pair">
            {state?.url ? (
              <>
                <div data-phone-qr>
                  {qr ? (
                    <img
                      src={qr}
                      alt={t(
                        "QR-код подключения телефона",
                        "Phone pairing QR code",
                      )}
                      draggable={false}
                    />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                </div>
                <p>{t("Наведи камеру на код", "Scan it with the camera")}</p>
                <button
                  type="button"
                  className="wi-phone-url-btn"
                  onClick={copyLink}
                  title={`${state.url}\n${state.network || t("Одна локальная сеть", "Same local network")}`}
                >
                  <span data-phone-url>
                    {copied
                      ? t("Ссылка скопирована", "Link copied")
                      : state.url.replace(/^http:\/\//, "")}
                  </span>
                  <Link2 size={10} />
                </button>
              </>
            ) : (
              <p>
                {t(
                  "Код истёк. Нажми «Новый код».",
                  "The code expired. Choose New code.",
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="wi-phone-offers">
            {upload?.active && (
              <div className="wi-phone-receiving">
                <div className="wi-phone-receiving-top">
                  <span title={upload.name}>
                    {upload.name || t("Загрузка…", "Receiving…")}
                  </span>
                  <em>{uploadPct}%</em>
                </div>
                <div className="wi-phone-receiving-bar">
                  <i style={{ width: `${uploadPct}%` }} />
                </div>
              </div>
            )}
            <span>{t("На телефон", "To phone")}</span>
            {state?.offered.length ? (
              <div className="wi-phone-offer-list">
                {state.offered.map((file) => (
                  <div
                    key={file.id}
                    data-phone-offered={file.name}
                    className={file.taken ? "is-taken" : ""}
                  >
                    <Check size={12} />
                    <div className="wi-phone-offer-meta">
                      <span title={file.name}>{file.name}</span>
                      {file.size > 0 && <em>{formatFileSize(file.size)}</em>}
                    </div>
                    <button
                      title={t("Убрать с телефона", "Take back from the phone")}
                      onClick={() => void act("phone_unsend", { id: file.id })}
                      disabled={busy !== null}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="wi-phone-drop-hint">
                {t(
                  "Перетащи файл на остров или нажми иконку телефона на карточке полки.",
                  "Drop a file onto the island or click the phone icon on any shelf item.",
                )}
              </p>
            )}
          </div>
        )}
        {fail && (
          <p className="wi-phone-error" role="alert">
            {fail.includes("nonet")
              ? t(
                  "Подключи ПК и телефон к одной сети Wi-Fi или к одному роутеру.",
                  "Connect the PC and phone to the same Wi-Fi network or router.",
                )
              : fail}
          </p>
        )}
        {state?.public && (
          <p data-phone-public className="wi-phone-public">
            {t(
              "Windows считает сеть общественной",
              "Windows considers this a public network",
            )}
          </p>
        )}
      </div>
      {networkHelp ? (
        <button
          data-phone-firewall
          className="wi-phone-connect"
          disabled={busy !== null}
          onClick={() => {
            onFocus?.();
            const command = state?.public
              ? act("phone_stop").then(
                  (stopped) => stopped && act("phone_start"),
                )
              : act("phone_firewall");
            void command.then((allowed) => {
              if (allowed) setHelp(false);
            });
          }}
        >
          {state?.public
            ? t("Проверить снова", "Check again")
            : t("Разрешить", "Allow")}
          <ExternalLink size={12} />
        </button>
      ) : running ? (
        <div className="wi-phone-actions">
          <button
            data-phone-renew
            disabled={busy !== null}
            onClick={() => void act("phone_renew")}
          >
            <RefreshCw size={12} />
            {t("Новый код", "New code")}
          </button>
          <button
            data-phone-stop
            disabled={busy !== null}
            title={t("Отключить телефон", "Disconnect phone")}
            onClick={() => void act("phone_stop")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m8 3 4 4-3 3-4-4M16 21l-4-4 3-3 4 4M2 2l20 20M6 12l-2 2 6 6 2-2M18 12l2-2-6-6-2 2" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          data-phone-open
          disabled={busy !== null}
          className="wi-phone-connect"
          onClick={() => void act("phone_start")}
        >
          <PhoneIcon size={13} />
          {busy ? t("Запускаю…", "Starting…") : t("Подключить", "Connect")}
        </button>
      )}
      {running && !linked && !pending && !networkHelp && (
        <button
          className="wi-phone-help"
          onClick={() => setHelp((value) => !value)}
          aria-expanded={help}
        >
          {t("Нет соединения?", "Can’t connect?")}
        </button>
      )}
    </aside>
  );
}

export function ShelfOrigin({ item }: { item: unknown }) {
  const [, refresh] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => refresh((value) => value + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const value = shelfProvenance(item),
    lang = t("ru", "en") as "ru" | "en";
  return (
    <span
      data-shelf-origin
      data-from-phone={value.fromPhone}
      className="wi-shelf-origin"
      title={
        value.fromPhone
          ? t("С телефона", "From the phone")
          : t("С компьютера", "From the computer")
      }
    >
      {value.fromPhone ? <PhoneIcon size={10} /> : <Monitor size={10} />}
      {shelfAge(value.added, Date.now(), lang)}
    </span>
  );
}
