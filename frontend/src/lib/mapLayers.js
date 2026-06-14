// frontend/src/lib/mapLayers.js
// Couches de fond partagées entre CartePage et MapPicker.
//
// Contexte "Map data not yet available" : pour certaines zones de
// Madagascar, Esri World_Imagery n'a tout simplement pas d'imagerie
// haute résolution (même dans la limite de `maxNativeZoom`) et renvoie
// une tuile placeholder portant ce texte. La couche Google (satellite
// public, sans clé API) sert d'alternative pour ces zones.

// Tuile transparente 1x1 — utilisée comme `errorTileUrl` pour qu'une
// tuile en échec (réseau/CORS) laisse voir la tuile parente zoomée au
// lieu d'afficher le carré gris "image cassée" de Leaflet.
export const ERROR_TILE_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAfMqYG3AAAAAASUVORK5CYII=';

export const BASE_LAYERS = {
  satellite: {
    label: 'Satellite (Esri)',
    icon: '🛰',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 22,
    maxNativeZoom: 18,
  },
  hybrid: {
    label: 'Satellite (Google)',
    icon: '🌐',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
};

// Crée la couche de fond `key`, prête à être ajoutée à la carte via `.addTo(map)`.
export function createBaseLayer(L, key) {
  const cfg = BASE_LAYERS[key];
  const tileOptions = {
    attribution: cfg.attribution,
    maxZoom: cfg.maxZoom,
    maxNativeZoom: cfg.maxNativeZoom,
    errorTileUrl: ERROR_TILE_URL,
  };
  // Ne définir `subdomains` que si fourni : passer `undefined` écraserait
  // explicitement le défaut Leaflet ('abc') et ferait planter
  // _getSubdomain() (lecture de .length sur undefined).
  if (cfg.subdomains) tileOptions.subdomains = cfg.subdomains;
  return L.tileLayer(cfg.url, tileOptions);
}
