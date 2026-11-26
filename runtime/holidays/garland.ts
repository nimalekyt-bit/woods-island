export interface GarlandPoint {
  x: number;
  y: number;
  bottom: boolean;
  phase: number;
}

/** Sample the rounded edge at a constant distance, including sides and capsule top. */
export function garlandPoints(
  width: number,
  height: number,
  capsule: boolean,
  corner = Math.min(height / 2, height > 60 ? 32 : 26),
): GarlandPoint[] {
  const radius = Math.max(0, Math.min(corner, width / 2, height / (capsule ? 2 : 1)));
  if (!(radius > 0)) return [];
  const straight = Math.max(0, width / 2 - radius);
  const arc = (Math.PI * radius) / 2;
  const side = Math.max(0, capsule ? height - 2 * radius : height - radius);
  const half = capsule ? 2 * straight + 2 * arc + side : straight + arc + Math.max(0, height - radius - 4);
  const points: GarlandPoint[] = [];
  for (
    let distance = 0, phase = 0;
    distance <= half + 0.01;
    distance += 15, phase++
  ) {
    let x = width / 2,
      y = height,
      nx = 0, ny = 1,
      bottom = false,
      remaining = distance;
    if (remaining <= straight) {
      x += remaining;
      bottom = true;
    } else if ((remaining -= straight) <= arc) {
      const angle = Math.PI / 2 - remaining / radius;
      nx = Math.cos(angle); ny = Math.sin(angle);
      x = width - radius + nx * radius;
      y = height - radius + ny * radius;
    } else if ((remaining -= arc) <= side) {
      x = width;
      y = height - radius - remaining;
      nx = 1; ny = 0;
    } else if (!capsule) break;
    else if ((remaining -= side) <= arc) {
      const angle = -remaining / radius;
      nx = Math.cos(angle); ny = Math.sin(angle);
      x = width - radius + nx * radius;
      y = radius + ny * radius;
    } else {
      x = width - radius - (remaining - arc);
      y = 0;
      nx = 0; ny = -1;
    }
    x += nx * 2.5; y += 7 + ny * 2.5;
    points.push({ x, y, bottom, phase });
    if (phase && !(capsule && half - distance < 15 * .45))
      points.push({ x: width - x, y, bottom, phase: -phase });
  }
  return points.sort((a, b) => a.phase - b.phase);
}

function seed(value: number) { const wave = Math.sin(value * 127.1 + 311.7) * 43758.5453; return wave - Math.floor(wave); }
export function garlandBrightness(mode: string, phase: number, seconds: number, music = 0, beat = 0): number {
  if (mode === "wave") return .25 + .75 * (.5 + .5 * Math.sin(seconds * 4.2 - Math.abs(phase) * .55)) ** 2;
  if (mode === "music") return .22 + .78 * Math.max(0, Math.min(1, music * (.7 + .3 * Math.sin(Math.abs(phase) * 1.3 + beat * 2.1))));
  return .3 + .7 * (.5 + .5 * Math.sin(seconds * (1.1 + seed(phase) * 1.8) + seed(phase * 7 + 3) * Math.PI * 2)) ** 3;
}
