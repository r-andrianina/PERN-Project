// backend/src/utils/idTerrain.js
// Génération de l'identifiant de terrain : <CODE_LOCALITE>_<n>
// Le compteur est unique par localité, tous types confondus (Moustique + Tique + Puce).

const prisma = require('../config/prisma');

/**
 * Récupère la localité associée à une méthode et son code.
 */
async function getLocaliteByMethode(methodeId) {
  const m = await prisma.methodeCollecte.findUnique({
    where: { id: parseInt(methodeId) },
    include: { localite: true },
  });
  if (!m) throw new Error('Méthode introuvable');
  return m.localite;
}

/**
 * Calcule le prochain numéro pour une localité, en parcourant les 3 types.
 */
async function nextCounter(localiteId, code) {
  // Récupère toutes les méthodes de cette localité
  const methodes = await prisma.methodeCollecte.findMany({
    where: { localiteId },
    select: { id: true },
  });
  if (!methodes.length) return 1;
  const ids = methodes.map((x) => x.id);

  // Récupère tous les idTerrain existants sur cette localité
  const [m, t, p] = await Promise.all([
    prisma.moustique.findMany({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
    prisma.tique.findMany    ({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
    prisma.puce.findMany     ({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
  ]);

  const re = new RegExp(`^${code}_(\\d+)$`);
  const maxN = [...m, ...t, ...p]
    .map((x) => x.idTerrain)
    .filter(Boolean)
    .map((id) => { const mm = id.match(re); return mm ? parseInt(mm[1]) : 0; })
    .reduce((a, b) => Math.max(a, b), 0);

  return maxN + 1;
}

/**
 * Génère un idTerrain pour un nouveau spécimen relié à une méthode.
 * @returns {Promise<string|null>} ex "AKZ_5". Renvoie null si la localité
 *   n'a pas de code (le contrôleur peut alors décider d'autoriser ou refuser).
 */
async function generateIdTerrain(methodeId) {
  const localite = await getLocaliteByMethode(methodeId);
  if (!localite) throw new Error('Localité introuvable');
  if (!localite.code) return null;
  const n = await nextCounter(localite.id, localite.code);
  return `${localite.code}_${n}`;
}

/**
 * Génère plusieurs idTerrain consécutifs pour un import en masse.
 * @returns {Promise<string[]>} ex ["AKZ_5","AKZ_6","AKZ_7"]
 */
async function generateMany(methodeId, count) {
  const localite = await getLocaliteByMethode(methodeId);
  if (!localite || !localite.code) return Array(count).fill(null);
  const start = await nextCounter(localite.id, localite.code);
  return Array.from({ length: count }, (_, i) => `${localite.code}_${start + i}`);
}

/**
 * Vérifie si une chaîne idTerrain est unique sur les 3 tables.
 */
async function isIdTerrainUnique(value, ignoreType = null, ignoreId = null) {
  if (!value) return true;
  const where = { idTerrain: value };
  const [m, t, p] = await Promise.all([
    prisma.moustique.findFirst({ where: ignoreType === 'moustique' ? { ...where, NOT: { id: ignoreId } } : where }),
    prisma.tique.findFirst    ({ where: ignoreType === 'tique'     ? { ...where, NOT: { id: ignoreId } } : where }),
    prisma.puce.findFirst     ({ where: ignoreType === 'puce'      ? { ...where, NOT: { id: ignoreId } } : where }),
  ]);
  return !m && !t && !p;
}

module.exports = { generateIdTerrain, generateMany, isIdTerrainUnique, getLocaliteByMethode };
