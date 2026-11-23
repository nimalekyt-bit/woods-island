export interface HolidaySettings {
  reducedMotion?: 'auto' | 'reduce' | 'full';
  snow?: 'auto' | 'on' | 'off';
  snowFrom?: string;
  snowTo?: string;
  snowAmount?: number;
  snowFall?: boolean;
  snowCap?: boolean;
  snowScreen?: boolean;
  garland?: 'off' | 'blink' | 'wave' | 'music';
}
export const HOLIDAY_DEFAULTS = Object.freeze({
  snow: 'auto', snowFrom: '12-15', snowTo: '01-15', snowAmount: 100,
  snowFall: true, snowCap: true, snowScreen: false, garland: 'off',
} as const);

/** A recurring calendar day can include February 29, but never February 30. */
export function recurringDay(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return fallback;
  const month = Number(match[1]), day = Number(match[2]);
  const probe = new Date(2000, month - 1, day);
  return month >= 1 && month <= 12 && day >= 1 &&
    probe.getMonth() === month - 1 && probe.getDate() === day
    ? `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : fallback;
}
export function holidayDateActive(date: Date, from?: string, to?: string): boolean {
  if (!Number.isFinite(date.getTime())) return false;
  const value = (date.getMonth() + 1) * 100 + date.getDate();
  const start = Number(recurringDay(from, HOLIDAY_DEFAULTS.snowFrom).replace('-', ''));
  const end = Number(recurringDay(to, HOLIDAY_DEFAULTS.snowTo).replace('-', ''));
  return start <= end ? value >= start && value <= end : value >= start || value <= end;
}
export function snowDensity(value: unknown): number {
  return Math.max(25, Math.min(300, typeof value === 'number' && Number.isFinite(value) ? value : 100)) / 100;
}
export function holidayPolicy(settings: HolidaySettings, context: {
  date: Date; visible: boolean; reducedMotion: boolean; capsule: boolean; fullscreen?: boolean;
}) {
  const selected = settings.snow === 'on' || settings.snow !== 'off' &&
    holidayDateActive(context.date, settings.snowFrom, settings.snowTo);
  const active = selected && context.visible && !context.fullscreen;
  const motion = active && !context.reducedMotion;
  const garland = settings.garland === 'blink' || settings.garland === 'wave' || settings.garland === 'music'
    ? settings.garland : 'off';
  return {
    active,
    fall: motion && settings.snowFall !== false,
    cap: active && context.capsule && settings.snowCap !== false,
    screen: motion && settings.snowScreen === true,
    garland: active ? garland : 'off',
    animateGarland: motion,
    density: snowDensity(settings.snowAmount),
  } as const;
}
