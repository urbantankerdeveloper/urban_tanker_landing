import { useState } from 'react';
import { ArrowLeft, MapPin, Loader } from 'lucide-react';
import { Button } from '../../shared/components/ui';
import { updateSavedAddress } from '../../shared/lib/cloudStore';
import type { SavedAddress } from '../../shared/lib/types';

interface AddressVerificationModalProps {
  address: SavedAddress | null;
  onClose: () => void;
  onLocationCaptured: (address: SavedAddress) => void;
  onContinueWithoutLocation: () => void;
}

export function AddressVerificationModal({ address, onClose, onLocationCaptured, onContinueWithoutLocation }: AddressVerificationModalProps) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [step, setStep] = useState<'options' | 'map'>('options');

  const captureCurrentLocation = async () => {
    setGeoLoading(true);
    setGeoError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 0
        });
      });

      if (address) {
        const updatedAddress: SavedAddress = {
          ...address,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        try {
          // Try to update backend first
          await updateSavedAddress(address.id, {
            latitude: updatedAddress.latitude,
            longitude: updatedAddress.longitude
          });
        } catch (backendError) {
          console.warn('Backend update failed, using local storage fallback:', backendError);
          // Fallback to localStorage if backend fails
          const savedAddresses = JSON.parse(localStorage.getItem('urban-tanker-saved-addresses') || '[]') as SavedAddress[];
          const updatedAddresses = savedAddresses.map(a => a.id === address.id ? updatedAddress : a);
          localStorage.setItem('urban-tanker-saved-addresses', JSON.stringify(updatedAddresses));
        }
        
        onLocationCaptured(updatedAddress);
      }
    } catch (error) {
      const message = error instanceof GeolocationPositionError
        ? error.code === 1 ? 'Location access denied. Please enable location in your browser settings.'
          : error.code === 2 ? 'Unable to determine your location. Please try again.'
          : error.code === 3 ? 'Location request timed out. Please try again.'
          : error.message
        : 'Unable to capture your location.';
      setGeoError(message);
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="modal address-verification-modal" role="dialog" aria-modal="true" aria-labelledby="verification-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close verification modal">×</button>
        
        {step === 'options' && <>
          <span className="eyebrow">Location Required</span>
          <h2 id="verification-title">Confirm delivery location</h2>
          <p className="modal-copy">We need your exact location to ensure accurate delivery and calculate precise ETAs.</p>
          
          <div className="verification-options">
            <div className="address-summary">
              <MapPin size={18} />
              <div>
                <strong>{address?.label}</strong>
                <small>{address?.address}</small>
                <small>{address?.city} · {address?.pincode}</small>
              </div>
            </div>

            <div className="location-options">
              <Button 
                variant="primary" 
                icon={MapPin}
                onClick={captureCurrentLocation}
                disabled={geoLoading}
              >
                {geoLoading ? <><Loader size={16} className="spinner" /> Getting location...</> : 'Use current location'}
              </Button>

              <Button 
                variant="quiet"
                onClick={() => setStep('map')}
              >
                Select on map
              </Button>

              <Button 
                variant="outline"
                onClick={onContinueWithoutLocation}
              >
                Continue without location
              </Button>
            </div>

            {geoError && (
              <div className="error-message" role="alert">
                <span>⚠️</span>
                <p>{geoError}</p>
              </div>
            )}

            {address?.latitude && address?.longitude && !geoLoading && (
              <div className="success-message">
                <span>✓</span>
                <p>Location confirmed: {address.latitude.toFixed(4)}, {address.longitude.toFixed(4)}</p>
              </div>
            )}

            <small className="verification-notice">
              Your location will be used for delivery optimization only and will not be shared with third parties.
            </small>
          </div>
        </>}

        {step === 'map' && <>
          <button 
            className="back-button" 
            type="button" 
            onClick={() => setStep('options')}
            aria-label="Back to options"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className="eyebrow">Map Selection</span>
          <h2>Select your delivery location</h2>
          <p className="modal-copy">Click on the map to set your exact delivery coordinates.</p>
          
          <div className="map-container-placeholder">
            <div className="map-loading">
              <Loader size={32} className="spinner" />
              <p>Map service loading...</p>
              <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--muted)' }}>
                Interactive map feature coming soon. Use "Get current location" for now.
              </p>
            </div>
          </div>

          <div className="map-actions">
            <Button 
              variant="quiet"
              onClick={() => setStep('options')}
            >
              Back to options
            </Button>
          </div>
        </>}
      </section>
    </div>
  );
}
