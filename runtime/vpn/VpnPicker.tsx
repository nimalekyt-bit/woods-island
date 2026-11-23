import { React } from "../react";
import { Check, ExternalLink } from "../components/settings-icons";
import { vpnProfiles, vpnPickAction, type VpnProfile } from "./profiles";
import "./vpn.css";

export function VpnPicker({
  profiles,
  busy,
  language,
  onPick,
  onOpen,
  onClose,
}: {
  profiles: unknown;
  busy: boolean;
  language: "ru" | "en";
  onPick: (profile: VpnProfile, on: boolean) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
}) {
  const t = (ru: string, en: string) => (language === "en" ? en : ru);
  const items = vpnProfiles(profiles);
  const dialog = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={dialog}
      tabIndex={-1}
      className="wi-vpn-picker"
      data-vpn-choice
      role="dialog"
      aria-label={t("Подключения VPN", "VPN connections")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <h3>{t("Какой VPN подключить?", "Which VPN to connect?")}</h3>
        <button
          className="wi-vpn-close"
          onClick={onClose}
          aria-label={t("Закрыть список VPN", "Close VPN list")}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </header>
      <div className="wi-vpn-items">
        {items.map((profile) => {
          const action = vpnPickAction(profile);
          if (!profile.ready)
            return (
              <button
                key={profile.id}
                data-vpn-pick={profile.id}
                data-on={String(profile.on)}
                className="wi-vpn-pick"
                disabled={busy || !profile.launchPath}
                title={t(
                  "Управление подключением в окне клиента",
                  "Manage the connection in the client window",
                )}
                onClick={() => {
                  if (profile.launchPath) {
                    onClose();
                    onOpen(profile.launchPath);
                  }
                }}
              >
                <span>{profile.name}</span>
                <small>{t("Открыть", "Open")}</small>
                <ExternalLink size={12} />
              </button>
            );
          if (action === null)
            return (
              <div
                key={profile.id}
                className="wi-vpn-unknown"
                data-custom-vpn={profile.id === "app:custom" ? true : undefined}
                data-vpn-unknown={profile.id}
              >
                <div>
                  <strong>{profile.name}</strong>
                  <small>{t("Состояние неизвестно", "Status unknown")}</small>
                </div>
                <p>
                  {profile.id === "app:custom"
                    ? profile.lastRequestedOn === null
                      ? t(
                          "Состояние появится, когда Windows подтвердит туннель или прокси.",
                          "Status appears when Windows confirms a tunnel or proxy.",
                        )
                      : t(
                          "Команда выполнена; Windows пока не подтвердила состояние подключения.",
                          "The command completed; Windows has not confirmed the connection state yet.",
                        )
                    : t(
                        "Клиент пока не подтвердил состояние подключения.",
                        "The client has not confirmed the connection state yet.",
                      )}
                </p>
                <div className="wi-vpn-command-actions">
                  {[true, false].map((on) => (
                    <button
                      key={String(on)}
                      data-vpn-command={on ? "connect" : "disconnect"}
                      data-vpn-command-profile={profile.id}
                      disabled={busy}
                      onClick={() => {
                        onClose();
                        onPick(profile, on);
                      }}
                    >
                      {on
                        ? t("Подключить", "Connect")
                        : t("Отключить", "Disconnect")}
                    </button>
                  ))}
                </div>
              </div>
            );
          return (
            <button
              key={profile.id}
              data-vpn-pick={profile.id}
              data-on={String(profile.on)}
              className="wi-vpn-pick"
              disabled={busy}
              title={
                profile.on
                  ? t(
                      "Подключён: нажми, чтобы отключить",
                      "Connected: press to disconnect",
                    )
                  : t(
                      "Подключить этот VPN; прежний сначала отключится",
                      "Connect this VPN after disconnecting the previous one",
                    )
              }
              onClick={() => {
                onClose();
                onPick(profile, action);
              }}
            >
              {profile.on && <Check size={13} />}
              <span>{profile.name}</span>
              {profile.on && <small>{t("Подключён", "Connected")}</small>}
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="wi-vpn-empty">
            {t("Подключения VPN не найдены", "No VPN connections found")}
          </p>
        )}
      </div>
    </div>
  );
}
