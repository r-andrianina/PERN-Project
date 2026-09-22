// Flux SSE unique, partagé par toute l'application authentifiée.
//
// Trois composants ouvraient chacun leur `EventSource` vers le MÊME endpoint :
// NotificationBell (monté en permanence dans MainLayout), AdminPresencePage et
// NotificationsPage. Un admin sur l'écran de surveillance tenait donc deux
// connexions longues ouvertes simultanément, pour recevoir exactement les
// mêmes octets.
//
// Ce n'était pas qu'un gaspillage. `sseManager.getTabCount()` compte les
// connexions d'un utilisateur, et la page de surveillance affichait ce nombre
// comme un nombre d'ONGLETS : un seul onglet en déclarait deux, et l'écran
// accusait l'utilisateur d'une fenêtre que l'écran lui-même venait d'ouvrir.
// Un flux par session rend ce compte exact au lieu de le renommer.
//
// ── Ce que le partage apporte encore ──
// · Le jeton vient de `authStore` et non plus d'une lecture ponctuelle de
//   `localStorage` au montage : une déconnexion ferme le flux, une reconnexion
//   ou un jeton ré-émis le recrée. Les trois consommateurs gardaient sinon une
//   connexion signée d'un jeton périmé jusqu'à leur démontage.
// · Les abonnés n'ont plus besoin de rappels stables. Le handler est lu dans
//   une ref à chaque émission, donc un `useCallback` oublié ne provoque plus
//   de cycle fermeture/réouverture de connexion à chaque rendu.

import { useEffect, useMemo, useRef, useState } from 'react';
import useAuthStore from '../store/authStore';
import { SseContext, EVENEMENTS } from './sseContext';

export function SseProvider({ children }) {
  const token = useAuthStore((s) => s.token);
  const [etat, setEtat] = useState('connecting');

  // Map<nomEvenement, Set<handler>>. Une ref et non un state : s'abonner ne
  // doit rien redessiner, et l'ensemble change à chaque montage de page.
  const abonnes = useRef(new Map());

  useEffect(() => {
    if (!token) { setEtat('offline'); return undefined; }

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`);

    // Une copie de l'ensemble avant diffusion : un abonné qui se désabonne
    // depuis son propre handler modifierait le Set en cours d'itération.
    const diffuser = (nom) => (e) => {
      const set = abonnes.current.get(nom);
      if (set) for (const handler of [...set]) handler(e);
    };

    const poses = EVENEMENTS.map((nom) => {
      const f = diffuser(nom);
      es.addEventListener(nom, f);
      return [nom, f];
    });

    // `init` vaut confirmation d'ouverture au même titre que `onopen` : sur un
    // rétablissement, c'est souvent lui qui arrive en premier.
    es.addEventListener('init', () => setEtat('connected'));
    es.onopen  = () => setEtat('connected');
    es.onerror = () => setEtat('offline');

    return () => {
      poses.forEach(([nom, f]) => es.removeEventListener(nom, f));
      es.close();
    };
  }, [token]);

  // `abonnes` est une ref stable : la valeur ne change qu'avec l'état, donc
  // un changement d'état ne réabonne personne.
  const valeur = useMemo(() => ({ etat, abonnes }), [etat]);

  return <SseContext.Provider value={valeur}>{children}</SseContext.Provider>;
}
