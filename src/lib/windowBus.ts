import type { WindowId } from '@/desktop/windowStore';

/**
 * 任务栏（以及任何窗口外部的地方）只能"请求"窗口动作：
 * 真正带动画、带作废令牌的入口在 WindowFrame 里。
 * 最小化与关闭各一条事件，不许哪个组件直接改 store 绕过动画。
 */
const MINIMIZE_EVENT = 'kanadex:minimize-window';
const CLOSE_EVENT = 'kanadex:close-window';

function request(event: string, id: WindowId): void {
  window.dispatchEvent(new CustomEvent<WindowId>(event, { detail: id }));
}

function subscribe(event: string, handler: (id: WindowId) => void): () => void {
  const listener = (raw: Event) => {
    const detail = (raw as CustomEvent<WindowId>).detail;
    if (typeof detail === 'string') handler(detail);
  };
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

/** 请求最小化：收缩到任务栏 chip。 */
export function requestMinimize(id: WindowId): void {
  request(MINIMIZE_EVENT, id);
}

export function onMinimizeRequest(handler: (id: WindowId) => void): () => void {
  return subscribe(MINIMIZE_EVENT, handler);
}

/** 请求关闭：先淡出，淡完才真的关。 */
export function requestClose(id: WindowId): void {
  request(CLOSE_EVENT, id);
}

export function onCloseRequest(handler: (id: WindowId) => void): () => void {
  return subscribe(CLOSE_EVENT, handler);
}
