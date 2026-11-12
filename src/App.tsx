import { useCallback, useEffect, useRef, useState } from 'react';
import { setAimFocus, setAimRest } from '@/app/aimRegistry';
import { BootScreen } from '@/boot/BootScreen';
import { TerminalView } from '@/terminal/TerminalView';
import { InkDefs } from '@/components/ui/InkDefs';
import { DeskObjects } from '@/desktop/DeskObjects';
import { Dock } from '@/desktop/Dock';
import { WindowFrame } from '@/desktop/WindowFrame';
import { useWindows, windowActions, metaOf, windowMeta } from '@/desktop/windowStore';
import { AboutPane } from '@/panes/AboutPane';
import { ContactPane } from '@/panes/ContactPane';
import { NotesPane } from '@/panes/NotesPane';
import { ProjectsPane } from '@/panes/ProjectsPane';
import { ImageViewer } from '@/image/ImageViewer';
import { Stage } from '@/scene/Stage';
import { siteConfig } from '@/config/site.config';

const panes: Record<string, () => JSX.Element> = {
  terminal: () => <TerminalView />,
  about: () => <AboutPane />,
  projects: () => <ProjectsPane />,
  notes: () => <NotesPane />,
  contact: () => <ContactPane />,
};

const knownIds = Object.keys(windowMeta);

/** 开机画面的三个阶段：盖着 / 正在退场（站点已经能点） / 已经走了 */
type BootPhase = 'booting' | 'reveal' | 'done';

export function App() {
  const brandRef = useRef<HTMLHeadingElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const [bootPhase, setBootPhase] = useState<BootPhase>('booting');
  const store = useWindows();
  const ids = Object.keys(store.windows);

  // 焦点窗口是台灯的"默认目标"：灯指向当前被操作的那扇窗。
  // 没有任何窗口时，灯回落到墙上的名字（静止锚点），不是回零。
  useEffect(() => {
    setAimFocus(store.focused ? 'win:' + store.focused : null);
  }, [store.focused]);

  useEffect(() => {
    setAimRest(brandRef.current);
  }, []);

  // 开机画面还盖着的时候，桌面不接受指针与键盘（inert 连焦点一起挡住）
  useEffect(() => {
    appRef.current?.toggleAttribute('inert', bootPhase === 'booting');
  }, [bootPhase]);

  // 开机画面淡干净了才放出窗口：终端在这里"进入"，
  // 和之后从桌面图标打开的窗口走同一个 WindowFrame 入场动画。
  const finishBoot = useCallback(() => {
    setBootPhase('done');
    windowActions.open('terminal');
    // 支持 #about、#projects 这类可分享的深链接
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) return;
    hash
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => knownIds.includes(item))
      .forEach((id) => windowActions.open(id));
  }, []);

  return (
    <>
      <div className="app" ref={appRef}>
        <a className="skip-link" href="#desktop">
          跳到桌面
        </a>
        <InkDefs />
        <Stage />

        <div className="brand">
          <h1 className="brand__name" ref={brandRef}>
            {siteConfig.name}
          </h1>
          <p className="brand__tagline">{siteConfig.subtitle}</p>
        </div>

        <main className="desktop" id="desktop">
          {ids.map((id) => {
            const state = store.windows[id];
            if (!state || !state.open) return null;
            const meta = metaOf(id);
            const Pane = panes[id];
            return (
              <WindowFrame key={id} state={state} focused={store.focused === id && !state.minimized}>
                {meta.viewer ? <ImageViewer src={meta.viewer.src} alt={meta.viewer.alt} /> : Pane ? <Pane /> : null}
              </WindowFrame>
            );
          })}
        </main>

        <DeskObjects />
        <Dock windows={store.windows} order={store.order} focused={store.focused} />
      </div>

      {bootPhase !== 'done' && (
        <BootScreen onReveal={() => setBootPhase('reveal')} onDone={finishBoot} />
      )}
    </>
  );
}
