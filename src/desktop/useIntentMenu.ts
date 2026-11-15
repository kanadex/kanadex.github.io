import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusEvent, PointerEvent } from 'react';

/**
 * 意图菜单：停够 delay 才展开，中途按下就作废，作废之后要离开再回来才会再展开。
 *
 * 为什么单独成一个钩子：这件事的本质是相位，不是"定时器 + 各处取消"。
 * 只有四个相位，任何时刻只可能在一个里：
 *   idle    什么都没等。
 *   waiting 指针停在上面，正在等够 delay。
 *   open    菜单展开。
 *   muted   这一轮已被点击作废；只要指针不离开，再等多久也不展开。
 *
 * muted 只由"离开"清除 —— 这就是 Windows 的行为：悬停还没到点就点了，
 * 菜单不会再冒出来，除非你把指针移开再放回去；按住到点则照常展开。
 */
export type IntentPhase = 'idle' | 'waiting' | 'open' | 'muted';

export interface IntentMenu {
  phase: IntentPhase;
  open: boolean;
  /** 挂在 chip 的 li 上：悬停、离开、焦点离开整块（按钮 + 菜单） */
  slot: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: () => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
  };
  /** 挂在 chip 的 button 上：按下、松手、激活与键盘焦点 */
  chip: {
    onPointerDown: () => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClick: () => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
  };
  /** 菜单项点完就收起；指针还停在原地也不会再冒出来 */
  dismiss: () => void;
}

export function useIntentMenu(activate: () => void, delay = 800): IntentMenu {
  const [phase, setPhase] = useState<IntentPhase>('idle');
  const phaseRef = useRef<IntentPhase>('idle');
  const timer = useRef(0);
  /** 指针正按在 chip 上 */
  const holding = useRef(false);
  /** 菜单是"按住到点"打开的：紧接着的那次 click 不能再算作 chip 自己的动作 */
  const fromHold = useRef(false);
  const activateRef = useRef(activate);
  activateRef.current = activate;

  const moveTo = useCallback((next: IntentPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopTimer = useCallback(() => {
    if (!timer.current) return;
    window.clearTimeout(timer.current);
    timer.current = 0;
  }, []);

  /** 开始等；已经在等、或者这一轮作废过，就不重复排。 */
  const wait = useCallback(() => {
    if (phaseRef.current === 'muted' || timer.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      if (holding.current) fromHold.current = true;
      moveTo('open');
    }, delay);
    moveTo('waiting');
  }, [delay, moveTo]);

  /** 指针离开 / 失焦：一切回到 idle，下一轮可以重新等。 */
  const reset = useCallback(() => {
    stopTimer();
    holding.current = false;
    fromHold.current = false;
    moveTo('idle');
  }, [moveTo, stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return {
    phase,
    open: phase === 'open',
    slot: {
      onPointerEnter: (event) => {
        // 触摸没有悬停：手指按下走 chip.onPointerDown，不在这里排队
        if (event.pointerType === 'mouse') wait();
      },
      onPointerLeave: reset,
      // 焦点在按钮与菜单之间移动时不能收；离开整块才收
      onBlur: (event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        reset();
      },
    },
    chip: {
      onPointerDown: () => {
        holding.current = true;
        wait();
      },
      onPointerUp: () => {
        holding.current = false;
        stopTimer();
        // 长按开出来的菜单：这次松手只是"按完了"，不作废
        if (fromHold.current) return;
        if (phaseRef.current === 'waiting' || phaseRef.current === 'open') moveTo('muted');
      },
      onPointerCancel: reset,
      onClick: () => {
        if (fromHold.current) {
          fromHold.current = false;
          return;
        }
        activateRef.current();
        moveTo('muted');
      },
      onFocus: (event) => {
        // 指针点出来的焦点不算意图（按下时 holding 还是 true），键盘 Tab 才算
        if (holding.current || !event.currentTarget.matches(':focus-visible')) return;
        stopTimer();
        moveTo('open');
      },
    },
    dismiss: () => moveTo('muted'),
  };
}
