import FormField from './FormField';
import { useT } from '../lib/i18n';

/**
 * Date de collecte d'un spécimen.
 *
 * Depuis « une méthode = une nuit-piège » (2026-09-16), cette date DÉCOULE du
 * matin de relevé de la méthode : c'est `specimenFactory` qui l'impose à
 * l'enregistrement. Laisser un champ date libre afficherait donc une valeur que
 * le backend remplacerait en silence — exactement le champ libre qui avait
 * produit 313 spécimens datés autrement que leur méthode, dont 10 avec un an
 * d'écart qu'aucun contrôle n'a vus.
 *
 * Le champ redevient saisissable pour les rares méthodes sans date de relevé,
 * seul cas où le backend retient la valeur transmise.
 */
export default function DateCollecteField({ methode, value, onChange }) {
  const t = useT();
  const nuit = methode?.dateReleve ? String(methode.dateReleve).slice(0, 10) : null;

  return (
    <FormField
      label={t('nouveauSpecimen.dateCollecte')}
      name="dateCollecte"
      type="date"
      value={nuit ?? value}
      onChange={onChange}
      disabled={Boolean(nuit)}
      hint={nuit ? t('nouveauSpecimen.dateDeriveeNuitPiege') : t('nouveauSpecimen.dateSansReleve')}
    />
  );
}
