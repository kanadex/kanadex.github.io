import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { registerAimTarget } from '@/app/aimRegistry';
import { metaOf, windowActions, type WindowState } from '@/desktop/windowStore';
import { onCloseRequest, onMinimizeRequest } from '@/lib/windowBus';
import { useWindowFade } from '@/desktop/useWindowFade';
import { useWindowMotion } from '@/desktop/useWindowMotion';

interface WindowFrameProps {
  state: WindowState;
  focused: boolean;
  children: ReactNode;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DragState {
  startX: number;
  startY: number;
  base: Box | null;
  pendingRestore: boolean;
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface ResizeState {
  startX: number;
  startY: number;
  base: Box;
  edge: ResizeEdge;
}

const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;
const DRAG_START = 4;
const RESTORE_THRESHOLD = 5;
const COLLAPSE_MS = 320;

export function WindowFrame({ state, focused, children }: WindowFrameProps) {
  const meta = metaOf(state.id);
  const nodeRef = useRef<HTMLElement>(null);
  const [collapsing, setCollapsing] = useState(false);
  const [dragBox, setDragBox] = useState<Box | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [resizing, setResizing] = useState(false);
  const collapseTimer = useRef(0);
  const downOnBar = useRef(false);
  const draggingRef = useRef(false);

  const desktopRect = () => {
    const el = document.querySelector('.desktop');
    return el
      ? el.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  };

  // WAAPI 需要"目标 chip 位置"对应的 transform：
  // 缩放比取 chip 与窗口的**真实宽度比**（不写死 0.06），中心对中心。
  const chipTransform = useCallback((): string | null => {
    const node = nodeRef.current;
    const chip = document.querySelector('[data-window="' + state.id + '"]');
    if (!node || !chip) return null;
    const from = node.getBoundingClientRect();
    const to = chip.getBoundingClientRect();
    if (from.width < 1 || to.width < 1) return null;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = Math.max(0.02, to.width / from.width);
    return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
  }, [state.id]);

  // 窗口是台灯的主要目标：挂载即登记，最小化后 rect 为 0，注册表会自己跳过
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    return registerAimTarget('win:' + state.id, node);
  }, [state.id]);

  const { cancelAll } = useWindowMotion({
    node: nodeRef.current,
    maximized: state.maximized,
    minimized: state.minimized,
    chipTransform,
    isDragging: () => draggingRef.current,
  });

  // 进入 / 退出：只动 opacity。最小化不在这里——那是收缩到任务栏 chip 的另一条动画。
  const { playExit, cancelExit, cancelEnter } = useWindowFade(nodeRef);
  const closing = useRef(false);
  const closeToken = useRef(0);

  /** 退出动画还没播完时，别的操作把它作废，窗口留在原地。 */
  const cancelClose = useCallback(() => {
    if (!closing.current) return;
    closing.current = false;
    closeToken.current += 1;
    cancelExit();
  }, [cancelExit]);

  const close = useCallback(() => {
    if (closing.current) return;
    // 已经收进任务栏的窗口看不见淡出，直接关，别让用户白等一段
    if (state.minimized) {
      windowActions.close(state.id);
      return;
    }
    closing.current = true;
    const token = ++closeToken.current;
    playExit().then((finished) => {
      if (token !== closeToken.current) return;
      closing.current = false;
      if (finished) windowActions.close(state.id);
    });
  }, [playExit, state.id, state.minimized]);

  const minimize = useCallback(() => {
    if (collapsing || state.minimized) return;
    cancelEnter();
    cancelClose();
    window.clearTimeout(collapseTimer.current);
    setCollapsing(true);
    windowActions.minimize(state.id);
    collapseTimer.current = window.setTimeout(() => {
      setCollapsing(false);
      collapseTimer.current = 0;
    }, COLLAPSE_MS);
  }, [cancelClose, cancelEnter, collapsing, state.id, state.minimized]);

