/** Finalise a screenshot from one immutable snapshot, before asynchronous IPC. */
export interface AnnotationPoint { x: number; y: number }
export interface PendingAnnotationText { at: AnnotationPoint; text: string }
export interface TextAnnotation { t: 'text'; at: AnnotationPoint; text: string; color: string; size: number }
export function screenshotAnnotations<T>(annotations: readonly T[], pending: PendingAnnotationText | null | undefined, color: string, size: number): readonly (T | TextAnnotation)[] {
  if (!pending?.text.trim()) return annotations;
  return [...annotations, {t:'text',at:{...pending.at},text:pending.text,color,size}];
}
export function screenshotExport<T>(annotations: readonly T[], pending: PendingAnnotationText | null | undefined, color: string, size: number, close: boolean) {
  return {annotations:screenshotAnnotations(annotations,pending,color,size),copy:!close,close};
}
