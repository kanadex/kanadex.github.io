import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/config/site.config';
import { prefersReducedMotion } from '@/lib/motion';

interface BootScreenProps {
  /** 开机画面开始退场：站点可以淡入了，输入也放行 */
  onReveal: () => void;
  /** 开机画面已经淡干净：把它卸掉，再把桌面上的窗口放出来 */
  onDone: () => void;
}

/** 需求是 3 秒；退场与站点淡入同一段，窗口要等这一段走完才进来。 */
const HOLD_MS = 3000;
const FADE_MS = 480;
/** 字体没下载完就开始写，会先用回退字体写一遍、再跳成 Young Serif。等它，但不无限等。 */
const FONT_WAIT_MS = 700;

/**
 * 开机画面：纯黑、居中的名字从左往右"写"出来、下面一个不确定状态的加载环。
 * 名字与左上角墙上那个是同一套字形（--serif = Young Serif），只是更大。
 */
export function BootScreen({ onReveal, onDone }: BootScreenProps) {
  const [writing, setWriting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const reveal = useRef(onReveal);
  const done = useRef(onDone);
  reveal.current = onReveal;
  done.current = onDone;

  useEffect(() => {
    const timers: number[] = [];
    let alive = true;

    if (prefersReducedMotion()) {
      setWriting(true);
    } else {
      let started = false;
      const startWriting = () => {
        if (!alive || started) return;
        started = true;
        setWriting(true);
      };
      timers.push(window.setTimeout(startWriting, FONT_WAIT_MS));
      const waiting = document.fonts?.load?.('1em "Young Serif"');
      if (waiting) waiting.then(startWriting, startWriting);
      else startWriting();
    }

    timers.push(
      window.setTimeout(() => {
        if (!alive) return;
        // 站点本体靠这个标记从纯黑里淡进来；index.html 里是静态写好的
        delete document.documentElement.dataset.booting;
        setLeaving(true);
        reveal.current();
        timers.push(
          window.setTimeout(() => {
            if (alive) done.current();
          }, FADE_MS)
        );
      }, HOLD_MS)
    );

    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <div className={'boot' + (leaving ? ' is-leaving' : '')} role="status">
      <span className="boot__sr">{siteConfig.bootName} 正在启动</span>
      <span className={'boot__word' + (writing ? ' is-writing' : '')} aria-hidden="true">
        {siteConfig.bootName}
      </span>
      <span className="boot__loader" aria-hidden="true">
        <span className="boot__ring">
          <span className="boot__ring-arc" />
          <span className="boot__ring-cap" />
        </span>
      </span>
    </div>
  );
}
