const STAR_SEEDS = [
  [6, 18, 2], [12, 42, 1], [18, 9, 2], [23, 31, 1], [29, 57, 1], [34, 21, 3], [38, 44, 1], [44, 13, 2],
  [49, 36, 1], [54, 61, 1], [58, 24, 2], [63, 49, 1], [67, 11, 1], [72, 33, 2], [76, 56, 1], [81, 19, 1],
  [86, 41, 3], [90, 27, 1], [94, 52, 1], [97, 15, 2], [9, 63, 1], [16, 52, 1], [25, 47, 2], [41, 60, 1],
  [52, 8, 1], [61, 63, 1], [70, 44, 1], [79, 61, 2], [88, 34, 1], [95, 38, 1], [31, 26, 1], [43, 29, 1],
];

/**
 * 夜空：饱和靛蓝底 + 两层颗粒 + 星点 + 一个月亮。
 *
 * 颗粒是这张画的"笔触"。上一版 .sky__grain 引用了一个从未定义的 --grain，
 * 所以整页平得像 PPT —— 现在 --grain 是 tokens.css 里的真噪声。
 */
export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="sky__grain" />
      <div className="sky__grain sky__grain--fine" />
      <div className="sky__stars">
        {STAR_SEEDS.map(([left, top, size = 1], index) => (
          <span
            key={index}
            className={'sky__star' + (size > 1 ? ' sky__star--big' : '')}
            style={{
              left: left + '%',
              top: top + '%',
              width: size + 'px',
              height: size + 'px',
              animationDelay: (index % 7) * 0.7 + 's',
              opacity: 0.4 + ((index * 37) % 55) / 100,
            }}
          />
        ))}
      </div>
      <div className="sky__moon">
        <span className="sky__moon-halo" />
        <span className="sky__moon-disc" />
      </div>
    </div>
  );
}
