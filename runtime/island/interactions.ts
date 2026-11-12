import { scheduleTimeout, type Schedule } from '../media/activity';

// Only the fields used by interaction policy cross this port. Feature payloads
// stay in their adapters until their own contracts are migrated.
export interface InteractionState {
  hovered: boolean;
  expanded: boolean;
  palette: boolean;
  peek: unknown;
  dragOver: unknown;
  pinned: boolean;
  holdOpen: boolean;
  draggingOut: boolean;
  webAiActive: boolean;
  asking: boolean;
  openedBy: string | null;
  enteredSinceOpen: boolean;
  tab: string;
  dictation: unknown;
  recording: unknown;
  updating: unknown;
  downloads: readonly unknown[];
  mediaLive: boolean;
  settings: {
    openOnHover?: boolean;
    hoverDelayMs?: number;
    collapseDelayMs?: number;
    mediaPill?: string;
    moduleMedia?: boolean;
  } | null;
}

export function hasPersistentActivity(state: Pick<InteractionState,
  'dictation' | 'recording' | 'settings' | 'mediaLive' | 'updating' | 'downloads'>) {
  return state.dictation !== null || state.recording !== null ||
    (state.settings?.mediaPill === 'player' && state.settings.moduleMedia !== false &&
      state.mediaLive && state.updating === null && state.downloads.length === 0);
}

interface InteractionPorts {
  getState: () => InteractionState;
  setState: (patch: Partial<Pick<InteractionState, 'hovered' | 'enteredSinceOpen' | 'webAiActive'>>) => void;
  open: (source: 'hover' | 'hotkey', tab?: string) => void;
  close: () => void;
  openPalette: () => void;
  closePalette: () => void;
  schedule?: Schedule;
}

export function createIslandInteractions(ports: InteractionPorts) {
  const schedule = ports.schedule ?? scheduleTimeout;
  let cancelOpen: (() => void) | null = null;
  let cancelClose: (() => void) | null = null;
  let disposed = false;
  const stopOpen = () => { cancelOpen?.(); cancelOpen = null; };
  const stopClose = () => { cancelClose?.(); cancelClose = null; };
  const canOpen = (s: InteractionState) => s.hovered && !s.palette && !s.expanded &&
    !s.peek && !s.dragOver && !hasPersistentActivity(s) && s.settings?.openOnHover === true;
  const canClose = (s: InteractionState) => s.expanded && !s.palette && !s.hovered &&
    !s.pinned && !s.holdOpen && !s.draggingOut && !s.webAiActive &&
    (s.openedBy !== 'hotkey' || s.enteredSinceOpen);
  const closeLater = () => {
    stopClose();
    cancelClose = schedule(() => {
      cancelClose = null;
      if (!disposed && canClose(ports.getState())) ports.close();
    }, ports.getState().settings?.collapseDelayMs ?? 350);
  };
  return {
    hover(hovered: boolean) {
      if (disposed) return;
      ports.setState({ hovered });
      const s = ports.getState();
      if (s.palette) { stopOpen(); stopClose(); return; }
      if (hovered) {
        stopClose();
        if (s.expanded) { ports.setState({ enteredSinceOpen: true }); return; }
        if (!canOpen(s)) return;
        stopOpen();
        cancelOpen = schedule(() => {
          cancelOpen = null;
          if (!disposed && canOpen(ports.getState())) ports.open('hover');
        }, s.settings?.hoverDelayMs ?? 150);
      } else {
        stopOpen();
        if (canClose(s)) closeLater();
      }
    },
    outsideClick() {
      if (disposed) return;
      const s = ports.getState();
      stopOpen(); stopClose();
      if (s.palette) ports.closePalette();
      else if (s.expanded && !s.pinned && !s.draggingOut && !s.asking) ports.close();
    },
    togglePalette() {
      if (disposed) return;
      stopOpen(); stopClose();
      ports.getState().palette ? ports.closePalette() : ports.openPalette();
    },
    webAiActive(active: boolean) {
      if (disposed) return;
      ports.setState({ webAiActive: active });
      if (active) stopClose();
      else if (canClose(ports.getState())) closeLater();
    },
    toggle({ tab }: { tab?: string | null }) {
      if (disposed) return;
      stopOpen(); stopClose();
      const s = ports.getState();
      if (s.palette) ports.closePalette();
      if (s.expanded && (!tab || tab === s.tab)) ports.close();
      else ports.open('hotkey', tab ?? undefined);
    },
    cancelHoverOpen: stopOpen,
    escape() { if (!disposed) { stopOpen(); stopClose(); ports.close(); } },
    dispose() { disposed = true; stopOpen(); stopClose(); },
  };
}
