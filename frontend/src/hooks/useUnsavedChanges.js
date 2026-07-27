import { useEffect, useCallback } from 'react';
import { useBlocker, useBeforeUnload } from 'react-router-dom';

/**
 * Bloque la navigation (in-app et navigateur) si isDirty est true.
 * Affiche un dialog de confirmation natif.
 *
 * Usage :
 *   const [isDirty, setIsDirty] = useState(false);
 *   useUnsavedChanges(isDirty);
 *   // setIsDirty(true) dès que l'utilisateur modifie le formulaire
 *   // setIsDirty(false) après soumission réussie
 */
export function useUnsavedChanges(isDirty) {
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
      const ok = window.confirm(
        'Vous avez des modifications non sauvegardées. Quitter quand même ?'
      );
      if (ok) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
}
