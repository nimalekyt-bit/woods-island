import { React } from "../react";
import { ot as useIslandStore } from "../compat/island-store.js";
export const islandStore = useIslandStore as typeof useIslandStore & {
  getState: () => any;
  setState: (state: Record<string, unknown>) => void;
};

/** Hidden and collapsed pages keep their state without running control queries. */
export function useVisibleControls(tab = "home") {
  const open = useIslandStore(
    (state: any) => state.expanded && state.tab === tab,
  );
  const [visible, setVisible] = React.useState(() => !document.hidden);
  React.useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  return !!open && visible;
}

export function holdControl(held: boolean) {
  islandStore.getState().setHoldOpen(held);
}
