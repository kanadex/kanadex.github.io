/**
 * 光锥的画布渲染。
 *
 * 不是"两片半透明多边形"：真正的做法是四层楔形 + 罩口灯泡辉光 + 颗粒侵蚀。
 * 四层楔形的半角按 5.5° / 8.1° / 10.7° / 13.3° 递增（越外层越淡），
 * 锥长由"灯口到目标的距离"决定（×1.45，且不小于画布宽度的 0.8 倍），
 * 所以灯指向远处时锥会自然变长；最后用一层噪点做 destination-out，
 * 把填充蚀出粗糙的边——这就是手绘光的"笔触"，不是高斯模糊。
 */

export interface BeamFrame {
  /** 罩口在视口里的位置 */
  bulb: { x: number; y: number };
  /** 光锥在屏幕上的角度（度） */
  angleDeg: number;
  /** 目标点（视口坐标），null 表示没有目标 */
  target: { x: number; y: number } | null;
  /** 灯的缩放（灯包围盒宽 / 815），决定锥口的粗细 */
  scale: number;
  /** 亮度 0..1 */
  alpha: number;
}

const WEDGES = [
  { angle: 5.5, alpha: 0.44 },
  { angle: 8.1, alpha: 0.26 },
  { angle: 10.7, alpha: 0.16 },
  { angle: 13.3, alpha: 0.1 },
] as const;

function makeGrain(size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 255;
    image.data[i + 1] = 255;
    image.data[i + 2] = 255;
    image.data[i + 3] = Math.random() * 150;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function createBeamRenderer(canvas: HTMLCanvasElement) {
  const grain = makeGrain();
  const ctx = canvas.getContext('2d');
  let pattern: CanvasPattern | null = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (rect.width === width && rect.height === height && nextDpr === dpr) return;
    width = rect.width;
    height = rect.height;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  };

  return {
    clear() {
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    draw(next: BeamFrame) {
      if (!ctx) return;
      resize();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (next.alpha < 0.01) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!pattern) pattern = ctx.createPattern(grain, 'repeat');

      const rad = (next.angleDeg * Math.PI) / 180;
      const dir = { x: Math.cos(rad), y: Math.sin(rad) };
      const perp = { x: -dir.y, y: dir.x };
      const target = next.target ?? { x: next.bulb.x + dir.x * 400, y: next.bulb.y + dir.y * 400 };
      const distance = Math.hypot(target.x - next.bulb.x, target.y - next.bulb.y);
      const length = Math.max(distance * 1.45, Math.min(width, 900) * 0.8);
      const mouth = 220 * next.scale * 0.9;
      const bulbRadius = 110 * next.scale + 12;

      // 罩口灯泡：一层径向辉光，光才有"从这里射出来"的源头
      const glow = ctx.createRadialGradient(next.bulb.x, next.bulb.y, 0, next.bulb.x, next.bulb.y, bulbRadius);
      glow.addColorStop(0, 'rgba(254, 250, 236, ' + 0.62 * next.alpha + ')');
      glow.addColorStop(1, 'rgba(254, 250, 236, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(next.bulb.x, next.bulb.y, bulbRadius, 0, Math.PI * 2);
      ctx.fill();

      let outline: { x: number; y: number }[] = [];
      for (let i = 0; i < WEDGES.length; i += 1) {
        const wedge = WEDGES[i];
        if (!wedge) continue;
        const spread = Math.tan((wedge.angle * Math.PI) / 180);
        const near = mouth * (0.95 + i * 0.06);
        const far = near + length * spread;
        const points: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
          { x: next.bulb.x + perp.x * near, y: next.bulb.y + perp.y * near },
          { x: next.bulb.x + dir.x * length + perp.x * far, y: next.bulb.y + dir.y * length + perp.y * far },
          { x: next.bulb.x + dir.x * length - perp.x * far, y: next.bulb.y + dir.y * length - perp.y * far },
          { x: next.bulb.x - perp.x * near, y: next.bulb.y - perp.y * near },
        ];
        const fade = ctx.createLinearGradient(
          next.bulb.x, next.bulb.y,
          next.bulb.x + dir.x * length, next.bulb.y + dir.y * length
        );
        const peak = wedge.alpha * next.alpha;
        fade.addColorStop(0, 'rgba(254, 250, 236, ' + peak + ')');
        fade.addColorStop(Math.min(0.92, distance / length), 'rgba(254, 250, 236, ' + peak * 0.62 + ')');
        fade.addColorStop(1, 'rgba(254, 250, 236, 0)');
        ctx.fillStyle = fade;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.lineTo(points[3].x, points[3].y);
        ctx.closePath();
        ctx.fill();
        if (i === WEDGES.length - 1) outline = points;
      }

      // 颗粒侵蚀：把填充蚀出粗糙边，光才有笔触感
      const [p0, p1, p2, p3] = outline;
      if (pattern && p0 && p1 && p2 && p3) {
        frame += 1;
        if (frame % 6 === 0) {
          pattern.setTransform(new DOMMatrix().translate(Math.random() * 256, Math.random() * 256));
        }
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = pattern;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.arc(next.bulb.x, next.bulb.y, bulbRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    },
  };
}
