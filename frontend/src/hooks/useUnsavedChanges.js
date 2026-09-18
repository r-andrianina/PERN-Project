import { useEffect, useCallback } from 'react';
import { useBlocker, useBeforeUnload } from 'react-router-dom';
import { useT } from '../lib/i18n';

/**
 * Bloque la navigation (in-app et navigateur) si isDirty est true.
 * Affiche un dialog de confirmation natif.
 *
 * Usage :
 *   const [isDirty, setIsDirty] = useState(false);
 *   useUnsavedChanges(isDirty);
 *   // setIsDirty(true) dès que l'utilisateur modifie le formulaire
 *   // setIsDirty(false) après soumission réussie
 *
 * Portée du blocage — deux mécanismes distincts, et un seul est traduisible :
 *
 *   • Navigation dans l'application (clic sur un lien du menu) : bloquée par
 *     `useBlocker`, avec notre propre `window.confirm`. C'est ce texte qui est
 *     traduit ci-dessous (2026-09-18) ; il était codé en dur en français, donc
 *     un utilisateur en anglais lisait un message français.
 *
 *   • F5 et fermeture d'onglet : bloqués par `useBeforeUnload`. Le texte y est
 *     imposé par le NAVIGATEUR et ne peut pas être fourni — les navigateurs
 *     ignorent depuis longtemps toute chaîne personnalisée, pour empêcher les
 *     pages de retenir l'utilisateur par un faux message. Rien à traduire là.
 */
export function useUnsavedChanges(isDirty) {
  const t = useT();

  // Bloque F5 / fermeture d'onglet
  useBeforeUnload(
    useCallback(
      (e) => {
        if (isDirty) {
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
        isDirty && currentLocation.pathname !== nextLocation.pathname,
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
}
