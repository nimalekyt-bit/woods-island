import { React } from '../react';
import type { ReactNode } from 'react';
import { invoke } from '../ipc/client';

const cache = new Map<string, { value: Promise<string | null>; until: number }>();
const LIMIT = 128;
export function getProgramIcon(path: string): Promise<string | null> {
  const saved = cache.get(path);
  if (saved && saved.until > Date.now()) {
    cache.delete(path); cache.set(path, saved);
    return saved.value;
  }
  const entry = { value: Promise.resolve<string | null>(null), until: Date.now() + 300000 };
  entry.value = invoke('palette_icon', { path }).catch(() => null).then(value => {
    if (!value) entry.until = Date.now() + 30000;
    return value;
  });
  cache.delete(path); cache.set(path, entry);
  while (cache.size > LIMIT) cache.delete(cache.keys().next().value!);
  return entry.value;
}
export function ProgramIcon({ path, fallback }: { path: string; fallback?: ReactNode }) {
  const [image, setImage] = React.useState<{ path: string; value: string | null } | null>(null);
  React.useEffect(() => {
    let mounted = true;
    getProgramIcon(path).then(value => { if (mounted) setImage({ path, value }); });
    return () => { mounted = false; };
  }, [path]);
  return image?.path === path && image.value
    ? <img data-program-icon src={image.value} alt="" className="size-6 object-contain" draggable={false} />
    : <>{fallback}</>;
}
