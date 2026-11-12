import { useCallback, useEffect, useRef, useState } from 'react';
import { clampScale, toPercent, zoomAt, type View } from '@/image/zoom';

interface ImageViewerProps {
  src: string;
  alt: string;
}

/**
 * 图片查看器。
 *
 * 三条必须一直成立：
 *   1. 缩放锚定在光标（或双指中点）—— 那个像素点缩放前后不动；
 *   2. 倍率范围 4%–1000%，超出就钳住；
 *   3. 视口中间显示当前倍率，操作时出现，停手 700ms 后消失。
 * 平移用单指/单键拖动；双指捏合走 pointer 事件，不依赖浏览器默认手势。
 */
export function ImageViewer({ src, alt }: ImageViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [hint, setHint] = useState<string | null>(null);
  const viewRef = useRef<View>(view);
  const hintTimer = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const apply = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const flashHint = useCallback((scale: number) => {
    window.clearTimeout(hintTimer.current);
    setHint(toPercent(scale));
    hintTimer.current = window.setTimeout(() => setHint(null), 700);
  }, []);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  /** 把图按"完整可见"铺进视口并居中。 */
  const fit = useCallback(
    (natural: { w: number; h: number }) => {
      const box = stageRef.current?.getBoundingClientRect();
      if (!box || !natural.w || !natural.h) return;
      const scale = clampScale(Math.min(box.width / natural.w, box.height / natural.h, 1));
      apply({
        scale,
        x: (box.width - natural.w * scale) / 2,
        y: (box.height - natural.h * scale) / 2,
      });
      flashHint(scale);
    },
    [apply, flashHint]
  );

  // 滚轮缩放：必须非被动监听，否则 preventDefault 无效、页面会跟着滚
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const current = viewRef.current;
      const factor = Math.exp(-event.deltaY * 0.001);
      const next = zoomAt(current, current.scale * factor, event.clientX - rect.left, event.clientY - rect.top);
      apply(next);
      flashHint(next.scale);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [apply, flashHint]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) {
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      }
      drag.current = null;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const node = stageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const current = viewRef.current;

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const ratio = pinch.current.dist > 0 ? dist / pinch.current.dist : 1;
      const zoomed = zoomAt(current, current.scale * ratio, midX - rect.left, midY - rect.top);
      apply({
        scale: zoomed.scale,
        x: zoomed.x + (midX - pinch.current.cx),
        y: zoomed.y + (midY - pinch.current.cy),
      });
      pinch.current = { dist, cx: midX, cy: midY };
      flashHint(zoomed.scale);
      return;
    }

    if (drag.current && drag.current.id === event.pointerId) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      apply({ scale: current.scale, x: current.x + dx, y: current.y + dy });
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  return (
    <div
      ref={stageRef}
      className="viewer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={() => {
        const img = stageRef.current?.querySelector('img');
        if (img) fit({ w: img.naturalWidth, h: img.naturalHeight });
      }}
    >
      <img
        className="viewer__img"
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => fit({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
        style={{ transform: 'translate(' + view.x + 'px, ' + view.y + 'px) scale(' + view.scale + ')' }}
      />
      {hint ? (
        <span className="viewer__hint" aria-hidden="true">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
