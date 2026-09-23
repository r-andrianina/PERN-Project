// backend/src/utils/taxonomyType.js
// Classement d'une ligne du dictionnaire taxonomique (Dico_Taxo.xlsx) vers
// l'une des quatre valeurs de l'enum TypeSpecimenTaxon.
//
// Trois familles portent un type dédié parce que l'application leur consacre
// une table et un écran (Moustique, Tique, Puce). Tout le reste du fichier
// tombe dans `autre`, la quatrième valeur — celle que vise déjà
// AutreSpecimen.taxonomieId.
//
// Jusqu'au 2026-09-23, le classement vivait dans scripts/import-taxo.js et
// renvoyait null hors des trois familles ; l'appelant jetait alors la ligne
// sans rien dire. 8 258 des 16 363 lignes du fichier n'ont ainsi jamais
// atteint la base, dont les 1 683 Culicoides (Ceratopogonidae), les 938
// phlébotomes (Psychodidae), les Simuliidae, les Tabanidae et les Reduviidae
// — que des vecteurs. Sorti ici pour être testable sans base de données.

/**
 * @param {string|null} ordre    colonne « ordre » du fichier, déjà nettoyée
 * @param {string|null} famille  colonne « famille », déjà nettoyée
 * @returns {'moustique'|'tique'|'puce'|'autre'}
 */
function detectType(ordre, famille) {
  if (ordre === 'Diptera' && famille === 'Culicidae') return 'moustique';
  if (ordre === 'Ixodida')                            return 'tique';
  if (ordre === 'Siphonaptera')                        return 'puce';
  return 'autre';
}

module.exports = { detectType };
