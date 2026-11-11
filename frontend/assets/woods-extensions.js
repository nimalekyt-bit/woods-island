// Woods-owned additions to the extracted runtime; keep their source readable.
export function validWeatherForecast(value) {
  return value && typeof value.now?.temp === 'number' && typeof value.now?.code === 'number'
    && Array.isArray(value.hours) && value.hours.length > 0
    && value.hours.every(hour => Number.isFinite(hour.time) && hour.time > 0 && hour.time < 1e11)
    && Array.isArray(value.days) && value.days.length > 0;
}
export const woodsInfoIcon = {
  name: 'info', size: 24,
  node: [
    ['circle', {cx: '12', cy: '12', r: '10', key: 'outline'}],
    ['path', {d: 'M12 16v-4', key: 'stem'}],
    ['path', {d: 'M12 8h.01', key: 'dot'}],
  ],
};
export function exportNote({id,title,text}) {
  return window.__TAURI_INTERNALS__.invoke('note_export',{id:id||null,title,text});
}

export function woodsAbout(jsx, t) {
  return jsx.jsxs('section', {
    id: 'pro', 'data-woods-about': true,
    className: 'flex flex-col gap-3 rounded-2xl bg-white/[0.045] p-4 ring-1 ring-white/10',
    children: [
      jsx.jsx('h2', {className: 'text-[15px] font-semibold', children: 'Woods Island'}),
      jsx.jsx('div', {className: 'text-[12.5px] text-white/70', children: t('Бесплатно · Все функции доступны без ключа и подписки', 'Free · All features available without a key or subscription')}),
      jsx.jsx('div', {className: 'text-[12px] leading-snug text-white/55', children: t('Остров для Windows от Никиты Кузнецова (Woods). Музыка, буфер обмена, заметки, экранные инструменты, OBS и ИИ в одном месте.', 'A Windows island by Nikita Kuznetsov (Woods). Music, clipboard, notes, screen tools, OBS and AI in one place.')}),
      jsx.jsx('ul', {className: 'grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-white/70', children: [
        t('Все 25 персонажей', 'All 25 characters'),
        t('Заметки и экспорт в Obsidian', 'Notes and Obsidian export'),
        t('OBS и статусы ИИ-агентов', 'OBS and AI agent status'),
        t('Локальные модели и свои API-ключи', 'Local models and your API keys'),
      ].map(text => jsx.jsx('li', {children: text}, text))}),
      jsx.jsx('div', {className: 'text-[12px] leading-snug text-white/45', children: t('Стоимость внешних ИИ-сервисов зависит от выбранного провайдера. Woods Island не продаёт доступ к ним.', 'External AI service costs depend on your provider. Woods Island does not sell access to them.')}),
    ],
  });
}

export function woodsContact(jsx, t, open) {
  return jsx.jsxs('section', {
    'data-woods-contact': true,
    className: 'flex flex-col gap-3 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10',
    children: [
      jsx.jsx('h2', {className: 'text-[13.5px] font-semibold', children: t('Woods Personal Corp', 'Woods Personal Corp')}),
      jsx.jsx('div', {className: 'text-[12px] text-white/55', children: t('Идеи и сообщения об ошибках — автору проекта.', 'Send ideas and bug reports to the project author.')}),
      jsx.jsxs('div', {className: 'flex gap-2', children: [
        jsx.jsx('button', {'data-woods-telegram': true, className: 'press h-9 rounded-lg bg-white/10 px-4 text-[13px] hover:bg-white/15', onClick: () => void open('https://t.me/woodskilla'), children: 'Telegram · @woodskilla'}),
        jsx.jsx('button', {'data-woods-github': true, className: 'press h-9 rounded-lg bg-white/10 px-4 text-[13px] hover:bg-white/15', onClick: () => void open('https://github.com/nimalekyt-bit'), children: 'GitHub'}),
      ]}),
    ],
  });
}

if (location.pathname.endsWith('/settings.html')) {
  let scheduled=false;
  const install=async()=>{
    scheduled=false;
    const folders=document.querySelector('[data-files-folders]');
    if(!folders||document.querySelector('[data-obsidian-path]'))return;
    try{
      const settings=await window.__TAURI_INTERNALS__.invoke('settings_get');
      if(!folders.isConnected||document.querySelector('[data-obsidian-path]'))return;
      const english=settings.language==='en';
      const form=document.createElement('form');
      form.className='flex flex-col gap-2';
      const label=document.createElement('label');
      label.className='text-[12px] text-white/85';
      label.textContent=english?'Obsidian vault for note exports':'Хранилище Obsidian для экспорта заметок';
      const input=document.createElement('input');
      input.dataset.obsidianPath='';input.type='text';input.value=settings.obsidianVaultPath||'<OBSIDIAN_VAULT>';
      input.className='rounded-lg bg-black/40 p-2.5 font-mono text-[12px] text-white/85 outline-none';
      input.setAttribute('aria-label',label.textContent);input.spellcheck=false;
      label.append(input);
      const submit=document.createElement('button');submit.type='submit';
      submit.className='press h-8 rounded-lg bg-white/10 px-3 text-[12px] text-white/85';
      submit.textContent=english?'Save vault path':'Сохранить путь';
      const message=document.createElement('span');message.className='text-[12px] text-white/45';message.setAttribute('role','status');
      form.append(label,submit,message);
      form.addEventListener('submit',async event=>{
        event.preventDefault();submit.disabled=true;
        try{
          const value=input.value.trim();if(!value)throw new Error(english?'Enter a vault path':'Укажи путь к хранилищу');
          const warnings=await window.__TAURI_INTERNALS__.invoke('settings_set',{settings:{obsidianVaultPath:value}});
          if(warnings.length)throw new Error(warnings.join('\n'));
          message.textContent=english?'Saved. Notes export only when you click “To Obsidian”.':'Сохранено. Экспорт запускается кнопкой «В Obsidian» в заметке.';
        }catch(error){message.textContent=String(error);}finally{submit.disabled=false;}
      });
      folders.insertAdjacentElement('afterend',form);
    }catch(error){console.warn('Woods Obsidian settings:',error);}
  };
  const schedule=()=>{if(!scheduled){scheduled=true;setTimeout(install,0);}};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
}
