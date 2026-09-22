// Abonnements au flux SSE partagé — voir sse.jsx pour le fournisseur.

import { useContext, useEffect, useRef } from 'react';
import { SseContext } from './sseContext';

/**
 * S'abonne à un événement du flux partagé.
 *
 * `handler` n'a pas besoin d'être stable : il est lu dans une ref au moment de
 * l'émission. C'est ce qui permet d'écrire `useSse('new_activity', () => …)`
 * sans `useCallback`, là où chaque consommateur devait auparavant stabiliser
 * ses rappels sous peine de rouvrir sa connexion à chaque rendu.
 */
export function useSse(evenement, handler) {
  const ctx = useContext(SseContext);
  if (!ctx) {
    // Volontairement bruyant. Un abonnement muet donnerait un écran qui ne se
    // rafraîchit jamais sans rien signaler — exactement le défaut que ce
    // module corrige ailleurs.
    throw new Error(`useSse('${evenement}') utilisé hors d'un <SseProvider>.`);
  }

  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  const { abonnes } = ctx;
  useEffect(() => {
    const stable = (e) => handlerRef.current?.(e);
    const map = abonnes.current;
    if (!map.has(evenement)) map.set(evenement, new Set());
    map.get(evenement).add(stable);
    return () => { map.get(evenement)?.delete(stable); };
  }, [abonnes, evenement]);
}

/** État de la connexion partagée : 'connecting' | 'connected' | 'offline'. */
export function useSseEtat() {
  const ctx = useContext(SseContext);
  if (!ctx) throw new Error("useSseEtat() utilisé hors d'un <SseProvider>.");
  return ctx.etat;
}
