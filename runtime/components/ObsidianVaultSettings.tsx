import { React } from '../react';
import { invoke } from '../ipc/client';
import { H as translate } from '../compat/shared.js';

export function ObsidianVaultSettings() {
  const [path, setPath] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    invoke('settings_get').then(settings => { if (mounted) setPath(settings.obsidianVaultPath); })
      .catch(error => { if (mounted) setMessage(String(error)); });
    return () => { mounted = false; };
  }, []);
  return <form className="flex flex-col gap-2 px-4 py-3" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const value = path.trim();
      if (!value) throw new Error(translate('Укажи путь к хранилищу', 'Enter a vault path'));
      const warnings = await invoke('settings_set', { settings: { obsidianVaultPath: value } });
      if (warnings.length) throw new Error(warnings.join('\n'));
      setMessage(translate('Сохранено. Экспорт — кнопкой «В Obsidian» в заметке.', 'Saved. Export with “To Obsidian” in a note.'));
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }}>
    <label className="text-[12px] text-white/85">
      {translate('Хранилище Obsidian для экспорта заметок', 'Obsidian vault for note exports')}
      <input data-obsidian-path type="text" value={path} onChange={event => setPath(event.target.value)}
        spellCheck={false} className="mt-2 w-full rounded-lg bg-black/40 p-2.5 font-mono text-[12px] text-white/85 outline-none" />
    </label>
    <button type="submit" disabled={busy} className="press h-8 rounded-lg bg-white/10 px-3 text-[12px] text-white/85 disabled:opacity-40">{translate('Сохранить путь', 'Save vault path')}</button>
    <span role="status" className="text-[12px] text-white/45">{message}</span>
  </form>;
}
