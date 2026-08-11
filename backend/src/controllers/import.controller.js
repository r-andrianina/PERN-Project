// backend/src/controllers/import.controller.js
// Import de spécimens moustiques depuis un fichier Excel au format IPM.
//
// Stratégie :
//   - PROJET               → projet trouvé par code/nom ou créé automatiquement
//   - MISSION_ORDER_NUMBER → mission trouvée ou créée automatiquement (rattachée au projet)
//   - WHAT_3_WORDS         → localité cherchée par code, puis par GPS (seuil 2 km), puis créée
//   - COLLECTION_METHOD    → méthode cherchée par typeMethode.code
//   - BOX_PLATE_ID         → container créé automatiquement si absent
//   - SCIENTIFIC_NAME      → taxonomie résolue par genus+species
//   - Lignes inconnues     → reportées dans logs[], non bloquantes

const ExcelJS  = require('exceljs');
const prisma   = require('../config/prisma');
const {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, ORGANISM_PART, BLOOD_MEAL,
  normalizeKey, parseScientificName, buildHeaderMap, cellValue, hasHeader,
} = require('../utils/importMappings');
const { nextAvailablePositions } = require('../utils/container');

// Positions libres d'une plaque (excl. H12 — témoin SOP) à partir d'une liste d'occupées
function freePlaquePositions(occupiedSet) {
  const out = [];
  for (const r of 'ABCDEFGH') {
    for (let c = 1; c <= 12; c++) {
      const p = `${r}${c}`;
      if (p !== 'H12' && !occupiedSet.has(p)) out.push(p);
    }
  }
  return out;
}

// ── Helpers internes ─────────────────────────────────────────
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const toString = (v) => (v === null || v === undefined ? null : String(v).trim() || null);

const toFloat = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

/** Distance Haversine en kilomètres entre deux points GPS. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Seuil GPS pour rattacher un spécimen à une localité existante (2 km)
const GPS_THRESHOLD_KM = 2;

/**
 * Extrait le nom de localité depuis la colonne COLLECTION_LOCATION.
 * "Mahajanga | Boeny | Marovoay | Tsararano" → "Tsararano"
 */
function parseLocationNom(raw) {
  if (!raw) return null;
  const parts = String(raw).split('|').map(p => p.trim()).filter(Boolean);
  return parts[parts.length - 1]?.slice(0, 200) ?? null;
}

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

async function resolveContainer(boxId, missionId, createdById) {
  if (!boxId) return null;
  const existing = await prisma.container.findUnique({
    where: { code: boxId },
    select: { id: true, type: true },
  });
  if (existing) return existing;

  const type     = /^P_/i.test(boxId) ? 'PLAQUE' : 'BOITE';
  const capacity = type === 'PLAQUE' ? 96 : 81;

  return prisma.container.create({
    data: { code: boxId, type, capacity, missionId, createdById },
    select: { id: true, type: true },
  });
}

/**
 * Trouve ou crée un projet à partir du nom extrait de la colonne PROJET.
 */
async function findOrCreateProjet(projetNom, logs) {
  const nomNettoye = (projetNom || 'IMPORT_AUTO').trim().slice(0, 200);
  const code = nomNettoye.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_-]/g, '').slice(0, 50) || 'IMPORT_AUTO';

  let projet = await prisma.projet.findUnique({ where: { code }, select: { id: true, nom: true } });
  if (!projet) {
    projet = await prisma.projet.findFirst({
      where: { nom: { equals: nomNettoye, mode: 'insensitive' } },
      select: { id: true, nom: true },
    });
  }
  if (projet) return { projet, created: false };

  projet = await prisma.projet.create({
    data: { code, nom: nomNettoye },
    select: { id: true, nom: true },
  });
  logs.push({ ligne: 0, idTerrain: null, niveau: 'info', code: 'PROJET_CREE', raison: `Projet "${nomNettoye}" (code: ${code}) créé automatiquement` });
  return { projet, created: true };
}

/**
 * Trouve ou crée une mission pour un ordre de mission donné.
 */
async function findOrCreateMission(ordreMission, projetId, dateDebut, logs) {
  let mission = await prisma.mission.findUnique({
    where: { ordreMission },
    select: { id: true, dateDebut: true },
  });
  if (mission) return { mission, created: false };

  const debut = dateDebut ?? new Date();
  mission = await prisma.mission.create({
    data: { ordreMission, projetId, dateDebut: debut },
    select: { id: true, dateDebut: true },
  });
  logs.push({
    ligne: 0, idTerrain: null, niveau: 'info', code: 'MISSION_CREEE',
    raison: `Mission "${ordreMission}" créée automatiquement (dateDebut: ${debut.toISOString().split('T')[0]})`,
  });
  return { mission, created: true };
}

