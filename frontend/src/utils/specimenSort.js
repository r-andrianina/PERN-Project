// Tri des lignes de spécimens sur les colonnes communes aux quatre types.
//
// Cette fonction était recopiée à l'identique dans MoustiquesPage, TiquesPage
// et PucesPage (21 lignes, au caractère près). Une règle de tri corrigée dans
// l'une serait restée fausse dans les deux autres, sans que rien ne le signale.

/**
 * Trie une liste de spécimens sans muter le tableau d'origine.
 *
 * @param {Array}  rows   lignes à trier
 * @param {object} sort   { key, dir } — `null` renvoie `rows` tel quel
 * @param {string} locale pour la comparaison de chaînes (accents, casse)
 * @returns {Array} nouvelle liste triée
 */
export function sortRows(rows, sort, locale) {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    let av, bv;
    switch (sort.key) {
      case 'idTerrain':    av = a.idTerrain;    bv = b.idTerrain;    break;
      case 'nombre':       av = a.nombre;       bv = b.nombre;       break;
      case 'sexe':         av = a.sexe;         bv = b.sexe;         break;
      case 'dateCollecte':
        av = a.dateCollecte ? new Date(a.dateCollecte).getTime() : null;
        bv = b.dateCollecte ? new Date(b.dateCollecte).getTime() : null;
        break;
      default: return 0;
    }
    // Les valeurs absentes vont toujours en fin de liste, quel que soit le sens
    // du tri : une colonne vide n'est pas « la plus petite », elle est inconnue.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), locale);
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}
