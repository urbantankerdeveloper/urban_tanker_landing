import { Activity, ArrowRight, Droplets, RefreshCcw, ShieldCheck, Truck } from 'lucide-react';
import type { AppData, BookingDraft, Order, Workspace } from '../../shared/lib/types';
import { Button, Status } from '../../shared/components/ui';
import { DeliveryLocation } from './CustomerHomeShell';
import { useContent } from '../../shared/hooks/useContent';

interface CustomerLandingProps { data: AppData; order?: Order; onNavigate: (workspace: Workspace) => void; onSelectService?: (service: BookingDraft['service']) => void; }

export function CustomerLanding({ data, order, onNavigate, onSelectService }: CustomerLandingProps) {
  const content = useContent();
  const { hero, actions, booking, how, essentials } = content.customer;
  return <>
    <section className="customer-hero" aria-labelledby="customer-hero-title">
      <div className="customer-hero-copy"><DeliveryLocation /><span className="eyebrow">{hero.eyebrow}</span><h1 id="customer-hero-title">{hero.title}</h1><p>{hero.description}</p><div className="trust-row"><span><b>Verified</b> vendors</span><span><b>{hero.eta}</b></span><span><b>Secure</b> delivery OTP</span></div></div>
      <div className="customer-hero-art" aria-hidden="true"><div className="hero-sun" /><div className="hero-cloud cloud-a" /><div className="hero-cloud cloud-b" /><div className="hero-tank"><i /><i /><i /></div><div className="hero-ground" /><div className="hero-promise"><small>URBAN TANKER PROMISE</small><strong>{hero.promise}</strong><span /></div></div>
    </section>
    <section className="customer-actions" aria-label="Book a service"><button type="button" onClick={() => onSelectService ? onSelectService('Water tanker') : onNavigate('book')}><span className="service-icon water"><Droplets size={22} /></span><span><b>{actions.water}</b><small>{actions.waterMeta}</small></span><ArrowRight size={18} /></button><button type="button" onClick={() => onSelectService ? onSelectService('Sewage pickup') : onNavigate('book')}><span className="service-icon sewage"><Activity size={22} /></span><span><b>{actions.sewage}</b><small>{actions.sewageMeta}</small></span><ArrowRight size={18} /></button><button className="repeat-action" type="button" onClick={() => onNavigate('book')}><span className="service-icon repeat"><RefreshCcw size={20} /></span><span><small>{actions.repeatMeta}</small><b>{actions.repeat} <em>₹2,400</em></b></span><ArrowRight size={18} /></button></section>
    <section className="customer-booking-intro"><span className="eyebrow">{booking.eyebrow}</span><h2>{booking.title}</h2><p>{booking.description}</p><Button variant="primary" onClick={() => onNavigate('book')}>{booking.cta} <ArrowRight size={16} /></Button></section>
    {order && <section className="customer-live-preview"><div><span className="eyebrow">Your active delivery</span><h2>{order.service} is {order.status.toLowerCase()}.</h2><p>{data.location.address} · ETA {order.eta}</p><Status>{order.status}</Status></div><button type="button" onClick={() => onNavigate('track')}>View live tracking <ArrowRight size={16} /></button></section>}
    <section className="customer-how"><span className="eyebrow">{how.eyebrow}</span><h2>{how.title}</h2><ol>{how.steps.map(step => <li key={step.number}><b>{step.number}</b><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol></section>
    <section className="customer-essentials"><span className="eyebrow">{essentials.eyebrow}</span><h2>{essentials.title}</h2><div><button type="button" onClick={() => onNavigate('book')}><ShieldCheck size={16} /><span><b>{essentials.addresses}</b><small>Home, office, apartment or site</small></span><ArrowRight size={15} /></button><button type="button" onClick={() => onNavigate('orders')}><Truck size={16} /><span><b>{essentials.orders}</b><small>Active, upcoming and completed</small></span><ArrowRight size={15} /></button><button type="button" onClick={() => onNavigate('support')}><Activity size={16} /><span><b>{essentials.support}</b><small>Message support@urbantanker.com</small></span><ArrowRight size={15} /></button></div></section>
  </>;
}
