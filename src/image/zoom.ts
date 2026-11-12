/** 缩放数学：以某个点为锚，缩放后该点保持不动。 */
export const MIN_SCALE = 0.04;
export const MAX_SCALE = 10;

export interface View {
  scale: number;
  x: number;
  y: number;
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** 把 scale 从 view.scale 变到 nextScale，锚点 (cx, cy) 是相对视口左上角的坐标。 */
export function zoomAt(view: View, nextScale: number, cx: number, cy: number): View {
  const scale = clampScale(nextScale);
  const ratio = scale / view.scale;
  return { scale, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio };
}

export function toPercent(scale: number): string {
  return Math.round(scale * 100) + '%';
}
