import { Check, Loader, MapPin, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../../shared/components/ui';
import type { SavedAddress } from '../../shared/lib/types';

interface AddressDialogProps {
  address?: SavedAddress;
  onClose: () => void;
  onSave: (address: SavedAddress) => void;
}

export function AddressDialog({ address, onClose, onSave }: AddressDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    label: '',
    address: '',
    city: '',
    pincode: '',
    latitude: 0,
    longitude: 0,
  });

  const mapRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.label.trim()) newErrors.label = 'Label is required';
    if (!form.address.trim()) newErrors.address = 'Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.pincode.match(/^\d{6}$/)) newErrors.pincode = 'Valid 6-digit pincode required';
    if (!form.latitude || !form.longitude) newErrors.location = 'Please select location on map';
    return newErrors;
  };

  const handleMapClick = () => {
    // In a real implementation, this would open a map picker
    // For now, we'll use browser geolocation
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setForm(prev => ({ ...prev, latitude, longitude }));
          mapRef.current = { lat: latitude, lng: longitude };
          setLoading(false);
        },
        () => {
          setErrors(prev => ({ ...prev, location: 'Unable to get location' }));
          setLoading(false);
        }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newAddress: SavedAddress = {
      id: address?.id || Date.now().toString(),
      label: form.label,
      address: form.address,
      city: form.city,
      pincode: form.pincode,
      latitude: form.latitude,
      longitude: form.longitude,
      createdAt: address?.createdAt || new Date().toISOString(),
    };

    onSave(newAddress);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal address-dialog" role="dialog" aria-modal="true" aria-labelledby="address-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close address dialog">×</button>
        <span className="eyebrow">{address ? 'Edit address' : 'Add new address'}</span>
        <h2 id="address-title">{address ? 'Update your address' : 'Save delivery location'}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Address label *
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g., Home, Office, Site"
              aria-invalid={!!errors.label}
            />
            {errors.label && <small className="field-error">{errors.label}</small>}
          </label>

          <label>
            Full address *
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address, building, apartment"
              aria-invalid={!!errors.address}
            />
            {errors.address && <small className="field-error">{errors.address}</small>}
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label>
              City *
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Chennai"
                aria-invalid={!!errors.city}
              />
              {errors.city && <small className="field-error">{errors.city}</small>}
            </label>

            <label>
              Pincode *
              <input
                type="text"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                placeholder="600001"
                maxLength={6}
                aria-invalid={!!errors.pincode}
              />
              {errors.pincode && <small className="field-error">{errors.pincode}</small>}
            </label>
          </div>

          <label>
            Location coordinates *
            <button
              type="button"
              className="map-select-button"
              onClick={handleMapClick}
              disabled={loading}
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <MapPin size={16} />}
              {form.latitude && form.longitude
                ? `Selected: ${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}`
                : 'Click to select location'}
            </button>
            {errors.location && <small className="field-error">{errors.location}</small>}
          </label>

          <div className="heading-actions">
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" icon={Check}>
              {address ? 'Update address' : 'Save address'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
