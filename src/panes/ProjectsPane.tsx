import { projects } from '@/data/projects';
import { windowActions } from '@/desktop/windowStore';
import { requestTerminalCommand } from '@/lib/terminalBus';
import { openImage } from '@/image/openImage';

export function ProjectsPane() {
  return (
    <div className="pane pane--projects">
      {projects.map((project, index) => (
        <article className={'card card--' + project.accent} key={project.id}>
          <header className="card__head">
            <span className="card__index hand">0{index + 1}</span>
            <h3>{project.name}</h3>
            <span className={'stamp stamp--' + project.status}>{project.statusLabel}</span>
          </header>
          <p className="card__sub">{project.subtitle}</p>
          <p className="card__summary">{project.summary}</p>
          <ul className="card__points">
            {project.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <ul className="card__tags">
            {project.tags.map((tag) => (
              <li className="chip chip--quiet" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
          {project.media.length > 0 ? (
            <div className="card__media">
              {project.media.map((item) => (
                <figure key={item.src}>
                  <button
                    type="button"
                    className="card__shot"
                    onClick={() => openImage(item.src, item.alt)}
                    aria-label={'打开图片 ' + item.alt}
                    title={'打开图片 ' + item.alt}
                  >
                    <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />
                  </button>
                  <figcaption>{item.caption}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <footer className="card__actions">
            <button type="button" className="btn btn--sm" onClick={() => {
              // 顺序很重要：命令 open <id> 内部会 navigate('projects')，把项目窗口提到最前；
              // 所以必须等命令跑完，再把终端抬起来，否则终端刚打开就被项目窗口盖住。
              requestTerminalCommand('open ' + project.id);
              windowActions.open('terminal');
            }}>
              {'open ' + project.id}
            </button>
            {project.links.map((link) => (
              <a className="link" key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <span className="link__arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </footer>
        </article>
      ))}
    </div>
  );
}
