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

/**
 * Vrai si `court` désigne probablement la même personne que `long`, écrite
 * plus complètement : tous les mots du nom court figurent dans le long, qui en
 * compte davantage — « Henintsoa Andrianina » ⊂ « RAZANAKOTO Henintsoa
 * Andrianina ». C'est le cas typique d'une fiche reprise d'un compte
 * utilisateur, puis retrouvée dans l'annuaire avec le nom de famille.
 *
 * La comparaison se fait mot à mot, jamais par sous-chaîne : « Henintsoa »
 * ne se retrouve pas dans « Henintsoanirina ». Un nom d'un seul mot n'est
 * jamais rapproché, il est trop pauvre pour identifier quelqu'un.
 */
const nomInclus = (court, long) => {
  const motsCourts = cleNom(court).split(' ').filter(Boolean);
  const motsLongs = new Set(cleNom(long).split(' ').filter(Boolean));
  return motsCourts.length >= 2
    && motsCourts.length < motsLongs.size
    && motsCourts.every((m) => motsLongs.has(m));
};

module.exports = { nettoyerNom, cleNom, nomInclus };
