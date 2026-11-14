const formatters = new Map<string, Intl.DateTimeFormat>();

/** A UTC-shaped Date whose fields represent the chosen city's wall clock. */
export function weatherDate(seconds: number, zone: string | number): Date {
  if (typeof zone === 'number') return new Date((seconds + zone) * 1000);
  const fixed = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (fixed) return new Date((seconds + (fixed[1] === '-' ? -1 : 1) * (Number(fixed[2]) * 3600 + Number(fixed[3]) * 60)) * 1000);
  try {
    let formatter = formatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
      if (formatters.size >= 16) formatters.delete(formatters.keys().next().value!);
      formatters.set(zone,formatter);
    }
    const parts = Object.fromEntries(formatter.formatToParts(seconds * 1000).map(part => [part.type,part.value]));
    return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second)));
  } catch { return new Date(seconds * 1000); }
}
