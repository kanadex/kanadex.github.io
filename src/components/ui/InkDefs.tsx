/**
 * 手绘描边用的 SVG 滤镜。放在页面根部，全局只渲染一次。
 * 只给**静态**图形用（山、桌面、便签边框）。
 * 绝对不要挂在每帧旋转的台灯上：滤镜会逐帧重新栅格化，那是掉帧直通车。
 */
export function InkDefs() {
  return (
    <svg className="ink-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ink-rough" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ink-fine" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="2" seed="13" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* 地面用：波长更长、位移更大，边像铅笔勾出来的一道一道 */}
        <filter id="ink-hills" x="-6%" y="-14%" width="112%" height="132%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="3" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
