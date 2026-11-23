export const calendarMonths = [
  /^(январ[ьяе]|янв|jan|january)$/, /^(феврал[ьяе]|февр?|feb|february)$/,
  /^(март[ае]?|мар|mar|march)$/, /^(апрел[ьяе]|апр|apr|april)$/,
  /^(ма[йяе]|may)$/, /^(июн[ьяе]?|june?)$/, /^(июл[ьяе]?|july?)$/,
  /^(август[ае]?|авг|aug|august)$/, /^(сентябр[ьяе]|сент?|sept?|september)$/,
  /^(октябр[ьяе]|окт|oct|october)$/, /^(ноябр[ьяе]|нояб?|nov|november)$/,
  /^(декабр[ьяе]|дек|dec|december)$/,
];
const noise = new Set(['в', 'во', 'at', 'на', 'on', 'the', 'of']);
const monthNumber = (text: string) => calendarMonths.findIndex(month => month.test(text.replace(/\.$/, '')));
const dayNumber = (text: string) => {
  const match = /^(\d{1,2})(?:-?(?:го|е|ое)|st|nd|rd|th)?$/.exec(text);
  return match ? Number(match[1]) : NaN;
};
function dateAt(year: number, month: number, day: number, hour: number, minute: number): Date | null {
  const date = new Date(year, month, day, hour, minute, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

// undefined means that the existing relative-time parser should handle this expression.
export function calendarDate(expression: string, now = new Date()): Date | null | undefined {
  const tokens = expression.toLowerCase().replace(/ё/g, 'е').replace(/,(?=\s|$)/g, '').split(/\s+/).filter(token => token && !noise.has(token));
  const named = tokens.some(token => monthNumber(token) >= 0);
  const ordinal = /^(\d{1,2})(?:-го|st|nd|rd|th)$/.test(tokens[0] ?? '');
  if (!named && !ordinal) return undefined;
  let day: number, month: number | null = null, year: number | null = null;
  if (named) {
    if (monthNumber(tokens[0] ?? '') >= 0) { month = monthNumber(tokens.shift()!); day = dayNumber(tokens.shift() ?? ''); }
    else { day = dayNumber(tokens.shift() ?? ''); month = monthNumber(tokens.shift() ?? ''); }
    if (month < 0) return null;
    if (/^\d{4}$/.test(tokens[0] ?? '')) year = Number(tokens.shift());
  } else day = dayNumber(tokens.shift() ?? '');
  if (!Number.isInteger(day) || day < 1 || day > 31 || tokens.length > 1) return null;
  const time = tokens.length ? /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(tokens[0]) : ['9', '9', '0'];
  if (!time) return null;
  const hour = Number(time[1]), minute = Number(time[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  if (month !== null) {
    if (year !== null) { if (year < 100 || year > 9999) return null; return dateAt(year, month, day, hour, minute); }
    // Find the next valid occurrence, including February 29 in a leap year.
    for (let offset = 0; offset <= 4; offset++) {
      const date = dateAt(now.getFullYear() + offset, month, day, hour, minute);
      if (date && date > now) return date;
    }
  } else {
    for (let offset = 0; offset < 12; offset++) {
      const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const date = dateAt(base.getFullYear(), base.getMonth(), day, hour, minute);
      if (date && date > now) return date;
    }
  }
  return null;
}

export function shiftReminder(date: Date, minutes: number): Date {
  const days = Math.trunc(minutes / 1440);
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return new Date(shifted.getTime() + (minutes - days * 1440) * 60_000);
}
// Stop a malformed date from being reinterpreted as a shorter suffix or as task text.
export function hasInvalidCalendarDate(expression: string, now = new Date()): boolean {
  const tokens = expression.toLowerCase().replace(/ё/g, 'е').replace(/,(?=\s|$)/g, '').split(/\s+/).filter(token => token && !noise.has(token));
  for (let index = 0; index < tokens.length; index++) {
    if (monthNumber(tokens[index]) >= 0) {
      let start = index, end = index + 2;
      if (Number.isFinite(dayNumber(tokens[index - 1] ?? ''))) { start = index - 1; end = index + 1; }
      else if (!Number.isFinite(dayNumber(tokens[index + 1] ?? ''))) continue;
      if (/^\d{4}$/.test(tokens[end] ?? '')) end++;
      if (/^\d{1,2}(?:[:.]\d{2})?$/.test(tokens[end] ?? '')) end++;
      if (calendarDate(tokens.slice(start, end).join(' '), now) === null) return true;
    }
    const dotted = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/.exec(tokens[index]);
    if (dotted && (dotted[3] || /^\d{1,2}(?:[:.]\d{2})?$/.test(tokens[index + 1] ?? ''))) {
      const year = dotted[3] ? Number(dotted[3]) + (dotted[3].length === 2 ? 2000 : 0) : now.getFullYear();
      if (!dateAt(year, Number(dotted[2]) - 1, Number(dotted[1]), 9, 0)) return true;
    }
  }
  return false;
}
export function weekdayChoices(date: Date) {
  return { later: [7, 14].map(days => shiftReminder(date, days * 1440)), weekly: { days: [date.getDay()], h: date.getHours(), m: date.getMinutes() } };
}
export function validRepeat(repeat: unknown): boolean {
  if (!repeat || typeof repeat !== 'object') return false;
  const value = repeat as { days?: unknown; h?: unknown; m?: unknown };
  return Array.isArray(value.days) && value.days.length > 0 && value.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
    && Number.isInteger(value.h) && Number(value.h) >= 0 && Number(value.h) <= 23
    && Number.isInteger(value.m) && Number(value.m) >= 0 && Number(value.m) <= 59;
}
