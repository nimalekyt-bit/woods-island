/** Native WebView activation can reset DOM focus. Focus the input reliably after it completes. */
export function focusInputAfterActivation(
  input: () => Pick<HTMLElement, 'focus'> | null,
  activate: () => Promise<unknown>,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'> | null =
    typeof window === 'undefined' ? null : window,
) {
  let cancelled = false;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let rafId = 0;
  const focus = () => {
    if (!cancelled) input()?.focus({ preventScroll: true });
  };
  const ensureBrowserFocus = () => {
    if (cancelled || typeof document === 'undefined') return;
    const el = input();
    if (el && document.activeElement !== (el as unknown as Element)) {
      el.focus({ preventScroll: true });
    }
  };
  const afterActivate = () => {
    if (cancelled) return;
    focus();
    if (typeof document !== 'undefined') {
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(ensureBrowserFocus);
      }
      if (typeof setTimeout === 'function') {
        for (const delay of [45, 130]) {
          timers.push(setTimeout(ensureBrowserFocus, delay));
        }
      }
    }
  };
  // A delayed OS/WebView focus notification can follow the IPC response.
  events?.addEventListener('focus', focus);
  void Promise.resolve()
    .then(() => {
      if (!cancelled) return activate();
    })
    .then(afterActivate)
    .catch(afterActivate);
  return () => {
    cancelled = true;
    events?.removeEventListener('focus', focus);
    if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    for (const id of timers) clearTimeout(id);
  };
}
