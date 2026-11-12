import { siteConfig } from '@/config/site.config';
import { systemFields } from '@/app/systemInfo';
import portraitRaw from '@/data/portrait.txt?raw';
import { findProject, projects } from '@/data/projects';
import { allPaths, isDir, listDir, normalize, readFile, resolvePath } from '@/terminal/vfs';
import type { LineInput, TerminalCommand } from '@/terminal/types';

/** 头像的字符画（110 列 × 55 行），来自 src/data/portrait.txt，不在代码里内联。 */
const PORTRAIT: string[] = portraitRaw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');

/** 按显示宽度补齐：东亚字符算两格，表格才对得齐。 */
function pad(text: string, width: number): string {
  const visible = [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  return text + ' '.repeat(Math.max(0, width - visible));
}

function projectLinks(id: string): LineInput[] {
  const project = findProject(id);
  if (!project) return [];
  return project.links.map((item) => ({
    kind: 'accent' as const,
    text: '  ' + pad(item.label, 16) + item.href,
  }));
}

export const commands: TerminalCommand[] = [
  {
    name: 'help',
    summary: '列出全部命令',
    run: (_args, ctx) => {
      const width = Math.max(...commands.map((command) => command.name.length));
      ctx.print([
        { kind: 'dim', text: '可用命令：' },
        ...commands.map((command) => ({
          kind: 'text' as const,
          text: '  ' + command.name.padEnd(width + 2) + command.summary,
        })),
        { kind: 'dim', text: 'Tab 补全命令与文件名，↑↓ 翻历史。' },
      ]);
    },
  },
  {
    name: 'hello',
    summary: '打招呼并自我介绍',
    run: (_args, ctx) => {
      ctx.print([
        { kind: 'accent', text: siteConfig.title },
        { kind: 'text', text: siteConfig.subtitle },
        { kind: 'dim', text: siteConfig.terminal.hint },
      ]);
    },
  },
  {
    name: 'whoami',
    summary: '我是谁',
    run: (_args, ctx) => {
      ctx.print([
        { kind: 'accent', text: 'kanadex' },
        { kind: 'text', text: '维护 GeometryOS、VerseBox 和 QZXUI。' },
        { kind: 'dim', text: 'github.com/kanadex' },
      ]);
    },
  },
  {
    name: 'about',
    summary: '打开自我介绍',
    run: (_args, ctx) => {
      const file = readFile('about.txt');
      if (file) ctx.print(file.body.map((text) => ({ kind: 'text' as const, text })));
      ctx.navigate('about');
    },
  },
  {
    name: 'ls',
    summary: '列出目录内容',
    usage: 'ls [目录]',
    run: (args, ctx) => {
      const target = resolvePath(ctx.cwd, args[0] ?? '');
      const entries = listDir(target);
      if (entries.length === 0) {
        ctx.print({ kind: 'warn', text: 'ls: ' + (args[0] ?? '') + ': 没有这个目录' });
        return;
      }
      ctx.print({ kind: 'text', text: entries.join('   ') });
    },
  },
  {
    name: 'cd',
    summary: '切换目录',
    usage: 'cd [目录]',
    run: (args, ctx) => {
      const raw = args[0] ?? '';
      const target = raw === '' || raw === '~' ? '' : resolvePath(ctx.cwd, raw);
      if (!isDir(target)) {
        ctx.print({ kind: 'warn', text: 'cd: ' + raw + ': 没有这个目录' });
        return;
      }
      // cd 成功不输出任何东西，和真 shell 一样
      ctx.setCwd(target);
    },
  },
  {
    name: 'pwd',
    summary: '显示当前目录',
    run: (_args, ctx) => {
      ctx.print({ kind: 'text', text: ctx.cwd ? '/' + ctx.cwd : '/' });
    },
  },
  {
    name: 'cat',
    summary: '读取文件',
    usage: 'cat <文件>',
    run: (args, ctx) => {
      const target = args[0];
      if (!target) {
        ctx.print({ kind: 'warn', text: '用法：cat <文件>，例如 cat projects/versebox.md' });
        return;
      }
      const file = readFile(resolvePath(ctx.cwd, target));
      if (!file) {
        ctx.print({ kind: 'warn', text: 'cat: ' + target + ': 没有这个文件' });
        return;
      }
      ctx.print(file.body.map((text) => ({ kind: 'text' as const, text })));
    },
  },
  {
    name: 'projects',
    summary: '列出项目',
    run: (_args, ctx) => {
      ctx.print([
        { kind: 'dim', text: 'id          名称          状态' },
        ...projects.map((project) => ({
          kind: 'text' as const,
          text: pad(project.id, 12) + pad(project.name, 14) + project.statusLabel,
        })),
        { kind: 'dim', text: '用 open <id> 看详情，cat projects/<id>.md 读全文。' },
      ]);
    },
  },
  {
    name: 'open',
    summary: '打开某个项目',
    usage: 'open <id>',
    run: (args, ctx) => {
      const id = args[0];
      if (!id) {
        ctx.print({ kind: 'warn', text: '用法：open <id>，例如 open versebox' });
        return;
      }
      const project = findProject(id);
      if (!project) {
        ctx.print({ kind: 'warn', text: '找不到项目「' + id + '」，可用：' + projects.map((item) => item.id).join(', ') });
        return;
      }
      const sentences = project.summary.split('。').filter(Boolean);
      ctx.print([
        { kind: 'ok', text: project.name + ' — ' + project.subtitle },
        ...sentences.map((sentence) => ({ kind: 'text' as const, text: sentence + '。' })),
        { kind: 'dim', text: '状态：' + project.statusLabel + '，标签：' + project.tags.join(' / ') },
        ...projectLinks(project.id),
      ]);
      ctx.navigate('projects');
    },
  },
  {
    name: 'goto',
    summary: '打开某个窗口',
    usage: 'goto <terminal|about|projects|notes|contact>',
    run: (args, ctx) => {
      const target = args[0] ?? '';
      const allowed = ['terminal', 'about', 'projects', 'notes', 'contact'];
      if (!allowed.includes(target)) {
        ctx.print({ kind: 'warn', text: '没有这个窗口：' + (target || '(空)') });
        return;
      }
      // 窗口会自己出现在桌面上，不需要再补一行"已打开"
      ctx.navigate(target);
    },
  },
  {
    name: 'verbose',
    summary: '失败时多说一句（默认关）',
    usage: 'verbose [on|off]',
    run: (args, ctx) => {
      const next = args[0];
      const on = next === 'on' ? true : next === 'off' ? false : !ctx.verbose();
      ctx.setVerbose(on);
      // 这是"问模式是什么"的回答，不是操作成功的确认行
      ctx.print({ kind: 'dim', text: 'verbose ' + (on ? 'on' : 'off') });
    },
  },
  {
    name: 'github',
    summary: '新标签打开 GitHub',
    run: (_args, ctx) => {
      ctx.print([
        { kind: 'accent', text: siteConfig.contact.github },
        { kind: 'dim', text: '如果没弹窗，说明浏览器拦了新标签。' },
      ]);
      window.open(siteConfig.contact.github, '_blank', 'noopener,noreferrer');
    },
  },
  {
    name: 'mail',
    summary: '显示联系邮箱',
    run: (_args, ctx) => {
      ctx.print([
        { kind: 'accent', text: siteConfig.contact.email },
        { kind: 'dim', text: '也可以点页面底部的「写邮件」。' },
      ]);
    },
  },
  {
    // 字段来自 systemFields()，和关于面板共用；版本号不要在这条命令里手写第二份
    name: 'neofetch',
    summary: '一屏系统信息',
    run: (_args, ctx) => {
      const rows: { text: string; spans?: { text: string; tone?: 'key' | 'val' }[] }[] = [];
      const fields = systemFields(commands.length);
      const art = PORTRAIT;
      const header = siteConfig.terminal.user + '@' + siteConfig.terminal.host;
      const push = (artRow: string, spans: { text: string; tone?: 'key' | 'val' }[]) =>
        rows.push({ text: artRow + spans.map((span) => span.text).join(''), spans: [{ text: artRow }, ...spans] });

      push(art[0] ?? '', [{ text: header }]);
      push(art[1] ?? '', [{ text: '─'.repeat(23) }]);
      fields.forEach(([key, value], index) => {
        const label = key + ': ' + ' '.repeat(Math.max(0, 12 - key.length));
        push(art[index + 2] ?? '', [
          { text: label, tone: 'key' as const },
          { text: value, tone: 'val' as const },
        ]);
      });
      for (let index = fields.length + 2; index < art.length; index += 1) rows.push({ text: art[index] ?? '' });
      ctx.print(rows.map((row) => ({ kind: 'art' as const, text: row.text, spans: row.spans })));
    },
  },
  {
    name: 'date',
    summary: '本地时间',
    run: (_args, ctx) => {
      ctx.print({ kind: 'text', text: new Date().toLocaleString('zh-CN', { hour12: false }) });
    },
  },
  {
    name: 'echo',
    summary: '原样输出',
    usage: 'echo <文本>',
    run: (args, ctx) => {
      ctx.print({ kind: 'text', text: args.join(' ') });
    },
  },
  {
    name: 'clear',
    summary: '清屏',
    run: (_args, ctx) => ctx.clear(),
  },
  {
    name: 'sudo',
    summary: '（不行的）',
    run: (_args, ctx) => {
      ctx.print({ kind: 'warn', text: 'kanadex 不在 sudoers 文件里。此事将被记录。' });
    },
  },
  {
    name: 'exit',
    summary: '（也不行的）',
    run: (_args, ctx) => {
      ctx.print({ kind: 'dim', text: '灯还亮着，先别走，往下看看项目。' });
    },
  },
];

export function resolveCommand(name: string): TerminalCommand | undefined {
  return commands.find((command) => command.name === name);
}

/** Tab 补全：命令名、文件路径、项目 id 一起给。 */
export function complete(prefix: string): string[] {
  const word = prefix.trim();
  if (!word) return commands.map((command) => command.name);
  const spaceIndex = word.indexOf(' ');
  if (spaceIndex === -1) {
    return commands.map((command) => command.name).filter((name) => name.startsWith(word));
  }
  const head = word.slice(0, spaceIndex);
  const rest = word.slice(spaceIndex + 1);
  if (head === 'cat' || head === 'ls' || head === 'cd') {
    const base = normalize(rest);
    return allPaths()
      .filter((item) => item.startsWith(base))
      .map((item) => head + ' ' + item);
  }
  if (head === 'open') {
    return projects
      .map((project) => project.id)
      .filter((id) => id.startsWith(rest.trim()))
      .map((id) => 'open ' + id);
  }
  return [];
}

/** 输错命令时给一个最像的提示。 */
export function suggest(name: string): string | undefined {
  const best = commands
    .map((command) => ({ name: command.name, score: distance(name, command.name) }))
    .sort((a, b) => a.score - b.score)[0];
  return best && best.score <= 3 ? best.name : undefined;
}

function distance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) table[i]![0] = i;
  for (let j = 0; j < cols; j += 1) table[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      table[i]![j] = Math.min(table[i - 1]![j]! + 1, table[i]![j - 1]! + 1, table[i - 1]![j - 1]! + cost);
    }
  }
  return table[rows - 1]![cols - 1]!;
}
