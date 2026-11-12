/**
 * 提示符：分段上色，和真终端一致。
 *   kanadex@web  → 绿色（用户名与主机名）
 *   @ :          → 白色
 *   ~/projects   → 蓝色（路径）
 *   %            → 白色
 * 路径来自每一行自己记录的 where，所以历史回显里每条命令的提示符都是当时的样子。
 */
interface PromptProps {
  user: string;
  host: string;
  where: string;
  sign: string;
}

export function Prompt({ user, host, where, sign }: PromptProps) {
  return (
    <span className="term__prompt">
      <span className="term__prompt-user">{user}</span>
      <span className="term__prompt-mark">@</span>
      <span className="term__prompt-host">{host}</span>
      <span className="term__prompt-mark">:</span>
      <span className="term__prompt-path">{where ? '~/' + where : '~'}</span>
      <span className="term__prompt-mark">{sign}</span>
    </span>
  );
}
