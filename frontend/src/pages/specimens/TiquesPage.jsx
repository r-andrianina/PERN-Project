// Liste des tiques — coque commune dans SpecimenListPage.
import { useCallback } from 'react';
import { Badge } from '../../components/ui';
import SpecimenListPage from '../../components/SpecimenListPage';
import { colonnesSpecimen } from '../../components/colonnesSpecimen';
import { formatGorgement } from '../../utils/gorgement';

export default function TiquesPage() {
  // Le gorgement est propre aux tiques : il s'intercale après le stade, à la
  // place qu'il occupait avant la mise en commun.
  const colonnes = useCallback((tr) => {
    const c = colonnesSpecimen(tr);
    return [
      c.idTerrain, c.id, c.espece, c.nombre, c.sexe, c.stade,
      {
        key: 'gorge',
        label: tr('specimenList.colGorgee'),
        skeletonWidth: '55%',
        hidden: 'hidden sm:table-cell',
        render: (r) => (
          <Badge tone={['G', 'Gr'].includes(r.gorge) ? 'danger' : 'default'}>
            {formatGorgement(r.gorge)}
          </Badge>
        ),
      },
      c.localite, c.dateCollecte,
    ];
  }, []);

  return (
    <SpecimenListPage
      type="tique"
      pluriel="tiques"
      titreCle="dashboard.tiques"
      videCle="tiquesPage.noneYet"
      colonnes={colonnes}
      largeurMin="880px"
    />
  );
}