  const minimizeRef = useRef(minimize);
  minimizeRef.current = minimize;
  useEffect(() => onMinimizeRequest((id) => {
    if (id === state.id) minimizeRef.current();
  }), [state.id]);

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => onCloseRequest((id) => {
    if (id === state.id) closeRef.current();
  }), [state.id]);

  useEffect(() => () => window.clearTimeout(collapseTimer.current), []);

  const toggleMaximize = () => {
    cancelEnter();
    cancelClose();
    draggingRef.current = false;
    setDragging(false);
    dragRef.current = null;
    document.body.classList.remove('is-dragging-window');
    windowActions.toggleMaximize(state.id);
  };

  const clampBox = (box: Box): Box => {
    const desktop = desktopRect();
    return {
      ...box,
      left: Math.max(0, Math.min(desktop.width - box.width, box.left)),
      top: Math.max(0, Math.min(desktop.height - box.height, box.top)),
    };
  };

  const startResize = (edge: ResizeEdge) => (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    // 最大化时没有"边界"可拉，直接不吃这个手势
    if (state.maximized) return;
    event.stopPropagation();
    event.preventDefault();
    cancelEnter();
    cancelClose();
    windowActions.focus(state.id);
    cancelAll();
    const rect = nodeRef.current?.getBoundingClientRect();
    const desktop = desktopRect();
    const base: Box = rect
      ? {
          left: rect.left - desktop.left,
          top: rect.top - desktop.top,
          width: rect.width,
          height: rect.height,
        }
      : { left: 0, top: 0, width: 400, height: 300 };
    resizeRef.current = { startX: event.clientX, startY: event.clientY, base, edge };
    setDragBox(base);
    setResizing(true);
    document.body.dataset.resizing = edge;
    nodeRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    // 点下去就说明入场结束了：淡入收掉，接下来的最大化/拖动才看得见
    cancelEnter();
    const target = event.target as HTMLElement;
    downOnBar.current = !!target.closest('.win__bar');
    // 点在窗口身上 = 还想用它：作废正在播的退出动画。点三键不算。
    if (!target.closest('.win__dots')) cancelClose();
    windowActions.focus(state.id);
    // 开始拖动：先取消正在播放的 WAAPI 动画
    cancelAll();
    if (!downOnBar.current || target.closest('.win__dots')) return;

    if (state.maximized) {
      dragRef.current = { startX: event.clientX, startY: event.clientY, base: null, pendingRestore: true };
    } else {
      const rect = nodeRef.current?.getBoundingClientRect();
      const desktop = desktopRect();
      const box: Box = rect
        ? { left: rect.left - desktop.left, top: rect.top - desktop.top, width: rect.width, height: rect.height }
        : { left: 0, top: 0, width: 400, height: 300 };
      dragRef.current = { startX: event.clientX, startY: event.clientY, base: box, pendingRestore: false };
      setDragBox(box);
    }
    nodeRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const resize = resizeRef.current;
    if (resize) {
      const desktop = desktopRect();
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      const { base, edge } = resize;
      let { left, top, width, height } = base;
      const right = base.left + base.width;
      const bottom = base.top + base.height;

      if (edge.includes('e')) width = Math.min(desktop.width - base.left, Math.max(MIN_WIDTH, base.width + dx));
      if (edge.includes('s')) height = Math.min(desktop.height - base.top, Math.max(MIN_HEIGHT, base.height + dy));
      if (edge.includes('w')) {
        width = Math.min(right, Math.max(MIN_WIDTH, base.width - dx));
        left = right - width;
        if (left < 0) {
          left = 0;
          width = right;
        }
      }
      if (edge.includes('n')) {
        height = Math.min(bottom, Math.max(MIN_HEIGHT, base.height - dy));
        top = bottom - height;
        if (top < 0) {
          top = 0;
          height = bottom;
        }
      }
      setDragBox({ left, top, width, height });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const distance = Math.hypot(dx, dy);

    if (!dragging && distance > DRAG_START) {
      draggingRef.current = true;
      setDragging(true);
      document.body.classList.add('is-dragging-window');
    }

    if (drag.pendingRestore) {
      if (distance < RESTORE_THRESHOLD) return;
      const desktop = desktopRect();
      const width = (desktop.width * meta.rect.width) / 100;
      const height = (desktop.height * meta.rect.height) / 100;
      const ratioX = (drag.startX - desktop.left) / desktop.width;
      const ratioY = (drag.startY - desktop.top) / desktop.height;
      const restored = clampBox({
        left: drag.startX - desktop.left - width * ratioX,
        top: drag.startY - desktop.top - height * ratioY,
        width,
        height,
      });
      drag.base = restored;
      drag.pendingRestore = false;
      windowActions.toggleMaximize(state.id);
      setDragBox(restored);
      return;
    }

    if (!drag.base || distance <= DRAG_START) return;
    setDragBox(clampBox({ ...drag.base, left: drag.base.left + dx, top: drag.base.top + dy }));
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (resizeRef.current) {
      resizeRef.current = null;
      setResizing(false);
      nodeRef.current?.releasePointerCapture(event.pointerId);
      delete document.body.dataset.resizing;
      return;
    }
    if (!dragRef.current) return;
    dragRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    nodeRef.current?.releasePointerCapture(event.pointerId);
    document.body.classList.remove('is-dragging-window');
  };

  const style: CSSProperties = state.maximized
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: state.z }
    : dragBox
      ? { ...dragBox, zIndex: state.z }
      : {
          left: meta.rect.left + '%',
          top: meta.rect.top + '%',
          width: meta.rect.width + '%',
          height: meta.rect.height + '%',
          zIndex: state.z,
        };

  return (
    <section
      ref={nodeRef}
      className={
        'win win--' + meta.tone + (state.maximized ? ' is-max' : '') + (focused ? ' is-focus' : '') +
        (dragging ? ' is-dragging' : '') + (resizing ? ' is-resizing' : '')
      }
      style={style}
      data-aim-target={'win:' + state.id}
      hidden={state.minimized && !collapsing}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        if (!downOnBar.current) return;
        toggleMaximize();
      }}
      aria-label={meta.title + ' 窗口'}
    >
      {/* 八条拉伸把手：贴在内侧，指针压上去就换方向光标 */}
      {!state.maximized &&
        (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map((edge) => (
          <span
            key={edge}
            className={'win__grip win__grip--' + edge}
            onPointerDown={startResize(edge)}
            aria-hidden="true"
          />
        ))}

      <header className="win__bar">
        <span className="win__dots" onDoubleClick={(event) => event.stopPropagation()}>
          <button type="button" className="win__dot win__dot--close" onClick={close} aria-label="关闭窗口" title="关闭">
            <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.6 2.6l4.8 4.8M7.4 2.6L2.6 7.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
          <button type="button" className="win__dot win__dot--min" onClick={minimize} aria-label="最小化到任务栏" title="最小化">
            <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.4 5h5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
          <button type="button" className="win__dot win__dot--max" onClick={toggleMaximize} aria-label={state.maximized ? '还原窗口' : '最大化窗口'} title={state.maximized ? '还原' : '最大化'}>
            <svg viewBox="0 0 10 10" aria-hidden="true">
              {state.maximized
                ? <path d="M3.4 2.2h4.4v4.4M2.2 3.4h4.4v4.4z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                : <path d="M2.4 2.4h5.2v5.2H2.4z" fill="none" stroke="currentColor" strokeWidth="1.3" />}
            </svg>
          </button>
        </span>
        <span className="win__title">
          {meta.title}
          <span className="win__sub">{meta.subtitle}</span>
        </span>
        <span className={'win__state' + (state.maximized ? ' is-on' : '')}>
          {state.maximized ? '最大' : '窗口'}
        </span>
      </header>
      <div className="win__body">{children}</div>
    </section>
  );
}
