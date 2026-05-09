// backend/src/controllers/import.controller.js
// Import de spécimens moustiques depuis un fichier Excel au format IPM.
//
// Stratégie (recommandations validées) :
//   - SERIES             → idTerrain conservé tel quel
//   - MISSION_ORDER_NUMBER → mission existante requise
//   - WHAT_3_WORDS        → localité.code (requise dans la mission)
//   - COLLECTION_METHOD   → méthode cherchée par typeMethode.code
//   - BOX_PLATE_ID        → container créé automatiquement si absent
//   - SCIENTIFIC_NAME     → taxonomie résolue par genus+species
//   - Lignes inconnues    → reportées dans errors[], non bloquantes

const ExcelJS  = require('exceljs');
const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, ORGANISM_PART, BLOOD_MEAL,
  normalizeKey, parseScientificName, buildHeaderMap, cellValue,
} = require('../utils/importMappings');

// ── Helpers internes ─────────────────────────────────────────
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const toString = (v) => (v === null || v === undefined ? null : String(v).trim() || null);

/**
 * Résout la solution de conservation par son nom (recherche floue).
 */
async function resolveSolution(rawValue) {
  if (!rawValue) return null;
  const key = normalizeKey(rawValue);
  const nom  = PRESERVATIVE[key];
  if (!nom) return null;
  const sol = await prisma.solutionConservation.findFirst({
    where: { nom: { contains: nom, mode: 'insensitive' }, actif: true },
    select: { id: true },
  });
  return sol?.id ?? null;
}

/**
 * Résout ou crée le container selon BOX_PLATE_ID (ex: P_0079_202603_1).
 */
async function resolveContainer(boxId, missionId, createdById) {
  if (!boxId) return null;
  const existing = await prisma.container.findUnique({
    where: { code: boxId },
    select: { id: true, type: true },
  });
  if (existing) return existing;

  // Détermine le type depuis le préfixe du code
  const type = /^P_/i.test(boxId) ? 'PLAQUE' : 'BOITE';
  const capacity = type === 'PLAQUE' ? 96 : 81;

  return prisma.container.create({
    data: { code: boxId, type, capacity, missionId, createdById },
    select: { id: true, type: true },
  });
}

