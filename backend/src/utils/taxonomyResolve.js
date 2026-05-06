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
      niveau:   'espece',
      parentId: genreNode.id,
      nom:      { equals: espece.trim(), mode: 'insensitive' },
      actif:    true,
    },
  });
  return especeNode ? especeNode.id : genreNode.id;
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

module.exports = { resolveSpecimenTaxonomyId, libelleTaxonomie };