/**
 * Trouve ou crée une localité.
 *
 * Ordre de résolution :
 *   1. Par code WHAT_3_WORDS dans la même mission
 *   2. Par proximité GPS dans la même mission (seuil GPS_THRESHOLD_KM)
 *   3. Création avec le code, le nom, et les coordonnées disponibles
 *      (si le code est déjà pris dans une autre mission → création sans code)
 */
async function findOrCreateLocalite({ missionId, code3w, lat, lon, nomCandidat, altitudeM, logs, rn, idTerrain }) {
  // 1. Matching par code dans la même mission
  if (code3w) {
    const loc = await prisma.localite.findFirst({
      where: { missionId, code: code3w.toUpperCase() },
      select: { id: true },
    });
    if (loc) return { localite: loc, created: false };
  }

  // 2. Matching par GPS dans la même mission
  if (lat != null && lon != null) {
    const candidates = await prisma.localite.findMany({
      where: { missionId, latitude: { not: null }, longitude: { not: null } },
      select: { id: true, nom: true, latitude: true, longitude: true },
    });
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = haversineKm(lat, lon, c.latitude, c.longitude);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best && bestDist <= GPS_THRESHOLD_KM) {
      logs.push({
        ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'info',
        code: 'LOCALITE_MATCHEE_GPS',
        raison: `Localité "${best.nom}" trouvée par GPS à ${(bestDist * 1000).toFixed(0)} m`,
      });
      return { localite: { id: best.id }, created: false };
    }
  }

  // 3. Création
  const codeToUse = code3w ? code3w.toUpperCase().slice(0, 10) : null;
  const nomToUse  = (nomCandidat || codeToUse || 'Localité import').slice(0, 200);

  let localite;
  try {
    localite = await prisma.localite.create({
      data: { missionId, code: codeToUse, nom: nomToUse, latitude: lat, longitude: lon, altitudeM },
      select: { id: true },
    });
    logs.push({
      ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'info',
      code: 'LOCALITE_CREEE',
      raison: `Localité "${nomToUse}" (code: ${codeToUse ?? 'sans code'}) créée automatiquement`,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      // Le code est déjà utilisé dans une autre mission → créer sans code
      localite = await prisma.localite.create({
        data: { missionId, code: null, nom: nomToUse, latitude: lat, longitude: lon, altitudeM },
        select: { id: true },
      });
      logs.push({
        ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'avertissement',
        code: 'LOCALITE_CREEE_SANS_CODE',
        raison: `Localité "${nomToUse}" créée sans code (code "${codeToUse}" déjà utilisé dans une autre mission)`,
      });
    } else {
      throw err;
    }
  }
  return { localite, created: true };
}

/**
 * Trouve ou crée une MethodeCollecte pour une localité donnée.
 *
 * Le TypeMethodeCollecte (référentiel CDC-LT, MHT…) doit déjà exister en base.
 * La MethodeCollecte (instance localité+date) est créée si absente.
 *
 * Ordre de résolution :
 *   1. Par (localiteId, typeMethodeId, dateCollecte exacte)
 *   2. Par (localiteId, typeMethodeId) — la plus récente
 *   3. Création
 */
async function findOrCreateMethode({ localiteId, methodCode, rawMethod, dateCol, lat, lon, logs, rn, idTerrain }) {
  const logCtx = { ligne: rn, idTerrain: idTerrain || `ligne_${rn}` };

  // ── Résoudre le TypeMethodeCollecte ──
  let typeMethode = null;

  if (methodCode) {
    // Chemin nominal : mapping JS → code exact en base
    typeMethode = await prisma.typeMethodeCollecte.findUnique({
      where: { code: methodCode },
      select: { id: true, nom: true },
    });
  }

  if (!typeMethode && rawMethod) {
    // Fallback : recherche floue sur le nom du référentiel
    typeMethode = await prisma.typeMethodeCollecte.findFirst({
      where: { nom: { contains: rawMethod, mode: 'insensitive' }, actif: true },
      select: { id: true, nom: true },
    });
    if (typeMethode) {
      logs.push({
        ...logCtx, niveau: 'avertissement', code: 'METHODE_MATCHEE_FUZZY',
        raison: `Méthode "${rawMethod}" non mappée — rattachée à "${typeMethode.nom}" par recherche floue`,
      });
    }
  }

  if (!typeMethode) {
    logs.push({
      ...logCtx, niveau: 'erreur', code: 'TYPE_METHODE_INTROUVABLE',
      raison: `Méthode "${rawMethod ?? methodCode}" introuvable dans le référentiel — ajoutez-la dans le dictionnaire`,
    });
    return null;
  }

  // Cherche une méthode existante
  let methode = null;
  if (dateCol) {
    methode = await prisma.methodeCollecte.findFirst({
      where: { localiteId, typeMethodeId: typeMethode.id, dateCollecte: dateCol },
      select: { id: true },
    });
  }
  if (!methode) {
    methode = await prisma.methodeCollecte.findFirst({
      where: { localiteId, typeMethodeId: typeMethode.id },
      orderBy: { dateCollecte: 'desc' },
      select: { id: true },
    });
  }
  if (methode) return { methode, created: false };

  // Créer la méthode de collecte
  methode = await prisma.methodeCollecte.create({
    data: { localiteId, typeMethodeId: typeMethode.id, dateCollecte: dateCol, latitude: lat, longitude: lon },
    select: { id: true },
  });
  const dateLabel = dateCol ? dateCol.toISOString().split('T')[0] : 'sans date';
  logs.push({
    ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'info',
    code: 'METHODE_CREEE',
    raison: `Méthode "${typeMethode.nom}" créée automatiquement (${dateLabel})`,
  });
  return { methode, created: true };
}

