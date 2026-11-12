import { siteConfig } from '@/config/site.config';

/** 会话运行时长，和 neofetch 一样按天/时/分给。 */
function formatUptime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return days + ' days, ' + hours + ' hours, ' + mins + ' mins';
}

/** 显卡名：去掉括号里的驱动后缀，太长就截断。 */
function readGpu(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return 'unavailable';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const head = (name.split('(')[0] ?? '').trim();
    return head ? head.slice(0, 44) : 'integrated';
  } catch {
    return 'unknown';
  }
}

/** 堆内存（只有 Chromium 提供），拿不到就写 n/a。 */
function readMemory(): string {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
  if (!perf.memory) return 'n/a';
  const used = Math.round(perf.memory.usedJSHeapSize / 1048576);
  const total = Math.round(perf.memory.jsHeapSizeLimit / 1048576);
  return used + 'MiB / ' + total + 'MiB';
}

/**
 * 系统信息：终端 neofetch 与「关于」面板共用这一份。
 * 两边各写一份，版本号迟早会漂。
 */
export function systemFields(packages: number): [string, string][] {
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 0;
  return [
    ['OS', siteConfig.os + ' ' + siteConfig.release],
    ['Host', window.location.host || window.location.hostname],
    ['Kernel', 'React 18 / Vite 5'],
    ['Uptime', formatUptime(performance.now())],
    ['Packages', packages + ' commands'],
    ['Shell', 'kanadex-term ' + siteConfig.release],
    ['Resolution', window.innerWidth + 'x' + window.innerHeight],
    ['CPU', '(' + cores + ')'],
    ['GPU', readGpu()],
    ['Memory', readMemory()],
  ];
}
