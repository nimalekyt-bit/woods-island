import { idleSize, normalMediaSize, titleMediaSize, lyricsMediaSize, playerMediaSize, lyricsNeedWrap, snapWidth } from './sizing';
import type { MediaPill, Size, WidgetSizing } from './sizing';
import type { AgentAsk } from '../ipc/client';

export type IslandMode = 'idle' | 'liveStatus' | 'liveMedia' | 'liveShelf' | 'liveDownloads' | 'liveUpdating'
  | 'liveRecording' | 'liveDictation' | 'drop' | 'expanded' | 'palette' | 'peek';

export interface ModeState {
  palette: boolean;
  expanded: boolean;
  dictating: boolean;
  peek: boolean;
  recording: boolean;
  updating: boolean;
  downloads: boolean;
  mediaLive: boolean;
  shelfCount: number;
  status: boolean;
}

/** Alerts and active tools take precedence over the folded media view. */
export function selectIslandMode(state: ModeState): Exclude<IslandMode, 'drop'> {
  if (state.palette) return 'palette';
  if (state.expanded) return 'expanded';
  if (state.dictating) return 'liveDictation';
  if (state.peek) return 'peek';
  if (state.recording) return 'liveRecording';
  if (state.updating) return 'liveUpdating';
  if (state.downloads) return 'liveDownloads';
  if (state.mediaLive) return 'liveMedia';
  if (state.shelfCount > 0) return 'liveShelf';
  return state.status ? 'liveStatus' : 'idle';
}

export function dropSize(zoneCount: number): Size { return [zoneCount >= 3 ? 620 : 460, 128]; }
export function overlayDropSize(open: boolean, current: Size, zoneCount = 2): Size {
  const [width, height] = dropSize(zoneCount);
  return open ? [Math.max(current[0], width), Math.max(current[1], height)] : [width, height];
}

export const BASE_SIZES = {
  idle: [150, 30], liveStatus: [176, 30], liveMedia: [268, 32], liveShelf: [140, 30],
  liveDownloads: [320, 32], liveUpdating: [260, 32], liveRecording: [262, 32], liveDictation: [236, 34],
  drop: dropSize(2), expanded: [680, 336], chat: [680, 420],
} satisfies Record<string, Size>;

export function chatHeight(viewportHeight: number): number {
  return Math.max(BASE_SIZES.chat[1], Math.min(780, Math.floor(viewportHeight) - 60, Math.floor((viewportHeight - 2) / 1.1)));
}
export function paletteHeight(rows: number, answer: boolean): number {
  return answer ? 330 : 56 + Math.max(0, rows) * 42 + (rows > 0 ? 8 : 0);
}

export function agentQuestionHeight(ask: Pick<AgentAsk, 'questions'>, step = 0): number {
  const question = ask.questions[Math.min(step, ask.questions.length - 1)];
  return 80 + (question.question.length > 56 ? 38 : 19) + question.options.length * 38 - 4 + (question.multiSelect ? 40 : 0);
}

/** The adapter passes only the content fields that affect an alert's size. */
export interface PeekSizing {
  kind: string;
  noteBody?: string;
  agentMessage?: string;
  questionHeight?: number;
  question?: boolean;
  label?: string;
}
const FIXED_PEEK_SIZES: Readonly<Record<string, Size>> = {
  screenshot: [430, 100], recorded: [430, 100], copied: [360, 60], ocr: [400, 60], qr: [400, 60],
  color: [380, 88], volume: [340, 46], device: [330, 56], layout: [110, 34], caps: [230, 40],
  mic: [420, 60], micMuted: [270, 52], cam: [330, 56], vpn: [380, 60], download: [420, 72],
  update: [400, 64], news: [410, 64], chat: [420, 60], reminder: [460, 68], timer: [400, 64],
  weather: [330, 62], pro: [420, 62], dictated: [460, 68], error: [400, 64],
};
export function peekSize(peek: PeekSizing): Size {
  switch (peek.kind) {
    case 'notification': return [440, peek.noteBody ? peek.noteBody.length > 48 || peek.noteBody.includes('\n') ? 80 : 64 : 54];
    case 'agent': return [440, peek.agentMessage ? 64 : 52];
    case 'agentAsk': return [500, peek.question ? peek.questionHeight ?? 108 : 108];
    case 'done': return [Math.round(Math.min(460, Math.max(280, 120 + Array.from(peek.label ?? '').length * 7.5))), 52];
    default: return FIXED_PEEK_SIZES[peek.kind] ?? [340, 60];
  }
}

export interface GeometryInput extends ModeState {
  paletteMeasure: { rows: number; answer: boolean };
  peekContent: PeekSizing | null;
  tall: boolean;
  externalChat: boolean;
  viewportHeight: number;
  /** Home's existing layout adapter supplies its card/tiles measurement. */
  homeSize: Size | null;
  widgets: WidgetSizing;
  mediaPill: MediaPill;
  dragOver: boolean;
  dropZoneCount: number;
  devicePixelRatio: number;
}
export interface IslandGeometry { mode: IslandMode; w: number; h: number; wrap: boolean }

export function calculateIslandGeometry(input: GeometryInput): IslandGeometry {
  const mode = selectIslandMode(input);
  const wrap = mode === 'liveMedia' && input.mediaPill === 'lyrics' && lyricsNeedWrap(input.widgets);
  let size: Size;
  if (mode === 'palette') size = [640, paletteHeight(input.paletteMeasure.rows, input.paletteMeasure.answer)];
  else if (mode === 'peek') size = input.peekContent ? peekSize(input.peekContent) : [340, 60];
  else if (mode === 'expanded' && input.tall) size = input.externalChat ? [680, chatHeight(input.viewportHeight)] : BASE_SIZES.chat;
  else if (mode === 'expanded' && input.homeSize) size = input.homeSize;
  else if (mode === 'idle' || mode === 'liveStatus' || mode === 'liveShelf') size = idleSize(input.widgets);
  else if (mode === 'liveMedia') {
    switch (input.mediaPill) {
      case 'player': size = playerMediaSize(input.widgets); break;
      case 'lyrics': size = lyricsMediaSize(input.widgets); break;
      case 'title': size = titleMediaSize(input.widgets); break;
      default: size = normalMediaSize(input.widgets);
    }
  } else size = BASE_SIZES[mode];
  if (input.dragOver) size = overlayDropSize(mode === 'expanded' || mode === 'palette', size, input.dropZoneCount);
  return { mode: input.dragOver ? 'drop' : mode, w: snapWidth(size[0], input.devicePixelRatio), h: size[1], wrap };
}
