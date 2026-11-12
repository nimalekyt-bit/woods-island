/** CSS-pixel sizes shared by the folded island and all music pill variants. */
export type Size = readonly [width: number, height: number];
export type CharacterBox = readonly [x: number, y: number, width: number, height: number];
export type MediaPill = 'normal' | 'title' | 'lyrics' | 'player';

export interface WidgetSizing {
  character?: boolean;
  face?: boolean;
  big?: boolean;
  slot?: number;
  clock?: boolean;
  seconds?: boolean;
  battery?: boolean;
  weather?: boolean;
  caps?: boolean;
  layout?: boolean;
  desk?: number;
  dots?: number;
  obs?: boolean;
  agent?: boolean;
  download?: boolean;
  shelf?: number;
  /** Number of characters in the displayed timer label. */
  timer?: number;
  words?: number;
  seekable?: boolean;
  lyrics?: boolean;
}

const IDLE: Size = [150, 30];
const SLOT: Size = [168, 34];
const NORMAL: Size = [268, 32];
const TITLE: Size = [420, 44];
const CLOCK = 38;
const CLOCK_SECONDS = 58;
const BATTERY = 50;
const WEATHER = 56;
const GAP = 10;

export function characterRestWidth(large: boolean): number {
  return large ? 2 * Math.round(6600 / 34 / 2) : 150;
}

export function characterSlotWidth(box?: CharacterBox | null, height = 34): number {
  const minimum = 2 * Math.round(60 * height / 34 / 2);
  if (!box || !(box[2] > 0) || !(box[3] > 0)) return minimum;
  return Math.min(characterRestWidth(height > 34), Math.max(minimum, 2 * Math.ceil(box[2] * height / box[3] / 2)));
}

export function snapWidth(width: number, devicePixelRatio: number): number {
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return 2 * Math.round(width * scale / 2) / scale;
}

type SideWidget = 'clock' | 'battery' | 'weather';
export function distributeFaceWidgets(options: WidgetSizing): { left: SideWidget[]; right: SideWidget[] } {
  const left: SideWidget[] = [], right: SideWidget[] = [];
  if (options.clock) left.push('clock');
  if (options.weather) right.push('weather');
  if (options.battery) (options.weather || !options.clock ? left : right).push('battery');
  return { left, right };
}

const clockWidth = (options: WidgetSizing) => options.clock ? (options.seconds ? CLOCK_SECONDS : CLOCK) : 0;
const append = (width: number, extra: number) => extra > 0 ? width + (width > 0 ? 8 : 0) + extra : width;
const desktopWidth = (count: number) => count > 0 ? 8 + Math.ceil(Math.min(count, 12) * 6.4) : 0;
const inputWidth = (options: WidgetSizing) => append(append(desktopWidth(options.desk ?? 0), options.layout ? 22 : 0), options.caps ? 16 : 0);
const privacyWidth = (dots: number) => dots > 0 ? dots * 7 + (dots - 1) * 4 : 0;
const statusWidth = (options: WidgetSizing) => append(append(append(privacyWidth(options.dots ?? 0), options.obs ? 34 : 0), options.agent ? 16 : 0), options.download ? 16 : 0);
const shelfWidth = (count: number) => count > 9 ? 38 : count > 0 ? 31 : 0;

export function timerTextWidth(length: number): number {
  const narrow = length > 5 ? 2 : 1;
  return Math.ceil((length - narrow) * 7.2 + narrow * 3.6);
}
const timerWidth = (length: number) => length > 0 ? 19 + timerTextWidth(length) : 0;
function sideWidth(widgets: SideWidget[], clock = CLOCK): number {
  return widgets.reduce((sum, widget) => sum + (widget === 'clock' ? clock : widget === 'battery' ? BATTERY : WEATHER), 0) + Math.max(0, widgets.length - 1) * 8;
}

