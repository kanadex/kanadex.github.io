/**
 * 站点配置：名字、链接、备案、终端欢迎语都集中在这里。
 * 换域名或换联系方式时只改本文件，不要散落到组件里。
 */
export interface NavItem {
  /** 对应页面上 section 的 id */
  id: string;
  label: string;
}

export interface SiteConfig {
  name: string;
  handle: string;
  /** 开机画面上的字；和角落的 handle 不是一回事 */
  bootName: string;
  /** 项目的发布版本号，终端横幅与 neofetch 都读它 */
  release: string;
  /** 终端里显示的系统名 */
  os: string;
  /** 部署后的正式域名，用于规范化与分享卡片 */
  siteUrl: string;
  title: string;
  subtitle: string;
  description: string;
  nav: NavItem[];
  contact: {
    email: string;
    github: string;
    githubLabel: string;
    status: string;
    statusLabel: string;
  };
  footer: {
    icp: string;
    icpUrl: string;
    since: number;
    note: string;
  };
  terminal: {
    user: string;
    host: string;
    /** 输入行前缀符号 */
    prompt: string;
    /** 首次进入终端时的引导命令 */
    bootCommand: string;
    /** 引导结束后的一行提示 */
    hint: string;
  };
}

export const siteConfig: SiteConfig = {
  name: 'Kanadex',
  handle: 'kanadex',
  bootName: 'Kanadex_OS',
  release: '1.0.0',
  os: 'KanadexOS',
  siteUrl: 'https://kanadex.github.io',
  title: 'Kanadex',
  subtitle: '👋你好，我是 Kanadex，热爱编程，平时喜欢做一些让自己开心的神秘项目。',
  description: 'Kanadex 的个人主页：维护 GeometryOS、VerseBox 与 QZXUI。桌面上可以敲命令。',
  nav: [
    { id: 'about', label: '关于' },
    { id: 'projects', label: '项目' },
    { id: 'contact', label: '联系' },
  ],
  contact: {
    email: 'qzxxfy@gmail.com',
    github: 'https://github.com/kanadex',
    githubLabel: 'github.com/kanadex',
    status: 'https://cloud.geometryos.cn/serverstatus/',
    statusLabel: '服务状态',
  },
  footer: {
    icp: '黑ICP备2026006652号-1',
    icpUrl: 'https://beian.miit.gov.cn/',
    since: 2026,
    note: '.',
  },
  terminal: {
    user: 'kanadex',
    host: 'web',
    prompt: '%',
    bootCommand: './hello',
    hint: '输入 help 查看全部命令，Tab 补全，↑↓ 翻历史。',
  },
};

