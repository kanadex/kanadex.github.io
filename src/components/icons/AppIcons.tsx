/**
 * 应用图标：**白色线稿**，全站只有一种颜色。
 *
 * 规则：只用 --icon-ink（纯白）描边，不填充、不用第二种色相、不用滤镜。
 * 参考站连一颗灰都不给别的颜色，图标自然也不该是绿黄蓝紫的塑料块。
 * 一套 SVG 同时用于桌面（72px）与 dock chip（19px）。
 */
export type AppIconName = 'terminal' | 'about' | 'projects' | 'notes' | 'contact' | 'github' | 'image';

const ink = {
  fill: 'none',
  stroke: 'var(--icon-ink)',
  strokeWidth: 3.4,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

interface AppIconProps {
  name: AppIconName;
  className?: string;
}

function Terminal() {
  return (
    <>
      <rect x="5.5" y="9" width="37" height="30" rx="3.6" {...ink} />
      <path d="M5.5 15.6h37" {...ink} strokeWidth="2.6" />
      <path d="M12.4 23.2l4.8 4.4-4.8 4.6" {...ink} strokeWidth="3.2" />
      <path d="M22.6 32.2h9" {...ink} strokeWidth="3.2" />
    </>
  );
}

function About() {
  return (
    <>
      <circle cx="24" cy="17.4" r="6.4" {...ink} />
      <path d="M11.4 40.4c1.4-7.2 6.4-11 12.6-11s11.2 3.8 12.6 11" {...ink} />
    </>
  );
}

function Projects() {
  return (
    <>
      <path d="M6.6 15.4h12.2l3.6 4.2h18.8v19.2H6.6z" {...ink} />
      <path d="M6.6 15.4V11h11.2l3.4 4.4" {...ink} strokeWidth="2.8" />
      <path d="M14 27.4h18" {...ink} strokeWidth="2.8" />
      <path d="M14 32.4h11.4" {...ink} strokeWidth="2.8" />
    </>
  );
}

function Notes() {
  return (
    <>
      <circle cx="24" cy="24" r="15.6" {...ink} />
      <circle cx="24" cy="24" r="5.4" {...ink} strokeWidth="2.8" />
      <circle cx="24" cy="24" r="1.5" fill="var(--icon-ink)" stroke="none" />
      <path d="M12.2 17.6a14.8 14.8 0 0 1 5.8-4.4" {...ink} strokeWidth="2.4" opacity="0.7" />
    </>
  );
}

function Contact() {
  return (
    <>
      <path d="M7.4 13.6h33.2v21.2H7.4z" {...ink} />
      <path d="M8.6 15l15.4 12.2L39.4 15" {...ink} strokeWidth="2.9" />
    </>
  );
}

function Github() {
  return (
    <>
      <path d="M17 18v12.6" {...ink} />
      <path d="M17 22.4c8.6 1.2 13.2-1.4 14.6-6.6" {...ink} />
      <circle cx="16.6" cy="13.4" r="4.4" {...ink} strokeWidth="2.9" />
      <circle cx="17" cy="35" r="4.4" {...ink} strokeWidth="2.9" />
      <circle cx="31.8" cy="12.6" r="4.4" {...ink} strokeWidth="2.9" />
    </>
  );
}

function Image() {
  return (
    <>
      <rect x="6.4" y="10.4" width="35.2" height="27.2" rx="3.4" {...ink} />
      <circle cx="17.2" cy="19.6" r="3.2" {...ink} strokeWidth="2.8" />
      <path d="M8.6 34.4l10.4-9.2 7.6 6.6 5.4-4.6 8 7.2" {...ink} strokeWidth="2.8" />
    </>
  );
}

const shapes: Record<AppIconName, () => JSX.Element> = {
  terminal: Terminal,
  about: About,
  projects: Projects,
  notes: Notes,
  contact: Contact,
  github: Github,
  image: Image,
};

export function AppIcon({ name, className }: AppIconProps) {
  const Shape = shapes[name];
  return (
    <svg
      viewBox="0 0 48 48"
      className={'app-icon' + (className ? ' ' + className : '')}
      aria-hidden="true"
      focusable="false"
    >
      <Shape />
    </svg>
  );
}
