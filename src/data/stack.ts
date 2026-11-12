/** 首页展示的技术栈标签，与项目卡片里的 tags 分开维护。 */
export interface StackGroup {
  title: string;
  items: string[];
}

export const stackGroups: StackGroup[] = [
  { title: '运行时与系统', items: ['C/C++', 'Android', 'AOSP', 'ART', 'Binder'] },
  { title: '前端与站点', items: ['Vue 3', 'Nuxt', 'React', 'Fluent UI'] },
  { title: '服务端', items: ['NestJS', 'Koa2', 'PHP', '.NET 8', 'Python'] },
];
