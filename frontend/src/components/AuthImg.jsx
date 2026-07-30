/* eslint-disable react-refresh/only-export-components -- ce fichier exporte aussi un utilitaire de cache d'images ; faux positif HMR (cf. router/index.jsx) */
import { useState, useEffect } from 'react';
import api from '../api/axios';

/**
 * Charge une image depuis une URL protégée par JWT via axios,
 * puis l'affiche via un blob URL. Évite d'exposer l'image sans auth.
 */
export default function AuthImg({ src, alt, className }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!src) return;
    let objectUrl;
    api.get(src, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!blobUrl) return null;
  return <img src={blobUrl} alt={alt} className={className} />;
}

/**
 * Télécharge un fichier protégé par JWT via axios.
 * @param {string} url  - URL relative à l'instance axios (ex: "/uploads/gel.png")
 * @param {string} filename - nom du fichier proposé au téléchargement
 */
export async function downloadAuthFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename || 'fichier';
  a.click();
  URL.revokeObjectURL(href);
}
