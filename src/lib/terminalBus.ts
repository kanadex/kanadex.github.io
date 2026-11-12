const COMMAND_EVENT = 'kanadex:terminal-command';
const FOCUS_EVENT = 'kanadex:terminal-focus';

/**
 * 从页面任意位置向终端下单：执行命令并聚焦输入框。
 * 只负责"把命令送进去"，不负责把终端窗口抬到前面——那是调用方的事，
 * 因为命令本身可能会把别的窗口顶上来（例如 open <id> 会聚焦项目窗口）。
 */
export function requestTerminalCommand(command: string): void {
  window.dispatchEvent(new CustomEvent<string>(COMMAND_EVENT, { detail: command }));
  window.setTimeout(() => window.dispatchEvent(new Event(FOCUS_EVENT)), 320);
}

export function focusTerminal(): void {
  window.dispatchEvent(new Event(FOCUS_EVENT));
}

export function onTerminalCommand(handler: (command: string) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (typeof detail === 'string') handler(detail);
  };
  window.addEventListener(COMMAND_EVENT, listener);
  return () => window.removeEventListener(COMMAND_EVENT, listener);
}

export function onTerminalFocus(handler: () => void): () => void {
  window.addEventListener(FOCUS_EVENT, handler);
  return () => window.removeEventListener(FOCUS_EVENT, handler);
}
