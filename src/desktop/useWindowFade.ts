import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { cssEasing } from '@/lib/easing';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * 窗口的"进入"与"退出"：只有 opacity，一条动画，不加位移、不加缩放、不回弹。
 *
 * 为什么不并进 useWindowMotion：那个钩子管的是 rect 与 transform（最大化、最小化），
 * 这里管的是"这扇窗在不在"。最小化必须继续是收缩到任务栏 chip，绝不能淡出——
 * 两个动作共用一个动画，用户就分不清"收进任务栏"和"关掉了"。
 */
const ENTER_MS = 200;
const EXIT_MS = 180;

export interface WindowFade {
  /** 播完淡出返回 true；被取消返回 false，调用方不许再关窗口 */
  playExit: () => Promise<boolean>;
  cancelExit: () => void;
  /**
   * 用户一碰窗口，入场就结束了：把淡入直接收掉。
   * 不收的话，窗口刚出现就点最大化，前 200ms 的位移会被半透明吃掉，看起来像"没动画"。
   */
  cancelEnter: () => void;
}

export function useWindowFade(nodeRef: RefObject<HTMLElement>): WindowFade {
  const enter = useRef<Animation | null>(null);
  const exit = useRef<Animation | null>(null);
  /** 取消退出时它反向播回 1，播完再摘掉，别留一层 fill 在节点上 */
  const recover = useRef<Animation | null>(null);
  const settle = useRef<((finished: boolean) => void) | null>(null);

  // 挂载 = 进入桌面（关闭后重开也是同一条路径）。layout effect：动画要在这次提交里起播。
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node || prefersReducedMotion()) return;
    enter.current?.cancel();
    const anim = node.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: ENTER_MS, easing: cssEasing('--settle'), fill: 'both' }
    );
    enter.current = anim;
    anim.onfinish = () => {
      if (enter.current !== anim) return;
      enter.current = null;
      anim.cancel();
    };
    // StrictMode 会把 effect 跑两遍：不返回清理就会留下一条没人管的旧动画
    return () => {
      if (enter.current === anim) enter.current = null;
      anim.cancel();
    };
  }, [nodeRef]);

  useEffect(
    () => () => {
      enter.current?.cancel();
      enter.current = null;
      exit.current?.cancel();
      exit.current = null;
      recover.current?.cancel();
      recover.current = null;
      settle.current = null;
    },
    []
  );

  const playExit = useCallback((): Promise<boolean> => {
    const node = nodeRef.current;
    if (!node || prefersReducedMotion()) return Promise.resolve(true);
    // 进场还没播完就关：先作废进场，否则它会把 opacity 又拉回 1
    enter.current?.cancel();
    enter.current = null;
    exit.current?.cancel();
    exit.current = null;
    recover.current?.cancel();
    recover.current = null;

    const anim = node.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: EXIT_MS, easing: cssEasing('--settle'), fill: 'both' }
    );
    exit.current = anim;
    return new Promise<boolean>((resolve) => {
      settle.current = resolve;
      const finish = (finished: boolean) => {
        if (exit.current === anim) exit.current = null;
        const waiting = settle.current;
        settle.current = null;
        if (waiting) waiting(finished);
      };
      anim.onfinish = () => finish(true);
      anim.oncancel = () => finish(false);
    });
  }, [nodeRef]);

  // 关闭被别的操作作废：从当前透明度原路返回 1，不许直接 cancel 跳回去。
  const cancelExit = useCallback(() => {
    const anim = exit.current;
    if (!anim) return;
    exit.current = null;
    anim.onfinish = null;
    anim.oncancel = null;
    const waiting = settle.current;
    settle.current = null;
    if (waiting) waiting(false);
    recover.current?.cancel();
    recover.current = anim;
    anim.reverse();
    anim.finished
      .then(() => {
        if (recover.current !== anim) return;
        recover.current = null;
        anim.cancel();
      })
      .catch(() => {
        if (recover.current === anim) recover.current = null;
      });
  }, []);

  const cancelEnter = useCallback(() => {
    enter.current?.cancel();
    enter.current = null;
  }, []);

  return { playExit, cancelExit, cancelEnter };
}
