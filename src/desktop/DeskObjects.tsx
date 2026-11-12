import { useEffect, useRef } from 'react';
import { registerAimTarget } from '@/app/aimRegistry';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcons';
import { windowActions, type WindowId } from '@/desktop/windowStore';
import { siteConfig } from '@/config/site.config';

interface DeskEntry {
  key: AppIconName;
  label: string;
  window?: WindowId;
  href?: string;
}

/** 桌面固定六个入口，顺序与键位固定（1440 均分 / 390 三列两行）。 */
const entries: DeskEntry[] = [
  { key: 'terminal', label: '终端', window: 'terminal' },
  { key: 'about', label: '关于', window: 'about' },
  { key: 'projects', label: '项目', window: 'projects' },
  { key: 'notes', label: '笔记', window: 'notes' },
  { key: 'contact', label: '联系', window: 'contact' },
  { key: 'github', label: 'GitHub', href: siteConfig.contact.github },
];

function DeskItem({ entry }: { entry: DeskEntry }) {
  const node = useRef<HTMLElement | null>(null);
  const aimKey = 'obj:' + entry.key;
  const attach = (element: HTMLElement | null) => {
    node.current = element;
  };

  // 登记成台灯的目标：指针悬停到这里，灯就转过来（指针坐标不参与）
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    return registerAimTarget(aimKey, element);
  }, [aimKey]);

  const body = (
    <>
      <span className="obj__icon">
        <AppIcon name={entry.key} />
      </span>
      <span className="obj__label">{entry.label}</span>
    </>
  );

  if (entry.href) {
    return (
      <a
        ref={attach}
        className="obj"
        data-aim-target={aimKey}
        href={entry.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
      </a>
    );
  }

  return (
    <button
      ref={attach}
      type="button"
      className="obj"
      data-aim-target={aimKey}
      onClick={() => entry.window && windowActions.open(entry.window)}
    >
      {body}
    </button>
  );
}

/**
 * 桌面上的六个入口。最大化时也不藏：窗口本来就盖在它们上面，
 * 藏起来只会在关掉/还原窗口时多出一次淡入，纯属多此一举。
 */
export function DeskObjects() {
  return (
    <div className="desk-objects" aria-label="桌面入口">
      {entries.map((entry) => (
        <DeskItem key={entry.key} entry={entry} />
      ))}
    </div>
  );
}
