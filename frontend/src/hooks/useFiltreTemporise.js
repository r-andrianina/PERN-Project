import { useEffect, useRef, useState } from 'react';

/**
 * Champ texte dont la valeur ne part dans l'URL qu'après une pause de frappe.
 *
 * Les filtres de cette page vivent dans l'URL, et chaque changement d'URL
 * relance la recherche. Sans temporisation, taper « Marofandilia » lançait
 * TREIZE recherches — et chacune charge tout le jeu de résultats avant d'en
 * renvoyer une page (cf. recherche.controller.js), soit ~250 ms de travail
 * serveur par caractère sur la base actuelle.
 *
 * La valeur affichée est locale pour que la saisie reste instantanée ; l'URL
 * reste la source de vérité et reprend la main quand elle change d'ailleurs
 * (retour arrière du navigateur, bouton « réinitialiser »).
 */
export function useFiltreTemporise(valeurUrl, appliquer, delai = 350) {
  const [valeur, setValeur] = useState(valeurUrl ?? '');
  // `appliquer` est recréé à chaque rendu par l'appelant ; le garder dans une
  // ref évite de le mettre en dépendance du minuteur, ce qui le relancerait
  // sans fin. La mise à jour passe par un effet : écrire une ref pendant le
  // rendu casse le mode concurrent (règle react-hooks/refs).
  const appliquerRef = useRef(appliquer);
  useEffect(() => { appliquerRef.current = appliquer; });

  useEffect(() => { setValeur(valeurUrl ?? ''); }, [valeurUrl]);

  useEffect(() => {
    // Rien à propager quand la valeur locale correspond déjà à l'URL : c'est
    // le cas juste après un aller-retour, et re-déclencher ferait une boucle.
    if ((valeurUrl ?? '') === valeur) return undefined;
    const tid = setTimeout(() => appliquerRef.current(valeur), delai);
    return () => clearTimeout(tid);
    // `valeurUrl` est volontairement hors dépendances : le seul déclencheur
    // légitime est la frappe de l'utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, delai]);

  return [valeur, setValeur];
}
