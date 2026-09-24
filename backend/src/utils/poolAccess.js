// backend/src/utils/poolAccess.js
// Cloisonnement par projet appliqué aux POOLS.
//
// Un pool n'a pas de projet à lui : il le tient de ses membres, et un membre
// est une référence POLYMORPHE (`specimenType` + `specimenId`), pas une
// relation Prisma. Impossible, donc, d'écrire le filtre en un `where`
// imbriqué comme pour les autres ressources — il faut résoudre la chaîne
// spécimen → méthode → localité → mission → projet à la main.
//
// La règle est FAIL-CLOSED : un pool n'est accessible que si TOUS ses membres
// appartiennent à des projets accessibles. Un seul membre hors périmètre — ou
// introuvable — et le pool entier devient invisible. C'est volontaire : un
// pool mélangeant deux projets laisserait autrement fuiter l'existence du
// second. Rien n'interdit ce mélange en base aujourd'hui ; c'est une limite
// connue du modèle, pas un oubli.
//
// Ce module existe pour qu'il n'y ait qu'UNE implémentation de cette règle.
// Elle vivait dans `labo.controller.js`, qui la faisait respecter aux
// manipulations pendant que `pools.service.js` servait les mêmes pools sans
// aucun contrôle (corrigé le 2026-09-24).

const prisma   = require('../config/prisma');
const AppError = require('./AppError');
const { getAccessibleProjetIds, canBypass } = require('./access');

// specimenType (enum TypeSpecimenTaxon) → modèle Prisma correspondant.
const SPECIMEN_MODELS = {
  moustique: 'moustique',
  tique:     'tique',
  puce:      'puce',
  autre:     'autreSpecimen',
};

const cle = (type, id) => `${type}:${id}`;

/**
 * Résout le projetId de chaque membre en UNE requête par type de spécimen
 * (4 au maximum), au lieu d'une requête par membre.
 * @param {{specimenType: string, specimenId: number}[]} membres
 * @returns {Promise<Map<string, number|null>>} "type:id" → projetId, ou null
 *          si le spécimen n'existe pas / n'est rattaché à aucun projet.
 */
const resoudreProjetIds = async (membres) => {
  const parType = new Map();
  for (const m of membres) {
    if (!SPECIMEN_MODELS[m.specimenType]) continue;
    if (!parType.has(m.specimenType)) parType.set(m.specimenType, new Set());
    parType.get(m.specimenType).add(m.specimenId);
  }

  const projetParMembre = new Map();
  for (const [type, ids] of parType) {
    const lignes = await prisma[SPECIMEN_MODELS[type]].findMany({
      where:  { id: { in: [...ids] } },
      select: { id: true, methode: { select: { localite: { select: { mission: { select: { projetId: true } } } } } } },
    });
    for (const l of lignes) {
      projetParMembre.set(cle(type, l.id), l.methode?.localite?.mission?.projetId ?? null);
    }
  }
  return projetParMembre;
};

/**
 * projetId d'un spécimen isolé (cas d'une manipulation rattachée directement
 * à un spécimen, sans pool).
 */
const getSpecimenProjetId = async (specimenType, specimenId) => {
  const resolus = await resoudreProjetIds([{ specimenType, specimenId }]);
  return resolus.get(cle(specimenType, specimenId)) ?? null;
};

/**
 * Applique la règle fail-closed à un pool déjà chargé.
 * @param {{specimenType: string, specimenId: number}[]} membres
 * @param {Map<string, number|null>} projetParMembre  résultat de resoudreProjetIds
 * @param {number[]|null} idsAccessibles  null = bypass (admin/superviseur)
 */
const poolEstAccessible = (membres, projetParMembre, idsAccessibles) => {
  if (idsAccessibles === null) return true;
  // Un pool sans membre n'est rattaché à aucun projet : on refuse plutôt que
  // de le laisser passer par vacuité (`[].every()` vaut true).
  if (!membres || membres.length === 0) return false;
  return membres.every((m) => {
    const projetId = projetParMembre.get(cle(m.specimenType, m.specimenId));
    return projetId !== null && projetId !== undefined && idsAccessibles.includes(projetId);
  });
};

