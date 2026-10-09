// Dictionnaire Personnel, partagé par les sélecteurs de chef et d'agents.
//
// On charge TOUTES les fiches, actives ou non : une mission peut porter une
// personne désactivée depuis (partie de l'UEM), et ses pastilles doivent
// encore afficher son nom. Seules les fiches actives sont PROPOSÉES au choix.
// Le volume (une centaine de fiches) ne justifie pas une recherche serveur.

import { useMemo } from 'react';
import { useApiQuery } from '../../hooks';

export const PERSONNEL_URL = '/dictionnaire/personnel';

export default function usePersonnel() {
  const { data, loading, error, refetch } = useApiQuery(PERSONNEL_URL, {
    select: (r) => r.items ?? [],
  });

  return useMemo(() => {
    const personnel = data ?? [];
    const parId = new Map(personnel.map((p) => [p.id, p]));
    const equipes = [...new Set(personnel.map((p) => p.equipe).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fr'));
    return {
      personnel,
      actifs: personnel.filter((p) => p.actif),
      parId,
      equipes,
      loading,
      error,
      refetch,
    };
  }, [data, loading, error, refetch]);
}
