import { useCallback, useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/config/site.config';
import { prefersReducedMotion } from '@/lib/motion';
import { complete as completeCommands, resolveCommand, suggest } from '@/terminal/commands';
import { windowActions, windowMeta, type WindowId } from '@/desktop/windowStore';
import type { LineInput, TermLine, TerminalContext } from '@/terminal/types';

const MAX_LINES = 300;

const LAST_LOGIN_KEY = 'kanadex.lastLogin';

/** 上一次打开终端的时间。第一次来就没有这一行。 */
function readLastLogin(): string | null {
  try {
    const raw = window.localStorage.getItem(LAST_LOGIN_KEY);
    if (!raw) return null;
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) return null;
    // 和系统登录提示同一种写法：Wed Nov 12 17:25:16 2026
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const two = (value: number) => String(value).padStart(2, '0');
    return (
      days[at.getDay()] +
      ' ' +
      months[at.getMonth()] +
      ' ' +
      at.getDate() +
      ' ' +
      two(at.getHours()) + ':' + two(at.getMinutes()) + ':' + two(at.getSeconds()) +
      ' ' +
      at.getFullYear()
    );
  } catch {
    return null;
  }
}

function writeLastLogin(): void {
  try {
    window.localStorage.setItem(LAST_LOGIN_KEY, new Date().toISOString());
  } catch {
    /* 隐私模式下写不进去就不写 */
  }
}

/** 开机横幅：欢迎语 + 三个去处 + 挂载 + 提示，最后是上次登录时间。 */
function bootLines(): LineInput[] {
  const repo = siteConfig.contact.github.replace('https://', '');
  const status = siteConfig.contact.status.replace('https://', '').replace(/\/$/, '');
  const last = readLastLogin();
  const lines: LineInput[] = [
    { kind: 'text', text: 'Welcome to ' + siteConfig.os + ' ' + siteConfig.release + ' (web)' },
    { kind: 'dim', text: '' },
    { kind: 'dim', text: ' * Documentation:  ' + repo },
    { kind: 'dim', text: ' * Management:     ' + status },
    { kind: 'dim', text: ' * Support:        ' + siteConfig.contact.email },
    { kind: 'dim', text: '' },
    { kind: 'dim', text: '挂载 /dev/web ......................... ok' },
    { kind: 'dim', text: '' },
    { kind: 'accent', text: siteConfig.terminal.hint },
  ];
  if (last) {
    lines.push({ kind: 'dim', text: '' }, { kind: 'dim', text: 'Last login: ' + last });
  }
  return lines;
}

export interface TerminalSession {
  lines: TermLine[];
  /** 开机横幅还在打印 */
  booting: boolean;
  history: string[];
  user: string;
  host: string;
  cwd: string;
  promptSign: string;
  submit: (raw: string) => void;
  clear: () => void;
  complete: (prefix: string) => string[];
}

/** 终端会话：只有行、历史、执行三件事，不含任何渲染。 */
export function useTerminalSession(): TerminalSession {
  const [lines, setLines] = useState<TermLine[]>([]);
  /**
   * 横幅逐条打印期间为 true。
   * 输入行只有在它为 false 时才渲染 —— 否则提示符会先出现，然后被逐条追加的横幅顶到下面去。
   */
  const [booting, setBooting] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const seq = useRef(0);
  // verbose 只是开关，不需要触发重渲染
  const verboseRef = useRef(false);
  const [cwd, setCwd] = useState('');

  const print = useCallback((input: LineInput | LineInput[]) => {
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) return;
    setLines((previous) => {
      const next = [...previous];
      items.forEach((item) => {
        seq.current += 1;
        next.push({ id: seq.current, kind: item.kind, text: item.text });
      });
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const goTo = useCallback((section: string) => {
    const known = Object.keys(windowMeta) as WindowId[];
    if ((known as string[]).includes(section)) windowActions.open(section as WindowId);
  }, []);

  useEffect(() => {
    writeLastLogin();
    const banner = bootLines();
    if (prefersReducedMotion()) {
      print(banner);
      setBooting(false);
      return;
    }
    // 逐条打印；最后一条落地时才放行输入行
    const timers = banner.map((line, index) =>
      window.setTimeout(() => {
        print(line);
        if (index === banner.length - 1) setBooting(false);
      }, 120 + index * 130)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [print]);



  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      // 历史里回显完整提示符，和真实终端一致
      print([{ kind: 'echo', text: raw, where: cwd }]);
      if (!text) return;
      setHistory((previous) => [...previous, text]);

      const [name = '', ...args] = text.split(/\s+/);
      const ctx: TerminalContext = {
        print,
        clear,
        navigate: goTo,
        cwd,
        setCwd,
        verbose: () => verboseRef.current,
        setVerbose: (on) => {
          verboseRef.current = on;
        },
      };

      const command = resolveCommand(name.toLowerCase());
      if (command) {
        // 命令抛错不能静默回到提示符：终端里必须留下一行，否则看起来像"命令没输出"
        try {
          command.run(args, ctx);
        } catch (error) {
          print({
            kind: 'warn',
            text: '命令执行失败: ' + (error instanceof Error ? error.message : String(error)),
          });
        }
        return;
      }

      // 失败只留一行，没有品牌前缀、没有"是不是想输入"。verbose 才多说一句。
      const lines: LineInput[] = [{ kind: 'warn', text: 'command not found: ' + name }];
      if (verboseRef.current) {
        const hint = suggest(name.toLowerCase());
        if (hint) lines.push({ kind: 'dim', text: '是不是想输入 ' + hint + ' ?' });
        lines.push({ kind: 'dim', text: '输入 help 看全部命令。' });
      }
      print(lines);
    },
    [clear, cwd, goTo, print]
  );

  return {
    lines,
    booting,
    history,
    user: siteConfig.terminal.user,
    host: siteConfig.terminal.host,
    cwd,
    promptSign: siteConfig.terminal.prompt,
    submit,
    clear,
    complete: completeCommands,
  };
}
