// backend/src/utils/personnelNom.js
// Identité d'une fiche Personnel : à quel moment deux noms désignent-ils la
// même personne ?
//
// L'annuaire de l'UEM écrit un même nom de plusieurs façons — « MIARINJARA
// Adelaide » et « Adélaide MIARINJARA » sur le même onglet — et l'ordre
// prénom/nom n'y est pas constant. La clé ignore donc la casse, les accents,
// les espaces superflus ET l'ordre des mots. Le prix : deux homonymes vrais
// (même nom, même prénom) ne peuvent pas coexister. Au besoin, on les
// distingue en complétant l'un des noms (second prénom, initiale).

/** Nom tel qu'il sera enregistré : espaces normalisés, rien d'autre. */
const nettoyerNom = (nom) => String(nom ?? '').replace(/\s+/g, ' ').trim();

/** Clé de comparaison — deux noms de même clé désignent la même fiche. */
const cleNom = (nom) =>
  nettoyerNom(nom)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

module.exports = { nettoyerNom, cleNom };
