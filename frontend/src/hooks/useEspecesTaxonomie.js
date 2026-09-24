// Recherche d'espèces dans le dictionnaire taxonomique, CÔTÉ SERVEUR.
//
// Les sept écrans de saisie et de détail préchargeaient la liste complète des
// espèces de leur type pour alimenter un menu déroulant. Mesuré le
// 2026-09-24 : 1,6 Mo pour les moustiques (3 659 espèces), 2,5 Mo pour les
// autres spécimens (5 799 depuis l'import du dictionnaire). Chaque ligne
// arrivait avec toutes ses colonnes et un `_count` sur cinq relations dont
// aucun de ces écrans ne se sert.
//
// Ici, on ne demande que ce qui s'affiche (`light`), 50 lignes à la fois, et
// seulement quand l'utilisateur ouvre le menu.

import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { taxoLabel } from '../utils/taxoLabel';

// Le libellé passe par `taxoLabel`, qui REMONTE la chaîne jusqu'au rang
// `genre`. Les menus déroulants faisaient `parent.nom + nom`, ce qui donne le
// SOUS-GENRE quand il y en a un : « Stegomyia aegypti » au lieu d'« Aedes
// aegypti ». Le reste de l'application avait été corrigé le 2026-09-01 ; ces
// menus étaient restés en arrière, et affichaient donc un autre nom que le
// titre de la fiche juste au-dessus.
const enOption = (tx) => ({ value: tx.id, label: taxoLabel(tx) });

/**
 * @param {'moustique'|'tique'|'puce'|'autre'} type
 * @param {number|string|null} valeurCourante  taxonomieId déjà sélectionné
 * @returns {{ chercherEspeces: (q: string) => Promise<object[]>,
 *             optionTaxonomie: {value: number, label: string} | null }}
 */
export function useEspecesTaxonomie(type, valeurCourante) {
  const [optionTaxonomie, setOption] = useState(null);

  const chercherEspeces = useCallback(async (q) => {
    const r = await api.get('/dictionnaire/taxonomie-specimens', {
      params: {
        type, niveau: 'espece', actif: 'true', light: 'true', limit: 50,
        ...(q ? { search: q } : {}),
      },
    });
    return (r.data.items || []).map(enOption);
  }, [type]);

  // Le libellé de la valeur déjà enregistrée : elle n'est presque jamais dans
  // les 50 lignes affichées. Sans cette résolution, rouvrir une fiche
  // montrerait un champ vide à la place de l'espèce saisie.
  useEffect(() => {
    if (!valeurCourante) { setOption(null); return; }
    let vivant = true;
    api.get(`/dictionnaire/taxonomie-specimens/${valeurCourante}`)
      .then((r) => { if (vivant && r.data.item) setOption(enOption(r.data.item)); })
      .catch(() => { if (vivant) setOption(null); });
    return () => { vivant = false; };
  }, [valeurCourante]);

  return { chercherEspeces, optionTaxonomie };
}
