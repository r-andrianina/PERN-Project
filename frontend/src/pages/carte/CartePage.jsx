// frontend/src/pages/carte/CartePage.jsx
// Carte interactive des spécimens collectés.
// Utilise Leaflet vanilla (même pattern que MapPicker.jsx).
// 1 marqueur par méthode de collecte géolocalisée, filtré par RBAC.

import { useEffect, useRef, useState } from 'react';
import { Map, Layers, Info } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../api/axios';
import useAuthStore from '../../store/authStore';
import { Spinner } from '../../components/ui';
import { createBaseLayer } from '../../lib/mapLayers';
import MapSearchBar from '../../components/MapSearchBar';

// ── Couleurs des types ────────────────────────────────────────
const TYPE_CFG = {
  moustique: { color: '#1D9E75', label: 'Moustique', icon: '/icons/mosquito.png' },
  tique:     { color: '#f59e0b', label: 'Tique',     icon: '/icons/tick.png'     },
  puce:      { color: '#ef4444', label: 'Puce',      icon: '/icons/flea.png'     },
};

// ── Construction HTML du marqueur (pin style, sans PNG) ───────
// Les PNG Leaflet ignorent width/height HTML → on utilise des pastilles CSS.
function buildMarkerHtml(point, visibleTypes) {
  const types = Object.keys(point.specimens).filter(t => visibleTypes.has(t));
  if (types.length === 0) return '';

  const total = types.reduce((s, t) => s + (point.specimens[t]?.total || 0), 0);

  const dominant = types.reduce((best, t) =>
    (point.specimens[t]?.total || 0) > (point.specimens[best]?.total || 0) ? t : best,
    types[0]
  );
  const color = TYPE_CFG[dominant]?.color || '#6b7280';

  // Pastilles colorées — une par type présent (pas d'image PNG dans le marqueur)
  const dots = types.map(t =>
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${TYPE_CFG[t].color};flex-shrink:0;"></span>`
  ).join('');

  return `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;font-family:system-ui,sans-serif;">
      <div style="
        background:white;
        border:2px solid ${color};
        border-radius:6px;
        padding:2px 6px;
        display:flex;
        align-items:center;
        gap:3px;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        white-space:nowrap;
        min-height:20px;
        min-width:20px;
        justify-content:center;
      ">
        ${dots}
        <span style="font-size:10px;font-weight:800;color:${color};margin-left:${types.length > 0 ? '2px' : '0'};">${total}</span>
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color};margin-top:-1px;"></div>
    </div>
  `;
}

// Échappe les caractères HTML pour éviter le XSS dans les popups Leaflet (innerHTML)
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Construction HTML du popup ────────────────────────────────
function buildPopupHtml(point, visibleTypes) {
  const { localite, typeMethode, dateCollecte, methodeId, specimens } = point;
  const mission = localite?.mission;

  const specimenRows = Object.entries(specimens)
    .filter(([t]) => visibleTypes.has(t))
    .map(([t, data]) => {
      if (!data) return '';
      const cfg = TYPE_CFG[t];
      const exemples = data.items.slice(0, 2).map(x =>
        `<span style="display:inline-block;background:#f3f4f6;border-radius:4px;padding:1px 5px;font-size:10px;color:#4b5563;font-style:italic;">${esc(x.taxonomie || x.idTerrain || `#${x.id}`)}</span>`
      ).join(' ');
      return `
        <div style="display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-bottom:1px solid #f3f4f6;">
          <img src="${esc(cfg.icon)}" style="width:16px;height:16px;max-width:16px;max-height:16px;display:block;object-fit:contain;flex-shrink:0;margin-top:1px;" />
          <div>
            <span style="font-size:11px;font-weight:700;color:${esc(cfg.color)};">${data.total} ${esc(cfg.label)}${data.total > 1 ? 's' : ''}</span>
            <div style="margin-top:2px;">${exemples}</div>
          </div>
        </div>
      `;
    }).join('');

  const dateStr = dateCollecte
    ? new Date(dateCollecte).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })
    : null;

  const region   = [localite?.region, localite?.district].filter(Boolean).map(esc).join(' · ');
  const projetBit = mission?.projet?.code
    ? `<span style="color:#9ca3af;margin-left:6px;">Projet</span> ${esc(mission.projet.code)}`
    : '';

  return `
    <div style="font-family:system-ui,sans-serif;min-width:230px;max-width:280px;padding:2px;">
      <div style="font-weight:700;font-size:13px;color:#111827;">${esc(localite?.nom) || '—'}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:1px;">${region}</div>
      <div style="margin:8px 0;border-top:1px solid #e5e7eb;"></div>
      <div style="font-size:11px;color:#374151;margin-bottom:3px;">
        <span style="color:#9ca3af;">Mission</span> ${esc(mission?.ordreMission) || '—'}
        ${projetBit}
      </div>
      <div style="font-size:11px;color:#374151;margin-bottom:${dateStr ? '3px' : '8px'};">
        <span style="color:#9ca3af;">Méthode</span> ${esc(typeMethode?.nom) || '—'}
      </div>
      ${dateStr ? `<div style="font-size:11px;color:#374151;margin-bottom:8px;"><span style="color:#9ca3af;">Date</span> ${esc(dateStr)}</div>` : ''}
      ${specimenRows}
      <a
        href="/recherche?methodeId=${encodeURIComponent(methodeId)}"
        style="
          display:block;margin-top:10px;
          background:#1D9E75;color:white;
          text-align:center;padding:7px 0;
          border-radius:8px;font-size:11px;font-weight:600;
          text-decoration:none;cursor:pointer;
        "
      >Voir dans la recherche →</a>
    </div>
  `;
}

