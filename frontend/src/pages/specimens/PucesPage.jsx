// Liste des puces — coque commune dans SpecimenListPage.
import { useCallback } from 'react';
import SpecimenListPage from '../../components/SpecimenListPage';
import { colonnesSpecimen } from '../../components/colonnesSpecimen';

export default function PucesPage() {
  const colonnes = useCallback((tr) => {
    const c = colonnesSpecimen(tr);
    return [c.idTerrain, c.id, c.espece, c.nombre, c.sexe, c.stade, c.localite, c.dateCollecte];
  }, []);

  return (
    <SpecimenListPage
      type="puce"
      pluriel="puces"
      titreCle="dashboard.puces"
      videCle="pucesPage.noneYet"
      colonnes={colonnes}
      largeurMin="820px"
    />
  );
}
