import { React } from '../react';
import { H as t } from '../compat/shared.js';
import type { SettingRow } from './ReliabilitySettings';

export function WeatherTimezoneSettings({value,save,Row}:{value:string;save:(settings:Record<string,unknown>)=>void;Row:SettingRow}) {
  const [zone,setZone]=React.useState(value),[manual,setManual]=React.useState(!!value),[error,setError]=React.useState('');
  React.useEffect(()=>{setZone(value);setManual(!!value);},[value]);
  const submit=()=>{const selected=zone.trim();try{if(selected)new Intl.DateTimeFormat('en',{timeZone:selected}).format();setError('');save({weatherTimezone:selected});}catch{setError(t('Укажи пояс IANA: например Europe/Moscow или Asia/Tokyo.','Enter an IANA zone, such as Europe/London or Asia/Tokyo.'));}};
  const reset=()=>{setZone('');setManual(false);setError('');save({weatherTimezone:''});};
  return <Row title={t('Часовой пояс','Time zone')} hint={manual?t('Например, Europe/Moscow или Asia/Tokyo','For example, Europe/London or Asia/Tokyo'):t('Автоматически по выбранному городу','Automatic, based on the selected city')} stacked={manual}>
    {!manual ? <button className="press h-8 shrink-0 rounded-lg bg-white/[0.08] px-3 text-[12.5px] hover:bg-white/[0.12]" onClick={()=>setManual(true)}>{t('Указать вручную','Set manually')}</button> : <>
    <div className="flex w-full gap-2">
      <input aria-label={t('Часовой пояс города','City time zone')} className="h-9 min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/30 focus:ring-1 focus:ring-white/20" value={zone} onChange={event=>setZone(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();submit();}}} placeholder={t('Автоматически','Automatic')} spellCheck={false}/>
      <button className="press h-9 shrink-0 rounded-lg bg-white/[0.08] px-3 text-[12.5px] hover:bg-white/[0.12]" onClick={submit}>{t('Применить','Apply')}</button>
    </div>
    <button className="wi-text-action" onClick={reset}>{t('Определять автоматически','Detect automatically')}</button>
    </>}
    {error&&<p role="alert" className="wi-error text-[12px]">{error}</p>}
  </Row>;
}

export function WeatherDataSources() {
  return <details className="px-4 py-3 text-[12px] leading-snug text-white/45">
    <summary style={{cursor:'pointer'}}>{t('Источники и данные','Sources and data')}</summary>
    <p style={{margin:'10px 0 0'}}>{t('Прогноз — MET Norway, поиск городов — OpenStreetMap. Для автоматического часового пояса выбранные координаты отправляются в Open-Meteo; результат сохраняется локально. При ручном выборе пояса этот запрос не нужен. Местоположение по IP не определяется.','Forecasts come from MET Norway and city search from OpenStreetMap. Automatic time zone detection sends the selected coordinates to Open-Meteo and caches the result locally. Setting a zone manually avoids this request. Your location is not inferred from your IP.')}</p>
  </details>;
}