export function idleSize(options: WidgetSizing): Size {
  const input = append(inputWidth(options), shelfWidth(options.shelf ?? 0));
  const status = statusWidth(options), clock = clockWidth(options), timer = timerWidth(options.timer ?? 0);
  if (options.face && !options.character && (options.clock || options.battery || input > 0 || status > 0 || timer > 0)) {
    const sides = distributeFaceWidgets(options);
    const occupied = Math.max(append(append(sideWidth(sides.left, clock), timer), input), append(sideWidth(sides.right, clock), status));
    return [Math.max(IDLE[0], 66 + 2 * (occupied + GAP)), IDLE[1]];
  }
  if (options.character) {
    const occupied = (clock ? clock + GAP - 2 : 0) + (options.battery ? 58 : 0) + (options.weather ? 64 : 0)
      + (input ? input + GAP - 2 : 0) + (status ? status + GAP - 2 : 0) + (timer ? timer + GAP - 2 : 0);
    const rest = SLOT[0] + characterRestWidth(!!options.big) - characterRestWidth(false);
    return [occupied > 0 ? 8 + (options.slot ?? 60) + 12 + occupied : rest, options.big ? 44 : SLOT[1]];
  }
  const center = append(append(timer, clock), options.battery ? BATTERY : 0);
  const side = Math.max(append(options.weather ? 20 : 0, input), append(options.weather ? 30 : 0, status));
  const sides = side > 0 ? 2 * (side + (center > 0 ? GAP : 0)) : 0;
  return [Math.max(IDLE[0], 26 + center + sides), IDLE[1]];
}

export function normalMediaSize(options: WidgetSizing): Size {
  const withLeadingGaps = (widths: number[], gap: number) => widths.filter(width => width > 0).reduce((sum, width) => sum + gap + width, 0);
  const extras = [inputWidth(options), statusWidth(options), shelfWidth(options.shelf ?? 0)];
  const timer = timerWidth(options.timer ?? 0), character = options.character ? 60 : 41;
  if (options.face && !options.character) {
    const left = 30 + withLeadingGaps([clockWidth(options), options.battery ? BATTERY : 0], 8);
    const right = character + withLeadingGaps([options.weather ? WEATHER : 0, timer, ...extras], GAP);
    return [Math.max(NORMAL[0], 40 + 2 * (Math.max(left, right) + GAP)), NORMAL[1]];
  }
  const widgets = withLeadingGaps([timer, clockWidth(options), options.battery ? BATTERY : 0, options.weather ? WEATHER : 0], 8) - 8;
  return [Math.max(NORMAL[0], 30 + (widgets > 0 ? 24 + widgets : GAP) + character + withLeadingGaps(extras, GAP)), NORMAL[1]];
}

export function resolveMediaPill(value: unknown): MediaPill {
  return value === 'title' || value === 'player' || value === 'lyrics' ? value : 'normal';
}

export function titleMediaSize(options: WidgetSizing): Size {
  const extras = [inputWidth(options), statusWidth(options), shelfWidth(options.shelf ?? 0)];
  const occupied = [timerWidth(options.timer ?? 0), clockWidth(options), options.battery ? BATTERY : 0,
    options.weather ? WEATHER : 0, ...extras, options.character ? 52 : 27]
    .filter(width => width > 0).reduce((sum, width) => sum + GAP + width, 0);
  return [Math.max(TITLE[0], 218 + occupied + 12), TITLE[1]];
}

function lyricsNaturalWidth(options: WidgetSizing): number {
  const [width] = titleMediaSize(options);
  return options.words ? width - 170 + Math.max(170, 22 + Math.ceil(options.words)) : width;
}
export function lyricsMediaSize(options: WidgetSizing): Size {
  return [Math.min(680, lyricsNaturalWidth(options)), TITLE[1]];
}
export function lyricsNeedWrap(options: WidgetSizing): boolean {
  return lyricsNaturalWidth(options) > 680;
}
export function playerMediaSize(options: WidgetSizing): Size {
  const joined = (widths: number[]) => widths.filter(width => width > 0).reduce((sum, width, index) => sum + (index > 0 ? 8 : 0) + width, 0);
  const side = Math.max(joined([inputWidth(options), statusWidth(options), shelfWidth(options.shelf ?? 0), options.character ? 0 : 27]),
    joined([timerWidth(options.timer ?? 0), clockWidth(options)]), joined([options.weather ? WEATHER : 0, options.battery ? BATTERY : 0]));
  const width = Math.max(360, 228 + (side > 0 ? 12 + side : 0) + 14);
  return [width + (options.lyrics ? 268 : 0), 74 + (options.seekable ? 22 : 0) + 32 + 12];
}
