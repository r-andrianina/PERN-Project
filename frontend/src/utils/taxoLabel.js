// Présentation d'un nœud taxonomique chargé avec ses parents.
// Miroir exact de backend/src/utils/taxonomyResolve.js (decomposeTaxon).
//
// Le genre est retrouvé en REMONTANT la chaîne des parents, jamais en supposant
// que le parent direct est le genre : 412 des 475 moustiques ont une espèce
// rattachée à un sous-genre. L'ancienne version prenait le sous-genre pour le
// genre et affichait un nom faux mais plausible — "Acartomyia mariae" au lieu
// de "Aedes mariae" — sur 179 spécimens.
//
// Le sous-genre n'est volontairement pas restitué (choix utilisateur 2026-09-01).
//
// espece      → { genre: "Aedes",  espece: "mariae" }        → "Aedes mariae"
// sous_espece → { genre: "Aedes",  espece: "mariae xyz" }
// genre       → { genre: "Aedes",  espece: null }            → "Aedes"
// au-dessus   → { genre: "Culicidae", espece: null }         → "Culicidae"

/** Décompose une taxonomie en { genre, espece }. */
export function decomposeTaxon(taxo) {
  if (!taxo) return { genre: null, espece: null };

  let genre = null;
  for (let n = taxo; n; n = n.parent) {
    if (n.niveau === 'genre') { genre = n.nom; break; }
  }

  let espece = null;
  if (taxo.niveau === 'espece') {
    espece = taxo.nom;
  } else if (taxo.niveau === 'sous_espece') {
    espece = [taxo.parent?.nom, taxo.nom].filter(Boolean).join(' ');
  }

  // Identification arrêtée au-dessus du genre (famille, ordre…) : on expose le
  // taxon le plus précis disponible plutôt que de laisser la ligne vide.
  if (!genre && !espece) genre = taxo.nom;

  return { genre, espece };
}

/** Libellé lisible "Genre espèce". Dérivé de decomposeTaxon : jamais divergent. */
export function taxoLabel(t) {
  if (!t) return '';
  const { genre, espece } = decomposeTaxon(t);
  return [genre, espece].filter(Boolean).join(' ');
}
