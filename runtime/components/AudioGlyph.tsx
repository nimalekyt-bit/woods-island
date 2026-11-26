import { React } from "../react";
import { subscribeAnimationFrames } from "../characters/scheduler";
import { MINI_BAR_COUNT, miniBarTarget } from "../media/mini-spectrum";

const barsX = Array.from({ length: MINI_BAR_COUNT }, (_, index) => index * 6);
const idleHeight = 2.5;
const maxTravel = 13.1;
const viewHeight = 16;

/** A small, measured audio indicator. It never invents motion in a silent gap. */
export function AudioGlyph({
  playing,
  readBands,
  accent,
  width = 21,
  height = 16,
}: {
  playing: boolean;
  readBands?: () => readonly number[];
  accent?: string | null;
  width?: number;
  height?: number;
}) {
  const root = React.useRef<SVGSVGElement>(null),
    reader = React.useRef(readBands);
  reader.current = readBands;
  React.useEffect(() => {
    const bars = root.current?.querySelectorAll("rect");
    if (!bars) return;
    const levels = new Float32Array(MINI_BAR_COUNT);
    const lastHeights = new Array<string>(MINI_BAR_COUNT).fill("");
    let last = 0;
    const draw = (time: number) => {
      const dt = last ? Math.min(0.075, Math.max(0, (time - last) / 1000)) : 0.016;
      last = time;
      const tSec = time / 1000;
      const bands = playing ? (reader.current?.() ?? []) : [];
      bars.forEach((bar, index) => {
        const rawTarget = miniBarTarget(bands, index);
        // Subtle organic groove strictly proportional to live audio energy (always 0 in silence).
        const groove = 0.8 + 0.2 * Math.abs(Math.sin(tSec * (5.3 + index * 1.7) + index * 1.3));
        const target = rawTarget > 0 ? Math.min(1, rawTarget * groove) : 0;
        const response = target > levels[index] ? 0.018 : 0.082;
        levels[index] += (target - levels[index]) * (1 - Math.exp(-dt / response));
        if (levels[index] < 0.002 && target === 0) levels[index] = 0;
        const hNum = idleHeight + levels[index] * maxTravel;
        const barHeight = hNum.toFixed(2);
        if (lastHeights[index] !== barHeight) {
          lastHeights[index] = barHeight;
          bar.setAttribute("height", barHeight);
          bar.setAttribute("y", ((viewHeight - hNum) / 2).toFixed(2));
        }
      });
    };
    draw(performance.now());
    return playing && readBands
      ? subscribeAnimationFrames(draw, () => 16)
      : undefined;
  }, [playing, Boolean(readBands)]);
  return (
    <svg
      ref={root}
      data-audio-glyph
      width={width}
      height={height}
      viewBox="0 0 21 16"
      fill="currentColor"
      className="shrink-0"
      style={{
        color: accent ?? "var(--color-accent-ink)",
        opacity: playing ? 1 : 0.55,
      }}
      aria-hidden="true"
    >
      {barsX.map((x) => (
        <rect key={x} x={x} y={(viewHeight - idleHeight) / 2} width="3" height={idleHeight} rx="1.5" />
      ))}
    </svg>
  );
}