/**
 * Ids des pools accessibles, parmi ceux déjà chargés. Fonction PURE : c'est
 * ici que vit la décision, donc c'est elle que les tests couvrent — le reste
 * du module n'est que du chargement.
 * @param {{id: number, membres: object[]}[]} pools
 */
const filtrerPoolsAccessibles = (pools, projetParMembre, idsAccessibles) =>
  pools
    .filter((p) => poolEstAccessible(p.membres, projetParMembre, idsAccessibles))
    .map((p) => p.id);

/**
 * Membres qu'une résolution n'a pas su rattacher : le spécimen n'existe pas.
 * Fonction pure.
 */
const membresInconnus = (membres, projetParMembre) =>
  membres.filter((m) => !projetParMembre.has(cle(m.specimenType, m.specimenId)));

/**
 * Ids des pools visibles par cet utilisateur. Retourne null pour un
 * utilisateur bypass — l'appelant ne doit alors poser AUCUN filtre.
 * Coût : 1 requête pools + au plus 4 requêtes de résolution, quel que soit
 * le nombre de pools.
 */
const getAccessiblePoolIds = async (user) => {
  if (!user || canBypass(user.role)) return null;
  const idsAccessibles = await getAccessibleProjetIds(user.id, user.role);

  const pools = await prisma.pool.findMany({ select: { id: true, membres: true } });
  const projetParMembre = await resoudreProjetIds(pools.flatMap((p) => p.membres));

  return filtrerPoolsAccessibles(pools, projetParMembre, idsAccessibles);
};

/**
 * Lève AppError.forbidden si le pool sort du périmètre de l'utilisateur.
 * Ne dit rien d'un pool inexistant — c'est à l'appelant de le traiter.
 */
const assertPoolAccessible = async (poolId, user) => {
  if (!user || canBypass(user.role)) return;
  const pool = await prisma.pool.findUnique({ where: { id: poolId }, select: { membres: true } });
  if (!pool) return;
  const idsAccessibles  = await getAccessibleProjetIds(user.id, user.role);
  const projetParMembre = await resoudreProjetIds(pool.membres);
  if (!poolEstAccessible(pool.membres, projetParMembre, idsAccessibles)) {
    throw AppError.forbidden('Accès refusé — hors de votre périmètre projet');
  }
};

/**
 * Contrôle des membres AVANT création d'un pool. Deux vérifications
 * distinctes, dans cet ordre :
 *   1. le spécimen existe — pour tout le monde, bypass compris. `PoolMembre`
 *      ne porte aucune clé étrangère vers les tables de spécimens (référence
 *      polymorphe), donc rien n'empêchait jusqu'ici de constituer un pool
 *      d'identifiants fantômes ; un tel pool serait ensuite invisible à tout
 *      non-bypass, par la règle fail-closed ci-dessus.
 *   2. le spécimen est dans le périmètre — pour les seuls non-bypass.
 */
const assertMembresAccessibles = async (membres, user) => {
  const projetParMembre = await resoudreProjetIds(membres);

  const inconnus = membresInconnus(membres, projetParMembre);
  if (inconnus.length > 0) {
    const liste = inconnus.map((m) => `${m.specimenType} #${m.specimenId}`).join(', ');
    throw AppError.notFound(`Spécimen introuvable : ${liste}`);
  }

  if (!user || canBypass(user.role)) return;
  const idsAccessibles = await getAccessibleProjetIds(user.id, user.role);
  if (!poolEstAccessible(membres, projetParMembre, idsAccessibles)) {
    throw AppError.forbidden('Accès refusé — un spécimen au moins est hors de votre périmètre projet');
  }
};

module.exports = {
  SPECIMEN_MODELS,
  // Pures — la règle d'accès elle-même, testée sans base.
  poolEstAccessible,
  filtrerPoolsAccessibles,
  membresInconnus,
  // Avec accès base.
  resoudreProjetIds,
  getSpecimenProjetId,
  getAccessiblePoolIds,
  assertPoolAccessible,
  assertMembresAccessibles,
};
