import { useCallback, useEffect, useRef } from 'react';

/**
 * Regroupe une rafale d'appels en un seul, avec un plafond d'attente.
 *
 * Pensé pour les rechargements déclenchés par le flux SSE. La page de
 * surveillance rechargeait ses données à CHAQUE événement reçu, et
 * `/dashboard/admin-stats` exécute une quinzaine de requêtes Prisma : un
 * technicien saisissant 50 spécimens un par un faisait émettre ~800 requêtes
 * à un écran d'admin simplement resté ouvert.
 *
 * Deux garde-fous plutôt qu'un :
 *   · `delai` — on attend une pause avant de recharger, ce qui absorbe les
 *     rafales (un import, une suite de saisies rapides).
 *   · `maxAttente` — mais une activité CONTINUE ne doit pas repousser le
 *     rechargement indéfiniment : sur un écran de surveillance, ce serait
 *     échanger un excès de requêtes contre un affichage qui ment. Passé ce
 *     plafond, on recharge même si les événements continuent d'arriver.
 *
 * L'appel est toujours en fin de fenêtre (jamais au premier événement) : la
 * donnée qui vient d'arriver n'est de toute façon lisible qu'après l'avoir
 * rechargée, et déclencher à l'entrée doublerait les requêtes pour rien.
 *
 * @param {Function} fn          Ce qu'on veut appeler, au plus une fois par fenêtre.
 * @param {object}   [opts]
 * @param {number}   [opts.delai]      Pause d'inactivité avant l'appel (ms).
 * @param {number}   [opts.maxAttente] Délai maximal depuis le premier événement (ms).
 * @returns {Function} à appeler autant qu'on veut ; n'appelle `fn` qu'une fois.
 */
export function useAppelTemporise(fn, { delai = 800, maxAttente = 4000 } = {}) {
  // `fn` est recréé à chaque rendu par l'appelant. Le garder dans une ref
  // évite de le mettre en dépendance, ce qui recréerait le déclencheur et
  // perdrait le minuteur en cours a chaque rendu. Même motif que
  // `useFiltreTemporise`, y compris l'écriture par effet : écrire une ref
  // pendant le rendu casse le mode concurrent.
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  const minuteur       = useRef(null);
  const debutDeFenetre = useRef(0);

  // Un minuteur encore armé au démontage appellerait `fn` sur un composant
  // disparu — typiquement un `setState` dans le vide.
  useEffect(() => () => {
    if (minuteur.current !== null) clearTimeout(minuteur.current);
  }, []);

  return useCallback(() => {
    const maintenant = Date.now();

    if (minuteur.current === null) {
      debutDeFenetre.current = maintenant;       // première secousse : la fenêtre s'ouvre
    } else {
      clearTimeout(minuteur.current);            // on repousse, sans perdre l'origine
    }

    const restant = Math.max(0, maxAttente - (maintenant - debutDeFenetre.current));
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      fnRef.current();
    }, Math.min(delai, restant));
  }, [delai, maxAttente]);
}
