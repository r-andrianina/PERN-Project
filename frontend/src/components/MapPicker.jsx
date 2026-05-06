import { useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function MapPicker({ latitude, longitude, onChange, height = '300px' }) {
  const mapRef      = useRef(null);
  const instanceRef = useRef(null);
  const markerRef   = useRef(null);

  const defaultLat = latitude  || -18.9137;
  const defaultLng = longitude || 47.5361;

  useEffect(() => {
    if (instanceRef.current) return;

    const map = L.map(mapRef.current).setView([defaultLat, defaultLng], 6);
    instanceRef.current = map;

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri', maxZoom: 18 }
    ).addTo(map);

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OSM', opacity: 0.4, maxZoom: 18 }
    ).addTo(map);

    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude]).addTo(map);
    }

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }
      onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    });

    return () => { map.remove(); instanceRef.current = null; };
  }, []);

  useEffect(() => {
    if (!instanceRef.current || !latitude || !longitude) return;
    const latlng = [parseFloat(latitude), parseFloat(longitude)];
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng).addTo(instanceRef.current);
    }
    instanceRef.current.setView(latlng, 12);
  }, [latitude, longitude]);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-card">
      <div ref={mapRef} style={{ height }} />
      {latitude && longitude ? (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <MapPin size={13} className="text-primary-500 flex-shrink-0" />
          <span className="text-xs font-mono text-gray-600 flex-1">
            {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
          </span>
          <button
            type="button"
            onClick={() => onChange({ latitude: '', longitude: '' })}
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={12} /> Effacer
          </button>
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <MapPin size={12} className="text-gray-400" />
            Cliquez sur la carte pour placer un point GPS
          </p>
        </div>
      )}
    </div>
  );
}
