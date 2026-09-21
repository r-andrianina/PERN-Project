// Date qui identifie une méthode de collecte à l'écran.
//
// Depuis le modèle « une méthode = une nuit-piège » (migration du 2026-09-16),
// une méthode porte DEUX dates : `datePose`, le soir où le piège est installé,
// et `dateReleve`, le matin où il est relevé. Elles diffèrent d'un jour.
//
// Celle qui identifie la nuit auprès d'un utilisateur est le RELEVÉ :
//   • c'est la valeur que reçoit `specimen.dateCollecte`, dérivée du relevé ;
//   • c'est celle que la carte affiche sur chaque point ;
//   • c'est le matin où l'on ramasse effectivement les spécimens.
//
// Trois écrans affichaient pourtant la date de POSE — la liste déroulante de
// sélection de méthode, et les listes de méthodes des deux écrans de mission.
// Sur le formulaire de création d'un spécimen, on choisissait donc une méthode
// étiquetée « 21/02/2026 » et le champ de date de collecte, juste en dessous,
// affichait « 22/02/2026 » : deux dates pour la même méthode, sur le même
// écran. Incohérence introduite par la migration et corrigée le 2026-09-21.
//
// Ce module existe pour qu'il n'y ait qu'UN endroit où cette règle est écrite.
// La leçon vient du libellé taxonomique : une copie locale de la même règle
// avait divergé et affichait le sous-genre à la place du genre pendant des
// mois (cf. taxonomyResolve.js et le correctif 5d10d9b).

/**
 * Date de la nuit-piège, sous forme d'objet Date, ou null.
 *
 * Repli sur `datePose` pour les rares méthodes sans relevé renseigné : mieux
 * vaut une date approchée qu'aucune date.
 */
export function dateNuitPiege(methode) {
  const brute = methode?.dateReleve ?? methode?.datePose;
  return brute ? new Date(brute) : null;
}

/** La même, formatée dans la langue courante, ou null. */
export function dateNuitPiegeFormatee(methode, locale) {
  const d = dateNuitPiege(methode);
  return d ? d.toLocaleDateString(locale) : null;
}

/**
 * Libellé complet d'une méthode pour une liste déroulante :
 *   « [CDC] CDC_LIGHT_TRAP — 22/02/2026 »
 *
 * @param {object}   methode
 * @param {string}   locale   ex. 'fr-FR'
 * @param {string}   secours  libellé quand le type de méthode est inconnu
 */
export function libelleMethode(methode, locale, secours) {
  const code = methode?.typeMethode?.code ? `[${methode.typeMethode.code}] ` : '';
  const nom  = methode?.typeMethode?.nom || secours;
  const date = dateNuitPiegeFormatee(methode, locale);
  return `${code}${nom}${date ? ` — ${date}` : ''}`;
}
