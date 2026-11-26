export interface LiquidContour {
  width: number;
  height: number;
  points: readonly (readonly [number, number])[];
}
const contours = new WeakMap<Element, LiquidContour>();
export function publishLiquidContour(owner: Element, contour: LiquidContour) {
  contours.set(owner, contour);
}
export function readLiquidContour(owner: Element): LiquidContour | undefined {
  return contours.get(owner);
}
export function clearLiquidContour(owner: Element) {
  contours.delete(owner);
}
/** The profile uses liquid's centred x coordinates; decorations use 0..width. */
export function contourY(
  contour: LiquidContour,
  x: number,
  width: number,
  height: number,
): number {
  if (
    !(width > 0 && contour.width > 0 && contour.height > 0) ||
    contour.points.length < 2
  )
    return height;
  const local = (x / width) * contour.width - contour.width / 2,
    points = contour.points;
  let left = 0,
    right = points.length - 1;
  if (local <= points[0][0]) return (points[0][1] / contour.height) * height;
  if (local >= points[right][0])
    return (points[right][1] / contour.height) * height;
  while (right - left > 1) {
    const middle = (left + right) >> 1;
    if (points[middle][0] <= local) left = middle;
    else right = middle;
  }
  const a = points[left],
    b = points[right],
    blend = (local - a[0]) / (b[0] - a[0]);
  return ((a[1] + (b[1] - a[1]) * blend) / contour.height) * height;
}