// ── Page ──────────────────────────────────────────────────────
export default function CartePage() {
  const { user } = useAuthStore();

  // Types autorisés pour cet utilisateur
  const autorises = user?.role === 'admin'
    ? ['moustique', 'tique', 'puce']
    : (user?.specimensAutorises || []);

  const [points,       setPoints]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [visibleTypes, setVisibleTypes] = useState(new Set(autorises));

  const mapRef      = useRef(null);  // div conteneur
  const instanceRef = useRef(null);  // instance L.Map
  const groupsRef   = useRef({});    // { moustique: L.LayerGroup, ... }

  // ── Chargement données ─────────────────────────────────────
  useEffect(() => {
    api.get('/carte/specimens')
      .then(r => setPoints(r.data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Init carte Leaflet ─────────────────────────────────────
  useEffect(() => {
    if (instanceRef.current || !mapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false })
      .setView([-19.5, 46.5], 6);
    instanceRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    createBaseLayer(L, 'satellite').addTo(map);

    // Groupes par type (pour show/hide)
    groupsRef.current = {
      moustique: L.layerGroup().addTo(map),
      tique:     L.layerGroup().addTo(map),
      puce:      L.layerGroup().addTo(map),
    };

    setTimeout(() => map.invalidateSize(), 80);
    return () => { map.remove(); instanceRef.current = null; };
  }, []);

  // ── Mise à jour des marqueurs quand données ou filtres changent ──
  useEffect(() => {
    const map = instanceRef.current;
    if (!map || loading) return;

    // Vider tous les groupes
    Object.values(groupsRef.current).forEach(g => g.clearLayers());

    if (points.length === 0) return;

    const bounds = [];

    points.forEach(point => {
      // Déterminer quels types sont visibles pour ce point
      const typesIci = Object.keys(point.specimens).filter(t => visibleTypes.has(t));
      if (typesIci.length === 0) return;

      const latlng = [point.latitude, point.longitude];
      bounds.push(latlng);

      // Icône HTML
      const html  = buildMarkerHtml(point, visibleTypes);
      const icon  = L.divIcon({
        className: 'specimen-pin',
        html,
        iconSize:   [48, 28],  // badge + flèche
        iconAnchor: [24, 28],  // pointe de la flèche = coordonnée GPS exacte
        popupAnchor:[0, -30],
      });

      const marker = L.marker(latlng, { icon })
        .bindPopup(buildPopupHtml(point, visibleTypes), {
          maxWidth: 300,
          className: 'specimen-popup',
        });

      // Ajouter dans le groupe du type dominant
      const dominant = typesIci.reduce((best, t) =>
        (point.specimens[t]?.total || 0) > (point.specimens[best]?.total || 0) ? t : best,
        typesIci[0]
      );
      groupsRef.current[dominant]?.addLayer(marker);
    });

    // Ajuster la vue sur les données visibles
    if (bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 }); } catch { /* fitBounds can throw on empty/invalid bounds */ }
    }
  }, [points, visibleTypes, loading]);

  const toggleType = (type) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  // ── Stats ─────────────────────────────────────────────────
  const visiblePoints = points.filter(p =>
    Object.keys(p.specimens).some(t => visibleTypes.has(t))
  );
  const statsParType = autorises.reduce((acc, t) => {
    if (visibleTypes.has(t)) {
      acc[t] = points.reduce((s, p) => s + (p.specimens[t]?.total || 0), 0);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Map size={20} className="text-primary" /> Carte des collectes
          </h1>
          <p className="text-xs text-fg-subtle mt-0.5">
            {loading ? 'Chargement…' : `${visiblePoints.length} site(s) géolocalisé(s)`}
          </p>
        </div>

        {/* Stats rapides */}
        {!loading && (
          <div className="hidden sm:flex items-center gap-3">
            {autorises.filter(t => visibleTypes.has(t)).map(t => (
              <div key={t} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: TYPE_CFG[t].color }}>
                <img src={TYPE_CFG[t].icon} width={14} height={14} alt={t} className="object-contain" />
                {statsParType[t] ?? 0} {TYPE_CFG[t].label}{statsParType[t] > 1 ? 's' : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conteneur carte */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-card"
           style={{ height: 'calc(100vh - 180px)', minHeight: 480 }}>

        {/* Spinner chargement */}
        {loading && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-surface/80 backdrop-blur-sm">
            <Spinner.Block label="Chargement des données…" height="h-full" />
          </div>
        )}

        {/* Message aucune donnée */}
        {!loading && points.length === 0 && (
          <div className="absolute inset-0 z-[900] flex flex-col items-center justify-center bg-surface/80 backdrop-blur-sm gap-3">
            <Info size={32} className="text-fg-subtle" />
            <p className="text-sm font-medium text-fg">Aucun site géolocalisé</p>
            <p className="text-xs text-fg-subtle text-center max-w-xs">
              Les méthodes de collecte doivent avoir des coordonnées GPS pour apparaître sur la carte.
            </p>
          </div>
        )}

        {/* ── Filtre types (flottant haut-gauche) ── */}
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 800 }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(6px)',
            borderRadius: 12,
            border: '1.5px solid rgba(229,231,235,0.8)',
            boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Filtres
            </p>
            {autorises.map(type => {
              const active = visibleTypes.has(type);
              const cfg    = TYPE_CFG[type];
              const count  = points.reduce((s, p) => s + (p.specimens[type]?.total || 0), 0);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: `1.5px solid ${active ? cfg.color : '#e5e7eb'}`,
                    background: active ? `${cfg.color}18` : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    opacity: count === 0 ? 0.4 : 1,
                  }}
                >
                  <img src={cfg.icon} width={16} height={16} style={{ objectFit: 'contain' }} alt={type} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? cfg.color : '#9ca3af' }}>
                    {cfg.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: active ? cfg.color : '#9ca3af',
                    background: active ? `${cfg.color}20` : '#f3f4f6',
                    borderRadius: 10, padding: '1px 6px',
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Recherche (flottante haut-droite) ── */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 800, width: 280, maxWidth: 'calc(100% - 24px)' }}>
          <MapSearchBar
            placeholder="Rechercher un lieu…"
            onSelect={(lat, lng) => instanceRef.current?.setView([lat, lng], 13, { animate: true })}
          />
        </div>

        {/* ── Légende (flottant bas-gauche) ── */}
        {!loading && visiblePoints.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 30, left: 12, zIndex: 800,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(6px)',
            borderRadius: 10,
            border: '1.5px solid rgba(229,231,235,0.8)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '6px 10px',
            fontSize: 10,
            fontFamily: 'system-ui',
            color: '#6b7280',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 22, height: 12, background: 'white', border: '2px solid #1D9E75', borderRadius: 6 }} />
                Site de collecte
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Layers size={10} /> Cliquer pour le détail
              </span>
            </div>
          </div>
        )}

        {/* ── Conteneur Leaflet ── */}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
