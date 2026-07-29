// Bandeau global "connexion au serveur perdue" — affiché dès qu'une requête
// échoue sans réponse (voir src/api/axios.js). Pendant que le bandeau est
// visible, ping périodique de /api/health (fetch brut, hors intercepteur,
// pas besoin d'auth) pour détecter le rétablissement et se masquer seul,
// sans attendre qu'une action utilisateur relance une requête.

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import useConnectionStore from '../store/connectionStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
const HEALTH_URL = API_BASE.replace(/\/api\/v1\/?$/, '/api/health');

export default function ConnectionBanner() {
  const isDown = useConnectionStore((s) => s.isDown);
  const setUp  = useConnectionStore((s) => s.setUp);

  useEffect(() => {
    if (!isDown) return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(HEALTH_URL, { cache: 'no-store' });
        if (r.ok) setUp();
      } catch { /* toujours down, on retentera au prochain tick */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [isDown, setUp]);

  if (!isDown) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-warning text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md">
      <WifiOff size={14} className="flex-shrink-0 animate-pulse" />
      Connexion au serveur perdue — nouvelle tentative en cours…
    </div>
  );
}
