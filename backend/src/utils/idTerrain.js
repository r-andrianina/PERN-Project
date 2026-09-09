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
  const [m, t, p, a] = await Promise.all([
    prisma.moustique.findMany     ({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
    prisma.tique.findMany         ({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
    prisma.puce.findMany          ({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
    prisma.autreSpecimen.findMany ({ where: { methodeId: { in: ids } }, select: { idTerrain: true } }),
  ]);

  const re = new RegExp(`^${code}_(\\d+)$`);
  const maxN = [...m, ...t, ...p, ...a]
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
 * Vérifie qu'un idTerrain est libre DANS SA LOCALITÉ, sur les 4 tables de
 * spécimens (le compteur `<CODE_LOCALITE>_<n>` est partagé entre les types).
 *
 * Le périmètre est la localité et non la base entière (changé le 2026-09-09,
 * migration `20260909070000_specimen_id_terrain_unique_par_localite`) : le
 * terrain repart à 1 à chaque mission, et une Localite appartient à une
 * Mission. Vérifier globalement rejetait la 2e mission sur un même lieu alors
 * que ses tubes portaient des étiquettes parfaitement légitimes.
 *
 * @param {string|null} value
 * @param {number} localiteId  périmètre d'unicité
 * @param {string|null} ignoreType  modèle à exclure (cas d'une mise à jour)
 * @param {number|null} ignoreId
 */
async function isIdTerrainUnique(value, localiteId, ignoreType = null, ignoreId = null) {
  if (!value) return true;
  const where = { idTerrain: value, localiteId };
  const [m, t, p, a] = await Promise.all([
    prisma.moustique.findFirst    ({ where: ignoreType === 'moustique'    ? { ...where, NOT: { id: ignoreId } } : where }),
    prisma.tique.findFirst        ({ where: ignoreType === 'tique'        ? { ...where, NOT: { id: ignoreId } } : where }),
    prisma.puce.findFirst         ({ where: ignoreType === 'puce'         ? { ...where, NOT: { id: ignoreId } } : where }),
    prisma.autreSpecimen.findFirst({ where: ignoreType === 'autreSpecimen'? { ...where, NOT: { id: ignoreId } } : where }),
  ]);
  return !m && !t && !p && !a;
}

/**
 * Génère un idTerrain pour un hôte : HOTE_<AAAAMM>_<n>.
 * AAAAMM vient de la date de pose (datePose) de la méthode de collecte liée
 * (date de terrain réelle), ou de la date du jour si elle n'est pas
 * renseignée. Compteur global par mois, indépendant de la localité —
 * contrairement aux spécimens, un hôte n'est pas rattaché au code de site.
 */
async function generateHoteId(methodeId) {
  const methode = await prisma.methodeCollecte.findUnique({
    where: { id: parseInt(methodeId) },
    select: { datePose: true },
  });
  const ref = methode?.datePose ? new Date(methode.datePose) : new Date();
  const key = `${ref.getFullYear()}${String(ref.getMonth() + 1).padStart(2, '0')}`;

  const existing = await prisma.hote.findMany({
    where: { idTerrain: { startsWith: `HOTE_${key}_` } },
    select: { idTerrain: true },
  });
  const re = new RegExp(`^HOTE_${key}_(\\d+)$`);
  const maxN = existing
    .map((h) => h.idTerrain)
    .filter(Boolean)
    .map((id) => { const m = id.match(re); return m ? parseInt(m[1]) : 0; })
    .reduce((a, b) => Math.max(a, b), 0);

  return `HOTE_${key}_${maxN + 1}`;
}

module.exports = { generateIdTerrain, generateMany, isIdTerrainUnique, getLocaliteByMethode, generateHoteId };
