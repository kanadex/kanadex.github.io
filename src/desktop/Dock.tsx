import { useEffect, useRef, useState } from 'react';
import { registerAimTarget } from '@/app/aimRegistry';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcons';
import { metaOf, windowActions, type WindowId, type WindowState } from '@/desktop/windowStore';
import { requestClose, requestMinimize } from '@/lib/windowBus';

/** 窗口 → 图标，dock chip 与桌面图标共用同一套漫画 SVG。 */
const iconOf: Record<string, AppIconName> = {
  terminal: 'terminal',
  about: 'about',
  projects: 'projects',
  notes: 'notes',
  contact: 'contact',
};

const iconFor = (id: WindowId): AppIconName => iconOf[id] ?? 'image';

interface DockProps {
  windows: Record<WindowId, WindowState>;
  order: WindowId[];
  focused: WindowId | null;
}

interface ChipProps {
  id: WindowId;
  state: WindowState;
  active: boolean;
}

/**
 * 一个 chip = 漫画图标 + 标题。
 * pointerenter 时在 chip 上方弹出一张纸菜单（应用名 / 进入 / 关闭），
 * 菜单是 <li> 的子元素，所以指针移进菜单不会把它关掉；键盘 focus 也展开。
 */
function DockChip({ id, state, active }: ChipProps) {
  const meta = metaOf(id);
  const node = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const attach = (element: HTMLElement | null) => {
    node.current = element;
  };

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    return registerAimTarget('dock:' + id, element);
  }, [id]);

  const enter = () => {
    if (state.minimized) windowActions.restore(id);
    else windowActions.focus(id);
    setOpen(false);
  };

  return (
    <li
      className="dock__slot"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={attach}
        type="button"
        data-window={id}
        data-aim-target={'dock:' + id}
        className={'dock__item' + (active ? ' is-active' : '') + (state.minimized ? ' is-min' : '')}
        onClick={() => {
          if (state.minimized) windowActions.restore(id);
          else if (active) requestMinimize(id);
          else windowActions.focus(id);
        }}
        aria-pressed={active}
        aria-label={meta.title + (state.minimized ? '（已最小化）' : '')}
      >
        <span className="dock__icon" aria-hidden="true">
          <AppIcon name={iconFor(id)} />
        </span>
      </button>

      {open && (
        <div className="dock__menu" role="menu" aria-label={(meta.subtitle || meta.title) + ' 菜单'}>
          <p className="dock__menu-name">{meta.subtitle || meta.title}</p>
          <button type="button" role="menuitem" className="dock__menu-item" onClick={enter}>
            {state.minimized ? '还原' : '进入'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="dock__menu-item dock__menu-item--close"
            onClick={() => {
              requestClose(id);
              setOpen(false);
            }}
          >
            关闭
          </button>
        </div>
      )}
    </li>
  );
}

/** 底部唯一一条任务栏：只列已打开的窗口，永远压在窗口之上。 */
export function Dock({ windows, order, focused }: DockProps) {
  const openIds = order.filter((id) => windows[id]?.open);
  if (openIds.length === 0) return null;

  return (
    <nav className="dock" aria-label="窗口任务栏">
      <ul className="dock__items">
        {openIds.map((id) => {
          const state = windows[id];
          if (!state) return null;
          return <DockChip key={id} id={id} state={state} active={focused === id && !state.minimized} />;
        })}
      </ul>
    </nav>
  );
}
