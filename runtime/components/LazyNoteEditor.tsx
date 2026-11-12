import { React } from '../react';
import type { ReactNode } from 'react';

const Editor = React.lazy(() => import('./NoteEditorCompat.js').then(module => ({ default: module.NoteEditor })));
export function LazyNoteEditor(props: {
  text: string;
  onChange: (text: string) => void;
  placeholder?: string;
  footer: (editor: unknown) => ReactNode;
}) {
  return <React.Suspense fallback={<div role="status" className="min-h-0 flex-1 rounded-2xl bg-tile p-3.5 text-ink-3">…</div>}>
    <Editor {...props} placeholder={props.placeholder} />
  </React.Suspense>;
}
