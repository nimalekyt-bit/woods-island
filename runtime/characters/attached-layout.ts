export interface AttachedVisualInsets { right: number; bottom: number }
export interface AttachedCharacterLayout {
  width: number;
  height: number;
  viewBox: readonly [number, number, number, number];
  translate: readonly [number, number];
}

/** Reserve painted space outside the pill without enlarging its interaction box.
 * Tail: sw ∈ [-20,40], cu/dr ∈ [0,1], stroke ≤16. Its Bézier control
 * hull reaches x=116+8 and its tip reaches y=74+16*.62. The anchor is
 * (pillWidth/2-60,pillHeight-30); 68/56 include an antialiasing margin.
 * Legs: two 13-unit segments and rotated shoes extend below y=30.
 */
export function attachedVisualInsets(id: string): AttachedVisualInsets {
  if (id === 'tail') return { right: 68, bottom: 56 };
  if (id === 'legs') return { right: 0, bottom: 38 };
  return { right: 0, bottom: 0 };
}

/** SVG pixels and viewBox units grow together, preserving the original artwork. */
export function attachedCharacterLayout(id: string, pillWidth: number, pillHeight: number): AttachedCharacterLayout {
  const insets = attachedVisualInsets(id);
  const width = pillWidth + insets.right;
  const height = pillHeight + insets.bottom;
  return {
    width, height,
    viewBox: [-pillWidth / 2, 0, width, height],
    translate: [id === 'tail' ? pillWidth / 2 - 60 : 0, pillHeight - 30],
  };
}
