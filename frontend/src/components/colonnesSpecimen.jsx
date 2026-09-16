// Colonnes partagées par les listes de spécimens.
//
// Dans un fichier à part de SpecimenListPage : un module qui exporte un
// composant ET des fonctions casse le Fast Refresh de Vite (react-refresh).

import { Badge } from './ui';
import { taxoLabel } from '../utils/taxoLabel';

const SEXE_TONE = { M: 'info', F: 'danger', inconnu: 'default' };

/**
 * Colonnes partagées par toutes les listes de spécimens, rendues sous forme
 * d'objet plutôt que de tableau : chaque page compose SON ordre et y insère ses
 * colonnes propres où il faut, sans qu'on ait à inventer une API de position.
 *
 * @param {Function} t la fonction de `useT()`
 */
export function colonnesSpecimen(t) {
  const SEXE_LABEL = { M: t('sexe.M'), F: t('sexe.F'), inconnu: t('sexe.inconnu') };

  return {
    idTerrain: {
      key: 'idTerrain',
      label: t('specimenList.colIdTerrain'),
      sortable: true,
      skeletonWidth: '55%',
      width: '110px',
      render: (r) => r.idTerrain
        ? <Badge tone="primary" size="sm" className="font-mono font-bold">{r.idTerrain}</Badge>
        : null,
    },
    id: {
      key: 'id',
      label: t('specimenList.colId'),
      skeletonWidth: '40%',
      width: '64px',
      hidden: 'hidden sm:table-cell',
      className: 'font-mono text-xs text-fg-subtle',
      render: (r) => `#${r.id}`,
    },
    espece: {
      key: 'espece',
      label: t('specimenList.colEspece'),
      skeletonWidth: '80%',
      render: (r) => (
        <span className="font-semibold text-fg italic">
          {taxoLabel(r.taxonomie) || null}
        </span>
      ),
    },
    nombre: {
      key: 'nombre',
      label: t('specimenList.colNb'),
      sortable: true,
      skeletonWidth: '30%',
      width: '52px',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (r) => <span className="text-fg-muted font-medium tabular-nums">{r.nombre}</span>,
    },
    sexe: {
      key: 'sexe',
      label: t('specimenList.colSexe'),
      skeletonWidth: '45%',
      render: (r) => (
        <Badge tone={SEXE_TONE[r.sexe] ?? 'default'}>
          {SEXE_LABEL[r.sexe] ?? t('sexe.inconnu')}
        </Badge>
      ),
    },
    stade: {
      key: 'stade',
      label: t('specimenList.colStade'),
      skeletonWidth: '50%',
      hidden: 'hidden lg:table-cell',
      render: (r) => <span className="text-fg-muted text-xs">{r.stade || null}</span>,
    },
    localite: {
      key: 'localite',
      label: t('specimenList.colLocalite'),
      skeletonWidth: '75%',
      hidden: 'hidden md:table-cell',
      render: (r) => (
        <span className="text-fg-muted text-xs max-w-[7rem] truncate block">
          {r.methode?.localite?.nom || null}
        </span>
      ),
    },
    dateCollecte: {
      key: 'dateCollecte',
      label: t('specimenList.colDate'),
      sortable: true,
      skeletonWidth: '60%',
      className: 'whitespace-nowrap',
      render: (r) => (
        <span className="text-fg-subtle text-xs">
          {r.dateCollecte ? new Date(r.dateCollecte).toLocaleDateString(t('common.locale')) : null}
        </span>
      ),
    },
  };
}
