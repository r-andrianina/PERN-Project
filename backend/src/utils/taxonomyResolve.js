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
 * Renvoie un libellé "Genre espèce" lisible à partir d'une taxonomie chargée
 * (avec parent inclus si feuille = espece).
 */
function libelleTaxonomie(taxo) {
  if (!taxo) return null;
  if (taxo.niveau === 'espece' && taxo.parent?.niveau === 'genre') {
    return `${taxo.parent.nom} ${taxo.nom}`;
  }
  if (taxo.niveau === 'sous_espece' && taxo.parent?.niveau === 'espece') {
    return `${taxo.parent.parent?.nom ?? ''} ${taxo.parent.nom} ${taxo.nom}`.trim();
  }
  return taxo.nom;
}

module.exports = { resolveSpecimenTaxonomyId, resolveSpecimenTaxonomyIdCached, libelleTaxonomie };
