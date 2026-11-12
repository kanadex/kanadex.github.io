import { useSyncExternalStore } from 'react';

/**
 * 窗口的唯一真相。
 *
 * id 是字符串，不是固定联合类型：图片查看器每次打开都是一个新窗口（`image:3`），
 * 所以窗口表必须能装下运行时才出现的 id。
 * 静态窗口的元信息在 STATIC_META 里；动态窗口在 openWindow() 时注册自己的元信息。
 */
export type WindowId = string;

export interface WindowMeta {
  /** 菜单/无障碍里的中文名 */
  label: string;
  /** 窗口标题栏里的名字 */
  title: string;
  /** 标题栏右侧的小字（图片查看器放真实文件名） */
  subtitle: string;
  /** 桌面上的默认位置与尺寸，百分比，相对桌面可用区域 */
  rect: { left: number; top: number; width: number; height: number };
  tone: 'paper' | 'night';
  /** 图片查看器带上要显示的图 */
  viewer?: { src: string; alt: string };
}

export const windowMeta: Record<string, WindowMeta> = {
  terminal: { label: '终端', title: 'terminal', subtitle: 'kanadex@web', rect: { left: 22, top: 24, width: 56, height: 66 }, tone: 'night' },
  about: { label: '关于', title: 'about.me', subtitle: '关于我', rect: { left: 26, top: 26, width: 40, height: 44 }, tone: 'paper' },
  projects: { label: '项目', title: 'projects', subtitle: '在做的东西', rect: { left: 26, top: 24, width: 46, height: 48 }, tone: 'paper' },
  notes: { label: '笔记', title: 'notes', subtitle: '随手记', rect: { left: 28, top: 28, width: 44, height: 44 }, tone: 'paper' },
  contact: { label: '联系', title: 'contact', subtitle: '写信', rect: { left: 30, top: 30, width: 40, height: 40 }, tone: 'paper' },
};

const dynamicMeta: Record<string, WindowMeta> = {};

/** 取一个窗口的元信息，静态、动态都认。 */
export function metaOf(id: WindowId): WindowMeta {
  const meta = dynamicMeta[id] ?? windowMeta[id];
  if (meta) return meta;
  return {
    label: id,
    title: id,
    subtitle: '',
    rect: { left: 30, top: 26, width: 40, height: 46 },
    tone: 'paper',
  };
}

export interface WindowState {
  id: WindowId;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  z: number;
}

interface Store {
  windows: Record<WindowId, WindowState>;
  order: WindowId[];
  focused: WindowId | null;
  topZ: number;
}

/**
 * 初始时桌面上没有窗口：开机画面还没退场，谁都不该已经在桌面上。
 * 终端由 App 在开机结束后用 windowActions.open('terminal') 放出来，
 * 所以它的"进入"和后来打开的窗口走同一条动画，不是直接出现。
 */
function buildInitial(): Store {
  const windows: Record<WindowId, WindowState> = {};
  Object.keys(windowMeta).forEach((id, index) => {
    windows[id] = { id, open: false, minimized: false, maximized: false, z: index + 10 };
  });
  return { windows, order: [], focused: null, topZ: 14 };
}

let state: Store = buildInitial();
const listeners = new Set<() => void>();

function commit(next: Store) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Store {
  return state;
}

export function useWindows(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const Z_CEILING = 800;

function withWindow(id: WindowId, patch: Partial<WindowState>): Store {
  const topZ = Math.min(Z_CEILING, state.topZ + 1);
  const previous = state.windows[id];
  const windows: Record<WindowId, WindowState> = {
    ...state.windows,
    [id]: {
      id,
      open: previous?.open ?? false,
      minimized: previous?.minimized ?? false,
      maximized: previous?.maximized ?? false,
      z: previous?.z ?? topZ,
      ...patch,
    },
  };
  const order = state.order.includes(id) ? state.order : [...state.order, id];
  return { ...state, windows, order, topZ, focused: id };
}

export const windowActions = {
  /** 打开���静态窗口（五个入口）。 */
  open(id: WindowId) {
    commit(withWindow(id, { open: true, minimized: false, z: state.topZ + 1 }));
  },
  /** 打开一个运行时才存在的窗口，并注册它的元信息。 */
  openWindow(id: WindowId, meta: WindowMeta) {
    dynamicMeta[id] = meta;
    commit(withWindow(id, { open: true, minimized: false, z: state.topZ + 1 }));
  },
  close(id: WindowId) {
    const previous = state.windows[id];
    if (!previous) return;
    const windows = { ...state.windows, [id]: { ...previous, open: false, minimized: false, maximized: false } };
    const order = state.order.filter((item) => item !== id);
    const focused: WindowId | null = order[order.length - 1] ?? null;
    commit({ ...state, windows, order, focused });
  },
  minimize(id: WindowId) {
    // 最小化保留 maximized：从任务栏回来仍然是最大化
    commit(withWindow(id, { minimized: true }));
  },
  restore(id: WindowId) {
    commit(withWindow(id, { open: true, minimized: false, z: state.topZ + 1 }));
  },
  toggleMaximize(id: WindowId) {
    const win = state.windows[id];
    if (!win) return;
    commit(withWindow(id, { maximized: !win.maximized, minimized: false, z: state.topZ + 1 }));
  },
  focus(id: WindowId) {
    const win = state.windows[id];
    if (!win || win.z === state.topZ) return;
    commit(withWindow(id, { z: state.topZ + 1 }));
  },
  closeAll() {
    const windows: Record<WindowId, WindowState> = {};
    Object.keys(state.windows).forEach((id) => {
      const win = state.windows[id];
      if (!win) return;
      windows[id] = { ...win, open: false, minimized: false, maximized: false };
    });
    commit({ ...state, windows, order: [], focused: null });
  },
};
