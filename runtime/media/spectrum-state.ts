export interface SpectrumSnapshot {
  level: number;
  bands: readonly number[];
  bandsAt: number;
  liquidSpectrum: boolean;
}

/** A deduplicated zero sample remains measured silence until audio resumes. */
export function liquidSpectrumBands(audio: SpectrumSnapshot, music: boolean, now: number): readonly number[] | null {
  if (!music || !audio.liquidSpectrum || audio.bands.length < 2) return null;
  const fresh = Number.isFinite(audio.bandsAt) && now - audio.bandsAt < 700;
  const measuredSilence = Number.isFinite(audio.bandsAt) && audio.bandsAt >= 0 && Number.isFinite(audio.level) && audio.level >= 0 && audio.level <= .00001 && audio.bands.every(value => value === 0);
  return fresh || measuredSilence ? audio.bands : null;
}
