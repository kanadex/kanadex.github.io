import { useLayoutEffect, useRef } from 'react';
import { cssEasing } from '@/lib/easing';

const DURATION_RECT = 350;
const DURATION_COLLAPSE = 320;

interface MotionOptions {
  node: HTMLElement | null;
  maximized: boolean;
  minimized: boolean;
  chipTransform: () => string | null;
  /** 拖动中不播 rect 动画：指针位置就是唯一真相，动画会把窗口拽回去。 */
  isDragging: () => boolean;
}

/**
 * 窗口运动的唯一驱动源（WAAPI）。
 * - rect：最大化/还原在两次渲染之间插值，from = 打断时的当前 rect，to = 本次目标 rect。
 * - transform：最小化/还原在 chip 位置与自身之间插值。
 * 中断时 cancel 旧动画并以 getBoundingClientRect()/getComputedStyle() 的当前值作为新起点。
 */
export function useWindowMotion({ node, maximized, minimized, chipTransform, isDragging }: MotionOptions) {
  const rectAnim = useRef<Animation | null>(null);
  const chipAnim = useRef<Animation | null>(null);
  const lastRect = useRef<DOMRect | null>(null);
  const prevRect = useRef<DOMRect | null>(null);
  const prevMax = useRef(maximized);
  const prevMin = useRef(minimized);

  useLayoutEffect(() => {
    const el = node;
    if (!el) return;
    // 每次提交都滚动一次：prevRect = 变化前，lastRect = 当前
    prevRect.current = lastRect.current;
    lastRect.current = el.getBoundingClientRect();
  });

  const desktopBox = () => {
    const box = document.querySelector('.desktop');
    return box ? box.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  };

  const frame = (rect: DOMRect) => {
    const box = desktopBox();
    return {
      left: rect.left - box.left + 'px',
      top: rect.top - box.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    };
  };

  // 最大化 / 还原
  // 用 layout effect：动画必须在本次提交里就起播。放进被动 effect 会等到
  // 浏览器下一次绘制之后，点击到起播之间空出 1-3 帧，九点采样的前几个点全落在起点上。
  useLayoutEffect(() => {
    const el = node;
    if (!el) return;
    if (prevMax.current === maximized) return;
    prevMax.current = maximized;

    const running = rectAnim.current;
    // 拖动中还原：立即取消动画，窗口直接贴到指针下的位置，不播任何过渡
    if (isDragging()) {
      running?.cancel();
      rectAnim.current = null;
      prevRect.current = el.getBoundingClientRect();
      lastRect.current = el.getBoundingClientRect();
      return;
    }
    // 打断：从当前渲染位置起；否则从变化前的那一帧起
    const from = running ? el.getBoundingClientRect() : prevRect.current;
    if (running) running.cancel();
    if (!from) return;

    const target = el.getBoundingClientRect();
    if (Math.abs(from.width - target.width) < 2 && Math.abs(from.left - target.left) < 2) return;

    const anim = el.animate([frame(from), frame(target)], {
      duration: DURATION_RECT,
      easing: cssEasing('--spring'),
      fill: 'both',
    });
    rectAnim.current = anim;
    anim.onfinish = () => {
      anim.cancel();
      rectAnim.current = null;
      lastRect.current = el.getBoundingClientRect();
    };
    anim.oncancel = () => {
      if (rectAnim.current === anim) rectAnim.current = null;
    };
  }, [maximized, node]);

  // 最小化 / 从任务栏还原（同样必须是 layout effect，理由同上）
  useLayoutEffect(() => {
    const el = node;
    if (!el) return;
    if (prevMin.current === minimized) return;
    prevMin.current = minimized;

    const running = chipAnim.current;
    const current = getComputedStyle(el).transform;
    if (running) running.cancel();

    let frames: Keyframe[];
    if (minimized) {
      const target = chipTransform();
      if (!target) return;
      frames = [{ transform: current === 'none' ? 'none' : current }, { transform: target }];
    } else {
      const start = running && current !== 'none' ? current : chipTransform();
      if (!start) return;
      frames = [{ transform: start }, { transform: 'none' }];
    }

    // 最小化/还原用 --settle：这一下要是带过冲，收缩到 chip 的路上会先缩过头再弹回来，
    // 看着就像窗口被橡皮筋拽了一下。回弹只留给最大化/还原的 rect 插值。
    const anim = el.animate(frames, { duration: DURATION_COLLAPSE, easing: cssEasing('--settle'), fill: 'both' });
    chipAnim.current = anim;
    anim.onfinish = () => {
      anim.cancel();
      chipAnim.current = null;
      lastRect.current = el.getBoundingClientRect();
    };
    anim.oncancel = () => {
      if (chipAnim.current === anim) chipAnim.current = null;
    };
  }, [minimized, node, chipTransform]);

  const cancelAll = () => {
    rectAnim.current?.cancel();
    chipAnim.current?.cancel();
    rectAnim.current = null;
    chipAnim.current = null;
    if (node) lastRect.current = node.getBoundingClientRect();
  };

  return { cancelAll };
}
