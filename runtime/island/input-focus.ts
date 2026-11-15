/** Native WebView activation can reset DOM focus. Focus the input after it completes. */
export function focusInputAfterActivation(
  input: () => Pick<HTMLElement, 'focus'> | null,
  activate: () => Promise<unknown>,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'> | null =
    typeof window === 'undefined' ? null : window,
) {
  let cancelled = false;
  const focus = () => {
    if (!cancelled) input()?.focus({ preventScroll: true });
  };
  // A delayed OS/WebView focus notification can follow the IPC response.
  events?.addEventListener('focus', focus);
  void Promise.resolve().then(() => {
    if (!cancelled) return activate();
  }).then(focus).catch(focus);
  return () => { cancelled = true; events?.removeEventListener('focus', focus); };
}
