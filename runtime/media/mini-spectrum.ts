export const MINI_BAR_COUNT = 4;
// Island-inspired silhouette weights: compact bass, tall vocal/body bar, crisp snare, lively treble.
const heightWeights = [0.64, 1, 0.78, 0.9];

/** Partition any measured band array (e.g. 24 or 8 bands) cleanly into 4 frequency zones. */
export function miniBandLevel(bands: readonly number[], index: number): number {
  const len = bands.length;
  if (len === 0 || index < 0 || index >= MINI_BAR_COUNT) return 0;
  const start = Math.floor((index * len) / MINI_BAR_COUNT);
  const end = Math.max(start + 1, Math.floor(((index + 1) * len) / MINI_BAR_COUNT));
  let value = 0;
  for (let band = start; band < end && band < len; band++) {
    const sample = Number(bands[band] ?? 0);
    if (Number.isFinite(sample)) value = Math.max(value, Math.min(1, sample));
  }
  return value;
}

export function miniBarTarget(bands: readonly number[], index: number): number {
  const level = miniBandLevel(bands, index);
  if (level <= 0) return 0;
  return heightWeights[index] * Math.min(1, level ** 0.62 * 1.28);
}
