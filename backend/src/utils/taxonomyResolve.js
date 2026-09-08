// backend/src/utils/taxonomyResolve.js
// Résout un couple (genre, espece) — texte libre Excel — vers un id de TaxonomieSpecimen.

const prisma = require('../config/prisma');

/**
 * Résout un nœud "espece" (ou "genre" si espèce manque) à partir du couple texte (genre, espece).
 * @param {object} params
 * @param {'moustique'|'tique'|'puce'} params.type
 * @param {string} params.genre
 * @param {string} [params.espece]
 * @returns {Promise<number|null>}  id du TaxonomieSpecimen, ou null si introuvable
 */
async function resolveSpecimenTaxonomyId({ type, genre, espece }) {
  if (!genre) return null;
  const genreNode = await prisma.taxonomieSpecimen.findFirst({
    where: {
      niveau: 'genre',
      type,
      nom:    { equals: genre.trim(), mode: 'insensitive' },
      actif:  true,
    },
  });
  if (!genreNode) return null;
  if (!espece) return genreNode.id;

  const especeNode = await prisma.taxonomieSpecimen.findFirst({
    where: {
      niveau: 'espece',
      nom:    { equals: espece.trim(), mode: 'insensitive' },
      actif:  true,
      // Le parent direct d'une espèce est soit le genre, soit un sous-genre
      // intermédiaire (ex: Anopheles (Cellia) coustani) — un simple
      // parentId: genreNode.id rate toute espèce rattachée via un sous-genre.
      OR: [
        { parentId: genreNode.id },
        { parent: { niveau: 'sous_genre', parentId: genreNode.id } },
      ],
    },
  });
  return especeNode ? especeNode.id : genreNode.id;
}

/**
 * Variante mise en cache de resolveSpecimenTaxonomyId, pour les boucles
 * d'import ligne par ligne (imports mono-méthode moustiques/tiques/puces) —
 * une mission compte typiquement quelques dizaines d'espèces distinctes pour
 * des centaines de lignes ; sans cache, chaque ligne relance 1-2 requêtes
 * `findFirst` redondantes. Le cache est scopé à l'appelant (un `Map` par
 * import, jamais partagé entre requêtes) et mémorise aussi les échecs
 * (id introuvable) pour éviter de re-tenter la même résolution négative.
 * @param {Map<string, number|null>} cache
 * @param {object} params  mêmes paramètres que resolveSpecimenTaxonomyId
 * @returns {Promise<number|null>}
 */
async function resolveSpecimenTaxonomyIdCached(cache, params) {
  const key = `${params.type}|${(params.genre || '').trim().toLowerCase()}|${(params.espece || '').trim().toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  const id = await resolveSpecimenTaxonomyId(params);
  cache.set(key, id);
  return id;
}

/**
 * Include Prisma à utiliser partout où une taxonomie doit être AFFICHÉE.
 *
 * 3 niveaux de parent, car la chaîne la plus longue est
 * `sous_espece → espece → sous_genre → genre` : avec seulement 2 niveaux, le
 * genre n'est pas chargé et decomposeTaxon ne peut pas le retrouver.
 */
const TAXONOMIE_INCLUDE = {
  include: { parent: { include: { parent: { include: { parent: true } } } } },
};

/**
 * Décompose une taxonomie chargée en { genre, espece }.
 *
 * SOURCE UNIQUE de la présentation taxonomique côté backend (miroir exact de
 * frontend/src/utils/taxoLabel.js).
 *
 * Le genre est retrouvé en REMONTANT la chaîne des parents, et non en supposant
 * que le parent direct est le genre : 412 des 475 moustiques ont une espèce
 * rattachée à un sous-genre (`Aedes (Acartomyia) mariae`). L'ancienne version
 * retombait sur `taxo.nom` et perdait le genre ("mariae") ; le miroir frontend,
 * lui, prenait le sous-genre pour le genre et affichait un nom faux mais
 * plausible ("Acartomyia mariae").
 *
 * Le sous-genre n'est volontairement PAS restitué (choix utilisateur du
 * 2026-09-01) : on veut "Aedes mariae", pas "Aedes (Acartomyia) mariae".
 *
 * @returns {{ genre: string|null, espece: string|null }}
 */
function decomposeTaxon(taxo) {
  if (!taxo) return { genre: null, espece: null };

  let genre = null;
  for (let n = taxo; n; n = n.parent) {
    if (n.niveau === 'genre') { genre = n.nom; break; }
  }

  let espece = null;
  if (taxo.niveau === 'espece') {
    espece = taxo.nom;
  } else if (taxo.niveau === 'sous_espece') {
    // Pas de 3e colonne : l'épithète sous-spécifique est accolée à l'espèce.
    espece = [taxo.parent?.nom, taxo.nom].filter(Boolean).join(' ');
  }

  // Identification arrêtée au-dessus du genre (famille, ordre…) : faute de
  // colonne dédiée, on expose le taxon le plus précis disponible plutôt que de
  // laisser la ligne vide. Le rang reste lisible au nom lui-même (Culicidae).
  if (!genre && !espece) genre = taxo.nom;

  return { genre, espece };
}

/**
 * Libellé lisible "Genre espèce" à partir d'une taxonomie chargée.
 * Dérivé de decomposeTaxon pour que libellé et colonnes ne divergent jamais.
 */
function libelleTaxonomie(taxo) {
  if (!taxo) return null;
  const { genre, espece } = decomposeTaxon(taxo);
  return [genre, espece].filter(Boolean).join(' ') || null;
}

module.exports = {
  resolveSpecimenTaxonomyId, resolveSpecimenTaxonomyIdCached,
  libelleTaxonomie, decomposeTaxon, TAXONOMIE_INCLUDE,
};
