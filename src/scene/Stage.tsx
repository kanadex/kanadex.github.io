import { Ground } from '@/scene/Ground';
import { Lamp } from '@/scene/Lamp';
import { Sky } from '@/scene/Sky';

/**
 * 固定舞台：天空 / 山与桌面 / 台灯。
 * 台灯自己跑帧循环（useLampRig），舞台不接收任何姿态属性，因此不会每帧重渲染。
 */
export function Stage() {
  return (
    <div className="stage" aria-hidden="true">
      <Sky />
      <Ground />
      <Lamp />
    </div>
  );
}
