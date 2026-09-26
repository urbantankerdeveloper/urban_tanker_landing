import { useEffect, useRef, useState } from 'react';
import { Loader, MapPin, X } from 'lucide-react';
import { Button } from '../../shared/components/ui';
import type { SavedAddress } from '../../shared/lib/types';

interface MapSelectorProps {
  initialLat: number;
  initialLng: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onCancel: () => void;
  title?: string;
}

interface MapLibrary {
  L?: any;
}

declare global {
  interface Window extends MapLibrary {}
}

export function MapSelector({ initialLat, initialLng, onLocationSelect, onCancel, title }: MapSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLat, setSelectedLat] = useState(initialLat);
  const [selectedLng, setSelectedLng] = useState(initialLng);
  const [coordsInput, setCoordsInput] = useState(`${initialLat.toFixed(4)}, ${initialLng.toFixed(4)}`);

  useEffect(() => {
    const initMap = async () => {
      try {
        // Load Leaflet CSS and JS if not already loaded
        if (!window.L) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
          document.head.appendChild(cssLink);

          const scriptPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Leaflet library'));
            document.body.appendChild(script);
          });
          await scriptPromise;
        }

        if (!mapContainerRef.current) return;

        // Initialize map
        const L = window.L;
        const map = L.map(mapContainerRef.current).setView([selectedLat, selectedLng], 16);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Add marker at initial position
        const marker = L.marker([selectedLat, selectedLng], { draggable: true })
          .addTo(map)
          .bindPopup('Drag to adjust location or click on map')
          .openPopup();

        mapRef.current = map;
        markerRef.current = marker;

        // Handle map click
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          setSelectedLat(lat);
          setSelectedLng(lng);
          setCoordsInput(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          marker.setLatLng([lat, lng]).openPopup();
        });

        // Handle marker drag
        marker.on('dragend', () => {
          const position = marker.getLatLng();
          setSelectedLat(position.lat);
          setSelectedLng(position.lng);
          setCoordsInput(`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);
        });

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load map');
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  const handleCoordsPaste = () => {
    try {
      const coords = coordsInput.split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && coords.every(c => !isNaN(c) && c >= -180 && c <= 180)) {
        const [lat, lng] = coords;
        setSelectedLat(lat);
        setSelectedLng(lng);
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]).openPopup();
        }
      } else {
        setError('Invalid coordinates format. Use: latitude, longitude');
      }
    } catch {
      setError('Invalid coordinates. Please check the format.');
    }
  };

  const handleConfirm = () => {
    onLocationSelect(selectedLat, selectedLng);
  };

  return (
    <div className="map-selector">
      <div className="map-header">
        <div>
          <h3>{title || 'Select Location'}</h3>
          <p>Click on map or drag marker to select delivery location</p>
        </div>
        <button className="close-btn" onClick={onCancel} aria-label="Close map">
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <span>⚠️</span>
          <p>{error}</p>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      <div className="map-container" ref={mapContainerRef} style={{ minHeight: '300px', position: 'relative' }}>
        {loading && (
          <div className="map-loading">
            <Loader size={32} className="spinner" />
            <p>Loading map...</p>
          </div>
        )}
      </div>

      <div className="coords-input-section">
        <label htmlFor="coords-input">
          <MapPin size={14} /> Coordinates
        </label>
        <div className="coords-input-group">
          <input
            id="coords-input"
            type="text"
            value={coordsInput}
            onChange={(e) => setCoordsInput(e.target.value)}
            placeholder="latitude, longitude"
            title="Enter coordinates as: latitude, longitude"
          />
          <button type="button" onClick={handleCoordsPaste} disabled={loading}>
            Update
          </button>
        </div>
        <small>
          Current: {selectedLat.toFixed(4)}, {selectedLng.toFixed(4)}
        </small>
      </div>

      <div className="map-actions">
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={loading}>
          Confirm Location
        </Button>
      </div>
    </div>
  );
}
