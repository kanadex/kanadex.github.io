/**
 * 台灯运动学。
 *
 * 这里的数字不是"调"出来的：灯臂三段共用一张 815×1216 画布，
 * 关节在画布里的坐标是固定的，指向角必须**先把灯泡点逐级转过去**再量，
 * 否则灯臂一转，罩口就偏了，光的落点跟着偏。
 *
 *   灯头 pivot (473,137) → 肘 (758,579) → 底座 (475,1204) → 灯泡 (125,235)
 *
 * 角度：绝对指向角钳在 [92°, 235°]，静止角 162.8°；
 * 底座只吃 7%（−4°…+2.5°），肘吃 30%（−13°…+9°），剩下的全给灯头。
 * 不对称是因为静态姿态本身左右不对称，对称的钳位会让灯偏向一侧。
 */

export interface Axis {
  value: number;
  velocity: number;
}

export const PIVOT = {
  bulb: { x: 125, y: 235 },
  head: { x: 473, y: 137 },
  elbow: { x: 758, y: 579 },
  base: { x: 475, y: 1204 },
} as const;

export const VIEW = { width: 815, height: 1216 } as const;

/** 静止姿态下罩口的朝向（度，屏幕坐标）。 */
export const REST_AXIS = 162.8;
/** 绝对指向角的可用范围。 */
export const AXIS_RANGE = { min: 92, max: 235 } as const;

export const LAYER = {
  lean: { ratio: 0.07, min: -4, max: 2.5 },
  upper: { ratio: 0.3, min: -13, max: 9 },
} as const;

export const SPRING = { aimed: 125, idle: 85, upper: 0.45, lean: 0.3 } as const;
export const ZETA = { axis: 0.56, upper: 0.62, lean: 0.5 } as const;
export const BOB = { amplitude: 1.3, periodMs: 640, afterMs: 1200 } as const;

const GLANCE = { firstMin: 8000, firstRange: 4000, out: 0.55, hold: 1.2, back: 0.7 } as const;
const MAX_STEP_S = 1 / 120;
const MAX_DT_S = 0.034;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDeg(value: number): number {
  let deg = value % 360;
  if (deg > 180) deg -= 360;
  if (deg <= -180) deg += 360;
  return deg;
}

/** 把角度归到 [0, 360)，指向角按这个区间比较。 */
export function normalize360(value: number): number {
  const deg = value % 360;
  return deg < 0 ? deg + 360 : deg;
}

/** 绕某点旋转（屏幕坐标，顺时针为正）。 */
function rotate(point: { x: number; y: number }, pivot: { x: number; y: number }, deg: number) {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

/**
 * 把画布里的点逐级转过去：先灯头、再肘、最后底座。
 * 顺序不能换——外层转的是内层已经转好的结果。
 */
export function chain(
  point: { x: number; y: number },
  headDeg: number,
  upperDeg: number,
  leanDeg: number
) {
  return rotate(rotate(rotate(point, PIVOT.head, headDeg), PIVOT.elbow, upperDeg), PIVOT.base, leanDeg);
}

/** 灯泡点当前落在画布上的哪里（用来量"灯到底指着谁"）。 */
export function bulbCanvas(headDeg: number, upperDeg: number, leanDeg: number) {
  return chain(PIVOT.bulb, headDeg, upperDeg, leanDeg);
}

export function createAxis(value = 0): Axis {
  return { value, velocity: 0 };
}

/** 半隐式欧拉：a = k(target − x) − 2√k·ζ·v，切 1/120s 子步。 */
export function stepSpring(axis: Axis, target: number, stiffness: number, zeta: number, dt: number): void {
  const total = clamp(dt, 0, MAX_DT_S);
  const steps = Math.max(1, Math.ceil(total / MAX_STEP_S));
  const step = total / steps;
  const damping = 2 * Math.sqrt(stiffness) * zeta;
  for (let i = 0; i < steps; i += 1) {
    const acceleration = stiffness * (target - axis.value) - damping * axis.velocity;
    axis.velocity += acceleration * step;
    axis.value += axis.velocity * step;
  }
}

export function layerTargets(delta: number) {
  return {
    lean: clamp(delta * LAYER.lean.ratio, LAYER.lean.min, LAYER.lean.max),
    upper: clamp(delta * LAYER.upper.ratio, LAYER.upper.min, LAYER.upper.max),
  };
}

function backOut(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function power2InOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function createGlance() {
  let startedAt = -1;
  let amount = 0;
  let nextAt = -1;
  const schedule = (now: number) => {
    nextAt = now + GLANCE.firstMin + Math.random() * GLANCE.firstRange;
  };
  const value = (now: number): number => {
    if (startedAt < 0) return 0;
    const elapsed = (now - startedAt) / 1000;
    if (elapsed < GLANCE.out) return amount * backOut(elapsed / GLANCE.out);
    if (elapsed < GLANCE.out + GLANCE.hold) return amount;
    if (elapsed < GLANCE.out + GLANCE.hold + GLANCE.back) {
      return amount * (1 - power2InOut((elapsed - GLANCE.out - GLANCE.hold) / GLANCE.back));
    }
    startedAt = -1;
    schedule(now);
    return 0;
  };
  return {
    update(now: number, atRest: boolean): number {
      if (nextAt < 0) schedule(now);
      if (!atRest) {
        if (startedAt >= 0) {
          startedAt = -1;
          schedule(now);
        }
        return 0;
      }
      if (startedAt < 0 && now >= nextAt) {
        startedAt = now;
        amount = Math.random() < 0.6 ? 17 : -9;
      }
      return value(now);
    },
    reset(now: number) {
      startedAt = -1;
      schedule(now);
    },
  };
}

export function bobAt(now: number): number {
  return Math.sin(now / BOB.periodMs) * BOB.amplitude;
}
