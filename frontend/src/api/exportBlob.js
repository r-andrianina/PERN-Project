import api from './axios';

/**
 * Télécharge un fichier binaire depuis une route API protégée (JWT via axios).
 *
 * @param {string} endpoint  Route relative (ex: '/moustiques/export')
 * @param {object} params    Query params optionnels transmis au backend
 * @param {string} filename  Nom du fichier suggéré au navigateur
 */
export async function exportBlob(endpoint, params = {}, filename) {
  const res  = await api.get(endpoint, { params, responseType: 'blob' });
  const url  = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Génère un suffixe date ISO pour nommer les exports : "2024-03-15" */
export function exportDate() {
  return new Date().toISOString().slice(0, 10);
}
