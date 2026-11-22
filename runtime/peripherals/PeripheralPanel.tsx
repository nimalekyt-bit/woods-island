import { React } from "../react";
import { AnimatePresence, motion } from "../motion";
import { invoke } from "../ipc/client";
import { focusInputAfterActivation } from "../island/input-focus";
import { DeviceIcon } from "./DeviceIcon";
import {
  compactLimit,
  normalizePeripherals,
  sameNamedDevices,
  sortPeripherals,
  visiblePeripherals,
  peripheralName,
  peripheralNotificationsActive,
} from "./model";
import type { PeripheralDevice, PeripheralPreferences } from "./model";
import "./peripherals.css";

interface Props {
  snapshot: unknown;
  preferences: PeripheralPreferences;
  expanded: boolean;
  listHeight: number;
  ru: boolean;
  onToggle: () => void;
  onHeight: (height: number) => void;
  onSave: (patch: Partial<PeripheralPreferences>) => Promise<unknown>;
}
export function PeripheralPanel({
  snapshot: raw,
  preferences,
  expanded,
  listHeight,
  ru,
  onToggle,
  onHeight,
  onSave,
}: Props) {
  const snapshot = React.useMemo(() => normalizePeripherals(raw), [raw]);
  const root = React.useRef<HTMLDivElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [saving, setSaving] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const [stripWidth, setStripWidth] = React.useState(680);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [alias, setAlias] = React.useState("");
  const [manualConfirm, setManualConfirm] = React.useState<string | null>(null);
  const [manualBusy, setManualBusy] = React.useState<string | null>(null);
  const [manualError, setManualError] = React.useState<{
    id: string;
    code: string;
  } | null>(null);
  const all = sortPeripherals(snapshot.devices, preferences.peripheralSort);
  const shown = visiblePeripherals(snapshot, preferences);
  const fits = Math.max(1, Math.floor((stripWidth - 10) / 92));
  const compact = shown.slice(
    0,
    Math.min(compactLimit(preferences.peripheralLimit), fits),
  );
  const current = all.filter((d) => d.present && d.connected !== false);
  const retained = all.filter((d) => !d.present || d.connected === false);
  const hasContent =
    preferences.showPeripherals !== false &&
    (current.length > 0 ||
      snapshot.loading ||
      !!snapshot.error ||
      (expanded && retained.length > 0));
  React.useLayoutEffect(() => {
    const element = root.current;
    if (!element) {
      onHeight(0);
      return;
    }
    const measure = () => {
      onHeight(element.offsetHeight);
      setStripWidth(
        element.querySelector<HTMLElement>(".peripheral-mini-list")
          ?.clientWidth ?? element.clientWidth,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onHeight(0);
    };
  }, [hasContent, onHeight]);
  React.useEffect(() => {
    if (!expanded) {
      setEditing(null);
      setManualConfirm(null);
    }
  }, [expanded]);
  React.useLayoutEffect(() => {
    const card = root.current?.querySelector<HTMLElement>(".peripheral-card");
    if (card) card.inert = !expanded;
  }, [expanded]);
  React.useEffect(() => {
    if (!expanded) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [expanded]);
  React.useEffect(() => {
    setBusy(false);
  }, [snapshot.revision]);
  React.useEffect(() => {
    if (!editing) return;
    return focusInputAfterActivation(
      () =>
        root.current?.querySelector<HTMLInputElement>(
          ".peripheral-name-form input",
        ) ?? null,
      () => invoke("take_focus"),
    );
  }, [editing]);
  React.useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => {
      setBusy(false);
      setError(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [busy]);
  const t = (a: string, b: string) => (ru ? a : b);
  async function measureG435(device: PeripheralDevice) {
    if (manualBusy) return;
    setManualBusy(device.id);
    setManualConfirm(null);
    setManualError(null);
    try {
      const result = await invoke("peripherals_g435_measure", {
        id: device.id,
        allowAudioPause: true,
      });
      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        result.saved === false
      )
        setManualError({ id: device.id, code: "g435Storage" });
    } catch (error) {
      setManualError({
        id: device.id,
        code: typeof error === "string" ? error : "g435Io",
      });
    } finally {
      setManualBusy(null);
    }
  }
  function manualMessage(code: string) {
    if (code === "g435HeadsetOff")
      return t(
        "Включи наушники и повтори замер",
        "Turn on the headset and try again",
      );
    if (code === "g435Busy")
      return t(
        "Приёмник занят. Повтори позже",
        "The receiver is busy. Try again later",
      );
    if (code === "g435ExitUnconfirmed")
      return t(
        "Выход из режима замера не подтверждён. Переподключи USB-приёмник",
        "Measurement mode exit was not confirmed. Reconnect the USB receiver",
      );
    if (code === "g435Unsupported")
      return t(
        "Эта ревизия приёмника пока не поддерживается",
        "This receiver revision is not supported yet",
      );
    if (code === "g435Storage")
      return t(
        "Показание получено, но не сохранилось после перезапуска",
        "The reading could not be saved for the next restart",
      );
    return t(
      "Замер не получен. Можно повторить вручную",
      "No reading received. You can try again manually",
    );
  }
  if (!hasContent) return null;
  async function refresh() {
    setBusy(true);
    setError(false);
    try {
      await invoke("peripherals_refresh");
    } catch {
      setBusy(false);
      setError(true);
    }
  }
  async function hide(device: PeripheralDevice) {
    const hidden = new Set(preferences.peripheralHidden ?? []);
    hidden.has(device.id) ? hidden.delete(device.id) : hidden.add(device.id);
    setSaving(device.id);
    setError(false);
    try {
      const result = await onSave({ peripheralHidden: [...hidden] });
      if (Array.isArray(result) && result.length) setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }
  async function mute(device: PeripheralDevice) {
    const muted = new Set(preferences.peripheralMuted ?? []);
    muted.has(device.id) ? muted.delete(device.id) : muted.add(device.id);
    setSaving(device.id);
    setError(false);
    try {
      const result = await onSave({ peripheralMuted: [...muted] });
      if (Array.isArray(result) && result.length) setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }
  async function rename(device: PeripheralDevice) {
    let aliases: Record<string, string> = {};
    try {
      const parsed = JSON.parse(preferences.peripheralNames ?? "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        aliases = parsed;
    } catch {}
    if (alias.trim()) aliases[device.id] = alias.trim().slice(0, 80);
    else delete aliases[device.id];
    setSaving(device.id);
    setError(false);
    try {
      const result = await onSave({ peripheralNames: JSON.stringify(aliases) });
      if (Array.isArray(result) && result.length) setError(true);
      else setEditing(null);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }
  const displayName = (d: PeripheralDevice) =>
    peripheralName(d, preferences) !== d.name
      ? peripheralName(d, preferences)
      : sameNamedDevices(all, d);
  const number = (d: PeripheralDevice) =>
    d.percent === null
      ? "—"
      : `${d.source === "g435-manual" ? "≈" : ""}${d.percent}%`;
  const transport = (d: PeripheralDevice) =>
    d.transport === "bluetooth"
      ? "Bluetooth"
      : d.transport === "receiver"
        ? t("USB-приёмник", "USB receiver")
        : d.transport === "usb"
          ? "USB"
          : "";
  function status(d: PeripheralDevice) {
    if (!d.present || d.connected === false)
      return t("Отключено", "Disconnected");
    if (d.source === "g435-manual")
      return t(
        "Ручной замер · оценка по напряжению",
        "Manual reading · voltage estimate",
      );
    if (d.charging === true) return t("Заряжается", "Charging");
    if (d.batteryStatus === "stale")
      return t("Последние известные данные", "Last known reading");
    if (d.percent === null)
      return d.unavailableReason === "audioInterruption"
        ? t(
            "Опрос отключён, чтобы не прерывать звук",
            "Polling disabled to preserve audio",
          )
        : t("Заряд пока недоступен", "Battery level unavailable");
    return d.source === "windows"
      ? t("По данным Windows", "Reported by Windows")
      : t("По данным устройства", "Reported by device");
  }
  function age(d: PeripheralDevice) {
    if (d.lastReadAt === null) return "";
    const minutes = Math.floor(Math.max(0, now - d.lastReadAt) / 60000);
    return minutes < 1
      ? t("только что", "just now")
      : t(`${minutes} мин назад`, `${minutes} min ago`);
  }
  const rows = [
    ...current,
    ...retained.filter((d) => !dismissed.includes(d.id)),
  ];
  return (
    <div
      className="peripheral-panel"
      ref={root}
      data-peripheral-panel
      data-open={expanded}
    >
      <button
        type="button"
        className="peripheral-summary press"
        aria-expanded={expanded}
        aria-controls="peripheral-device-card"
        aria-label={
          t("Заряд устройств", "Device batteries") +
          (compact.length
            ? ": " +
              compact.map((d) => `${displayName(d)} ${number(d)}`).join(", ")
            : "")
        }
        title={
          expanded
            ? t("Свернуть устройства", "Collapse devices")
            : t("Показать устройства", "Show devices")
        }
        onClick={onToggle}
      >
        <span className="peripheral-mini-list">
          {compact.map((d) => (
            <span
              key={d.id}
              className="peripheral-mini"
              data-stale={d.batteryStatus === "stale"}
              data-low={
                d.batteryStatus === "available" &&
                d.percent !== null &&
                d.percent <= (preferences.peripheralLowThreshold ?? 20)
              }
              title={`${displayName(d)} · ${number(d)} · ${status(d)}`}
            >
              <DeviceIcon kind={d.kind} />
              <span>{number(d)}</span>
              {d.charging === true &&
                preferences.peripheralCharging !== false && (
                  <span
                    className="peripheral-mini-charge"
                    aria-label={t("Заряжается", "Charging")}
                  >
                    <DeviceIcon kind="charging" size={12} />
                  </span>
                )}
              {d.batteryStatus === "stale" && (
                <span aria-label={t("Данные устарели", "Reading is stale")}>
                  ·
                </span>
              )}
            </span>
          ))}
          {shown.length > compact.length && (
            <span className="peripheral-overflow">
              +{shown.length - compact.length}
            </span>
          )}
          {!compact.length && (
            <span className="peripheral-placeholder">
              {snapshot.loading
                ? t("Читаю устройства…", "Reading devices…")
                : snapshot.error
                  ? t(
                      "Не удалось прочитать устройства",
                      "Could not read devices",
                    )
                  : t("Устройства", "Devices")}
            </span>
          )}
        </span>
        <span className="peripheral-summary-end">
          <span aria-hidden="true" className="peripheral-chevron">
            <DeviceIcon kind="chevron" size={16} />
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.section
            key="device-card"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="peripheral-card"
            id="peripheral-device-card"
            aria-label={t("Заряд устройств", "Device batteries")}
          >
            <header>
              <span>{t("Заряд устройств", "Device batteries")}</span>
              <button
                type="button"
                className="press peripheral-refresh"
                onClick={() => void refresh()}
                disabled={busy}
              >
                {busy
                  ? t("Обновляю…", "Refreshing…")
                  : t("Обновить", "Refresh")}
              </button>
            </header>
            <div
              className="peripheral-device-list"
              style={{ maxHeight: listHeight }}
            >
              {rows.map((d) => (
                <div
                  key={d.id}
                  className="peripheral-device-row"
                  data-peripheral-device={d.id}
                  data-connected={
                    d.connected === true
                      ? "true"
                      : d.connected === false
                        ? "false"
                        : "unknown"
                  }
                  data-stale={d.batteryStatus === "stale"}
                  data-low={
                    d.batteryStatus === "available" &&
                    d.percent !== null &&
                    d.percent <= (preferences.peripheralLowThreshold ?? 20)
                  }
                >
                  <DeviceIcon kind={d.kind} size={22} />
                  <div className="peripheral-device-copy">
                    {editing === d.id ? (
                      <form
                        className="peripheral-name-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void rename(d);
                        }}
                      >
                        <input
                          autoFocus
                          maxLength={80}
                          value={alias}
                          onChange={(e) => setAlias(e.target.value)}
                          placeholder={d.name}
                          aria-label={t("Имя устройства", "Device name")}
                        />
                        <button
                          className="press peripheral-refresh"
                          type="submit"
                          disabled={saving !== null}
                        >
                          {t("Сохранить", "Save")}
                        </button>
                        <button
                          className="press peripheral-refresh"
                          type="button"
                          onClick={() => setEditing(null)}
                        >
                          {t("Отмена", "Cancel")}
                        </button>
                      </form>
                    ) : (
                      <button
                        className="peripheral-name press"
                        type="button"
                        title={t("Задать своё имя", "Set a custom name")}
                        onClick={() => {
                          setAlias(
                            peripheralName(d, preferences) === d.name
                              ? ""
                              : peripheralName(d, preferences),
                          );
                          setEditing(d.id);
                        }}
                      >
                        {displayName(d)}
                      </button>
                    )}
                    <span title={d.reportedName ?? d.name}>
                      {[transport(d), status(d)].filter(Boolean).join(" · ")}
                    </span>
                    {d.batteryStatus === "stale" && d.lastReadAt !== null && (
                      <span>
                        {[
                          d.manualMillivolts !== null
                            ? t(
                                `${d.manualMillivolts} мВ`,
                                `${d.manualMillivolts} mV`,
                              )
                            : "",
                          age(d),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {d.manualMeasurementAvailable && (
                      <div className="peripheral-manual">
                        {manualConfirm === d.id ? (
                          <>
                            <span>
                              {t(
                                "Замер ненадолго прервёт звук и микрофон",
                                "Measurement briefly interrupts audio and microphone",
                              )}
                            </span>
                            <div className="peripheral-manual-actions">
                              <button
                                type="button"
                                className="press peripheral-refresh"
                                disabled={manualBusy !== null}
                                onClick={() => void measureG435(d)}
                              >
                                {t("Начать замер", "Measure now")}
                              </button>
                              <button
                                type="button"
                                className="press peripheral-refresh"
                                onClick={() => setManualConfirm(null)}
                              >
                                {t("Отмена", "Cancel")}
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="press peripheral-refresh"
                            disabled={manualBusy !== null}
                            onClick={() => {
                              setManualError(null);
                              setManualConfirm(d.id);
                            }}
                          >
                            {manualBusy === d.id
                              ? t("Измеряю…", "Measuring…")
                              : t("Измерить заряд", "Measure battery")}
                          </button>
                        )}
                      </div>
                    )}
                    {manualError?.id === d.id && (
                      <span className="peripheral-manual-error" role="status">
                        {manualMessage(manualError.code)}
                      </span>
                    )}
                  </div>
                  <div className="peripheral-device-reading">
                    <span>
                      {number(d)}
                      {d.charging === true &&
                        preferences.peripheralCharging !== false && (
                          <DeviceIcon kind="charging" size={13} />
                        )}
                    </span>
                    {d.percent !== null && (
                      <span
                        className="peripheral-meter"
                        role="meter"
                        aria-label={t("Заряд", "Battery level")}
                        aria-valuenow={d.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${d.percent}%` }} />
                      </span>
                    )}
                  </div>
                  {d.present && d.connected !== false ? (
                    <div className="peripheral-row-actions">
                      <button
                        className="press peripheral-visibility"
                        type="button"
                        disabled={saving !== null}
                        onClick={() => void hide(d)}
                        aria-pressed={
                          !preferences.peripheralHidden?.includes(d.id)
                        }
                        title={t(
                          "Показывать в строке на главной",
                          "Show in the Home battery row",
                        )}
                        aria-label={`${t("В строке", "In Home row")}: ${displayName(d)}`}
                      >
                        <DeviceIcon
                          kind={
                            preferences.peripheralHidden?.includes(d.id)
                              ? "eyeOff"
                              : "eye"
                          }
                        />
                      </button>
                      <button
                        className="press peripheral-visibility"
                        type="button"
                        disabled={saving !== null}
                        onClick={() => void mute(d)}
                        data-notifications-active={peripheralNotificationsActive(
                          d.id,
                          preferences,
                        )}
                        aria-pressed={
                          !preferences.peripheralMuted?.includes(d.id)
                        }
                        title={
                          preferences.peripheralAlerts !== true
                            ? t(
                                "Общие уведомления выключены в настройках. Здесь можно разрешить или заглушить это устройство.",
                                "Notifications are turned off in Settings. Here you can allow or mute this device.",
                              )
                            : preferences.peripheralMuted?.includes(d.id)
                              ? t(
                                  "Уведомления устройства заглушены",
                                  "Device notifications are muted",
                                )
                              : peripheralNotificationsActive(d.id, preferences)
                                ? t(
                                    "Уведомления устройства включены",
                                    "Device notifications are enabled",
                                  )
                                : t(
                                    "Все виды уведомлений выключены в настройках",
                                    "All notification types are turned off in Settings",
                                  )
                        }
                        aria-label={`${t("Уведомления", "Notifications")}: ${displayName(d)}`}
                      >
                        <DeviceIcon
                          kind={
                            preferences.peripheralMuted?.includes(d.id)
                              ? "bellOff"
                              : "bell"
                          }
                        />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="press peripheral-visibility"
                      type="button"
                      onClick={() => setDismissed([...dismissed, d.id])}
                      aria-label={t(
                        "Убрать отключённое устройство",
                        "Dismiss disconnected device",
                      )}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!rows.length && (
                <div className="peripheral-empty">
                  {snapshot.loading
                    ? t("Читаю устройства…", "Reading devices…")
                    : t(
                        "Поддерживаемые устройства с батареей не найдены",
                        "No supported battery-powered devices found",
                      )}
                </div>
              )}
            </div>
            <footer>
              {t(
                "Нажми на имя, чтобы изменить его",
                "Click a name to rename it",
              )}
            </footer>
            {(error || snapshot.error) && (
              <div className="peripheral-error" role="status">
                {t(
                  "Не удалось обновить. Попробуй ещё раз.",
                  "Could not update. Please try again.",
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
