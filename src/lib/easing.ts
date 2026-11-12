/**
 * 动画曲线只从 tokens.css 读：--spring（弹入/抬起）与 --settle（过渡/状态）。
 * 两份曲线一定会漂：CSS 里改了、JS 还拿着旧的，九点采样就会对不上。
 * 窗口运动（useWindowMotion）与窗口淡入淡出（useWindowFade）都走这里。
 */
const cache = new Map<string, string>();

const FALLBACK_SPRING = 'cubic-bezier(0.5, 1.6, 0.7, 1)';
const FALLBACK_SETTLE = 'cubic-bezier(0.25, 1, 0.5, 1)';

export function cssEasing(name: '--spring' | '--settle'): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const fallback = name === '--spring' ? FALLBACK_SPRING : FALLBACK_SETTLE;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const easing = value || fallback;
  cache.set(name, easing);
  return easing;
}
