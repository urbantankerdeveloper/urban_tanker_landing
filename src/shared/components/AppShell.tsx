import { Bell, ChevronDown, Droplets, Menu, Search, Settings2, ShieldCheck } from 'lucide-react';
import { UserBadge } from './ui';
import { useContent } from '../hooks/useContent';

export function AppShell({ role, active, orderCount = 0, mobileNav, onRoleChange, onNavigate, onToggleMobileNav, onNotify, onSignOut, children }) {
  const content = useContent();
  const navItems = [['overview', content.operations.overview], ['book', content.operations.bookTanker], ['orders', content.operations.orders], ['track', content.operations.liveTracking], ['support', content.operations.helpSupport]];
  return <div className={`app role-${role}`}>
    <header className="topbar">
      <button className="mobile-menu" onClick={onToggleMobileNav} aria-label={content.operations.openNavigation}><Menu size={20} /></button>
      <div className="brand"><span className="brand-mark"><Droplets size={18} /></span><span>{content.brand.name}</span></div>
      <div className="topbar-context"><span className="live-dot" /> {content.brand.city} <ChevronDown size={14} /></div>
      <div className="topbar-search"><Search size={16} /><input placeholder={content.operations.searchPlaceholder} /></div>
      <div className="topbar-actions"><button className="icon-button" aria-label={content.operations.notificationLabel}><Bell size={18} /><i>3</i></button><UserBadge onClick={onSignOut} /></div>
    </header>
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="sidebar-role"><span className="eyebrow">{content.operations.workspaceLabel}</span><strong>{role === 'customer' ? content.operations.customerView : role === 'vendor' ? content.operations.vendorPortal : content.operations.adminCommandCentre}</strong></div>
      <nav>{navItems.map(([id, label]) => <button className={active === id ? 'active' : ''} key={id} onClick={() => onNavigate(id)}><span className="nav-symbol" aria-hidden="true">{id === 'overview' ? '01' : id === 'book' ? '02' : id === 'orders' ? '03' : id === 'track' ? '04' : '05'}</span><span>{label}</span>{id === 'orders' && orderCount > 0 && <b>{orderCount}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={16} /><span><b>{content.operations.trustedTitle}</b><small>{content.operations.trustedDescription}</small></span></div><button onClick={() => onNotify(`${content.operations.settings} panel is available in the operations workspace`)}><Settings2 size={17} /> {content.operations.settings}</button></div>
    </aside>
    <main className="main-content">{children}</main>
  </div>;
}
