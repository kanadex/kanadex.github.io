import { windowActions, type WindowMeta } from '@/desktop/windowStore';

let sequence = 0;

/**
 * 打开一个图片查看器窗口。每次调用都是新窗口，id 唯一，
 * 所以任务栏里会同时出现多个图标，关掉其中一个不影响其它。
 */
export function openImage(src: string, alt: string): void {
  sequence += 1;
  const name = src.split('/').pop() ?? 'image';
  const step = (sequence - 1) % 6;
  const meta: WindowMeta = {
    label: '图片',
    title: 'image',
    subtitle: name,
    rect: { left: 28 + step * 3, top: 18 + step * 3, width: 44, height: 56 },
    tone: 'night',
    viewer: { src, alt },
  };
  windowActions.openWindow('image:' + sequence, meta);
}
