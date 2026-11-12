/**
 * 终端的只读虚拟文件系统。
 * 内容刻意写短：终端一行大约 30 个汉字，超了就会难看得换行。
 */
export interface VFile {
  path: string;
  body: string[];
}

export const vfs: VFile[] = [
  {
    path: 'about.txt',
    body: [
      'Kanadex',
      '  维护 GeometryOS、VerseBox 和 QZXUI。',
      '    GeometryOS   基于 Android 的虚拟机系统',
      '    VerseBox     Android 9 / 15 的客机运行时',
      '    QZXUI        Android 界面组件库，即将开源',
    ],
  },
  {
    path: 'contact.txt',
    body: [
      'GitHub   github.com/kanadex',
      'E-Mail   qzxxfy@gmail.com',
      '状态页   cloud.geometryos.cn/serverstatus',
    ],
  },
  {
    path: 'projects/geometryos.md',
    body: [
      '# GeometryOS',
      '基于 Android 深度定制的虚拟机系统，',
      '把独立的 Android 用户空间装进一台普通手机。',
      '我在里面做运行时和界面，长期维护。',
    ],
  },
  {
    path: 'projects/versebox.md',
    body: [
      '# VerseBox',
      '让 Android 9 和 Android 15 作为独立客体运行在手机上，',
      '不需要 root、Docker 或容器。',
      '状态：开发中，两套客机运行时已开源。',
      '仓库：github.com/GeometryOS',
    ],
  },
  {
    path: 'projects/qzxui.md',
    body: [
      '# QZXUI',
      '面向 Android 的界面组件库：页面、滚动、列表、材质。',
      '目标是一个应用默认就好看，而不是每页各写一份间距。',
      '状态：公开预览，开源尚未开始。',
      '站点：qzxui.geometryos.cn',
    ],
  },
  {
    path: 'projects/mcn.md',
    body: [
      '# MCN',
      '跑在 Velocity 代理端的群服互通插件，带 Web 面板与开放 API。',
      '状态：未开源。',
    ],
  },
];

const dirs = ['projects'];

export function listDir(path = ''): string[] {
  const key = normalize(path);
  if (!key) {
    const files = vfs.filter((file) => !file.path.includes('/')).map((file) => file.path);
    return [...files, ...dirs.map((dir) => dir + '/')];
  }
  const prefix = key + '/';
  return vfs
    .filter((file) => file.path.startsWith(prefix))
    .map((file) => file.path.slice(prefix.length))
    .filter((name) => !name.includes('/'));
}

export function readFile(path: string): VFile | undefined {
  const key = normalize(path);
  return vfs.find((file) => file.path === key);
}

export function allPaths(): string[] {
  return [...vfs.map((file) => file.path), ...dirs.map((dir) => dir + '/')];
}

/** 目录判断：根目录和 dirs 里的都算目录。 */
export function isDir(path: string): boolean {
  const key = normalize(path);
  return key === '' || dirs.includes(key);
}

/**
 * 把用户输入解析成 vfs 里的路径。
 * 支持：绝对（/projects）、家目录（~/）、上级（..）、当前（.）、以及相对当前目录。
 */
export function resolvePath(cwd: string, input: string): string {
  const raw = input.trim();
  const base = normalize(cwd);
  if (!raw) return base;
  if (raw === '/') return '';
  if (raw.startsWith('~/')) return normalize(raw.slice(2));
  if (raw.startsWith('/')) return normalize(raw.slice(1));
  if (raw === '..') {
    const parts = base.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }
  if (raw === '.' || raw === './') return base;
  return normalize(base ? base + '/' + raw : raw);
}

export function normalize(path: string): string {
  return path
    .trim()
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}
