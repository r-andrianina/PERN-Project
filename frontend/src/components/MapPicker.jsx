import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createBaseLayer } from '../lib/mapLayers';
import MapSearchBar from './MapSearchBar';
import { useT } from '../lib/i18n';

// Wraps a callback prop in a ref so the Leaflet click handler always calls
// the latest version without needing to be re-registered.
function useLatestRef(fn) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  return ref;
}

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

// Icône sobre pour les points existants superposés (localités, méthodes…),
// sélectionnables — couleur personnalisable (ex: par type de méthode).
const createExistingIcon = (color = '#6b7280') =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width:12px; height:12px;
        background:rgba(255,255,255,0.85); border:2px solid ${color};
        border-radius:50%; box-shadow:0 1px 4px rgba(0,0,0,0.35);
        cursor:pointer;
      "></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

export default function MapPicker({
  latitude, longitude, onChange, height = '340px',
  existingPoints, onSelectExisting,
}) {
  const t = useT();
  const mapRef      = useRef(null);
  const instanceRef = useRef(null);
  const markerRef   = useRef(null);
  const existingLayerRef = useRef(null);
  const onChangeRef = useLatestRef(onChange);
  const onSelectExistingRef = useLatestRef(onSelectExisting);

  const defaultLat = latitude  || -18.9137;
  const defaultLng = longitude || 47.5361;

  // ── Placer marker (helper) ────────────────────────────────────
  const placeMarker = (map, lat, lng) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: createCustomIcon() }).addTo(map);
    }
  };

  // ── Initialisation carte ──────────────────────────────────────
  useEffect(() => {
    if (instanceRef.current) return;

    // Zoom précis d'emblée si une position (piège/localité) est déjà connue —
    // évite la vue large par défaut, peu utile pour repositionner un piège.
    const map = L.map(mapRef.current, { zoomControl: false }).setView([defaultLat, defaultLng], (latitude && longitude) ? 15 : 6);
    instanceRef.current = map;

    // Contrôle zoom en bas à droite
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Couche de base
    createBaseLayer(L, 'satellite').addTo(map);

    // Groupe des marqueurs de localités existantes (superposition, peuplé par le second effect)
    existingLayerRef.current = L.layerGroup().addTo(map);

    // Marker initial
    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude], { icon: createCustomIcon() }).addTo(map);
    }

    // Clic sur la carte — utilise onChangeRef pour toujours appeler la version courante
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      placeMarker(map, lat, lng);
      onChangeRef.current({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
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
    // Initialisation unique de la carte (guard instanceRef.current ci-dessus) —
    // defaultLat/defaultLng/latitude/longitude ne servent qu'à positionner la
    // vue initiale, le suivi réactif est géré par l'effet [latitude, longitude]
    // plus bas ; onChangeRef est lu via .current exprès pour ne pas re-créer
    // la carte à chaque render. Les inclure ferait sauter/réinitialiser la carte
    // à chaque changement de coordonnées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    instanceRef.current.setView(latlng, Math.max(instanceRef.current.getZoom(), 15));
  }, [latitude, longitude]);

  // ── Localités existantes (superposition sélectionnable) ────────
  useEffect(() => {
    const layer = existingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!existingPoints?.length) return;

    for (const point of existingPoints) {
      if (point.latitude == null || point.longitude == null) continue;
      const marker = L.marker([point.latitude, point.longitude], { icon: createExistingIcon(point.color) });
      marker.bindTooltip(point.tooltip || point.nom || t('common.point'), { direction: 'top', offset: [0, -4] });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); // évite de déclencher le clic "placer un nouveau point"
        onSelectExistingRef.current?.(point);
      });
      marker.addTo(layer);
    }
    // onSelectExistingRef lu via .current exprès (pattern ref) pour ne pas
    // reconstruire tous les marqueurs à chaque re-render du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPoints, t]);

  const handleSearchSelect = (lat, lng) => {
    const map = instanceRef.current;
    if (!map) return;
    placeMarker(map, lat, lng);
    map.setView([lat, lng], 14, { animate: true });
    onChangeRef.current({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-full flex flex-col" style={{ position: 'relative', isolation: 'isolate' }}>

      {/* ── Barre de recherche flottante ── */}
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 800 }}>
        <MapSearchBar onSelect={handleSearchSelect} />
      </div>

      {/* ── Carte Leaflet ── */}
      <div
        ref={mapRef}
        style={{ height: height === '100%' ? undefined : height, flex: height === '100%' ? '1 1 0%' : undefined, minHeight: 0 }}
      />

    </div>
  );
}