// ── Contrôleur principal ─────────────────────────────────────
const importMoustiques = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  const ws = wb.worksheets[0];
  if (!ws) return res.status(400).json({ error: 'Fichier Excel vide ou format invalide' });

  // En-têtes
  const hMap = buildHeaderMap(ws.getRow(1));
  const requiredHeaders = ['SERIES', 'MISSION_ORDER_NUMBER', 'SCIENTIFIC_NAME'];
  for (const h of requiredHeaders) {
    if (!hMap[h] && !hMap[h.replace(/ /g, '_')]) {
      return res.status(400).json({
        error: `Colonne obligatoire manquante : "${h}". Vérifiez que le fichier suit le format IPM.`,
      });
    }
  }

  // Cache des résolutions pour éviter les requêtes répétées
  const missionCache   = new Map();
  const localiteCache  = new Map();
  const methodeCache   = new Map();
  const taxoCache      = new Map();
  const containerCache = new Map();

  const results = { total: 0, imported: 0, skipped: 0, errors: [] };
  const userId  = req.user?.id ?? null;

  // ── Parcours des lignes (skip en-tête, ligne 1) ──
  const rows = [];
  ws.eachRow((row, rn) => { if (rn > 1) rows.push({ row, rn }); });

  for (const { row, rn } of rows) {
    results.total++;
    const idTerrain    = toString(cellValue(row, hMap, 'SERIES', 'COLLECTOR_SAMPLE_ID'));
    const ordreMission = toString(cellValue(row, hMap, 'MISSION_ORDER_NUMBER'));

    const addError = (reason) => {
      results.skipped++;
      results.errors.push({ ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, raison: reason });
    };

    // ── 1. Mission ──
    if (!ordreMission) { addError('MISSION_ORDER_NUMBER manquant'); continue; }
    if (!missionCache.has(ordreMission)) {
      const m = await prisma.mission.findUnique({
        where: { ordreMission },
        select: { id: true, dateDebut: true },
      });
      missionCache.set(ordreMission, m);
    }
    const mission = missionCache.get(ordreMission);
    if (!mission) {
      addError(`Mission "${ordreMission}" introuvable — créez-la d'abord dans SpécimenManager`);
      continue;
    }

    // ── 2. Localité (par code 3 lettres) ──
    const code3w = toString(cellValue(row, hMap, 'WHAT_3_WORDS'));
    const locKey = `${mission.id}_${code3w}`;
    if (!localiteCache.has(locKey)) {
      if (!code3w) {
        localiteCache.set(locKey, null);
      } else {
        const loc = await prisma.localite.findFirst({
          where: { missionId: mission.id, code: code3w.toUpperCase() },
          select: { id: true },
        });
        localiteCache.set(locKey, loc);
      }
    }
    const localite = localiteCache.get(locKey);
    if (!localite) {
      addError(`Localité avec code "${code3w}" introuvable dans la mission "${ordreMission}" — créez-la d'abord`);
      continue;
    }

    // ── 3. Méthode de collecte ──
    const rawMethod  = toString(cellValue(row, hMap, 'COLLECTION_METHOD'));
    const methodCode = COLLECTION_METHOD[normalizeKey(rawMethod)] ?? null;
    const dateCol    = toDate(cellValue(row, hMap, 'DATE_OF_COLLECTION'));
    const methKey    = `${localite.id}_${methodCode}_${dateCol?.toISOString().split('T')[0] ?? 'nodate'}`;

    if (!methodeCache.has(methKey)) {
      let m = null;
      if (methodCode) {
        const where = {
          localiteId: localite.id,
          typeMethode: { code: methodCode },
        };
        // Cherche par code méthode + date si dispo, sinon prend le plus récent du même type
        if (dateCol) {
          m = await prisma.methodeCollecte.findFirst({
            where: { ...where, dateCollecte: dateCol },
            select: { id: true },
          });
        }
        if (!m) {
          m = await prisma.methodeCollecte.findFirst({
            where,
            orderBy: { dateCollecte: 'desc' },
            select: { id: true },
          });
        }
      }
      methodeCache.set(methKey, m);
    }
    const methode = methodeCache.get(methKey);
    if (!methode) {
      addError(`Méthode "${methodCode ?? rawMethod}" introuvable dans la localité — créez-la d'abord`);
      continue;
    }

    // ── 4. Taxonomie ──
    const sciName = toString(cellValue(row, hMap, 'SCIENTIFIC_NAME'));
    const { genus, species } = parseScientificName(sciName);
    const taxoKey = `${genus}_${species}`;
    if (!taxoCache.has(taxoKey)) {
      let t = null;
      if (genus && species) {
        // Cherche espèce
        t = await prisma.taxonomieSpecimen.findFirst({
          where: {
            niveau: 'espece',
            nom: { equals: species, mode: 'insensitive' },
            parent: { nom: { equals: genus, mode: 'insensitive' }, niveau: 'genre' },
            actif: true,
          },
          select: { id: true },
        });
      }
      if (!t && genus) {
        // Fallback : genre uniquement
        t = await prisma.taxonomieSpecimen.findFirst({
          where: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' }, actif: true },
          select: { id: true },
        });
      }
      taxoCache.set(taxoKey, t);
    }
    const taxo = taxoCache.get(taxoKey);
    if (!taxo) {
      addError(`Taxonomie "${sciName}" introuvable dans le dictionnaire (genre: ${genus}, espèce: ${species})`);
      continue;
    }

    // ── 5. Container (créé automatiquement si absent) ──
    const boxId    = toString(cellValue(row, hMap, 'BOX_PLATE_ID'));
    const position = toString(cellValue(row, hMap, 'TUBE_OR_WELL_ID'));
    let containerId = null;

    if (boxId) {
      if (!containerCache.has(boxId)) {
        const c = await resolveContainer(boxId, mission.id, userId);
        containerCache.set(boxId, c?.id ?? null);
      }
      containerId = containerCache.get(boxId);
    }

    // Vérification unicité de position dans la plaque (une seule fois par puit)
    if (containerId && position) {
      const occupied = await prisma.moustique.findFirst({
        where: { containerId, position },
        select: { id: true, idTerrain: true },
      });
      if (occupied) {
        addError(`Position "${position}" déjà occupée dans le container "${boxId}" par ${occupied.idTerrain}`);
        continue;
      }
    }

    // ── 6. Vérifier unicité de l'idTerrain ──
    if (idTerrain) {
      const dupl = await prisma.moustique.findUnique({ where: { idTerrain }, select: { id: true } });
      if (dupl) {
        addError(`idTerrain "${idTerrain}" déjà utilisé — ligne ignorée (doublon potentiel)`);
        continue;
      }
    }

    // ── 7. Mapper les autres champs ──
    const rawStade   = normalizeKey(cellValue(row, hMap, 'LIFESTAGE'));
    const rawSexe    = normalizeKey(cellValue(row, hMap, 'SEX'));
    const rawBlood   = normalizeKey(cellValue(row, hMap, 'BLOOD_MEAL'));
    const rawOrgane  = normalizeKey(cellValue(row, hMap, 'ORGANISM_PART'));
    const rawPres    = normalizeKey(cellValue(row, hMap, 'PRESERVATIVE_SOLUTION'));

    const stade        = LIFESTAGE[rawStade]  ?? null;
    const sexe         = SEX[rawSexe]         ?? 'inconnu';
    const repasSang    = BLOOD_MEAL[rawBlood]  ?? false;
    const organePreleve = ORGANISM_PART[rawOrgane] ?? null;
    const solutionId   = await resolveSolution(rawPres);

    const nombre     = parseInt(cellValue(row, hMap, 'NUMBER') ?? 1) || 1;
    const notes      = toString(cellValue(row, hMap, 'REMARKS', 'OTHER_INFORMATIONS', 'MISC_METADATA'));

    // ── 8. Créer le moustique ──
    try {
      await prisma.moustique.create({
        data: {
          idTerrain:     idTerrain,
          methodeId:     methode.id,
          taxonomieId:   taxo.id,
          nombre,
          sexe,
          stade,
          repasSang,
          organePreleve,
          solutionId,
          containerId,
          position,
          dateCollecte:  dateCol,
          notes,
        },
      });
      results.imported++;
    } catch (err) {
      if (err.code === 'P2002') {
        addError(`Doublon de contrainte unique (idTerrain ou position déjà prise)`);
      } else {
        addError(`Erreur base de données : ${err.message}`);
      }
    }
  }

  return res.json({
    message: `Import terminé — ${results.imported} spécimen(s) importé(s), ${results.skipped} ignoré(s)`,
    ...results,
  });
};

module.exports = { importMoustiques };
