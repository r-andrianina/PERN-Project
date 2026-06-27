// Renvoie le libellé lisible d'un nœud taxonomique chargé avec son parent.
// Miroir frontend de libelleTaxonomie() (backend/src/utils/taxonomyResolve.js).
//
// espece     → "Genre espece"       (ex: "Anopheles gambiae")
// sous_espece → "Genre espece sous"
// genre/autre → "Genre"             (ex: "Anopheles", PAS "Anophelinae Anopheles")
export function taxoLabel(t) {
  if (!t) return '';
  if (t.niveau === 'espece') {
    return `${t.parent?.nom ?? ''} ${t.nom}`.trim();
  }
  if (t.niveau === 'sous_espece') {
    return `${t.parent?.parent?.nom ?? ''} ${t.parent?.nom ?? ''} ${t.nom}`.trim();
  }
  return t.nom;
}
