import { React } from "../react";
import type { ComponentType, ReactNode } from "react";
import type { PeripheralPreferences } from "./model";
import "./peripherals.css";

type RowProps = { title: string; hint?: string; children: ReactNode };
type ToggleProps = { value: boolean; onChange: (value: boolean) => void };

export function PeripheralSettings({
  preferences: p,
  save,
  ru,
  Row,
  Toggle,
}: {
  preferences: PeripheralPreferences;
  save: (patch: Partial<PeripheralPreferences>) => void;
  ru: boolean;
  Row: ComponentType<RowProps>;
  Toggle: ComponentType<ToggleProps>;
}) {
  const t = (a: string, b: string) => (ru ? a : b);
  const toggle = (
    key: keyof PeripheralPreferences,
    title: string,
    value: boolean,
    hint?: string,
  ) => (
    <Row title={title} hint={hint}>
      <Toggle value={value} onChange={(next) => save({ [key]: next })} />
    </Row>
  );
  const select = (
    key: "peripheralLimit" | "peripheralSort" | "peripheralLowThreshold",
    title: string,
    value: string | number,
    options: { value: string | number; label: string }[],
    hint?: string,
  ) => (
    <Row title={title} hint={hint}>
      <select
        aria-label={title}
        value={value}
        className="h-9 shrink-0 rounded-lg bg-black/40 px-2 text-[12.5px] text-white/85 outline-none focus:ring-1 focus:ring-white/20"
        onChange={(event) =>
          save({
            [key]:
              key === "peripheralSort"
                ? event.target.value
                : Number(event.target.value),
          })
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Row>
  );
  return (
    <section
      className="peripheral-settings divide-y divide-white/[0.06]"
      aria-label={t("Заряд устройств", "Device batteries")}
    >
      <h3 className="px-4 py-3 text-[13.5px] font-semibold text-white">
        {t("Заряд устройств", "Device batteries")}
      </h3>
      {toggle(
        "showPeripherals",
        t("Показывать на главной", "Show on Home"),
        p.showPeripherals !== false,
        t(
          "Иконки и проценты, полная карточка по нажатию. При выключении опрос останавливается.",
          "Icons and percentages, with full details on click. Turning this off stops polling.",
        ),
      )}
      {p.showPeripherals !== false && (
        <>
          {select(
            "peripheralLimit",
            t("Устройств в компактной строке", "Devices in the compact row"),
            p.peripheralLimit ?? 3,
            [1, 2, 3, 4, 5, 6].map((value) => ({
              value,
              label: String(value),
            })),
            t(
              "Остальные доступны в карточке. Каждое устройство можно скрыть из строки.",
              "The rest remain available in the card. Individual devices can be hidden from the row.",
            ),
          )}
          {select(
            "peripheralSort",
            t("Порядок устройств", "Device order"),
            p.peripheralSort ?? "type",
            [
              { value: "type", label: t("По типу", "By type") },
              { value: "name", label: t("По названию", "By name") },
              {
                value: "charge",
                label: t("Низкий заряд первым", "Lowest charge first"),
              },
            ],
          )}
          {toggle(
            "peripheralUnknown",
            t(
              "Показывать неизвестный заряд",
              "Show unavailable battery levels",
            ),
            p.peripheralUnknown !== false,
            t(
              "В строке будет «—». В карточке остаётся имя устройства и причина.",
              "Shown as “—” in the row. The card keeps the device name and reason.",
            ),
          )}
          {toggle(
            "peripheralCharging",
            t("Значок зарядки", "Charging indicator"),
            p.peripheralCharging !== false,
            t(
              "Только когда устройство передаёт это состояние.",
              "Only when the device reports its charging state.",
            ),
          )}
          {toggle(
            "peripheralAlerts",
            t("Уведомления устройств", "Device notifications"),
            p.peripheralAlerts === true,
            t(
              "Короткие события в острове. Только подтверждённые изменения.",
              "Brief Island events, only for confirmed changes.",
            ),
          )}
          {p.peripheralAlerts === true && (
            <>
              {toggle(
                "peripheralNotifyLow",
                t("Низкий заряд", "Low battery"),
                p.peripheralNotifyLow !== false,
                t("Один раз за цикл разряда.", "Once per discharge cycle."),
              )}
              {toggle(
                "peripheralNotifyCharging",
                t("Начало зарядки", "Charging started"),
                p.peripheralNotifyCharging !== false,
                t(
                  "Если устройство сообщает состояние зарядки.",
                  "When the device reports its charging state.",
                ),
              )}
              {toggle(
                "peripheralNotifyUnplugged",
                t("Остановка зарядки", "Charging stopped"),
                (p.peripheralNotifyUnplugged ?? p.peripheralNotifyCharging) !==
                  false,
              )}
              {toggle(
                "peripheralNotifyFull",
                t("Заряд достиг 100%", "Battery reached 100%"),
                p.peripheralNotifyFull !== false,
              )}
              {toggle(
                "peripheralNotifyConnection",
                t("Подключение устройства", "Device connected"),
                p.peripheralNotifyConnection === true,
                t(
                  "Связь проверяется периодически. Подключение USB-приёмника показывается отдельно.",
                  "Connection is checked periodically. USB receiver attachment is reported separately.",
                ),
              )}
              {toggle(
                "peripheralNotifyDisconnection",
                t("Отключение устройства", "Device disconnected"),
                p.peripheralNotifyDisconnection ??
                  p.peripheralNotifyConnection === true,
                t(
                  "Обычный опрос — раз в минуту, подтверждение потери связи — через 15 секунд. Отсутствие ответа не означает выключение устройства.",
                  "Normal polling runs once a minute; connection loss is checked again after 15 seconds. A missing response does not mean the device is off.",
                ),
              )}
            </>
          )}
          {select(
            "peripheralLowThreshold",
            t("Порог низкого заряда", "Low battery threshold"),
            p.peripheralLowThreshold ?? 20,
            [5, 10, 15, 20, 25, 30, 40, 50].map((value) => ({
              value,
              label: `${value}%`,
            })),
          )}
          {!!p.peripheralHidden?.length && (
            <div className="px-4 py-3">
              <button
                type="button"
                className="press rounded-lg bg-white/10 px-3 py-2 text-[12.5px] text-white/85 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ea2ff]"
                onClick={() => save({ peripheralHidden: [] })}
              >
                {t(
                  "Вернуть все скрытые устройства в строку",
                  "Show all hidden devices in the row",
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