// ── Contrôleur principal ─────────────────────────────────────
const importMoustiques = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const startTime = Date.now();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  const ws = wb.worksheets[0];
  if (!ws) return res.status(400).json({ error: 'Fichier Excel vide ou format invalide' });

  const hMap = buildHeaderMap(ws.getRow(1));
  const requiredHeaders = ['SERIES', 'MISSION_ORDER_NUMBER', 'SCIENTIFIC_NAME'];
  for (const h of requiredHeaders) {
    if (!hasHeader(hMap, h)) {
      return res.status(400).json({
        error: `Colonne obligatoire manquante : "${h}". Vérifiez que le fichier suit le format IPM.`,
      });
    }
  }

  // Pré-scan : nom de projet et date de collecte depuis la 1ère ligne de données
  let projetNomCandidat = null;
  let dateDebutCandidat = null;
  ws.eachRow((row, rn) => {
    if (rn > 1 && projetNomCandidat === null) {
      projetNomCandidat = toString(cellValue(row, hMap, 'PROJET')) ?? 'IMPORT_AUTO';
      dateDebutCandidat = toDate(cellValue(row, hMap, 'DATE_OF_COLLECTION'));
    }
  });

  // Logs structurés (tous niveaux)
  const logs  = [];
  const crees = { projets: [], missions: [], localites: [] };

  // Caches pour éviter les requêtes répétées
  const projetCache    = new Map();
  const missionCache   = new Map();
  const localiteCache  = new Map();
  const methodeCache   = new Map();
  const taxoCache      = new Map();
  const containerCache = new Map();

  const counts = { total: 0, imported: 0, skipped: 0 };
  const userId = req.user?.id ?? null;

  const rows = [];
  ws.eachRow((row, rn) => { if (rn > 1) rows.push({ row, rn }); });

  for (const { row, rn } of rows) {
    counts.total++;
    const idTerrain    = toString(cellValue(row, hMap, 'SERIES', 'COLLECTOR_SAMPLE_ID'));
    const ordreMission = toString(cellValue(row, hMap, 'MISSION_ORDER_NUMBER'));

    const addLog = (niveau, code, raison) => {
      if (niveau === 'erreur') counts.skipped++;
      logs.push({ ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau, code, raison });
    };

    // Filet par ligne : toute exception non prévue (helper findOrCreate* qui
    // throw, champ trop long → P2000, coupure DB ponctuelle…) est isolée ici.
    // On journalise la ligne en erreur et on continue, au lieu d'abandonner
    // tout l'import en laissant des projets/missions/localités déjà créés
    // orphelins et un fichier à moitié importé difficile à rejouer.
    try {
    // ── 1. Projet + Mission ──
    if (!ordreMission) { addLog('erreur', 'MISSION_MANQUANTE', 'MISSION_ORDER_NUMBER manquant'); continue; }

    if (!missionCache.has(ordreMission)) {
      const projetNomLigne = toString(cellValue(row, hMap, 'PROJET')) ?? projetNomCandidat ?? 'IMPORT_AUTO';
      const projetCacheKey = projetNomLigne.toUpperCase().replace(/\s+/g, '_');
      const dateColLigne   = toDate(cellValue(row, hMap, 'DATE_OF_COLLECTION')) ?? dateDebutCandidat;

      if (!projetCache.has(projetCacheKey)) {
        const { projet, created } = await findOrCreateProjet(projetNomLigne, logs);
        projetCache.set(projetCacheKey, projet);
        if (created) crees.projets.push({ nom: projet.nom });
      }
      const projet = projetCache.get(projetCacheKey);

      const { mission, created } = await findOrCreateMission(ordreMission, projet.id, dateColLigne, logs);
      missionCache.set(ordreMission, mission);
      if (created) crees.missions.push({ ordreMission });
    }
    const mission = missionCache.get(ordreMission);

    // ── 2. Localité ──
    const code3w     = toString(cellValue(row, hMap, 'WHAT_3_WORDS'));
    const lat        = toFloat(cellValue(row, hMap, 'DECIMAL_LATITUDE'));
    const lon        = toFloat(cellValue(row, hMap, 'DECIMAL_LONGITUDE'));
    const altitudeM  = toFloat(cellValue(row, hMap, 'ELEVATION'));
    const nomLoc     = parseLocationNom(toString(cellValue(row, hMap, 'COLLECTION_LOCATION')));

    // Clé de cache : code si disponible, sinon GPS arrondi
    const locCacheKey = code3w
      ? `${mission.id}_CODE_${code3w.toUpperCase()}`
      : `${mission.id}_GPS_${lat?.toFixed(4) ?? 'x'}_${lon?.toFixed(4) ?? 'x'}`;

    if (!localiteCache.has(locCacheKey)) {
      const { localite, created } = await findOrCreateLocalite({
        missionId: mission.id, code3w, lat, lon,
        nomCandidat: nomLoc, altitudeM,
        logs, rn, idTerrain,
      });
      localiteCache.set(locCacheKey, localite);
      if (created) crees.localites.push({ nom: nomLoc || code3w || 'Localité' });
    }
    const localite = localiteCache.get(locCacheKey);

    if (!localite) {
      addLog('erreur', 'LOCALITE_INTROUVABLE', `Localité code "${code3w}" introuvable et impossible à créer`);
      continue;
    }

    // ── 3. Méthode de collecte ──
    const rawMethod  = toString(cellValue(row, hMap, 'COLLECTION_METHOD'));
    const methodCode = COLLECTION_METHOD[normalizeKey(rawMethod)] ?? null;
    const dateCol    = toDate(cellValue(row, hMap, 'DATE_OF_COLLECTION'));
    const methKey    = `${localite.id}_${methodCode}_${dateCol?.toISOString().split('T')[0] ?? 'nodate'}`;

    if (!methodeCache.has(methKey)) {
      const result = await findOrCreateMethode({
        localiteId: localite.id, methodCode, rawMethod, dateCol,
        lat, lon, logs, rn, idTerrain,
      });
      methodeCache.set(methKey, result?.methode ?? null);
    }
    const methode = methodeCache.get(methKey);
    if (!methode) { counts.skipped++; continue; }

    // ── 4. Taxonomie ──
    const sciName = toString(cellValue(row, hMap, 'SCIENTIFIC_NAME'));
    const { genus, species } = parseScientificName(sciName);
    const taxoKey = `${genus}_${species}`;
    if (!taxoCache.has(taxoKey)) {
      let t = null;
      if (genus && species) {
        t = await prisma.taxonomieSpecimen.findFirst({
          where: {
            niveau: 'espece',
            nom: { equals: species, mode: 'insensitive' },
            parent: { nom: { equals: genus, mode: 'insensitive' }, niveau: 'genre' },
            actif: true,
          },
          select: { id: true, niveau: true },
        });
      }
      if (!t && genus) {
        t = await prisma.taxonomieSpecimen.findFirst({
          where: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' }, actif: true },
          select: { id: true, niveau: true },
        });
      }
      taxoCache.set(taxoKey, t);
      // Avertissement unique par nom scientifique quand on tombe au niveau genre
      if (t?.niveau === 'genre') {
        logs.push({
          ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'avertissement',
          code: 'TAXO_NIVEAU_GENRE',
          raison: `"${sciName}" résolu au genre uniquement — espèce "${species ?? '(absente)'}" introuvable dans le dictionnaire`,
        });
      }
    }
    const taxo = taxoCache.get(taxoKey);
    if (!taxo) {
      addLog('erreur', 'TAXONOMIE_INTROUVABLE', `Taxonomie "${sciName}" introuvable dans le dictionnaire (genre: ${genus}, espèce: ${species})`);
      continue;
    }

    // ── 5. Mapper les champs biologiques ──
    const rawStade  = normalizeKey(cellValue(row, hMap, 'LIFESTAGE'));
    const rawSexe   = normalizeKey(cellValue(row, hMap, 'SEX'));
    const rawBlood  = normalizeKey(cellValue(row, hMap, 'BLOOD_MEAL'));
    const rawOrgane = normalizeKey(cellValue(row, hMap, 'ORGANISM_PART'));
    const rawPres   = normalizeKey(cellValue(row, hMap, 'PRESERVATIVE_SOLUTION'));

    const stade         = LIFESTAGE[rawStade]      ?? null;
    const sexe          = SEX[rawSexe]             ?? 'inconnu';
    const repasSang     = BLOOD_MEAL[rawBlood]     ?? 'NC';
    const organePreleve = ORGANISM_PART[rawOrgane] ?? null;
    const solutionId    = await resolveSolution(rawPres);

    // NUMBER ≤ 0 ou non numérique → 1 : jamais de compte négatif/zéro stocké.
    const rawNombre    = cellValue(row, hMap, 'NUMBER');
    const parsedNombre = parseInt(rawNombre ?? 1);
    const nombre       = Number.isFinite(parsedNombre) && parsedNombre > 0 ? parsedNombre : 1;
    if (rawNombre != null && rawNombre !== '' && parsedNombre !== nombre) {
      addLog('avertissement', 'NOMBRE_INVALIDE', `Valeur NUMBER "${rawNombre}" invalide (≤ 0 ou non numérique) — ramené à 1`);
    }
    const notes  = toString(cellValue(row, hMap, 'REMARKS', 'OTHER_INFORMATIONS', 'MISC_METADATA'));

    // ── 6. Container ──
    const boxId = toString(cellValue(row, hMap, 'BOX_PLATE_ID'));
    let position = toString(cellValue(row, hMap, 'TUBE_OR_WELL_ID'));
    let containerId = null;
    let containerType = null;

    if (boxId) {
      if (!containerCache.has(boxId)) {
        const c = await resolveContainer(boxId, mission.id, userId);
        containerCache.set(boxId, c ?? null);
      }
      const container = containerCache.get(boxId);
      containerId   = container?.id   ?? null;
      containerType = container?.type ?? null;
    }

    // ── 6a. PLAQUE + nombre > 1 → split automatique ──────────────
    if (containerId && containerType === 'PLAQUE' && nombre > 1) {
      // Récupérer les positions déjà occupées pour ce container
      const occupiedRows = await prisma.moustique.findMany({
        where: { containerId, position: { not: null } },
        select: { position: true },
      });
      const occupiedSet   = new Set(occupiedRows.map(r => r.position));
      const freePositions = freePlaquePositions(occupiedSet);

      if (freePositions.length < nombre) {
        addLog('erreur', 'POSITION_INSUFFISANTE',
          `Pas assez de positions libres dans "${boxId}" — ${freePositions.length} libre(s) pour ${nombre} individu(s) demandé(s)`);
        continue;
      }

      const positionsToUse = freePositions.slice(0, nombre);
      let splitOk = 0;

      for (const pos of positionsToUse) {
        const splitId = idTerrain ? `${idTerrain}-${pos}` : null;

        // Vérifier doublon pour l'ID dérivé
        if (splitId) {
          const dupl = await prisma.moustique.findUnique({ where: { idTerrain: splitId }, select: { id: true } });
          if (dupl) {
            logs.push({ ligne: rn, idTerrain: splitId, niveau: 'avertissement',
              code: 'DOUBLON', raison: `"${splitId}" déjà importé — position ${pos} ignorée` });
            continue;
          }
        }

        try {
          await prisma.moustique.create({
            data: {
              idTerrain:    splitId,
              methodeId:    methode.id,
              taxonomieId:  taxo.id,
              nombre:       1,
              sexe, stade, repasSang, organePreleve, solutionId,
              containerId,
              position:     pos,
              dateCollecte: dateCol,
              notes,
            },
          });
          splitOk++;
          // Marquer la position comme occupée pour les lignes suivantes du même fichier
          occupiedSet.add(pos);
        } catch (err) {
          logs.push({ ligne: rn, idTerrain: splitId || `ligne_${rn}-${pos}`, niveau: 'erreur',
            code: 'ERREUR_BDD', raison: `Erreur création individu ${pos} : ${err.message}` });
        }
      }

      counts.imported += splitOk;
      if (splitOk > 0) {
        logs.push({ ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'info',
          code: 'SPLIT_PLAQUE',
          raison: `Split: ${splitOk}/${nombre} individu(s) créé(s) aux positions ${positionsToUse.slice(0, splitOk).join(', ')} dans "${boxId}"` });
      }
      continue; // passer à la ligne suivante
    }
    // ─────────────────────────────────────────────────────────────

    // ── 6b. PLAQUE normale (nombre = 1) ou BOITE ──
    if (containerId) {
      // H12 = témoin négatif SOP sur les plaques
      if (containerType === 'PLAQUE' && position === 'H12') {
        addLog('avertissement', 'TEMOIN_H12',
          `Position H12 réservée au témoin négatif (SOP) — spécimen importé sans position assignée`);
        position = null;
      }

      if (position) {
        const occupied = await prisma.moustique.findFirst({
          where: { containerId, position },
          select: { id: true, idTerrain: true },
        });
        if (occupied) {
          addLog('erreur', 'POSITION_OCCUPEE',
            `Position "${position}" déjà occupée dans "${boxId}" par ${occupied.idTerrain}`);
          continue;
        }
      }
    }

    // ── 7. Unicité idTerrain ──
    if (idTerrain) {
      const dupl = await prisma.moustique.findUnique({ where: { idTerrain }, select: { id: true } });
      if (dupl) {
        addLog('erreur', 'DOUBLON', `idTerrain "${idTerrain}" déjà présent en base — ligne ignorée`);
        continue;
      }
    }

    // ── 8. Créer le moustique ──
    try {
      await prisma.moustique.create({
        data: {
          idTerrain,
          methodeId:    methode.id,
          taxonomieId:  taxo.id,
          nombre,
          sexe,
          stade,
          repasSang,
          organePreleve,
          solutionId,
          containerId,
          position,
          dateCollecte: dateCol,
          notes,
        },
      });
      counts.imported++;
    } catch (err) {
      if (err.code === 'P2002') {
        addLog('erreur', 'DOUBLON', `Doublon de contrainte unique (idTerrain ou position déjà prise)`);
      } else {
        addLog('erreur', 'ERREUR_BDD', `Erreur base de données : ${err.message}`);
      }
    }
    } catch (rowErr) {
      // Filet par ligne ouvert en début de boucle : la ligne est perdue mais
      // l'import continue sur les suivantes.
      addLog('erreur', 'ERREUR_LIGNE', `Erreur inattendue sur la ligne : ${rowErr.message}`);
    }
  }

  // ── Résumé final ──
  const dureeSec = ((Date.now() - startTime) / 1000).toFixed(1);

  const resume = {};
  for (const log of logs) {
    if (log.niveau === 'erreur') {
      resume[log.code] = (resume[log.code] ?? 0) + 1;
    }
  }

  const errors = logs
    .filter(l => l.niveau === 'erreur')
    .map(l => ({ ligne: l.ligne, idTerrain: l.idTerrain, raison: l.raison }));

  return res.json({
    message: `Import terminé — ${counts.imported} spécimen(s) importé(s), ${counts.skipped} ignoré(s) sur ${counts.total}`,
    total:    counts.total,
    imported: counts.imported,
    skipped:  counts.skipped,
    dureeSec,
    resume,
    crees,
    logs,
    errors,
  });
};

