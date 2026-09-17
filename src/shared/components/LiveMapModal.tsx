import { MapPin, X } from 'lucide-react';
import type { Order } from '../lib/types';
import { Button } from './ui';

export function LiveMapModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasRoute = typeof order.vendorLatitude === 'number' && typeof order.vendorLongitude === 'number' && typeof order.deliveryLatitude === 'number' && typeof order.deliveryLongitude === 'number';
  const origin = hasRoute ? `${order.vendorLatitude},${order.vendorLongitude}` : '';
  const destination = hasRoute ? `${order.deliveryLatitude},${order.deliveryLongitude}` : '';
  const mapUrl = mapsKey && hasRoute
    ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(mapsKey)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving`
    : '';

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal live-map-dialog" role="dialog" aria-modal="true" aria-labelledby="live-map-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close live map"><X size={18} /></button>
      <span className="eyebrow">Live delivery tracking</span>
      <h2 id="live-map-title">Vendor route to your location</h2>
      {mapUrl ? <iframe title="Live vendor route" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="live-map-empty"><MapPin size={28} /><h3>Location is not available yet</h3><p>The vendor must share a current location before the route can be displayed.</p>{hasRoute && !mapsKey && <small>Configure VITE_GOOGLE_MAPS_API_KEY to enable Google Maps.</small>}</div>}
      <Button variant="quiet" type="button" onClick={onClose}>Close map</Button>
    </section>
  </div>;
}
