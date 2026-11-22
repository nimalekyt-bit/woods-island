import { React } from "../react";
import type { PeripheralPreferences } from "./model";
import "./peripherals.css";
export function PeripheralSettings({
  preferences: p,
  save,
  ru,
}: {
  preferences: PeripheralPreferences;
  save: (patch: Partial<PeripheralPreferences>) => void;
  ru: boolean;
}) {
  const t = (a: string, b: string) => (ru ? a : b);
  return (
    <section
      className="peripheral-settings"
      aria-label={t("Заряд устройств", "Device batteries")}
    >
      <header>{t("Заряд устройств", "Device batteries")}</header>
      <label className="peripheral-setting">
        <span>
          {t("Показывать на главной", "Show on Home")}
          <small>
            {t(
              "Иконки и проценты, полная карточка по нажатию. При выключении опрос останавливается.",
              "Icons and percentages, with full details on click. Turning this off stops polling.",
            )}
          </small>
        </span>
        <input
          type="checkbox"
          checked={p.showPeripherals !== false}
          onChange={(e) => save({ showPeripherals: e.target.checked })}
        />
      </label>
      {p.showPeripherals !== false && (
        <div className="peripheral-settings-options">
          <label className="peripheral-setting">
            <span>
              {t("Устройств в компактной строке", "Devices in the compact row")}
              <small>
                {t(
                  "Остальные доступны в карточке. Каждое устройство можно скрыть из строки.",
                  "The rest remain available in the card. Individual devices can be hidden from the row.",
                )}
              </small>
            </span>
            <select
              value={p.peripheralLimit ?? 3}
              onChange={(e) =>
                save({ peripheralLimit: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="peripheral-setting">
            <span>{t("Порядок устройств", "Device order")}</span>
            <select
              value={p.peripheralSort ?? "type"}
              onChange={(e) => save({ peripheralSort: e.target.value })}
            >
              <option value="type">{t("По типу", "By type")}</option>
              <option value="name">{t("По названию", "By name")}</option>
              <option value="charge">
                {t("Низкий заряд первым", "Lowest charge first")}
              </option>
            </select>
          </label>
          <label className="peripheral-setting">
            <span>
              {t(
                "Показывать неизвестный заряд",
                "Show unavailable battery levels",
              )}
              <small>
                {t(
                  "В строке будет «—». В карточке остаётся имя устройства и причина.",
                  "Shown as “—” in the row. The card keeps the device name and reason.",
                )}
              </small>
            </span>
            <input
              type="checkbox"
              checked={p.peripheralUnknown !== false}
              onChange={(e) => save({ peripheralUnknown: e.target.checked })}
            />
          </label>
          <label className="peripheral-setting">
            <span>
              {t("Значок зарядки", "Charging indicator")}
              <small>
                {t(
                  "Только когда устройство передаёт это состояние.",
                  "Only when the device reports its charging state.",
                )}
              </small>
            </span>
            <input
              type="checkbox"
              checked={p.peripheralCharging !== false}
              onChange={(e) => save({ peripheralCharging: e.target.checked })}
            />
          </label>
          <label className="peripheral-setting">
            <span>
              {t("Уведомления устройств", "Device notifications")}
              <small>
                {t(
                  "Короткие события в острове. Только подтверждённые изменения.",
                  "Brief Island events, only for confirmed changes.",
                )}
              </small>
            </span>
            <input
              type="checkbox"
              checked={p.peripheralAlerts === true}
              onChange={(e) => save({ peripheralAlerts: e.target.checked })}
            />
          </label>
          {p.peripheralAlerts === true && (
            <>
              <label className="peripheral-setting">
                <span>
                  {t("Низкий заряд", "Low battery")}
                  <small>
                    {t(
                      "Один раз за цикл разряда.",
                      "Once per discharge cycle.",
                    )}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={p.peripheralNotifyLow !== false}
                  onChange={(e) =>
                    save({ peripheralNotifyLow: e.target.checked })
                  }
                />
              </label>
              <label className="peripheral-setting">
                <span>
                  {t("Начало зарядки", "Charging started")}
                  <small>
                    {t(
                      "Если устройство сообщает состояние зарядки.",
                      "When the device reports its charging state.",
                    )}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={p.peripheralNotifyCharging !== false}
                  onChange={(e) =>
                    save({ peripheralNotifyCharging: e.target.checked })
                  }
                />
              </label>
              <label className="peripheral-setting">
                <span>{t("Остановка зарядки", "Charging stopped")}</span>
                <input
                  type="checkbox"
                  checked={
                    (p.peripheralNotifyUnplugged ??
                      p.peripheralNotifyCharging) !== false
                  }
                  onChange={(e) =>
                    save({ peripheralNotifyUnplugged: e.target.checked })
                  }
                />
              </label>
              <label className="peripheral-setting">
                <span>{t("Заряд достиг 100%", "Battery reached 100%")}</span>
                <input
                  type="checkbox"
                  checked={p.peripheralNotifyFull !== false}
                  onChange={(e) =>
                    save({ peripheralNotifyFull: e.target.checked })
                  }
                />
              </label>
              <label className="peripheral-setting">
                <span>
                  {t("Подключение устройства", "Device connected")}
                  <small>
                    {t(
                      "Потеря связи подтверждается повторным чтением. Отключение USB-приёмника показывается отдельно; отсутствие ответа не означает выключение устройства.",
                      "Connection loss requires a second reading. USB removal is reported separately; a missing response does not mean the device is off.",
                    )}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={p.peripheralNotifyConnection === true}
                  onChange={(e) =>
                    save({ peripheralNotifyConnection: e.target.checked })
                  }
                />
              </label>
              <label className="peripheral-setting">
                <span>
                  {t("Отключение устройства", "Device disconnected")}
                  <small>
                    {t(
                      "Только подтверждённая потеря связи или отключение USB.",
                      "Only a confirmed connection loss or USB removal.",
                    )}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={
                    p.peripheralNotifyDisconnection ??
                    p.peripheralNotifyConnection === true
                  }
                  onChange={(e) =>
                    save({ peripheralNotifyDisconnection: e.target.checked })
                  }
                />
              </label>
            </>
          )}
          <label className="peripheral-setting">
            <span>{t("Порог низкого заряда", "Low battery threshold")}</span>
            <select
              value={p.peripheralLowThreshold ?? 20}
              onChange={(e) =>
                save({ peripheralLowThreshold: Number(e.target.value) })
              }
            >
              {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
          {!!p.peripheralHidden?.length && (
            <button
              type="button"
              className="press peripheral-refresh"
              onClick={() => save({ peripheralHidden: [] })}
            >
              {t(
                "Вернуть все скрытые устройства в строку",
                "Show all hidden devices in the row",
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
