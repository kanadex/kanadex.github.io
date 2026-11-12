export type LineKind = 'input' | 'echo' | 'text' | 'dim' | 'ok' | 'warn' | 'accent' | 'art';

/** 一行里的分段：用来给 neofetch 的"冒号左边"单独上色，又不破坏对齐。 */
export interface TermSpan {
  text: string;
  tone?: 'key' | 'val';
}

export interface TermLine {
  id: number;
  kind: LineKind;
  text: string;
  spans?: TermSpan[];
  /** echo 行记录当时的目录，提示符才能还原成敲下那一刻的样子 */
  where?: string;
}

export type LineInput = Omit<TermLine, 'id'>;

export interface TerminalContext {
  print: (lines: LineInput | LineInput[]) => void;
  clear: () => void;
  /** 打开/聚焦对应窗口；终端在桌面里，不再"滚动到某个 section" */
  navigate: (sectionId: string) => void;
  /** 当前目录（相对仓库根，空串表示家目录） */
  cwd: string;
  setCwd: (dir: string) => void;
  /** verbose 关着时，失败只留一行；开着才给"是不是想输入…"这类提示 */
  verbose: () => boolean;
  setVerbose: (on: boolean) => void;
}

export interface TerminalCommand {
  name: string;
  summary: string;
  usage?: string;
  run: (args: string[], ctx: TerminalContext) => void;
}
