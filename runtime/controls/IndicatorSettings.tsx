import { React } from "../react";
import { H as t } from "../compat/shared.js";
import {
  LOAD_PARTS,
  loadParts,
  type IndicatorSettings as Preferences,
} from "./indicator-model";
import "./controls.css";
export function IndicatorSettings({
  settings,
  save,
  Row,
  Choice,
}: {
  settings: Preferences;
  save: (patch: Partial<Preferences>) => void;
  Row: any;
  Choice: any;
}) {
  const selected = loadParts(settings);
  return (
    <>
      <Row
        title={t("Заряд устройств в пилюле", "Device battery in the pill")}
        hint={t(
          "Показывает устройство с самым низким известным зарядом. Уведомления настраиваются отдельно ниже.",
          "Shows the device with the lowest known battery. Configure notifications separately below.",
        )}
        stacked
      >
        <Choice
          value={settings.deviceBattery ?? "off"}
          onChange={(deviceBattery: string) => save({ deviceBattery })}
          options={[
            { value: "off", label: t("Нет", "Off") },
            { value: "low", label: t("Низкий заряд", "Low battery") },
            { value: "always", label: t("Всегда", "Always") },
          ]}
        />
      </Row>
      {settings.deviceBattery !== "off" &&
        settings.deviceBattery !== undefined && (
          <Row title={t("Порог низкого заряда", "Low battery threshold")}>
            <Choice
              value={String(settings.deviceBatteryLow ?? 20)}
              onChange={(value: string) =>
                save({ deviceBatteryLow: Number(value) })
              }
              options={[10, 15, 20, 30].map((value) => ({
                value: String(value),
                label: `${value}%`,
              }))}
            />
          </Row>
        )}
      <Row
        title={t("Нагрузка в пилюле", "System load in the pill")}
        hint={t(
          "Выбери показатели. Когда показ выключен и центр управления закрыт, сбор данных останавливается.",
          "Choose the readings. Collection stops when none are shown and Control Center is closed.",
        )}
        stacked
      >
        <div className="flex flex-wrap gap-1.5">
          {LOAD_PARTS.map((part) => (
            <button
              key={part}
              aria-pressed={selected.includes(part)}
              onClick={() =>
                save({
                  loadInPill: selected.includes(part)
                    ? selected.filter((value) => value !== part)
                    : [...selected, part],
                })
              }
              className={`press rounded-full px-3 py-1.5 text-[12px] ${selected.includes(part) ? "bg-white/20 text-ink" : "bg-white/5 text-ink-3 hover:bg-white/10"}`}
            >
              {part === "net" ? t("Сеть", "Network") : part.toUpperCase()}
            </button>
          ))}
        </div>
      </Row>
    </>
  );
}
