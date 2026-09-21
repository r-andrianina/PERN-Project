import { useEffect, useCallback, useRef } from 'react';
import { useBlocker, useBeforeUnload } from 'react-router-dom';
import { useT } from '../lib/i18n';

/**
 * Bloque la navigation (in-app et navigateur) si isDirty est true.
 * Affiche un dialog de confirmation natif.
 *
 * Usage :
 *   const [isDirty, setIsDirty] = useState(false);
 *   const desarmerGarde = useUnsavedChanges(isDirty);
 *   // setIsDirty(true) dès que l'utilisateur modifie le formulaire
 *   // desarmerGarde() AVANT le navigate() qui suit un enregistrement réussi
 *
 * Pourquoi `desarmerGarde()` et non `setIsDirty(false)` (corrigé le 2026-09-21) :
 *
 *   setIsDirty(false);              // mise à jour d'état React — ASYNCHRONE
 *   navigate('/specimens/tiques');  // part AVANT le re-rendu
 *
 * `useBlocker` évaluait encore la fonction qui capture `isDirty === true`, donc
 * la garde se déclenchait APRÈS un enregistrement réussi : l'utilisateur venait
 * de sauvegarder et on lui demandait s'il acceptait de perdre ses
 * modifications. Observé en créant une tique par le formulaire — la ligne était
 * bien écrite en base, et la boîte s'ouvrait quand même.
 *
 * Une ref se mute de façon SYNCHRONE : le blocker voit le désarmement dans le
 * même tour, avant que la navigation soit évaluée.
 *
 * Portée du blocage — deux mécanismes distincts, et un seul est traduisible :
 *
 *   • Navigation dans l'application (clic sur un lien du menu) : bloquée par
 *     `useBlocker`, avec notre propre `window.confirm`. C'est ce texte qui est
 *     traduit ci-dessous ; il était codé en dur en français.
 *
 *   • F5 et fermeture d'onglet : bloqués par `useBeforeUnload`. Le texte y est
 *     imposé par le NAVIGATEUR et ne peut pas être fourni — les navigateurs
 *     ignorent depuis longtemps toute chaîne personnalisée, pour empêcher les
 *     pages de retenir l'utilisateur par un faux message. Rien à traduire là.
 *
 * @param   {boolean}  isDirty
 * @returns {Function} desarmerGarde — à appeler avant une navigation voulue
 */
export function useUnsavedChanges(isDirty) {
  const t = useT();
  const desarme = useRef(false);

  // Réarmé si le formulaire redevient modifié après un enregistrement (cas du
  // formulaire qu'on continue de remplir sans quitter la page).
  useEffect(() => { if (isDirty) desarme.current = false; }, [isDirty]);

  // Bloque F5 / fermeture d'onglet
  useBeforeUnload(
    useCallback(
      (e) => {
        if (isDirty && !desarme.current) {
          e.preventDefault();
          e.returnValue = '';
        }
      },
      [isDirty]
    )
  );

  // Bloque la navigation React Router
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty && !desarme.current && currentLocation.pathname !== nextLocation.pathname,
      [isDirty]
    )
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const ok = window.confirm(t('unsavedChanges.confirmLeave'));
      if (ok) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, t]);

  return useCallback(() => { desarme.current = true; }, []);
}