// GET /api/v1/import/template/moustiques
// Génère un fichier Excel prêt à remplir avec les colonnes attendues + exemples + notes.
const getTemplateMoustiques = async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator  = 'SpécimenManager — Institut Pasteur Madagascar';
  workbook.created  = new Date();

  const ws = workbook.addWorksheet('Import Moustiques');

  const COLS = [
    { header: 'SERIES',                 key: 'series',   width: 22, note: 'Identifiant terrain unique — ex : MPM-2024-0001'          },
    { header: 'MISSION_ORDER_NUMBER',   key: 'mission',  width: 24, note: 'Numéro d\'ordre de mission — ex : OM-2024-001'             },
    { header: 'PROJET',                 key: 'projet',   width: 20, note: 'Nom ou code projet (optionnel — créé si absent)'           },
    { header: 'WHAT_3_WORDS',           key: 'w3w',      width: 20, note: 'Code localité 3 mots ou code court — ex : ///a.b.c'        },
    { header: 'SCIENTIFIC_NAME',        key: 'taxo',     width: 28, note: 'Genre Espèce — ex : Anopheles gambiae'                     },
    { header: 'COLLECTION_METHOD',      key: 'method',   width: 22, note: 'CDC-LT | BG-SENT | HLC | DRAGGING | GITES | HLC | …'      },
    { header: 'BOX_PLATE_ID',           key: 'box',      width: 18, note: 'Code container (BX_001 = boîte, P_001 = plaque 96 puits)'  },
    { header: 'TUBE_OR_WELL_ID',        key: 'pos',      width: 16, note: 'Position dans le container — ex : T001 ou A1'              },
    { header: 'SEX',                    key: 'sex',      width: 12, note: 'FEMALE | MALE | UNKNOWN'                                   },
    { header: 'LIFESTAGE',              key: 'stage',    width: 14, note: 'ADULT | LARVA | NYMPH | EGG'                               },
    { header: 'BLOOD_MEAL',             key: 'blood',    width: 14, note: 'Y | N | G | Gr | SGr | NC'                                 },
    { header: 'PRESERVATIVE_SOLUTION',  key: 'preserv',  width: 24, note: '95%_ETHANOL | RNALATER | 70%_ETHANOL | DRY | SILICA'      },
    { header: 'DATE_OF_COLLECTION',     key: 'date',     width: 20, note: 'Format YYYY-MM-DD — ex : 2024-03-15'                       },
  ];

  ws.columns = COLS.map(({ header, key, width }) => ({ header, key, width }));

  // ── En-tête coloré vert IPM ───────────────────────────────────
  const headerRow       = ws.getRow(1);
  headerRow.font        = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill        = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
  headerRow.alignment   = { horizontal: 'center', vertical: 'middle' };
  headerRow.height      = 22;

  // ── Lignes d'exemples ─────────────────────────────────────────
  const EXAMPLES = [
    { series: 'MPM-2024-0001', mission: 'OM-2024-001', projet: 'ARBO-MHG',
      w3w: 'LOC-MHG-001', taxo: 'Anopheles gambiae',     method: 'CDC-LT',
      box: 'BX_001', pos: 'T001', sex: 'FEMALE', stage: 'ADULT', blood: 'Y',
      preserv: '95%_ETHANOL', date: '2024-03-15' },
    { series: 'MPM-2024-0002', mission: 'OM-2024-001', projet: 'ARBO-MHG',
      w3w: 'LOC-MHG-001', taxo: 'Culex quinquefasciatus', method: 'BG-SENT',
      box: 'BX_001', pos: 'T002', sex: 'FEMALE', stage: 'ADULT', blood: 'N',
      preserv: 'RNALATER', date: '2024-03-15' },
    { series: 'MPM-2024-0003', mission: 'OM-2024-002', projet: 'ARBO-MHG',
      w3w: 'LOC-ANT-005', taxo: 'Aedes albopictus',       method: 'HLC',
      box: '',     pos: '',     sex: 'MALE',   stage: 'ADULT', blood: 'N',
      preserv: '70%_ETHANOL', date: '2024-03-20' },
  ];

  EXAMPLES.forEach((row, i) => {
    const wsRow = ws.addRow(row);
    wsRow.fill  = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFF0FFF8' : 'FFFFFFFF' },
    };
    wsRow.alignment = { horizontal: 'left' };
  });

  // ── Ligne de notes (grisée) ───────────────────────────────────
  ws.addRow({});
  const noteRow = ws.getRow(5);
  COLS.forEach((col, i) => {
    const cell       = noteRow.getCell(i + 1);
    cell.value       = col.note;
    cell.font        = { italic: true, color: { argb: 'FF888888' }, size: 9 };
    cell.alignment   = { wrapText: true, vertical: 'top' };
    cell.fill        = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
  });
  noteRow.height = 42;

  ws.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="template_import_moustiques.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
};

