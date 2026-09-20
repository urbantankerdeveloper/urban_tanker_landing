import { Bell, ChevronDown, Droplets, Menu, Search, Settings2, ShieldCheck } from 'lucide-react';
import { UserBadge } from './ui';
import { useContent } from '../hooks/useContent';
import { loadNotifications, type NotificationItem } from '../lib/cloudStore';
import { useEffect, useState } from 'react';

function notificationAge(timestamp?: string | Date): string {
  if (!timestamp) return 'Just now';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

export function AppShell({ role, active, orderCount = 0, mobileNav, onNavigate, onToggleMobileNav, onNotify, onSignOut, children }) {
  const content = useContent();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const refreshNotifications = () => loadNotifications().then(result => { setNotificationCount(result.unreadCount); setNotifications([...result.notifications].sort((first, second) => new Date(second.timestamp || 0).getTime() - new Date(first.timestamp || 0).getTime())); }).catch(() => undefined);
  useEffect(() => {
    void refreshNotifications();
    const refreshTimer = window.setInterval(() => void refreshNotifications(), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [role]);
  const navItems = [['overview', content.operations.overview], ['book', content.operations.bookTanker], ['orders', content.operations.orders], ['track', content.operations.liveTracking], ...(role === 'vendor' ? [['fleet', 'Fleet']] : []), ...(role === 'admin' ? [['customers', 'Customers'], ['vendors', 'Vendors'], ['coupons', 'Coupons']] : []), ['support', content.operations.helpSupport]];
  return <div className={`app role-${role}`}>
    <header className="topbar">
      <button className="mobile-menu" onClick={onToggleMobileNav} aria-label={content.operations.openNavigation}><Menu size={20} /></button>
      <div className="brand"><span className="brand-mark"><Droplets size={18} /></span><span>{content.brand.name}</span></div>
      <div className="topbar-context"><span className="live-dot" /> {content.brand.city} <ChevronDown size={14} /></div>
      <div className="topbar-search"><Search size={16} /><input placeholder={content.operations.searchPlaceholder} /></div>
      <div className="topbar-actions"><div className="notification-menu"><button className="icon-button" type="button" aria-label={content.operations.notificationLabel} aria-expanded={notificationOpen} onClick={() => { setNotificationOpen(current => !current); void refreshNotifications(); }}><Bell size={18} />{notificationCount > 0 && <i>{notificationCount > 99 ? '99+' : notificationCount}</i>}</button>{notificationOpen && <section className="notification-toast-stack" role="dialog" aria-label="Notifications"><div className="notification-toast-head"><strong>Notifications</strong><button type="button" onClick={() => setNotificationOpen(false)} aria-label="Close notifications">×</button></div>{notifications.length ? <div className="notification-toast-list">{notifications.map(notification => <article className="notification-toast" key={`${notification.id}-${notification.status}`}><span className={`notification-dot notification-${notification.status.toLowerCase().replace(/\s+/g, '-')}`} /><div><b>{notification.title}</b><p>{notification.detail}</p><time>{notificationAge(notification.timestamp)}</time></div></article>)}</div> : <p className="notification-empty">No new notifications.</p>}</section>}</div><UserBadge onClick={onSignOut} /></div>
    </header>
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="sidebar-role"><span className="eyebrow">{content.operations.workspaceLabel}</span><strong>{role === 'customer' ? content.operations.customerView : role === 'vendor' ? content.operations.vendorPortal : content.operations.adminCommandCentre}</strong></div>
      <nav>{navItems.map(([id, label], index) => <button className={active === id ? 'active' : ''} key={id} onClick={() => onNavigate(id)}><span className="nav-symbol" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{label}</span>{id === 'orders' && orderCount > 0 && <b>{orderCount}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={16} /><span><b>{content.operations.trustedTitle}</b><small>{content.operations.trustedDescription}</small></span></div><button onClick={() => onNotify(`${content.operations.settings} panel is available in the operations workspace`)}><Settings2 size={17} /> {content.operations.settings}</button></div>
    </aside>
    <main className="main-content">{children}</main>
  </div>;
}
