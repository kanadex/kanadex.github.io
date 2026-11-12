import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { aimTarget, installAimInput } from '@/app/aimRegistry';
import { createBeamRenderer } from '@/app/beamCanvas';
import {
  AXIS_RANGE,
  BOB,
  REST_AXIS,
  SPRING,
  VIEW,
  ZETA,
  bobAt,
  bulbCanvas,
  clamp,
  createAxis,
  createGlance,
  layerTargets,
  normalize360,
  stepSpring,
} from '@/app/lampKinematics';

/**
 * 台灯的驱动回路。每帧：
 *   1. 取当前目标（窗口 / 图标 / chip / 静止锚点），没有指针坐标参与；
 *   2. 把灯泡点按当前三层角度**逐级转过去**，得到它现在真的在画面哪个位置；
 *   3. 从灯泡点量到目标的角度，钳到 [92,235]，这才是"灯该指向哪"；
 *   4. 底座吃 7%、肘吃 30%、灯头吃剩下的，三层各自跑弹簧。
 *
 * 第 2 步不能省：灯臂一转，罩口就跟着挪，不按链条量出来的角度会把光打偏。
 */

/** 灯的包围盒只在布局变化时变，不必每帧读。 */
const LAMP_RECT_TTL_MS = 200;

const DEG = 180 / Math.PI;
const angleTo = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.atan2(b.y - a.y, b.x - a.x) * DEG;

export interface LampRigRefs {
  beam: RefObject<HTMLCanvasElement>;
  lamp: RefObject<HTMLDivElement>;
  lean: RefObject<HTMLDivElement>;
  upper: RefObject<HTMLDivElement>;
  head: RefObject<HTMLDivElement>;
}

export function useLampRig(): LampRigRefs {
  const beam = useRef<HTMLCanvasElement>(null);
  const lamp = useRef<HTMLDivElement>(null);
  const lean = useRef<HTMLDivElement>(null);
  const upper = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uninstallInput = installAimInput();
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const leanAxis = createAxis();
    const upperAxis = createAxis();
    const aimAxis = createAxis(REST_AXIS);
    const glance = createGlance();
    const renderer = beam.current ? createBeamRenderer(beam.current) : null;

    let handle = 0;
    let last = performance.now();
    let restSince = last;
    let bobValue = 0;
    let glanceValue = 0;
    let headWritten = 0;
    let box: { left: number; top: number; width: number } | null = null;
    let boxAt = 0;

    const measure = (now: number) => {
      const node = lamp.current;
      if (!node) return null;
      if (box && now - boxAt < LAMP_RECT_TTL_MS) return box;
      const rect = node.getBoundingClientRect();
      box = { left: rect.left, top: rect.top, width: rect.width };
      boxAt = now;
      return box;
    };

    const invalidate = () => {
      box = null;
    };
    window.addEventListener('resize', invalidate);

    const tick = (now: number) => {
      handle = window.requestAnimationFrame(tick);
      const dt = clamp((now - last) / 1000, 0, 0.034);
      last = now;

      const leanNode = lean.current;
      const upperNode = upper.current;
      const headNode = head.current;
      const boxNow = measure(now);
      if (!leanNode || !upperNode || !headNode || !boxNow) return;

      const target = aimTarget(now);
      const atRest = !target || target.kind === 'rest';
      if (!atRest) restSince = now;

      // 灯泡点按当前角度逐级转过去，换到页面坐标
      const scale = boxNow.width / VIEW.width;
      const bulbLocal = bulbCanvas(headWritten, upperAxis.value, leanAxis.value);
      const bulbPage = {
        x: boxNow.left + bulbLocal.x * scale,
        y: boxNow.top + bulbLocal.y * scale,
      };

      const axisTarget = target
        ? clamp(normalize360(angleTo(bulbPage, target.point)), AXIS_RANGE.min, AXIS_RANGE.max)
        : REST_AXIS;
      const layers = layerTargets(axisTarget - REST_AXIS);
      const reduced = motionQuery.matches;
      const settled = atRest && now - restSince > BOB.afterMs;

      if (reduced) {
        aimAxis.value = axisTarget;
        aimAxis.velocity = 0;
        upperAxis.value = layers.upper;
        upperAxis.velocity = 0;
        leanAxis.value = layers.lean;
        leanAxis.velocity = 0;
        bobValue = 0;
        glance.reset(now);
        } else {
        const stiffness = atRest ? SPRING.idle : SPRING.aimed;
        stepSpring(aimAxis, axisTarget, stiffness, ZETA.axis, dt);
        stepSpring(upperAxis, layers.upper, stiffness * SPRING.upper, ZETA.upper, dt);
        stepSpring(leanAxis, layers.lean, stiffness * SPRING.lean, ZETA.lean, dt);
        bobValue += ((settled ? bobAt(now) : 0) - bobValue) * Math.min(1, dt * 4);
      }

      if (reduced) {
        glanceValue = 0;
      } else {
        glanceValue += (glance.update(now, settled) - glanceValue) * Math.min(1, dt * 14);
      }
      const wobble = reduced ? 0 : bobValue + glanceValue;

      // 灯头吃掉全部余量：总转角 = 底座 + 肘 + 灯头 = 指向角 − 静止角
      headWritten = aimAxis.value - REST_AXIS - upperAxis.value - leanAxis.value + wobble;

      // 光锥：从罩口朝目标打出去，长度跟着距离变
      if (renderer) {
        renderer.draw({
          bulb: bulbPage,
          angleDeg: REST_AXIS + leanAxis.value + upperAxis.value + headWritten,
          target: target ? target.point : null,
          scale,
          alpha: 1,
        });
      }

      leanNode.style.transform = 'rotate(' + leanAxis.value.toFixed(3) + 'deg)';
      upperNode.style.transform = 'rotate(' + upperAxis.value.toFixed(3) + 'deg)';
      headNode.style.transform = 'rotate(' + headWritten.toFixed(3) + 'deg)';
    };

    handle = window.requestAnimationFrame(tick);
    return () => {
      uninstallInput();
      window.removeEventListener('resize', invalidate);
      window.cancelAnimationFrame(handle);
    };
  }, []);

  return { beam, lamp, lean, upper, head };
}
