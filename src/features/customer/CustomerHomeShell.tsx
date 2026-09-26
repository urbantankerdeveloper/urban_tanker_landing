import { Crosshair, Droplets, MapPin, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppStore } from '../../app/store';
import { useContent } from '../../shared/hooks/useContent';
import type { Workspace } from '../../shared/lib/types';

interface CustomerHomeShellProps { children: ReactNode; onNavigate: (workspace: Workspace) => void; onSignOut: () => void; }

export function CustomerHomeShell({ children, onNavigate, onSignOut }: CustomerHomeShellProps) {
  const content = useContent();
  return <div className="customer-site">
    <a className="skip-link" href="#customer-content">Skip to booking content</a>
    <header className="customer-header">
      <button className="customer-brand" type="button" onClick={() => onNavigate('overview')} aria-label={`${content.brand.name} home`}><span className="brand-mark"><Droplets size={17} /></span><strong>{content.brand.name}</strong></button>
      <nav aria-label="Customer navigation"><button type="button" onClick={() => onNavigate('offers')}>{content.customer.nav.offers}</button><button type="button" onClick={() => onNavigate('track')}>{content.customer.nav.track}</button><button type="button" onClick={() => onNavigate('addresses')}>Saved addresses</button><button type="button" onClick={() => onNavigate('support')}>{content.customer.nav.support}</button></nav>
      <button className="customer-sign-in" type="button" onClick={onSignOut}><UserRound size={15} /> {content.operations.signOut}</button>
    </header>
    <main id="customer-content">{children}</main>
    <footer className="customer-footer"><strong><span className="brand-mark"><Droplets size={14} /></span> {content.brand.name}</strong><p>{content.brand.tagline}</p><div><button type="button" onClick={() => onNavigate('track')}>{content.customer.nav.track}</button><button type="button" onClick={() => onNavigate('addresses')}>Saved addresses</button><button type="button" onClick={() => onNavigate('support')}>{content.customer.nav.support}</button></div></footer>
    <nav className="customer-bottom-nav" aria-label={content.operations.customerView}><button type="button" onClick={() => onNavigate('overview')}>{content.customer.nav.home}</button><button type="button" onClick={() => onNavigate('book')}>{content.customer.nav.book}</button><button type="button" onClick={() => onNavigate('orders')}>{content.customer.nav.orders}</button><button type="button" onClick={() => onNavigate('track')}>{content.customer.nav.track}</button></nav>
  </div>;
}

export function DeliveryLocation() {
  const data = useAppStore(state => state.data);
  const requestLocation = useAppStore(state => state.requestLocation);
  const content = useContent();
  return <div className="location-control"><button className="location-chip" type="button" onClick={() => void requestLocation()} aria-label={content.operations.useCurrentLocation}><MapPin size={13} /><span>{content.operations.locationLabel}</span> {data.location.address} <span aria-hidden="true">⌄</span></button><button className="location-refresh" type="button" onClick={() => void requestLocation()} aria-label={content.operations.refreshLocation} title={content.operations.useCurrentLocation}><Crosshair size={14} /></button></div>;
}
