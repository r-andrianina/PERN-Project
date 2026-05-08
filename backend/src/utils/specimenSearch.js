// backend/src/utils/specimenSearch.js
// Construction du `where` Prisma pour la recherche unifiée des spécimens.
// Réutilisé par le contrôleur de recherche et l'export Excel.

const prisma = require('../config/prisma');

/**
 * Renvoie tous les ids descendants d'un nœud de taxonomie spécimens
 * (inclut le nœud lui-même). Permet de filtrer par genre et capter
 * automatiquement toutes ses espèces.
 */
async function resolveSpecimenDescendants(rootId) {
  if (!rootId) return null;
  const root = parseInt(rootId);
  const ids = new Set([root]);
  let frontier = [root];
  while (frontier.length) {
    const children = await prisma.taxonomieSpecimen.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    if (!children.length) break;
    const childIds = children.map((c) => c.id);
    childIds.forEach((id) => ids.add(id));
    frontier = childIds;
  }
  return Array.from(ids);
}

/**
 * Idem pour la taxonomie hôte.
 */
async function resolveHoteDescendants(rootId) {
  if (!rootId) return null;
  const root = parseInt(rootId);
  const ids = new Set([root]);
  let frontier = [root];
  while (frontier.length) {
    const children = await prisma.taxonomieHote.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    if (!children.length) break;
    const childIds = children.map((c) => c.id);
    childIds.forEach((id) => ids.add(id));
    frontier = childIds;
  }
  return Array.from(ids);
}

const asBool = (v) => {
  if (v === true  || v === 'true'  || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return undefined;
};

/**
 * Construit le `where` Prisma pour un type de spécimen donné.
 * Les ids de taxonomie/hote-taxonomie résolus en amont sont passés
 * via descendantTaxonomieIds / descendantHoteIds.
 */
function buildSpecimenWhere({
  type, // 'moustique' | 'tique' | 'puce'
  params,
  descendantTaxonomieIds = null,
  descendantHoteIds      = null,
}) {
  const where = {};

  // Méthode directe
  if (params.methodeId)   where.methodeId   = parseInt(params.methodeId);
  if (params.solutionId)  where.solutionId  = parseInt(params.solutionId);

  // Taxonomie (avec descendants si filtre = nœud non-feuille)
  if (descendantTaxonomieIds?.length) {
    where.taxonomieId = { in: descendantTaxonomieIds };
  } else if (params.taxonomieId) {
    where.taxonomieId = parseInt(params.taxonomieId);
  }

  // Sexe / stade
  if (params.sexe)  where.sexe  = params.sexe;
  if (params.stade) where.stade = { contains: params.stade, mode: 'insensitive' };

  // Spécifiques moustique
  if (type === 'moustique') {
    if (params.parite) where.parite = params.parite;
    const rs = asBool(params.repasSang);
    if (rs !== undefined) where.repasSang = rs;
  }
  // Spécifiques tique
  if (type === 'tique') {
    const g = asBool(params.gorge);
    if (g !== undefined) where.gorge = g;
  }

  // Période sur dateCollecte
  if (params.dateDebut || params.dateFin) {
    where.dateCollecte = {};
    if (params.dateDebut) where.dateCollecte.gte = new Date(params.dateDebut);
    if (params.dateFin)   where.dateCollecte.lte = new Date(params.dateFin);
  }

  // Recherche libre dans les notes
  if (params.search) {
    where.notes = { contains: params.search, mode: 'insensitive' };
  }

  // Cascade Mission → Localité → Méthode (filtres remontants)
  const methodeFilters  = {};
  const localiteFilters = {};
  const missionFilters  = {};

  if (params.localiteId) methodeFilters.localiteId = parseInt(params.localiteId);
  if (params.missionId)  localiteFilters.missionId = parseInt(params.missionId);
  if (params.region)     localiteFilters.region    = { contains: params.region,   mode: 'insensitive' };
  if (params.district)   localiteFilters.district  = { contains: params.district, mode: 'insensitive' };
  if (params.projetId)   missionFilters.projetId   = parseInt(params.projetId);

  if (Object.keys(missionFilters).length)  localiteFilters.mission  = missionFilters;
  if (Object.keys(localiteFilters).length) methodeFilters.localite  = localiteFilters;
  if (Object.keys(methodeFilters).length)  where.methode             = methodeFilters;

  // Hôte (tique/puce uniquement)
  if (type === 'tique' || type === 'puce') {
    const hh = asBool(params.hasHote);
    if (hh === true)  where.hoteId = { not: null };
    if (hh === false) where.hoteId = null;

    if (descendantHoteIds?.length) {
      where.hote = { ...(where.hote || {}), taxonomieHoteId: { in: descendantHoteIds } };
    } else if (params.taxonomieHoteId) {
      where.hote = { ...(where.hote || {}), taxonomieHoteId: parseInt(params.taxonomieHoteId) };
    }
  }

  return where;
}

const includeBase = {
  methode: {
    select: {
      id: true,
      typeMethode: { select: { code: true, nom: true } },
      localite: {
        select: {
          id: true, nom: true, region: true, district: true,
          latitude: true, longitude: true,
          mission: {
            select: {
              id: true, ordreMission: true,
              projet: { select: { id: true, code: true, nom: true } },
            },
          },
        },
      },
    },
  },
  taxonomie: { include: { parent: { include: { parent: true } } } },
  solution:  { select: { id: true, nom: true } },
  container: { select: { id: true, code: true, type: true } },
};

const includeWithHote = {
  ...includeBase,
  hote: { include: { taxonomieHote: { select: { nom: true, niveau: true, nomCommun: true } } } },
};

module.exports = {
  resolveSpecimenDescendants,
  resolveHoteDescendants,
  buildSpecimenWhere,
  includeBase,
  includeWithHote,
};
