export type ProjectStatus = 'shipping' | 'wip' | 'unreleased';

export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectMedia {
  src: string;
  alt: string;
  caption: string;
}

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  summary: string;
  points: string[];
  tags: string[];
  status: ProjectStatus;
  statusLabel: string;
  accent: 'lamp' | 'mint' | 'ink';
  links: ProjectLink[];
  media: ProjectMedia[];
}

export const projects: Project[] = [
  {
    id: 'geometryos',
    name: 'GeometryOS',
    subtitle: '基于 Android 定制的虚拟机系统',
    summary:
      '基于 Android 深度定制的虚拟机系统，把独立的 Android 用户空间装进一台普通手机，运行时跑在容器里。我是维护者之一，平时做运行时和界面。',
    points: [
      '基于 Android 深度定制，共享手机内核',
      '容器化的客机运行环境',
      '系统界面、设置与个性化一并重做',
    ],
    tags: ['Android', 'AOSP', 'Runtime', 'C/C++'],
    status: 'shipping',
    statusLabel: '长期维护',
    accent: 'lamp',
    links: [
      { label: '官网', href: 'https://geometryos.cn' },
      { label: '文档', href: 'https://docs.geometryos.cn' },
    ],
    media: [
      { src: '/media/geo-personalize.jpg', alt: 'GeometryOS 个性化设置界面', caption: '个性化，锁屏与主题' },
      { src: '/media/geo-lockscreen.jpg', alt: 'GeometryOS 锁屏界面', caption: '锁屏，编辑态' },
    ],
  },
  {
    id: 'versebox',
    name: 'VerseBox',
    subtitle: 'Android 9 / 15 的客机运行时',
    summary:
      '让 Android 9 和 Android 15 作为独立客体运行在 Android 手机上，不需要 root、Docker 或容器。两套客机运行时已经开源。',
    points: [
      'Android 9 / 15 两套客机运行时',
      '不用 root、Docker 和容器',
      'Binder、属性、图形三座桥',
    ],
    tags: ['Android', 'Bionic/ART', 'Binder', 'C/C++'],
    status: 'wip',
    statusLabel: '开发中',
    accent: 'mint',
    links: [
      { label: 'A9 运行时', href: 'https://github.com/GeometryOS/VerseBox-guest-runtime-a9' },
      { label: 'A15 运行时', href: 'https://github.com/GeometryOS/VerseBox-guest-runtime-a15' },
    ],
    media: [
      { src: '/media/versebox-1.jpg', alt: 'VerseBox 虚拟机管理界面', caption: '多虚拟机管理' },
      { src: '/media/versebox-2.jpg', alt: 'VerseBox 客机桌面', caption: '客机桌面' },
    ],
  },
  {
    id: 'qzxui',
    name: 'QZXUI',
    subtitle: '面向 Android 的界面组件库',
    summary:
      '围绕「页面 + 滚动 + 列表 + 材质」搭起来的一套 Android UI 组件库，目标是应用默认就好看、滑动就顺。',
    points: [
      '页面、滚动、列表、材质四层组件',
      '统一的动效节奏与圆角规范',
      '公开预览中，开源尚未开始',
    ],
    tags: ['Android', 'UI', 'Design System'],
    status: 'wip',
    statusLabel: '即将开源',
    accent: 'ink',
    links: [{ label: '预览站', href: 'https://qzxui.geometryos.cn' }],
    media: [
      { src: '/media/qzxui-1.jpg', alt: 'QZXUI 组件示例界面', caption: '组件示例' },
      { src: '/media/qzxui-2.jpg', alt: 'QZXUI 列表与滚动示例', caption: '列表与滚动' },
    ],
  },
  {
    id: 'mcn',
    name: 'MCN',
    subtitle: 'Velocity 群服互通插件',
    summary:
      '跑在 Velocity 代理端的群服互通插件，附带 Web 面板管理与一套开放 API，方便把多个服务器拼成一个整体。暂未开源。',
    points: ['代理端群服互通', 'Web 面板管理', '开放 API 便于扩展'],
    tags: ['Java', 'Velocity', 'Web API'],
    status: 'unreleased',
    statusLabel: '未开源',
    accent: 'mint',
    links: [{ label: 'GitHub', href: 'https://github.com/kanadex' }],
    media: [],
  },
];

export function findProject(id: string): Project | undefined {
  const key = id.trim().toLowerCase();
  return projects.find((project) => project.id === key || project.name.toLowerCase() === key);
}
