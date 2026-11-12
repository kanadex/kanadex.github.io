import { siteConfig } from '@/config/site.config';
import { stackGroups } from '@/data/stack';
import { systemFields } from '@/app/systemInfo';
import { commands } from '@/terminal/commands';

/**
 * 关于：不写"我在打磨什么"，按 neofetch 的字段给系统信息。
 * 字段与终端 neofetch 共用 systemFields()，版本号只有一份。
 */
export function AboutPane() {
  const fields = systemFields(commands.length);

  return (
    <div className="pane pane--about">
      <div className="pane__portrait">
        <img src="/media/avatar.jpg" alt="Kanadex 的头像" loading="lazy" decoding="async" />
        <span className="pane__portrait-tag hand">kanadex</span>
      </div>

      <div className="pane__text">
        <p className="pane__host">
          {siteConfig.terminal.user}@{siteConfig.terminal.host}
        </p>

        <dl className="pane__sys">
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="pane__stack">
          {stackGroups.map((group) => (
            <section key={group.title}>
              <h4>{group.title}</h4>
              <ul>
                {group.items.map((item) => (
                  <li className="chip chip--quiet" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="pane__foot">
          GitHub <a href={siteConfig.contact.github} target="_blank" rel="noopener noreferrer">github.com/kanadex</a>
        </p>
      </div>
    </div>
  );
}
