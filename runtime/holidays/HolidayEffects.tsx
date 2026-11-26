import { React } from "../react";
import { holidayPolicy, type HolidaySettings } from "./model";
import { snowCapPath } from "./snow-cap";
import "./holidays.css";
import { subscribeAnimationFrames } from "../characters/scheduler";
import { readLiquidContour, contourY } from "../characters/liquid-contour";
import { paintGarland } from "./garland-paint";

export function useHolidayClock() {
  const [date, setDate] = React.useState(() => new Date());
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();
      setDate(now);
      const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      timer = setTimeout(
        tick,
        Math.max(1000, next.getTime() - now.getTime() + 50),
      );
    };
    tick();
    const resume = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return date;
}
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    change();
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}
interface Flake {
  x: number;
  y: number;
  r: number;
  v: number;
  phase: number;
  side?: boolean;
}
const finiteLevel = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export function HolidayEffects({
  settings,
  width: targetWidth,
  height: targetHeight,
  capsule,
  visible,
  musicLevel = 0,
  readMusicLevel,
  still = false,
  falling = true,
}: {
  settings: HolidaySettings;
  width: number;
  height: number;
  capsule: boolean;
  visible: boolean;
  musicLevel?: number;
  readMusicLevel?: () => number;
  still?: boolean;
  falling?: boolean;
}) {
  const date = useHolidayClock(),
    systemReduced = useReducedMotion();
  const reducedMotion =
    still ||
    settings.reducedMotion === "reduce" ||
    (settings.reducedMotion !== "full" && systemReduced);
  const selection = holidayPolicy(settings, {
    date,
    visible,
    capsule,
    reducedMotion,
  });
  const policy = { ...selection, fall: selection.fall && falling };
  const hasEffects = policy.fall || policy.cap || policy.garland !== "off";
  const container = React.useRef<HTMLDivElement>(null);
  const measured = React.useRef<{ width: number; height: number } | null>(null);
  const live = React.useRef({
    width: targetWidth,
    height: targetHeight,
    policy,
    musicLevel,
    readMusicLevel,
  });
  live.current = {
    width: measured.current?.width ?? targetWidth,
    height: measured.current?.height ?? targetHeight,
    policy,
    musicLevel,
    readMusicLevel,
  };
  const canvas = React.useRef<HTMLCanvasElement>(null),
    capSvg = React.useRef<SVGSVGElement>(null),
    cap = React.useRef<SVGPathElement>(null);
  const resizingUntilRef = React.useRef(0);
  const repaint = React.useRef(() => {});
  React.useLayoutEffect(() => {
    const parent = container.current?.parentElement;
    if (!parent || !policy.active) return;
    // Track animated pill dimensions via ref without triggering 60fps React re-renders.
    const syncSize = (w: number, h: number) => {
      if (!(w > 0 && h > 0)) return;
      measured.current = { width: w, height: h };
      live.current.width = w;
      live.current.height = h;
      resizingUntilRef.current = performance.now() + 450;
      if (reducedMotion) repaint.current();
    };
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) syncSize(rect.width, rect.height);
    });
    observer.observe(parent);
    return () => {
      observer.disconnect();
      measured.current = null;
    };
  }, [policy.active, reducedMotion]);
  React.useLayoutEffect(() => { if(reducedMotion) repaint.current(); }, [targetWidth,targetHeight,reducedMotion]);
  React.useEffect(() => {
    const node = canvas.current,
      context = node?.getContext("2d");
    if (!node || !context) return;
    let stop = () => {},
      last = 0,
      rendered = 0,
      oldWidth = live.current.width,
      oldHeight = live.current.height,
      resizingUntil = 0,
      backingCssW = 0,
      backingCssH = 0,
      backingScale = 0,
      music = 0,
      beat = 0, beatArmed = true,
      peak = 0.005;
    const owner = container.current?.closest("[data-island]") as HTMLElement | null;
    let flakes: Flake[] = [];
    const create = (w: number, y: number): Flake => ({
      x: 4 + Math.random() * Math.max(1, w - 8),
      y,
      r: 0.8 + Math.random() * 1.8,
      v: 13 + Math.random() * 22,
      phase: Math.random() * 6.28,
    });
    const draw = (now: number, force=false) => {
      if (document.hidden) {
        last = 0;
        return;
      }
      const profile = owner ? readLiquidContour(owner) : undefined;
      let w = live.current.width;
      let h = live.current.height;
      if (profile) {
        w = profile.width;
        h = profile.height;
      } else if (owner) {
        const rect = owner.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          w = rect.width;
          h = rect.height;
        }
      }
      const sizeChanged = Math.abs(w - oldWidth) > 0.2 || Math.abs(h - oldHeight) > 0.2;
      if (sizeChanged) resizingUntilRef.current = now + 450;
      const activeResize = now < resizingUntilRef.current;
      if (!force && !activeResize && now - rendered < 28) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      rendered = now;
      const {
        policy: p,
        musicLevel: storedLevel,
        readMusicLevel: readLevel,
      } = live.current;
      const level=readLevel?.() ?? storedLevel;
      const scale = Math.min(2, window.devicePixelRatio || 1),
        bottom = p.fall ? 90 : p.garland !== "off" ? 48 : 8;
      const neededW = Math.ceil(w + 32),
        neededH = Math.ceil(h + bottom + 10);
      // Allocate the backing canvas ONCE at expanded size on the main island so neither
      // open nor close ever reallocates the GPU texture mid-animation.
      const isMainIsland = owner !== null;
      const minW = isMainIsland ? 736 : 0;
      const minH = isMainIsland ? 544 : 0;
      const nextCssW = Math.max(backingCssW, minW, Math.ceil(neededW / 128) * 128);
      const nextCssH = Math.max(backingCssH, minH, Math.ceil(neededH / 128) * 128);
      if (nextCssW !== backingCssW || nextCssH !== backingCssH || scale !== backingScale) {
        backingCssW = nextCssW;
        backingCssH = nextCssH;
        backingScale = scale;
        node.width = Math.ceil(backingCssW * scale);
        node.height = Math.ceil(backingCssH * scale);
        node.style.width = `${backingCssW}px`;
        node.style.height = `${backingCssH}px`;
      }
      context.setTransform(scale, 0, 0, scale, 16 * scale, 0);
      context.clearRect(-16, 0, backingCssW, backingCssH);
      if (capSvg.current && p.cap) {
        const capH = h + 10;
        if (capSvg.current.getAttribute("width") !== String(w)) {
          capSvg.current.setAttribute("width", String(w));
          capSvg.current.setAttribute("height", String(capH));
          capSvg.current.setAttribute("viewBox", `0 0 ${w} ${capH}`);
        }
      }
      if (p.fall) {
        const wanted = Math.round((w / 18) * p.density);
        if (flakes.length > wanted + 24) flakes = flakes.slice(0, wanted + 24);
        while (flakes.length < wanted)
          flakes.push(create(w, h + 8 + Math.random() * 75));
        if (p.cap && w < oldWidth - 5) {
          for (
            let i = 0;
            i < Math.min(16, Math.round((oldWidth - w) / 10));
            i++
          )
            flakes.push({
              ...create(w, 5),
              x: i % 2 ? Math.max(4, w - 4) : 4,
              side: true,
            });
        }
        for (let i = flakes.length - 1; i >= 0; i--) {
          const flake = flakes[i];
          flake.y += flake.v * dt;
          if (flake.y > h + 90) {
            if (flake.side) {
              flakes.splice(i, 1);
              continue;
            }
            flakes[i] = create(w, h + 8);
            continue;
          }
          flake.x = Math.max(3, Math.min(w - 3, flake.x));
          const alpha = Math.max(0, 1 - Math.max(0, flake.y - h) / 90) * 0.65;
          context.beginPath();
          context.arc(
            flake.x + Math.sin(now * 0.0004 + flake.phase) * 2,
            flake.y,
            flake.r,
            0,
            Math.PI * 2,
          );
          context.fillStyle = `rgba(239,247,255,${alpha})`;
          context.fill();
        }
      } else flakes = [];
      oldWidth = w;
      oldHeight = h;
      if (cap.current && p.cap)
        cap.current.setAttribute("d", snowCapPath(w, now / 1000, p.density));
      peak = Math.max(0.005, finiteLevel(level), peak * Math.exp(-dt / 0.8));
      music +=
        (Math.min(1, finiteLevel(level) / peak) - music) * Math.min(1, dt * 10);
      if (music < .4) beatArmed = true;
      if (beatArmed && music > .72) { beat++; beatArmed = false; }
      if (p.garland !== "off")
        paintGarland(
          context,
          w,
          h,
          capsule,
          profile,
          p.garland,
          now,
          music,
          !p.animateGarland,
          scale,
          owner ? parseFloat(owner.style.borderBottomLeftRadius) || undefined : undefined,
          beat,
        );
    };
    repaint.current=()=>draw(performance.now(),true);
    draw(performance.now(),true);
    if (policy.active && !reducedMotion && hasEffects)
      stop = subscribeAnimationFrames(draw, () => (performance.now() < resizingUntilRef.current ? 0 : 33));
    return () => {
      stop();
      repaint.current=()=>{};
      context.clearRect(0, 0, node.width, node.height);
    };
  }, [
    policy.active,
    reducedMotion,
    hasEffects,
    policy.cap,
    policy.garland,
    capsule,
  ]);
  if (!policy.active) return null;
  return (
    <div
      ref={container}
      data-holiday-effects
      data-snow-bottom={selection.fall ? 90 : selection.garland !== "off" ? 48 : 8}
      className="wi-holiday-effects"
      aria-hidden="true"
    >
      <canvas
        ref={canvas}
        data-garland={policy.garland !== "off" ? policy.garland : undefined}
        style={{
          left: -16,
        }}
      />
      <svg
        ref={capSvg}
        width={targetWidth}
        height={targetHeight + 10}
        viewBox={`0 0 ${targetWidth} ${targetHeight + 10}`}
        style={{ overflow: "visible" }}
      >
        {policy.cap && (
          <path
            ref={cap}
            data-snow-cap
            d={snowCapPath(targetWidth, 0, policy.density)}
            fill="#eef7ff"
            opacity=".92"
          />
        )}
      </svg>
    </div>
  );
}
