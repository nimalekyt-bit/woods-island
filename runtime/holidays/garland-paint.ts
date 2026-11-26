import { contourY, type LiquidContour } from "../characters/liquid-contour";
import { garlandPoints, garlandBrightness } from "./garland";

const colors = ["#ff5a5a", "#ffd25a", "#5ae08a", "#5ab8ff", "#ff7ad8"];
const LEVELS = 12;
interface SpriteAtlas {
  canvas: HTMLCanvasElement;
  cell: number;
}
const cache = new Map<number, SpriteAtlas>();
function sprites(scale: number): SpriteAtlas {
  const key = Math.round(scale * 100) / 100;
  const cached = cache.get(key);
  if (cached) return cached;
  // Pack all 5x12 lamp frames into ONE GPU canvas instead of 65 separate canvases.
  const cell = Math.ceil(22 * key);
  const ratio = cell / 22;
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = cell;
  const glowCtx = glowCanvas.getContext("2d")!;
  const atlas = document.createElement("canvas");
  atlas.width = cell * LEVELS;
  atlas.height = cell * colors.length;
  const ctx = atlas.getContext("2d")!;
  colors.forEach((color, colorIndex) => {
    glowCtx.setTransform(1, 0, 0, 1, 0, 0);
    glowCtx.clearRect(0, 0, cell, cell);
    glowCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gradient = glowCtx.createRadialGradient(11, 11, 0, 11, 11, 11);
    gradient.addColorStop(0, color);
    const rgb = parseInt(color.slice(1), 16);
    gradient.addColorStop(1, `rgba(${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255},0)`);
    glowCtx.globalAlpha = 0.65;
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, 22, 22);
    glowCtx.globalAlpha = 1;
    glowCtx.fillStyle = color;
    glowCtx.beginPath();
    glowCtx.ellipse(11, 11, 2.2, 2.9, 0, 0, Math.PI * 2);
    glowCtx.fill();
    glowCtx.globalAlpha = 0.8;
    glowCtx.fillStyle = "#fff";
    glowCtx.beginPath();
    glowCtx.arc(10.4, 10.1, 0.7, 0, Math.PI * 2);
    glowCtx.fill();

    const oy = colorIndex * cell;
    for (let level = 0; level < LEVELS; level++) {
      const ox = level * cell;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(ratio, ratio);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(11, 11, 2.2, 2.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = level / (LEVELS - 1);
      ctx.drawImage(glowCanvas, ox, oy);
      ctx.restore();
    }
  });
  const entry = { canvas: atlas, cell };
  if (cache.size >= 4) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
  return entry;
}
export function warmGarlandSprites(scale = Math.min(2, window.devicePixelRatio || 1)) {
  sprites(scale);
}
export function paintGarland(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  capsule: boolean,
  profile: LiquidContour | undefined,
  mode: string,
  time: number,
  music: number,
  still: boolean,
  scale: number,
  corner?: number,
  beat = 0,
) {
  const points = garlandPoints(width, height, capsule, corner),
    atlas = sprites(scale);
  const y = (point: (typeof points)[number]) =>
    profile && point.bottom
      ? contourY(profile, point.x, width, height) + 9.5
      : point.y;
  context.globalAlpha = 1;
  context.strokeStyle = "rgba(34,74,44,.85)";
  context.lineWidth = 1;
  context.beginPath();
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (!previous) {
      context.moveTo(point.x, y(point));
      return;
    }
    if (profile && point.bottom && previous.bottom) {
      const steps = Math.ceil(Math.abs(point.x - previous.x) / 6);
      for (let step = 1; step < steps; step++) {
        const x = previous.x + ((point.x - previous.x) * step) / steps;
        context.lineTo(x, contourY(profile, x, width, height) + 9.5);
      }
      context.lineTo(point.x, y(point));
    } else
      context.quadraticCurveTo(
        (previous.x + point.x) / 2,
        (y(previous) + y(point)) / 2 + 1.6,
        point.x,
        y(point),
      );
  });
  if (capsule && points.length > 2) {
    const first=points[0],last=points[points.length-1];
    context.quadraticCurveTo((last.x+first.x)/2,(y(last)+y(first))/2+1.6,first.x,y(first));
  }
  context.stroke();
  points.forEach((point) => {
    const brightness = still ? 0.6 : garlandBrightness(mode,point.phase,time/1000,music,beat);
    const color =
      (((point.phase + (mode === "music" ? beat : 0)) % colors.length) + colors.length) % colors.length;
    const level = Math.max(0, Math.min(LEVELS - 1, Math.round(brightness * (LEVELS - 1))));
    context.drawImage(
      atlas.canvas,
      level * atlas.cell,
      color * atlas.cell,
      atlas.cell,
      atlas.cell,
      point.x - 11,
      y(point) - 11,
      22,
      22,
    );
  });
}
