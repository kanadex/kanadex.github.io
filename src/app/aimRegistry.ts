/**
 * 台灯的目标注册表。
 *
 * 灯只认"被操作的东西"，不认指针坐标。只有在这里登记过的节点才可能成为 activeTarget。
 *
 * 优先级（每帧解析）：
 *   touch（手指命中的目标，粘 2s） > hover（指针停在某个目标上） > focus（焦点窗口） > 静止朝向
 *
 * 鼠标在空白处移动不会命中任何 [data-aim-target]，因此 hover 保持 null，灯一动不动。
 * 这是设计，不是漏写 pointermove。
 */
export type AimKey = string;

export const TOUCH_HOLD_MS = 2000;

/** 矩形缓存：窗口在最大化/还原过程中一直在动，不必每帧读一次布局。 */
const RECT_TTL_MS = 120;
/** 小于这个尺寸的目标（已最小化 / 已隐藏）不吸引灯。 */
const MIN_TARGET_PX = 8;

const AIM_ATTR = 'data-aim-target';

const nodes = new Map<AimKey, HTMLElement>();
const rectCache = new Map<AimKey, { rect: DOMRect; at: number }>();

let hovered: AimKey | null = null;
let touched: AimKey | null = null;
let touchedAt = 0;
let focused: AimKey | null = null;
let restNode: HTMLElement | null = null;
let installed = false;

export function registerAimTarget(key: AimKey, node: HTMLElement): () => void {
  nodes.set(key, node);
  rectCache.delete(key);
  return () => {
    rectCache.delete(key);
    if (nodes.get(key) === node) nodes.delete(key);
  };
}

export function aimKeyOf(node: EventTarget | null): AimKey | null {
  const element = node instanceof Element ? node.closest('[' + AIM_ATTR + ']') : null;
  return element ? element.getAttribute(AIM_ATTR) : null;
}

function pointFor(key: AimKey, now: number): { x: number; y: number } | null {
  const node = nodes.get(key);
  if (!node || !node.isConnected) return null;
  const cached = rectCache.get(key);
  let rect: DOMRect;
  if (cached && now - cached.at < RECT_TTL_MS) {
    rect = cached.rect;
  } else {
    rect = node.getBoundingClientRect();
    rectCache.set(key, { rect, at: now });
  }
  if (rect.width < MIN_TARGET_PX || rect.height < MIN_TARGET_PX) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** 当前的指向点（页面坐标）；null 表示该回静止朝向了。 */
export function aimPoint(now: number = performance.now()): { x: number; y: number } | null {
  const order: (AimKey | null)[] = [touched, hovered, focused];
  for (let index = 0; index < order.length; index += 1) {
    const key = order[index];
    if (!key) continue;
    if (index === 0 && now - touchedAt >= TOUCH_HOLD_MS) continue;
    const point = pointFor(key, now);
    if (point) return point;
  }
  return null;
}

/** 当前 target 的键，只用于调试与判据回读。 */
export function currentAimKey(now: number = performance.now()): AimKey | null {
  if (touched && now - touchedAt < TOUCH_HOLD_MS) return touched;
  return hovered ?? focused;
}

/** 静止锚点：没有任何目标时灯照的地方（默认是墙上的名字）。 */
export function setAimRest(node: HTMLElement | null): void {
  restNode = node;
}

export interface AimResult {
  point: { x: number; y: number };
  /** item：被操作的东西（窗口/图标/chip）；rest：静止锚点 */
  kind: 'item' | 'rest';
}

export function aimTarget(now: number = performance.now()): AimResult | null {
  const order: (AimKey | null)[] = [touched, hovered, focused];
  for (let index = 0; index < order.length; index += 1) {
    const key = order[index];
    if (!key) continue;
    if (index === 0 && now - touchedAt >= TOUCH_HOLD_MS) continue;
    const point = pointFor(key, now);
    if (point) return { point, kind: 'item' };
  }
  if (restNode && restNode.isConnected) {
    const rect = restNode.getBoundingClientRect();
    if (rect.width > 8 && rect.height > 8) {
      return { point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, kind: 'rest' };
    }
  }
  return null;
}

export function setAimFocus(key: AimKey | null): void {
  focused = key;
  rectCache.delete(key ?? '');
}

/**
 * 全局只装一次输入：指针用 pointerover/pointerout 委托，触摸用 elementFromPoint 命中。
 * 触摸时 pointerover 也会触发，但那不代表"悬停"，要跳过。
 */
export function installAimInput(): () => void {
  if (installed) return () => undefined;
  installed = true;

  // 离开目标后不立刻清空，留 500ms 宽限。
  // 菜单行之间有空隙，立刻清空会让目标在"这一项"和"焦点窗口"之间来回跳，
  // 每跳一次就是一段新的弹簧 —— 用户看到的就是灯在闪。
  let hoverTimer = 0;

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const key = aimKeyOf(event.target);
    if (!key) return;
    window.clearTimeout(hoverTimer);
    hovered = key;
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const next = aimKeyOf(event.relatedTarget);
    window.clearTimeout(hoverTimer);
    if (next) {
      hovered = next;
      return;
    }
    hoverTimer = window.setTimeout(() => {
      hovered = null;
    }, 500);
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touched = aimKeyOf(document.elementFromPoint(touch.clientX, touch.clientY));
    touchedAt = performance.now();
  };

  // 手指离开目标后保持当前指向；松手 2s 后缓慢回落到焦点/静止位
  const onTouchEnd = () => {
    if (touched) touchedAt = performance.now();
  };

  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('pointerout', onPointerOut, true);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    installed = false;
    window.clearTimeout(hoverTimer);
    document.removeEventListener('pointerover', onPointerOver, true);
    document.removeEventListener('pointerout', onPointerOut, true);
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchEnd);
  };
}
