import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, X, Search, Layers, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Icône personnalisée — cercle primaire avec halo
const createCustomIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width:22px; height:22px;
        background:#1D9E75; border:3px solid white;
        border-radius:50%; box-shadow:0 0 0 3px rgba(29,158,117,0.35), 0 2px 8px rgba(0,0,0,0.4);
        position:relative;
      "></div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

// Couches disponibles
const LAYERS = {
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar',
    maxZoom: 19,
  },
  osm: {
    label: 'Carte',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
};

// Labels OSM par-dessus le satellite (routes + toponymie)
const LABELS_URL = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

export default function MapPicker({ latitude, longitude, onChange, height = '340px' }) {
  const mapRef      = useRef(null);
  const instanceRef = useRef(null);
  const markerRef   = useRef(null);
  const tileRef     = useRef(null);
  const labelsRef   = useRef(null);

  const [activeLayer, setActiveLayer] = useState('satellite');
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  const defaultLat = latitude  || -18.9137;
  const defaultLng = longitude || 47.5361;

  // ── Initialisation carte ──────────────────────────────────────
  useEffect(() => {
    if (instanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([defaultLat, defaultLng], 6);
    instanceRef.current = map;

    // Contrôle zoom en bas à droite
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Couche de base
    const cfg = LAYERS.satellite;
    tileRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map);
    labelsRef.current = L.tileLayer(LABELS_URL, { attribution: '', maxZoom: cfg.maxZoom, opacity: 0.8 }).addTo(map);

    // Marker initial
    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude], { icon: createCustomIcon() }).addTo(map);
    }

    // Clic sur la carte
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      placeMarker(map, lat, lng);
      onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    });

    // Force le recalcul de taille après mount (utile quand height="100%")
    setTimeout(() => map.invalidateSize(), 50);
    setTimeout(() => map.invalidateSize(), 300);

    // Suit les changements de taille du conteneur (parent flex/grid qui s'étire)
    let ro;
    if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(mapRef.current);
    }

    return () => { ro?.disconnect(); map.remove(); instanceRef.current = null; };
  }, []);

  // ── Suivi externe des coords ──────────────────────────────────
  useEffect(() => {
    if (!instanceRef.current || !latitude || !longitude) return;
    const latlng = [parseFloat(latitude), parseFloat(longitude)];
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng, { icon: createCustomIcon() }).addTo(instanceRef.current);
    }
    instanceRef.current.setView(latlng, Math.max(instanceRef.current.getZoom(), 12));
  }, [latitude, longitude]);

  // ── Basculer couche ───────────────────────────────────────────
  const switchLayer = (key) => {
    if (!instanceRef.current || key === activeLayer) return;
    const map = instanceRef.current;
    const cfg  = LAYERS[key];

    map.removeLayer(tileRef.current);
    if (labelsRef.current) map.removeLayer(labelsRef.current);

    tileRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map);

    if (key === 'satellite') {
      labelsRef.current = L.tileLayer(LABELS_URL, { attribution: '', maxZoom: cfg.maxZoom, opacity: 0.8 }).addTo(map);
    } else {
      labelsRef.current = null;
    }
    setActiveLayer(key);
  };

  // ── Placer marker (helper) ────────────────────────────────────
  const placeMarker = (map, lat, lng) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: createCustomIcon() }).addTo(map);
    }
  };

  // ── Recherche Nominatim (debounce 400 ms) ─────────────────────
  const handleSearch = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setShowResults(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q:       value,
          format:  'json',
          limit:   '6',
          addressdetails: '1',
        });
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'Accept-Language': 'fr' },
        });
        const data = await r.json();
        setResults(data);
        setShowResults(true);
      } catch { /* silently fail */ }
      finally { setSearching(false); }
    }, 400);
  }, []);

  const selectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const map = instanceRef.current;
    if (!map) return;
    placeMarker(map, lat, lng);
    map.setView([lat, lng], 14, { animate: true });
    onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    setQuery(item.display_name.split(',')[0]);
    setShowResults(false);
    setResults([]);
  };

  const clear = () => {
    if (markerRef.current && instanceRef.current) {
      instanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onChange({ latitude: '', longitude: '' });
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-full flex flex-col" style={{ position: 'relative' }}>

      {/* ── Barre de recherche flottante ── */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 56,
        zIndex: 800,
      }}>
        <div className="relative">
          <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 px-3 py-2 gap-2">
            {searching
              ? <Loader2 size={14} className="text-primary-500 animate-spin flex-shrink-0" />
              : <Search size={14} className="text-gray-400 flex-shrink-0" />
            }
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Rechercher un lieu, ville, fokontany…"
              className="flex-1 text-sm bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 min-w-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Dropdown résultats */}
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
              {results.map((item, i) => {
                const parts = item.display_name.split(',');
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectResult(item)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-2.5"
                  >
                    <MapPin size={13} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{parts[0]}</p>
                      <p className="text-xs text-gray-400 truncate">{parts.slice(1, 4).join(',')}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {showResults && results.length === 0 && !searching && query.length > 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-3 z-50">
              <p className="text-xs text-gray-400 text-center">Aucun résultat pour « {query} »</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sélecteur de couche flottant ── */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        zIndex: 800,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {Object.entries(LAYERS).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchLayer(key)}
            title={cfg.label}
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              border: activeLayer === key ? '2px solid #1D9E75' : '2px solid rgba(255,255,255,0.9)',
              background: activeLayer === key ? '#1D9E75' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(4px)',
              color: activeLayer === key ? 'white' : '#374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              cursor: 'pointer', transition: 'all 0.15s',
              fontSize: 10, fontWeight: 600,
            }}
          >
            {key === 'satellite' ? '🛰' : '🗺'}
          </button>
        ))}
      </div>

      {/* ── Carte Leaflet ── */}
      <div
        ref={mapRef}
        style={{ height: height === '100%' ? undefined : height, flex: height === '100%' ? '1 1 0%' : undefined, minHeight: 0 }}
        onClick={() => setShowResults(false)}
      />

      {/* ── Barre de coordonnées ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        {latitude && longitude ? (
          <>
            <MapPin size={13} className="text-primary-500 flex-shrink-0" />
            <span className="text-xs font-mono text-gray-700 flex-1">
              {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
            </span>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-0.5 rounded-lg hover:bg-red-50"
            >
              <X size={11} /> Effacer
            </button>
          </>
        ) : (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <MapPin size={12} />
            Cliquez sur la carte ou recherchez un lieu pour placer le marqueur GPS
          </p>
        )}
      </div>
    </div>
  );
}
