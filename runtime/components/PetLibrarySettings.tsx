import { React } from '../react';
import { refreshPets, usePetLibrary } from '../characters/pet-library';

export function PetLibrarySettings({ language }: { language: string }) {
  const library = usePetLibrary();
  const [busy, setBusy] = React.useState(false);
  const en = language === 'en';
  const ready = library.pets.filter(pet => pet.available).length;
  return <div className="flex flex-col gap-2 rounded-2xl bg-white/[0.045] p-3">
    <div className="text-sm font-medium">{en ? 'Local Codex pets' : 'Локальные питомцы Codex'}</div>
    <p className="text-xs text-white/55">{en
      ? 'Imported from Codex installed on this computer. Artwork stays in your local profile and is not bundled with Woods Island.'
      : 'Импорт из установленного на этом компьютере Codex. Рисунки хранятся в локальном профиле и не входят в комплект Woods Island.'}</p>
    <div data-pet-library-status={library.status} className="text-xs text-white/65">
      {en ? `Available: ${ready}/9` : `Доступно: ${ready}/9`}
      {library.status === 'loading' ? (en ? ' · Loading…' : ' · Загрузка…') : ''}
    </div>
    {library.error && <p role="status" className="text-xs text-white/55">{en ? 'Import unavailable: ' : 'Импорт недоступен: '}{library.error}</p>}
    <button data-pet-import disabled={busy || library.status === 'loading'}
      onClick={async () => { setBusy(true); try { await refreshPets(true); } finally { setBusy(false); } }}
      className="self-start rounded-lg bg-white/10 px-3 py-2 text-xs disabled:opacity-40">
      {busy ? (en ? 'Importing…' : 'Импорт…') : (en ? 'Import from installed Codex' : 'Импортировать из установленного Codex')}
    </button>
  </div>;
}
