import { Bell, CalendarCheck, ChevronDown, ClipboardList, Droplets, Headphones, LayoutDashboard, MapPin, Menu, PanelLeft, PanelLeftClose, Percent, Search, Settings2, ShieldCheck, Store, Truck, Users, WalletCards, Wrench, type LucideIcon } from 'lucide-react';
import { UserBadge } from './ui';
import { useContent } from '../hooks/useContent';
import { loadNotifications, markNotificationsRead, type NotificationItem } from '../lib/cloudStore';
import type { Workspace } from '../lib/types';
import { useAppStore } from '../../app/store';
import { useEffect, useRef, useState } from 'react';

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
  const { data, sidebarCollapsed, searchQuery, searchOpen, online, notificationOpen, notificationCount, setSidebarCollapsed, setSearchQuery, setSearchOpen, setOnline, setNotificationOpen, setNotificationCount } = useAppStore(state => ({ data: state.data, sidebarCollapsed: state.sidebarCollapsed, searchQuery: state.searchQuery, searchOpen: state.searchOpen, online: state.online, notificationOpen: state.notificationOpen, notificationCount: state.notificationCount, setSidebarCollapsed: state.setSidebarCollapsed, setSearchQuery: state.setSearchQuery, setSearchOpen: state.setSearchOpen, setOnline: state.setOnline, setNotificationOpen: state.setNotificationOpen, setNotificationCount: state.setNotificationCount }));
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationTimer = useRef<number | undefined>(undefined);
  const refreshNotifications = () => loadNotifications().then(result => { setNotificationCount(result.unreadCount); setNotifications([...result.notifications].sort((first, second) => new Date(second.timestamp || 0).getTime() - new Date(first.timestamp || 0).getTime())); }).catch(() => undefined);
  const closeNotifications = () => {
    if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
    notificationTimer.current = undefined;
    setNotificationOpen(false);
  };
  const openNotifications = () => {
    if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
    setNotificationOpen(true);
    void loadNotifications().then(result => {
      setNotifications([...result.notifications].sort((first, second) => new Date(second.timestamp || 0).getTime() - new Date(first.timestamp || 0).getTime()));
      setNotificationCount(0);
      void markNotificationsRead(result.notifications.filter(notification => !notification.read).map(notification => notification.id));
    }).catch(() => undefined);
    notificationTimer.current = window.setTimeout(closeNotifications, 15_000);
  };
  useEffect(() => {
    void refreshNotifications();
    const refreshTimer = window.setInterval(() => void refreshNotifications(), 30_000);
    return () => {
      window.clearInterval(refreshTimer);
      if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
    };
  }, [role]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        document.getElementById('global-search')?.focus();
      }
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch ? [
    ...data.orders.filter(order => `${order.id} ${order.customer} ${order.address} ${order.service}`.toLowerCase().includes(normalizedSearch)).slice(0, 6).map(order => ({ id: order.id, label: order.id, detail: `${order.service} · ${order.customer}`, workspace: order.status === 'Delivered' ? 'orders' : 'track' as Workspace })),
    ...data.vendors.filter(vendor => `${vendor.name} ${vendor.email} ${vendor.zone}`.toLowerCase().includes(normalizedSearch)).slice(0, 4).map(vendor => ({ id: vendor.uid || vendor.email || vendor.name, label: vendor.name, detail: `${vendor.zone || 'Vendor'} · ${vendor.status}`, workspace: 'vendors' as Workspace })),
  ] : [];
  const navItems = [["overview", content.operations.overview, LayoutDashboard], ["book", content.operations.bookTanker, Truck], ["orders", content.operations.orders, ClipboardList], ["track", content.operations.liveTracking, MapPin], ...(role === 'customer' ? [["subscriptions", 'Subscriptions', CalendarCheck], ["invoices", 'Invoices & payments', WalletCards]] : []), ...(role === 'vendor' ? [["fleet", 'Fleet', Truck], ["maintenance", 'Maintenance', Wrench], ["attendance", 'Attendance', CalendarCheck], ["payouts", 'Payouts', WalletCards]] : []), ...(role === 'admin' ? [["dispatch", 'Dispatch board', ClipboardList], ["customers", 'Customers', Users], ["vendors", 'Vendors', Store], ["coupons", 'Coupons', Percent]] : []), ["support", content.operations.helpSupport, Headphones]] as Array<[Workspace, string, LucideIcon]>;
  return <div className={`app role-${role} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="topbar">
      <button className="mobile-menu" onClick={onToggleMobileNav} aria-label={content.operations.openNavigation}><Menu size={20} /></button>
      <div className="brand"><span className="brand-mark"><Droplets size={18} /></span><span>{content.brand.name}</span></div>
      <div className="topbar-context"><span className="live-dot" /> {content.brand.city} <ChevronDown size={14} /></div>
      <div className="topbar-search-wrap"><label className="topbar-search" htmlFor="global-search"><Search size={16} /><input id="global-search" value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={event => { setSearchQuery(event.target.value); setSearchOpen(true); }} placeholder={content.operations.searchPlaceholder} /><kbd>Ctrl K</kbd></label>{searchOpen && normalizedSearch && <div className="global-search-results" role="listbox">{searchResults.length ? searchResults.map(result => <button type="button" key={`${result.workspace}-${result.id}`} onClick={() => { onNavigate(result.workspace); setSearchQuery(''); setSearchOpen(false); }}><b>{result.label}</b><small>{result.detail}</small></button>) : <p>No matching records.</p>}</div>}</div>
      <div className="topbar-actions"><div className="notification-menu"><button className="icon-button" type="button" aria-label={content.operations.notificationLabel} aria-expanded={notificationOpen} onClick={openNotifications}><Bell size={18} />{notificationCount > 0 && <i>{notificationCount > 99 ? '99+' : notificationCount}</i>}</button>{notificationOpen && <div className="notification-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && closeNotifications()}><section className="notification-dialog" role="dialog" aria-modal="true" aria-label="Notifications"><span className="notification-dialog-timer" /><div className="notification-dialog-header"><strong>Notifications</strong><button type="button" onClick={closeNotifications} aria-label="Close notifications">×</button></div>{notifications.length ? <div className="notification-dialog-list">{notifications.map(notification => <article className="notification-dialog-item" key={`${notification.id}-${notification.status}`}><span className={`notification-dot notification-${notification.status.toLowerCase().replace(/\s+/g, '-')}`} /><div><b>{notification.title}</b><p>{notification.detail}</p><time>{notificationAge(notification.timestamp)}</time></div></article>)}</div> : <p className="notification-empty">No new notifications.</p>}<button className="notification-dialog-ok" type="button" onClick={closeNotifications}>OK</button></section></div>}</div><UserBadge onClick={onSignOut} /></div>
    </header>
    {!online && <div className="offline-banner" role="status">You are offline. Changes will sync when the connection returns.</div>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-pressed={sidebarCollapsed} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}</button>
      <div className="sidebar-role"><span className="eyebrow">{content.operations.workspaceLabel}</span><strong>{role === 'customer' ? content.operations.customerView : role === 'vendor' ? content.operations.vendorPortal : content.operations.adminCommandCentre}</strong></div>
      <nav>{navItems.map(([id, label, Icon]) => <button className={active === id ? 'active' : ''} key={id} onClick={() => onNavigate(id)}><Icon className="nav-icon" size={17} aria-hidden="true" /><span>{label}</span>{id === 'orders' && orderCount > 0 && <b>{orderCount}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={16} /><span><b>{content.operations.trustedTitle}</b><small>{content.operations.trustedDescription}</small></span></div><button onClick={() => onNotify(`${content.operations.settings} panel is available in the operations workspace`)}><Settings2 size={17} /> {content.operations.settings}</button></div>
    </aside>
    <main className="main-content">{children}</main>
  </div>;
}
