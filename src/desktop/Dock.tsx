import { useEffect, useRef } from 'react';
import { registerAimTarget } from '@/app/aimRegistry';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcons';
import { metaOf, windowActions, type WindowId, type WindowState } from '@/desktop/windowStore';
import { useIntentMenu } from '@/desktop/useIntentMenu';
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
 * 一个 chip = 只有一个图标，外加下沿那条指示线；没有外框、没有底色。
 * 菜单不随悬停立刻弹出：停够 0.8s 才出，中途点过就等指针离开再回来（见 useIntentMenu）。
 */
function DockChip({ id, state, active }: ChipProps) {
  const meta = metaOf(id);
  const node = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    return registerAimTarget('dock:' + id, element);
  }, [id]);

  const menu = useIntentMenu(() => {
    if (state.minimized) windowActions.restore(id);
    else if (active) requestMinimize(id);
    else windowActions.focus(id);
  });

  return (
    <li className="dock__slot" data-phase={menu.phase} {...menu.slot}>
      <button
        ref={(element) => {
          node.current = element;
        }}
        type="button"
        data-window={id}
        data-aim-target={'dock:' + id}
        className={'dock__item' + (active ? ' is-active' : '') + (state.minimized ? ' is-min' : '')}
        {...menu.chip}
        aria-pressed={active}
        aria-label={meta.title + (state.minimized ? '（已最小化）' : '')}
      >
        <span className="dock__icon" aria-hidden="true">
          <AppIcon name={iconFor(id)} />
        </span>
      </button>

      {menu.open && (
        <div className="dock__menu" role="menu" aria-label={(meta.subtitle || meta.title) + ' 菜单'}>
          <p className="dock__menu-name">{meta.subtitle || meta.title}</p>
          <button
            type="button"
            role="menuitem"
            className="dock__menu-item"
            onClick={() => {
              if (state.minimized) windowActions.restore(id);
              else windowActions.focus(id);
              menu.dismiss();
            }}
          >
            {state.minimized ? '还原' : '进入'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="dock__menu-item dock__menu-item--close"
            onClick={() => {
              requestClose(id);
              menu.dismiss();
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
