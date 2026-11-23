import { React } from '../react';
import { shiftReminder, weekdayChoices } from './calendar';
type Repeat = { days: number[]; h: number; m: number };
export function ReminderAdjustments({ date, weekday, language, onShift, onSave }: {
  date: Date; weekday: boolean; language: string; onShift: (minutes: number) => void; onSave: (date: Date, repeat?: Repeat) => void;
}) {
  const ru = language === 'ru', text = (ruText: string, enText: string) => ru ? ruText : enText;
  const choices = weekday ? weekdayChoices(date) : null;
  return <>
    <div data-reminder-nudge className="flex shrink-0 items-center gap-1.5 px-0.5">
      {[{ minutes: 1440, label: text('день', 'day'), before: text('На день раньше', 'A day earlier'), after: text('На день позже', 'A day later') },
        { minutes: 15, label: text('15 мин', '15 min'), before: text('На 15 минут раньше', '15 minutes earlier'), after: text('На 15 минут позже', '15 minutes later') }].map(item =>
        <div key={item.minutes} className="flex h-[22px] min-w-0 flex-1 items-center rounded-full bg-white/[0.08] text-[10.5px] font-medium text-ink-2">
          <button data-reminder-shift={-item.minutes} aria-label={item.before} title={item.before} disabled={shiftReminder(date, -item.minutes).getTime() <= Date.now()} onClick={() => onShift(-item.minutes)} className="press grid h-full w-7 shrink-0 place-items-center rounded-l-full text-[13px] hover:bg-white/14 disabled:pointer-events-none disabled:opacity-30">−</button>
          <span className="min-w-0 flex-1 truncate text-center text-ink-3">{item.label}</span>
          <button data-reminder-shift={item.minutes} aria-label={item.after} title={item.after} onClick={() => onShift(item.minutes)} className="press grid h-full w-7 shrink-0 place-items-center rounded-r-full text-[13px] hover:bg-white/14">+</button>
        </div>)}
    </div>
    {choices && <div data-reminder-weeks className="flex shrink-0 flex-wrap items-center gap-1 px-0.5 text-[10.5px] text-ink-3">
      <span>{text('или', 'or')}</span>
      {choices.later.map((later, index) => <button key={later.getTime()} data-reminder-week={index + 1} title={later.toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} onClick={() => onSave(later)} className="press h-[22px] shrink-0 rounded-full bg-white/[0.08] px-2 font-medium text-ink-2 hover:bg-white/14">
        {later.toLocaleDateString(ru ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}
      </button>)}
      <button data-reminder-weekly title={text('Повторять в этот день недели', 'Repeat on this weekday')} onClick={() => onSave(date, choices.weekly)} className="press h-[22px] min-w-0 truncate rounded-full bg-white/[0.08] px-2 font-medium text-ink-2 hover:bg-white/14">{text('Каждую неделю', 'Every week')}</button>
    </div>}
  </>;
}
