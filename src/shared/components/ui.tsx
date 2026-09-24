import { useState, type ComponentType, type ReactNode } from 'react';

interface PageHeaderProps { eyebrow: string; title: ReactNode; copy: string; action?: ReactNode; }
interface StatCardProps { icon: ComponentType<{ size?: number }>; label: string; value: ReactNode; detail: string; tone?: string; }
interface ButtonProps { children: ReactNode; variant?: string; onClick?: () => void; icon?: ComponentType<{ size?: number }>; type?: 'button' | 'submit' | 'reset'; disabled?: boolean; }

export function PageHeader({ eyebrow, title, copy, action }: PageHeaderProps) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{action}</div>;
}

export function StatCard({ icon: Icon, label, value, detail, tone = '' }: StatCardProps) {
  return <article className={`stat-card ${tone}`}><div className="stat-icon"><Icon size={17} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function Status({ children }: { children: ReactNode }) {
  const rawLabel = String(children);
  const label = rawLabel === 'Vendor assigned' ? 'Assigned' : rawLabel;
  const tone = rawLabel.toLowerCase().replace(/ /g, '-');
  return <span className={`status status-${tone}`}><span />{label}</span>;
}

export function Button({ children, variant = '', onClick, icon: Icon, type = 'button', disabled = false }: ButtonProps) {
  return <button type={type} onClick={onClick} className={`button ${variant}`} disabled={disabled}>{Icon && <Icon size={16} />}{children}</button>;
}

export function UserBadge({ initials = 'AM', onClick }: { initials?: string; onClick?: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="user-menu"><button className="avatar" type="button" onClick={() => setOpen(current => !current)} aria-label="Open account menu" aria-expanded={open}>{initials}</button>{open && <div className="user-menu-popover" role="menu"><button type="button" role="menuitem" onClick={() => { setOpen(false); onClick?.(); }}>Sign out</button></div>}</div>;
}