// ── Validation à sec (aucune écriture en base) ───────────────────
// POST /api/v1/import/moustiques/validate
// Lit le fichier, vérifie chaque ligne, renvoie un rapport sans importer.
const validateMoustiques = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const ws = wb.worksheets[0];
  if (!ws) return res.status(400).json({ error: 'Fichier Excel vide ou format invalide' });

  const hMap = buildHeaderMap(ws.getRow(1));
  for (const h of ['SERIES', 'MISSION_ORDER_NUMBER', 'SCIENTIFIC_NAME']) {
    if (!hasHeader(hMap, h)) {
      return res.status(400).json({
        error: `Colonne obligatoire manquante : "${h}". Vérifiez que le fichier suit le format IPM.`,
      });
    }
  }

  const logs          = [];
  const taxoCache     = new Map();
  const methodeCache  = new Map();
  const seenIds       = new Set();
  const counts        = { total: 0, valid: 0, erreurs: 0, avertissements: 0 };

  const rows = [];
  ws.eachRow((row, rn) => { if (rn > 1) rows.push({ row, rn }); });

  for (const { row, rn } of rows) {
    counts.total++;
    const idTerrain    = toString(cellValue(row, hMap, 'SERIES', 'COLLECTOR_SAMPLE_ID'));
    const ordreMission = toString(cellValue(row, hMap, 'MISSION_ORDER_NUMBER'));
    const sciName      = toString(cellValue(row, hMap, 'SCIENTIFIC_NAME'));
    let rowOk = true;

    const addLog = (niveau, code, raison) => {
      logs.push({ ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau, code, raison });
      if (niveau === 'erreur') { counts.erreurs++; rowOk = false; }
      else if (niveau === 'avertissement') counts.avertissements++;
    };

    // 1. Champs obligatoires
    if (!ordreMission) addLog('erreur', 'MISSION_MANQUANTE', 'MISSION_ORDER_NUMBER manquant');
    if (!sciName)      addLog('erreur', 'TAXONOMIE_INTROUVABLE', 'SCIENTIFIC_NAME manquant');

    // 2. Taxonomie
    if (sciName) {
      const { genus, species } = parseScientificName(sciName);
      const taxoKey = `${genus}_${species}`;
      if (!taxoCache.has(taxoKey)) {
        let t = null;
        if (genus && species) {
          t = await prisma.taxonomieSpecimen.findFirst({
            where: {
              niveau: 'espece',
              nom: { equals: species, mode: 'insensitive' },
              parent: { nom: { equals: genus, mode: 'insensitive' }, niveau: 'genre' },
              actif: true,
            },
            select: { id: true, niveau: true },
          });
        }
        if (!t && genus) {
          t = await prisma.taxonomieSpecimen.findFirst({
            where: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' }, actif: true },
            select: { id: true, niveau: true },
          });
        }
        taxoCache.set(taxoKey, t ?? null);
      }
      const taxo = taxoCache.get(taxoKey);
      if (!taxo) {
        addLog('erreur', 'TAXONOMIE_INTROUVABLE', `"${sciName}" introuvable dans le dictionnaire (genre: ${parseScientificName(sciName).genus}, espèce: ${parseScientificName(sciName).species ?? '—'})`);
      } else if (taxo.niveau === 'genre') {
        addLog('avertissement', 'TAXO_NIVEAU_GENRE', `"${sciName}" résolu au genre uniquement — espèce "${parseScientificName(sciName).species ?? '(absente)'}" introuvable`);
      }
    }

    // 3. Doublon idTerrain (dans le fichier + en base)
    if (idTerrain) {
      if (seenIds.has(idTerrain)) {
        addLog('erreur', 'DOUBLON', `idTerrain "${idTerrain}" apparaît plusieurs fois dans le fichier`);
      } else {
        seenIds.add(idTerrain);
        const dupl = await prisma.moustique.findUnique({ where: { idTerrain }, select: { id: true } });
        if (dupl) addLog('erreur', 'DOUBLON', `idTerrain "${idTerrain}" déjà présent en base de données`);
      }
    }

    // 4. Type méthode (référentiel)
    const rawMethod = toString(cellValue(row, hMap, 'COLLECTION_METHOD'));
    if (rawMethod) {
      const key = normalizeKey(rawMethod);
      if (!methodeCache.has(key)) {
        const methodCode   = COLLECTION_METHOD[key] ?? null;
        let typeMethode    = null;
        if (methodCode) {
          typeMethode = await prisma.typeMethodeCollecte.findUnique({
            where: { code: methodCode }, select: { id: true, nom: true },
          });
        }
        if (!typeMethode) {
          typeMethode = await prisma.typeMethodeCollecte.findFirst({
            where: { nom: { contains: rawMethod, mode: 'insensitive' }, actif: true },
            select: { id: true, nom: true },
          });
          if (typeMethode) methodeCache.set(key, { found: true, fuzzy: true, nom: typeMethode.nom });
          else             methodeCache.set(key, { found: false });
        } else {
          methodeCache.set(key, { found: true, fuzzy: false });
        }
      }
      const mc = methodeCache.get(key);
      if (!mc.found) {
        addLog('erreur', 'TYPE_METHODE_INTROUVABLE', `Méthode "${rawMethod}" introuvable dans le référentiel`);
      } else if (mc.fuzzy) {
        addLog('avertissement', 'METHODE_MATCHEE_FUZZY', `Méthode "${rawMethod}" trouvée par correspondance partielle → "${mc.nom}"`);
      }
    }

    // 5. Container : split PLAQUE ou position occupée
    const boxId    = toString(cellValue(row, hMap, 'BOX_PLATE_ID'));
    const position = toString(cellValue(row, hMap, 'TUBE_OR_WELL_ID'));
    const rawNombre    = cellValue(row, hMap, 'NUMBER');
    const parsedNombre = parseInt(rawNombre ?? 1);
    const nombre       = Number.isFinite(parsedNombre) && parsedNombre > 0 ? parsedNombre : 1;
    if (rawNombre != null && rawNombre !== '' && parsedNombre !== nombre) {
      addLog('avertissement', 'NOMBRE_INVALIDE', `Valeur NUMBER "${rawNombre}" invalide (≤ 0 ou non numérique) — sera ramené à 1`);
    }

    if (boxId) {
      const container = await prisma.container.findUnique({
        where: { code: boxId }, select: { id: true, type: true },
      });

      if (container) {
        // PLAQUE + nombre > 1 → vérifier qu'il y a assez de positions libres
        if (container.type === 'PLAQUE' && nombre > 1) {
          const occupiedRows = await prisma.moustique.findMany({
            where: { containerId: container.id, position: { not: null } },
            select: { position: true },
          });
          const occupiedSet   = new Set(occupiedRows.map(r => r.position));
          const freePositions = freePlaquePositions(occupiedSet);

          if (freePositions.length < nombre) {
            addLog('erreur', 'POSITION_INSUFFISANTE',
              `Pas assez de positions libres dans "${boxId}" — ${freePositions.length} libre(s) pour ${nombre} individu(s) demandé(s)`);
          } else {
            addLog('info', 'SPLIT_PLAQUE',
              `Split prévu : ${nombre} individu(s) → positions ${freePositions.slice(0, nombre).join(', ')} dans "${boxId}"`);
          }
        } else if (position && position !== 'H12') {
          // PLAQUE normale ou BOITE : vérifier position occupée
          const occupied = await prisma.moustique.findFirst({
            where: { containerId: container.id, position }, select: { id: true, idTerrain: true },
          });
          if (occupied) {
            addLog('erreur', 'POSITION_OCCUPEE',
              `Position "${position}" déjà occupée dans "${boxId}" par ${occupied.idTerrain}`);
          }
        }
      }
      // Si container inexistant → sera créé à l'import, pas d'erreur de validation
    }

    if (rowOk) counts.valid++;
  }

  const resume = {};
  for (const log of logs) {
    if (log.niveau === 'erreur') resume[log.code] = (resume[log.code] ?? 0) + 1;
  }

  return res.json({
    total:          counts.total,
    valid:          counts.valid,
    erreurs:        counts.erreurs,
    avertissements: counts.avertissements,
    resume,
    logs,
  });
};

module.exports = { importMoustiques, validateMoustiques, getTemplateMoustiques };
