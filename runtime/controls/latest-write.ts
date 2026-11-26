/** Serialize slow hardware writes, retain only the newest pending slider value. */
export function latestWriter<T>(
  write: (value: T) => Promise<void>,
  failed: (error: unknown) => void,
  delay = 120,
) {
  let pending: T | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    running = false,
    disposed = false;
  const run = async () => {
    clearTimeout(timer);
    timer = undefined;
    if (running || disposed) return;
    running = true;
    try {
      while (pending !== undefined && !disposed) {
        const value = pending;
        pending = undefined;
        try {
          await write(value);
        } catch (error) {
          if (!disposed) failed(error);
        }
      }
    } finally {
      running = false;
    }
  };
  return {
    isBusy() { return running || pending !== undefined || timer !== undefined; },
    push(value: T, final = false) {
      if (disposed) return;
      pending = value;
      if (final) void run();
      else if (!timer && !running) timer = setTimeout(() => void run(), delay);
    },
    flush() {
      void run();
    },
    dispose() {
      disposed = true;
      pending = undefined;
      clearTimeout(timer);
    },
  };
}
