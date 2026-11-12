import { useLampRig } from '@/app/useLampRig';

/**
 * 台灯。三层嵌套：lean ⊃ upper ⊃ head，转角相加。
 * 灯具是分层的透明底部件（public/lamp/*.webp），五张图共用同一张 815×1216 画布，
 * 叠在一起天然对齐；三个关节的原点在 scene.css 里，用百分比。
 * 灯罩口在画布 (125, 235)，是算指向角的极点，和 useLampRig 的 PIVOT.bulb 必须一致。
 *
 * 光不在这里：光锥画在舞台层的一张 canvas 上（见 beam-canvas），
 * 因为它的长度要跟着"灯口到目标的距离"变，塞进这棵子树只会被裁掉。
 */
export function Lamp() {
  const rig = useLampRig();

  return (
    <>
      <canvas ref={rig.beam} className="beam-canvas" aria-hidden="true" />
      <div className="lamp" ref={rig.lamp} aria-hidden="true">
        <div className="lamp__lean" ref={rig.lean}>
          <img className="lamp__part" src="/lamp/lower.webp" alt="" draggable={false} />
          <div className="lamp__upper" ref={rig.upper}>
            <img className="lamp__part" src="/lamp/upper.webp" alt="" draggable={false} />
            <img className="lamp__part" src="/lamp/bolt-elbow.webp" alt="" draggable={false} />
            <div className="lamp__head" ref={rig.head}>
              <img className="lamp__part" src="/lamp/head.webp" alt="" draggable={false} />
              <img className="lamp__part" src="/lamp/bolt-head.webp" alt="" draggable={false} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}