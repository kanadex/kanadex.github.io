import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/config/site.config';

interface BootScreenProps {
  /** 开机画面开始退场：站点可以淡入了，输入也放行 */
  onReveal: () => void;
  /** 开机画面已经淡干净：把它卸掉，再把桌面上的窗口放出来 */
  onDone: () => void;
}

/** 需求是 3 秒；退场与站点淡入同一段，窗口要等这一段走完才进来。 */
const HOLD_MS = 3000;
const FADE_MS = 480;

/**
 * 开机画面：纯黑、左图标右名字的品牌行、下面一个不确定状态的加载环。
 * 图标是细边圆角方框里的一枚八分音符（不是代码、不是终端框），底线在它下面。
 * 动画节奏对齐 VerseBox 的 loading 品牌：图标从右滑入，框/底线先后出现，
 * 名字在 64% 后才浮现，最后音符轻摆一次。名字与墙上那个同一套字形（--serif）。
 */
export function BootScreen({ onReveal, onDone }: BootScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const reveal = useRef(onReveal);
  const done = useRef(onDone);
  reveal.current = onReveal;
  done.current = onDone;

  useEffect(() => {
    const timers: number[] = [];
    let alive = true;

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
      <div className="boot__brand" aria-hidden="true">
        <svg className="boot__mark" viewBox="0 0 72 60" aria-hidden="true">
          {/* 框与音符同组：一条动画带着两者一起淡入、一起平移，绝不分开进场 */}
          <g className="boot__head">
            <rect className="boot__part" x="8" y="3.6" width="56" height="44.8" rx="12" />
            {/* 音符：实心符头 + 符干 + 符尾；轻摆挂在它自己身上，不抢组的平移 */}
            <g className="boot__note">
              {/* 内层只做光学居中 */}
              <g transform="translate(1.4 -2.4)">
                <ellipse className="boot__solid" cx="30" cy="38.6" rx="6.4" ry="4.9" transform="rotate(-18 30 38.6)" />
                <path className="boot__stem" d="M36 37.2 V13" />
                <path className="boot__solid" d="M36.4 12.8 C42.2 14.2 46.2 18.4 46.8 24.2 C45.2 20 41.2 17 36.4 16 Z" />
              </g>
            </g>
          </g>
          {/* 底线：图标坐在这一笔上 */}
          <path className="boot__part boot__part--underline" d="M6 54 H66" />
        </svg>
        <span className="boot__name">{siteConfig.bootName}</span>
      </div>
      <span className="boot__loader" aria-hidden="true">
        <span className="boot__ring">
          <span className="boot__ring-arc" />
          <span className="boot__ring-cap" />
        </span>
      </span>
    </div>
  );
}
