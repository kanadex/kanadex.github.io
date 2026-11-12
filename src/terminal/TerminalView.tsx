import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { onTerminalCommand, onTerminalFocus } from '@/lib/terminalBus';
import { Prompt } from '@/terminal/Prompt';
import { useTerminalSession } from '@/terminal/useTerminalSession';

const quick = ['help', 'projects', 'whoami', 'neofetch', 'ls'];

/** 纯渲染：没有业务判断，命令执行全部在 useTerminalSession 里。 */
export function TerminalView() {
  const [value, setValue] = useState('');
  const session = useTerminalSession();
  const cursor = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });

  useEffect(() => {
    const node = streamRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [session.lines]);

  useEffect(() => onTerminalFocus(focusInput), []);
  useEffect(
    () =>
      onTerminalCommand((command) => {
        session.submit(command);
        focusInput();
      }),
    [session]
  );

  // 横幅打完、输入行出现之后才聚焦，否则会聚焦到一个还不存在的元素上
  useEffect(() => {
    if (session.booting) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (fine && window.innerWidth >= 960) focusInput();
  }, [session.booting]);

  const run = (raw: string) => {
    setValue('');
    cursor.current = -1;
    session.submit(raw);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run(value);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (session.history.length === 0) return;
      cursor.current = cursor.current < 0 ? session.history.length - 1 : Math.max(0, cursor.current - 1);
      setValue(session.history[cursor.current] ?? '');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (cursor.current < 0) return;
      const next = cursor.current + 1;
      if (next >= session.history.length) {
        cursor.current = -1;
        setValue('');
        return;
      }
      cursor.current = next;
      setValue(session.history[next] ?? '');
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const matches = session.complete(value);
      if (matches.length === 1) {
        const only = matches[0] ?? '';
        setValue(only.endsWith('/') ? only : only + ' ');
      }
      return;
    }
    if (event.key === 'l' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      session.clear();
    }
  };

  return (
    <div className="term" onClick={focusInput}>
      <div className="term__stream" ref={streamRef} role="log" aria-live="polite" aria-label="终端输出">
        {session.lines.map((line) => {
          if (line.kind === 'echo') {
            return (
              <p className="term__line term__line--echo" key={line.id}>
                <Prompt user={session.user} host={session.host} where={line.where ?? ''} sign={session.promptSign} />{' '}
                <span className="term__cmd">{line.text}</span>
              </p>
            );
          }
          if (line.spans) {
            return (
              <p className={'term__line term__line--' + line.kind} key={line.id}>
                {line.spans.map((span, index) => (
                  <span key={index} className={span.tone ? 'term__span term__span--' + span.tone : 'term__span'}>
                    {span.text}
                  </span>
                ))}
              </p>
            );
          }
          return (
            <p className={'term__line term__line--' + line.kind} key={line.id}>
              {line.text || '\u00a0'}
            </p>
          );
        })}

        {session.booting ? null : (
        <p className="term__line term__line--prompt">
          <Prompt user={session.user} host={session.host} where={session.cwd} sign={session.promptSign} />
          <input
            ref={inputRef}
            id="terminal-input"
            className="term__input"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="终端命令输入"
          />
        </p>
        )}
      </div>

      <div className="term__quick" aria-label="常用命令">
        {quick.map((item) => (
          <button key={item} type="button" className="term__quick-item" onClick={() => run(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
