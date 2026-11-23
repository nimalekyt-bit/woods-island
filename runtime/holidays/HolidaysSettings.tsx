import { React } from '../react';
import type { ComponentType, ReactNode } from 'react';
import { H as t } from '../compat/shared.js';
import { HolidayEffects } from './HolidayEffects';
import { HOLIDAY_DEFAULTS, recurringDay, type HolidaySettings } from './model';
import './holidays.css';

function AnnualDate({value,fallback,onChange,label}: {value?:string;fallback:string;label:string;onChange:(value:string)=>void}) {
  const day=recurringDay(value,fallback),[month,date]=day.split('-').map(Number);
  const max=new Date(2000,month,0).getDate(),lang=t('ru-RU','en-US');
  return <span className="wi-holiday-date" aria-label={label}>
    <select aria-label={t(`${label}: день`,`${label}: day`)} value={date} onChange={event=>onChange(`${String(month).padStart(2,'0')}-${event.target.value.padStart(2,'0')}`)}>
      {Array.from({length:max},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}
    </select>
    <select aria-label={t(`${label}: месяц`,`${label}: month`)} value={month} onChange={event=>{
      const next=Number(event.target.value),nextDay=Math.min(date,new Date(2000,next,0).getDate());
      onChange(`${String(next).padStart(2,'0')}-${String(nextDay).padStart(2,'0')}`);
    }}>
      {Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Date(2000,i,1).toLocaleDateString(lang,{month:'short'})}</option>)}
    </select>
  </span>;
}
export function HolidaysSettings({settings,save,Row,Toggle,Choice,Slider}: {
  settings:HolidaySettings & {style?:string;theme?:string};save:(patch:Partial<HolidaySettings>)=>void;
  Row:ComponentType<{title:string;hint?:string;stacked?:boolean;children:ReactNode}>;
  Toggle:ComponentType<{value:boolean;onChange:(value:boolean)=>void}>;
  Choice:ComponentType<{value:string;onChange:(value:string)=>void;options:{value:string;label:string}[]}>;
  Slider:ComponentType<{value:number;min:number;max:number;step:number;unit:string;onChange:(value:number)=>void}>;
}) {
  const enabled=settings.snow!=='off';
  const light=settings.theme==='light'||settings.theme==='auto'&&matchMedia('(prefers-color-scheme: light)').matches;
  return <div data-holidays-settings>
    <div className="wi-holiday-preview">
      <div className="wi-holiday-preview-pill" data-island-theme={light?'light':'dark'}><span>Woods Island</span><HolidayEffects settings={{...settings,snow:'on',snowScreen:false}} width={330} height={48} capsule visible={enabled}/></div>
    </div>
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.045]">
      <Row title={t('Новый год на острове','New Year on the island')} hint={t('Снег и огоньки в выбранные дни или круглый год.','Snow and lights on selected days or all year round.')} stacked>
        <Choice value={settings.snow??'auto'} onChange={value=>save({snow:value as HolidaySettings['snow']})} options={[{value:'auto',label:t('По датам','By dates')},{value:'on',label:t('Всегда','Always')},{value:'off',label:t('Нет','Off')}]}/>
      </Row>
      {(settings.snow??'auto')==='auto'&&<Row title={t('Когда идёт снег','When it snows')} hint={t('Каждый год, оба дня включительно.','Every year, including both days.')} stacked>
        <div className="wi-holiday-dates" data-snow-dates>
          <span>{t('с','from')}</span><AnnualDate label={t('Начало','Start')} value={settings.snowFrom} fallback={HOLIDAY_DEFAULTS.snowFrom} onChange={snowFrom=>save({snowFrom})}/>
          <span>{t('по','to')}</span><AnnualDate label={t('Конец','End')} value={settings.snowTo} fallback={HOLIDAY_DEFAULTS.snowTo} onChange={snowTo=>save({snowTo})}/>
        </div>
      </Row>}
      {enabled&&<>
        <Row title={t('Снег из-под острова','Snow beneath the island')} hint={t('Снежинки падают вниз и тают у нижнего края.','Flakes fall down and fade at the bottom.')}><Toggle value={settings.snowFall!==false} onChange={snowFall=>save({snowFall})}/></Row>
        <Row title={t('Шапка снега на острове','A cap of snow on the island')} hint={settings.style==='capsule'?t('Сугробы растягиваются с пилюлей, сужение стряхивает снег с краёв.','Drifts stretch with the pill; narrowing sheds snow from the edges.'):t('Появится в стиле «Капсула».','Available with the Capsule style.')}><Toggle value={settings.snowCap!==false} onChange={snowCap=>save({snowCap})}/></Row>
        <Row title={t('Гирлянда','Garland')} hint={t('Огоньки по краю острова. Режим «Под музыку» следует за звуком.','Lights along the edge. With the music follows the audio.')} stacked>
          <Choice value={settings.garland??'off'} onChange={value=>save({garland:value as HolidaySettings['garland']})} options={[{value:'off',label:t('Нет','Off')},{value:'blink',label:t('Мигает','Twinkles')},{value:'wave',label:t('Волна','Wave')},{value:'music',label:t('Под музыку','With the music')}]}/>
        </Row>
        <Row title={t('Сколько снега','How much snow')} hint={t('100% — обычный снег, 300% — метель.','100% is normal snowfall; 300% is a blizzard.')} stacked><Slider value={settings.snowAmount??100} min={25} max={300} step={25} unit="%" onChange={snowAmount=>save({snowAmount})}/></Row>
        <Row title={t('Снег по всему экрану','Snow over the whole screen')} hint={t('Поверх окон, с пропуском щелчков. Исчезает над программой на весь экран.','Above windows, with clicks passing through. Hidden while an app is fullscreen.')}><Toggle value={settings.snowScreen===true} onChange={snowScreen=>save({snowScreen})}/></Row>
      </>}
    </div>
  </div>;
}
