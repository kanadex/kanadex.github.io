import { siteConfig } from '@/config/site.config';

export function ContactPane() {
  return (
    <div className="pane pane--contact">
      <a className="pane__mail hand" href={'mailto:' + siteConfig.contact.email}>
        {siteConfig.contact.email}
        <span aria-hidden="true"> →</span>
      </a>
      <ul className="pane__links">
        <li>
          <span>GitHub</span>
          <a href={siteConfig.contact.github} target="_blank" rel="noopener noreferrer">
            github.com/kanadex
          </a>
        </li>
      </ul>
      <p className="pane__foot">
        {siteConfig.footer.icp}　{siteConfig.footer.note}
      </p>
    </div>
  );
}
