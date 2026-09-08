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

const crypto   = require('crypto');
const ExcelJS  = require('exceljs');
const prisma   = require('../config/prisma');
const {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, ORGANISM_PART, BLOOD_MEAL, PARITE,
  INTERIEUR_EXTERIEUR,
  normalizeKey, buildHeaderMap, cellValue, hasHeader,
  resolveTaxonInput, buildHeaderReport, parseCatchId, clePiege,
  // Noms de colonnes : jamais de littéral en dur ici, sinon le contrôleur et la
  // table d'alias divergent à nouveau (cf. commentaire de FIELD_COLUMNS).
  FIELD_COLUMNS: COL,
} = require('../utils/importMappings');
const { getAccessibleProjetIds, assertProjetAccessible } = require('../utils/access');
const { logAudit, ACTIONS } = require('../utils/audit');
const { parseTrancheHoraire } = require('../utils/trancheHoraire');
const { nouveauRegistre, enregistrerTube, tubesHorsProtocole } = require('../utils/protocoleTube');
const { lireReperesPieges } = require('../utils/feuilleGps');
const AppError = require('../utils/AppError');

// En-têtes obligatoires. La taxonomie accepte deux formats au choix : le nom
// scientifique complet (SCIENTIFIC_NAME) ou les colonnes structurées
// (GENUS [+ SPECIES]) — exiger strictement le premier rejetait des fichiers
// dont l'information taxonomique était pourtant bien présente.
// Renvoie un message d'erreur, ou null si tout est présent.
function checkRequiredHeaders(hMap) {
  for (const h of [COL.idTerrain[0], COL.ordreMission[0]]) {
    if (!hasHeader(hMap, h)) {
      return `Colonne obligatoire manquante : "${h}". Vérifiez que le fichier suit le format IPM.`;
    }
  }
  if (!hasHeader(hMap, COL.nomScientifique[0]) && !hasHeader(hMap, COL.genre[0])) {
    return 'Colonne taxonomique manquante : il faut soit "SCIENTIFIC_NAME" (Genre espèce), soit "GENUS" (+ "SPECIES" optionnelle).';
  }
  return null;
}

/**
 * Empreinte SHA-256 du fichier déposé.
 *
 * Protège contre le RÉ-IMPORT d'un fichier déjà passé. C'est volontairement
 * découplé de l'unicité de `idTerrain` : une ligne peut légitimement partager
 * son SERIES avec d'autres (un tube reçoit plusieurs lots), alors qu'un fichier
 * entier n'a aucune raison d'être importé deux fois.
 *
 * Un fichier corrigé puis redéposé a une empreinte différente : il passe.
 */
function empreinteFichier(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Cherche un import antérieur du même fichier.
 * S'appuie sur les entrées d'audit `ImportMoustiques`, qui portent déjà le nom
 * du fichier et les compteurs — pas de table ni de migration supplémentaire.
 * @returns {Promise<object|null>} l'entrée d'audit la plus ancienne, ou null
 */
async function importAnterieur(empreinte) {
  const entrees = await prisma.auditLog.findMany({
    where:   { entity: 'ImportMoustiques', newValues: { path: ['empreinte'], equals: empreinte } },
    orderBy: { createdAt: 'asc' },
    take:    1,
    select:  { createdAt: true, newValues: true, user: { select: { nom: true, prenom: true } } },
  });
  return entrees[0] ?? null;
}

/**
 * Compacte une liste de numéros de ligne en plages lisibles.
 * [238,239,240,245,247] → "238-240, 245, 247"
 * Tronqué au-delà de 8 groupes : un rapport doit rester lisible.
 */
function compacterLignes(lignes) {
  const tri = [...new Set(lignes.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  const groupes = [];
  for (const n of tri) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && n === dernier[1] + 1) dernier[1] = n;
    else groupes.push([n, n]);
  }
  const texte = groupes.slice(0, 8).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ');
  return groupes.length > 8 ? `${texte}, +${groupes.length - 8} autres` : texte;
}

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

// cache : un projet compte typiquement 2-5 solutions de conservation
// distinctes pour des centaines de lignes — sans cache, chaque ligne
// relance la même requête `findFirst`.
async function resolveSolution(rawValue, cache) {
  if (!rawValue) return null;
  const key = normalizeKey(rawValue);
  if (cache.has(key)) return cache.get(key);
  const nom = PRESERVATIVE[key];
  if (!nom) { cache.set(key, null); return null; }
  const sol = await prisma.solutionConservation.findFirst({
    where: { nom: { contains: nom, mode: 'insensitive' }, actif: true },
    select: { id: true },
  });
  const id = sol?.id ?? null;
  cache.set(key, id);
  return id;
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
 * Nom nettoyé + code dérivé d'une valeur brute de colonne PROJET.
 * Partagé par l'import et la validation à sec : les deux doivent chercher le
 * projet exactement de la même façon, sinon l'aperçu et l'import divergent.
 */
function projetIdentite(projetNom) {
  const nom  = (projetNom || 'IMPORT_AUTO').trim().slice(0, 200);
  const code = nom.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_-]/g, '').slice(0, 50) || 'IMPORT_AUTO';
  return { nom, code };
}

/**
 * Trouve ou crée un projet à partir du nom extrait de la colonne PROJET.
 *
 * Cloisonnement (`accessibleProjetIds` : null = admin/superviseur, sinon liste
 * des projets dont l'utilisateur est membre) :
 *   - projet existant → doit être dans le périmètre de l'utilisateur ;
 *   - projet absent   → seuls les rôles bypass peuvent le créer. Sans cette
 *     règle, n'importe quel technicien fabriquait des projets hors périmètre
 *     en déposant un fichier, et y écrivait des spécimens.
 */
async function findOrCreateProjet(projetNom, logs, accessibleProjetIds) {
  const { nom: nomNettoye, code } = projetIdentite(projetNom);

  let projet = await prisma.projet.findUnique({ where: { code }, select: { id: true, nom: true } });
  if (!projet) {
    projet = await prisma.projet.findFirst({
      where: { nom: { equals: nomNettoye, mode: 'insensitive' } },
      select: { id: true, nom: true },
    });
  }
  if (projet) {
    assertProjetAccessible(projet.id, accessibleProjetIds);
    return { projet, created: false };
  }

  if (accessibleProjetIds !== null) {
    throw AppError.forbidden(
      `Projet "${nomNettoye}" inconnu — création réservée aux superviseurs. Demandez sa création, ou corrigez la colonne PROJET.`,
    );
  }

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
async function findOrCreateMission(ordreMission, projetId, dateDebut, logs, accessibleProjetIds) {
  let mission = await prisma.mission.findUnique({
    where: { ordreMission },
    select: { id: true, dateDebut: true, projetId: true },
  });
  if (mission) {
    // `ordreMission` est unique au niveau global : la mission trouvée peut
    // appartenir à un tout autre projet que celui résolu depuis la colonne
    // PROJET. On revalide donc sur le projet réel de la mission.
    assertProjetAccessible(mission.projetId, accessibleProjetIds);
    return { mission, created: false };
  }

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
 * Le TypeMethodeCollecte (référentiel CDC, BG, PMT…) doit déjà exister en base.
 * La MethodeCollecte (instance localité+date) est créée si absente.
 *
 * Ordre de résolution :
 *   1. Par (localiteId, typeMethodeId, datePose exacte)
 *   2. Par (localiteId, typeMethodeId) — la plus récente
 *   3. Création
 */
/**
 * Date de relevé d'un piège : lendemain de la pose.
 *
 * Les fichiers IPM ne portent qu'une seule date (DATE_OF_COLLECTION), qui vaut
 * date de pose. Le protocole standard étant une exposition d'une nuit, le relevé
 * est déduit à J+1 — sans quoi la durée d'exposition reste inconnue et aucune
 * densité par piège-nuit n'est calculable.
 * Travaille en UTC pour ne pas décaler d'un jour selon le fuseau du serveur.
 */
function dateReleveParDefaut(datePose) {
  if (!datePose) return null;
  const d = new Date(datePose);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function findOrCreateMethode({ localiteId, methodCode, rawMethod, dateCol, interieurExterieur, numero, repere, lat, lon, logs, rn, idTerrain }) {
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
  // NB : la colonne "dateCollecte" a été remplacée par "datePose"/"dateReleve"
  // (migration 20260723000000_methode_pose_releve) — on ne connaît que la date
  // de collecte du fichier IPM, mappée sur datePose (dateReleve reste vide).
  // L'identité d'un piège est (type, numéro, position) : trois CDC posés sur la
  // même localité la même nuit sont trois pièges distincts, à des dizaines de
  // mètres l'un de l'autre. Sans le numéro, ils fusionnaient en une seule
  // méthode et partageaient donc les mêmes coordonnées.
  const identite = {
    localiteId,
    typeMethodeId: typeMethode.id,
    numero:        numero ?? 1,
    interieurExterieur: interieurExterieur ?? null,
  };

  let methode = null;
  if (dateCol) {
    methode = await prisma.methodeCollecte.findFirst({
      where: { ...identite, datePose: dateCol },
      select: { id: true },
    });
  }
  // Repli réservé aux lignes SANS date : on rattache alors au déploiement le
  // plus récent du même piège plutôt que d'en créer un par ligne.
  // Surtout pas quand une date est fournie — un piège posé deux nuits de suite
  // constitue deux déploiements, et les rabattre sur le premier écrasait la
  // seconde nuit (donc la durée d'exposition et la densité qui en découle).
  if (!methode && !dateCol) {
    methode = await prisma.methodeCollecte.findFirst({
      where: identite,
      orderBy: { datePose: 'desc' },
      select: { id: true },
    });
  }
  if (methode) return { methode, created: false };

  // Créer la méthode de collecte
  methode = await prisma.methodeCollecte.create({
    data: {
      ...identite,
      datePose:   dateCol,
      dateReleve: dateReleveParDefaut(dateCol),
      latitude: lat, longitude: lon,
      // Repère de terrain issu de la feuille GPS annexe — il n'existe nulle
      // part ailleurs et c'est lui qui permet de retrouver le piège sur place.
      notes: repere ?? null,
    },
    select: { id: true },
  });
  const dateLabel = dateCol ? dateCol.toISOString().split('T')[0] : 'sans date';
  logs.push({
    ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'info',
    code: 'METHODE_CREEE',
    raison: `Piège "${typeMethode.nom}" n°${identite.numero}`
          + `${identite.interieurExterieur ? ` (${identite.interieurExterieur})` : ''}`
          + ` créé automatiquement (${dateLabel})`,
  });
  return { methode, created: true };
}

// ── Contrôleur principal ─────────────────────────────────────
const importMoustiques = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  // ── Ré-import du même fichier ──
  // Refusé par défaut : réimporter crée des spécimens en double, que rien ne
  // permet ensuite de distinguer des originaux. `?force=true` laisse la main à
  // l'utilisateur pour les cas légitimes (spécimens supprimés entre-temps).
  const empreinte = empreinteFichier(req.file.buffer);
  const force     = req.query?.force === 'true';
  if (!force) {
    const precedent = await importAnterieur(empreinte);
    if (precedent) {
      const q = precedent.newValues ?? {};
      const auteur = precedent.user ? `${precedent.user.prenom} ${precedent.user.nom}` : 'un utilisateur';
      return res.status(409).json({
        error: `Ce fichier a déjà été importé le ${precedent.createdAt.toISOString().slice(0, 10)} par ${auteur}`
             + ` (${q.importes ?? '?'} spécimen(s), mission ${q.ordreMission ?? '?'}).`
             + ' Réimporter créerait des doublons indiscernables.',
        dejaImporte: {
          date:         precedent.createdAt,
          par:          auteur,
          fichier:      q.fichier ?? null,
          importes:     q.importes ?? null,
          ordreMission: q.ordreMission ?? null,
        },
      });
    }
  }

  const startTime = Date.now();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  const ws = wb.worksheets[0];
  if (!ws) return res.status(400).json({ error: 'Fichier Excel vide ou format invalide' });

  const hMap = buildHeaderMap(ws.getRow(1));
  const headerErreur = checkRequiredHeaders(hMap);
  if (headerErreur) return res.status(400).json({ error: headerErreur, colonnes: buildHeaderReport(ws.getRow(1)) });
  const colonnes = buildHeaderReport(ws.getRow(1));

  // Pré-scan : nom de projet et date de collecte depuis la 1ère ligne de données
  let projetNomCandidat = null;
  let dateDebutCandidat = null;
  ws.eachRow((row, rn) => {
    if (rn > 1 && projetNomCandidat === null) {
      projetNomCandidat = toString(cellValue(row, hMap, ...COL.projet)) ?? 'IMPORT_AUTO';
      dateDebutCandidat = toDate(cellValue(row, hMap, ...COL.dateCollecte));
    }
  });

  // Logs structurés (tous niveaux)
  const logs  = [];
  const crees = { projets: [], missions: [], localites: [] };
  // Compte des spécimens réellement créés, par mission — base du journal
  // d'audit émis en fin d'import (une entrée par mission touchée).
  const importParMission = new Map(); // missionId -> { ordreMission, imported }
  const lignesSansDate   = [];        // signalées groupées en fin de parcours
  const registreTubes    = nouveauRegistre();
  // Repères de terrain de la feuille annexe : lus une fois pour tout le fichier.
  const reperesPieges    = lireReperesPieges(wb);
  if (reperesPieges.size) {
    logs.push({
      ligne: 0, idTerrain: null, niveau: 'info', code: 'REPERES_PIEGES',
      raison: `${reperesPieges.size} repère(s) de terrain lus dans la feuille GPS annexe et rattachés aux pièges`,
    });
  }

  // Caches pour éviter les requêtes répétées
  const projetCache    = new Map();
  const missionCache   = new Map();
  const localiteCache  = new Map();
  const methodeCache   = new Map();
  const taxoCache      = new Map();
  const containerCache = new Map();
  const solutionCache  = new Map();
  // positions occupées par container, partagé entre le chemin split-plaque
  // et le chemin normal — sans ça, un container référencé par N lignes
  // relance N fois la même requête `findMany` des positions occupées.
  const positionsCache = new Map();

  const counts = { total: 0, imported: 0, skipped: 0 };
  const userId = req.user?.id ?? null;

  // null pour admin/superviseur (aucun filtre) ; sinon la liste des projets dont
  // l'utilisateur est membre. Résolu une fois pour tout le fichier.
  const accessibleProjetIds = await getAccessibleProjetIds(req.user?.id, req.user?.role);

  const rows = [];
  ws.eachRow((row, rn) => { if (rn > 1) rows.push({ row, rn }); });

  // Pré-charge en une seule requête les idTerrain déjà présents en base parmi
  // ceux du fichier — remplace jusqu'à N requêtes `findUnique` (une par ligne)
  // par 1 seule. Les doublons INTRA-fichier restent détectés normalement par
  // la contrainte unique au moment du `create()` (le Set est mis à jour après
  // chaque insertion réussie, donc capturé sans aller-retour DB superflu).
  const fileIdTerrains = rows
    .map(({ row }) => toString(cellValue(row, hMap, ...COL.idTerrain)))
    .filter(Boolean);
  const existingIdTerrains = new Set(
    fileIdTerrains.length
      ? (await prisma.moustique.findMany({
          where: { idTerrain: { in: fileIdTerrains } },
          select: { idTerrain: true },
        })).map((r) => r.idTerrain)
      : []
  );

  for (const { row, rn } of rows) {
    counts.total++;
    const idTerrain    = toString(cellValue(row, hMap, ...COL.idTerrain));
    const ordreMission = toString(cellValue(row, hMap, ...COL.ordreMission));

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
      const projetNomLigne = toString(cellValue(row, hMap, ...COL.projet)) ?? projetNomCandidat ?? 'IMPORT_AUTO';
      const projetCacheKey = projetNomLigne.toUpperCase().replace(/\s+/g, '_');
      const dateColLigne   = toDate(cellValue(row, hMap, ...COL.dateCollecte)) ?? dateDebutCandidat;

      if (!projetCache.has(projetCacheKey)) {
        // Un refus d'accès est mis en cache comme un succès : sans ça, un
        // fichier de 1000 lignes sur un projet interdit relançait 1000 fois la
        // même requête pour reproduire le même refus.
        try {
          const { projet, created } = await findOrCreateProjet(projetNomLigne, logs, accessibleProjetIds);
          projetCache.set(projetCacheKey, projet);
          if (created) crees.projets.push({ nom: projet.nom });
        } catch (err) {
          if (err.name === 'AppError' && err.statusCode === 403) {
            projetCache.set(projetCacheKey, { refus: err.message });
          } else {
            throw err;
          }
        }
      }
      const projet = projetCache.get(projetCacheKey);
      if (projet.refus) { addLog('erreur', 'ACCES_REFUSE', projet.refus); continue; }

      const { mission, created } = await findOrCreateMission(ordreMission, projet.id, dateColLigne, logs, accessibleProjetIds);
      missionCache.set(ordreMission, mission);
      if (created) crees.missions.push({ ordreMission });
    }
    const mission = missionCache.get(ordreMission);
    if (!importParMission.has(mission.id)) {
      importParMission.set(mission.id, { ordreMission, imported: 0 });
    }

    // ── 2. Localité ──
    const code3w     = toString(cellValue(row, hMap, ...COL.code3w));
    const lat        = toFloat(cellValue(row, hMap, ...COL.latitude));
    const lon        = toFloat(cellValue(row, hMap, ...COL.longitude));
    const altitudeM  = toFloat(cellValue(row, hMap, ...COL.altitude));
    const nomLoc     = parseLocationNom(toString(cellValue(row, hMap, ...COL.nomLocalite)));

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
    const rawMethod  = toString(cellValue(row, hMap, ...COL.methode));
    const methodCode = COLLECTION_METHOD[normalizeKey(rawMethod)] ?? null;
    const dateCol    = toDate(cellValue(row, hMap, ...COL.dateCollecte));
    const rawIntExt  = normalizeKey(cellValue(row, hMap, ...COL.interieurExterieur));
    const intExt     = INTERIEUR_EXTERIEUR[rawIntExt] ?? null;
    if (rawIntExt && !intExt) {
      addLog('avertissement', 'POSITION_PIEGE_INVALIDE',
        `Valeur OUTDOORS_INDOORS "${rawIntExt}" non reconnue — position du piège laissée vide`);
    }
    // Une date absente n'était signalée nulle part : le spécimen entrait avec
    // dateCollecte = null, la méthode sans date de pose ni de relevé, en
    // silence. Collecté ici, signalé une seule fois en fin de parcours — une
    // colonne entièrement vide produirait sinon un message par ligne.
    if (!dateCol) lignesSansDate.push(rn);
    // ── Identité du piège, depuis CATCH_ID ──
    // CATCH_ID = code + numéro. La position intérieur/extérieur appartient à
    // OUTDOORS_INDOORS et NON à CATCH_ID (règle SOP) ; on tolère les
    // HLC_EXT_1 présents dans les fichiers, mais on le signale.
    const rawCatch = toString(cellValue(row, hMap, ...COL.piege));
    const catchId  = parseCatchId(rawCatch);
    const numero   = catchId.numero ?? 1;

    if (catchId.position) {
      if (intExt && catchId.position !== intExt) {
        addLog('avertissement', 'PIEGE_POSITION_DIVERGENTE',
          `CATCH_ID "${rawCatch}" indique "${catchId.position}" alors que OUTDOORS_INDOORS indique "${intExt}" — c'est OUTDOORS_INDOORS qui fait foi`);
      } else if (!intExt) {
        addLog('avertissement', 'PIEGE_POSITION_DANS_CATCH_ID',
          `CATCH_ID "${rawCatch}" porte la position du piège — elle devrait figurer dans OUTDOORS_INDOORS`);
      }
    }
    // Le code porté par CATCH_ID doit désigner le même type que COLLECTION_METHOD.
    const codeDepuisCatch = catchId.code ? (COLLECTION_METHOD[normalizeKey(catchId.code)] ?? null) : null;
    if (codeDepuisCatch && methodCode && codeDepuisCatch !== methodCode) {
      addLog('avertissement', 'PIEGE_TYPE_DIVERGENT',
        `CATCH_ID "${rawCatch}" désigne le type "${codeDepuisCatch}" alors que COLLECTION_METHOD indique "${methodCode}" — c'est COLLECTION_METHOD qui fait foi`);
    }

    // La position ET le numéro font partie de l'identité du piège : HLC_1
    // intérieur et HLC_1 extérieur sont deux pièges, CDC_1 et CDC_2 aussi.
    const positionPiege = intExt ?? catchId.position ?? null;
    const methKey    = `${localite.id}_${methodCode}_${numero}_${positionPiege ?? 'na'}_${dateCol?.toISOString().split('T')[0] ?? 'nodate'}`;

    if (!methodeCache.has(methKey)) {
      const result = await findOrCreateMethode({
        localiteId: localite.id, methodCode, rawMethod, dateCol,
        interieurExterieur: positionPiege, numero,
        repere: reperesPieges.get(clePiege(rawCatch)) ?? null,
        lat, lon, logs, rn, idTerrain,
      });
      methodeCache.set(methKey, result?.methode ?? null);
    }
    const methode = methodeCache.get(methKey);
    if (!methode) { counts.skipped++; continue; }

    // ── 4. Taxonomie ──
    // Deux formats acceptés : nom scientifique complet, ou colonnes GENUS
    // [+ SPECIES] — cf. resolveTaxonInput pour la règle de priorité.
    const sciName = toString(cellValue(row, hMap, ...COL.nomScientifique));
    const { genus, species, conflit } = resolveTaxonInput({
      genus:          toString(cellValue(row, hMap, ...COL.genre)),
      species:        toString(cellValue(row, hMap, ...COL.espece)),
      scientificName: sciName,
    });
    // Libellé lisible dans les logs, quelle que soit la source utilisée.
    const taxoLabel = sciName || [genus, species].filter(Boolean).join(' ') || '(vide)';
    if (conflit) {
      addLog('avertissement', 'TAXO_SOURCES_DIVERGENTES',
        `Genre divergent entre colonnes : GENUS="${conflit.genreColonne}" vs SCIENTIFIC_NAME="${conflit.genreNomScientifique}" — la colonne GENUS fait foi`);
    }
    const taxoKey = `${genus}_${species}`;
    if (!taxoCache.has(taxoKey)) {
      let t = null;
      if (genus && species) {
        t = await prisma.taxonomieSpecimen.findFirst({
          where: {
            niveau: 'espece',
            nom: { equals: species, mode: 'insensitive' },
            actif: true,
            // Le parent direct d'une espèce est soit le genre, soit un
            // sous-genre intermédiaire (ex: Anopheles (Cellia) coustani) —
            // il faut vérifier les deux, sinon toute espèce rattachée via un
            // sous-genre retombe à tort au niveau genre.
            OR: [
              { parent: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' } } },
              { parent: { niveau: 'sous_genre', parent: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' } } } },
            ],
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
      // Avertissement unique par nom scientifique quand on tombe au niveau genre —
      // mais seulement si une espèce a réellement été saisie et non trouvée
      // (mérite attention). "sp"/"sp." (déjà retiré de `species` par
      // parseScientificName) veut dire "non déterminée sur le terrain" — un
      // résultat normal, pas une erreur : simple ligne info, pas d'avertissement.
      if (t?.niveau === 'genre') {
        if (species) {
          logs.push({
            ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'avertissement',
            code: 'TAXO_NIVEAU_GENRE',
            raison: `"${taxoLabel}" résolu au genre uniquement — espèce "${species}" introuvable dans le dictionnaire`,
          });
        } else {
          logs.push({
            ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau: 'info',
            code: 'TAXO_ESPECE_NON_DETERMINEE',
            raison: `"${taxoLabel}" — espèce non déterminée sur le terrain, rattaché au genre`,
          });
        }
      }
    }
    const taxo = taxoCache.get(taxoKey);
    if (!taxo) {
      addLog('erreur', 'TAXONOMIE_INTROUVABLE', `Taxonomie "${taxoLabel}" introuvable dans le dictionnaire (genre: ${genus ?? '—'}, espèce: ${species ?? '—'})`);
      continue;
    }

    // ── 5. Mapper les champs biologiques ──
    const rawStade  = normalizeKey(cellValue(row, hMap, ...COL.stade));
    const rawSexe   = normalizeKey(cellValue(row, hMap, ...COL.sexe));
    const rawBlood  = normalizeKey(cellValue(row, hMap, ...COL.repasSang));
    const rawOrgane = normalizeKey(cellValue(row, hMap, ...COL.organePreleve));
    const rawPres   = normalizeKey(cellValue(row, hMap, ...COL.solution));

    const rawParite = normalizeKey(cellValue(row, hMap, ...COL.parite));
    // Valeur brute, non normalisée : c'est une heure Excel (objet Date), que
    // normalizeKey détruirait en la passant par String().
    const rawHeure       = cellValue(row, hMap, ...COL.trancheHoraire);
    const trancheHoraire = parseTrancheHoraire(rawHeure);
    if (rawHeure != null && rawHeure !== '' && !trancheHoraire) {
      addLog('avertissement', 'TRANCHE_HORAIRE_INVALIDE',
        `Valeur TIME_OF_COLLECTION "${rawHeure instanceof Date ? rawHeure.toISOString().slice(11, 16) : rawHeure}" hors des créneaux d'une nuit (18h→06h) — créneau laissé vide`);
    }

    const stade         = LIFESTAGE[rawStade]      ?? null;
    const sexe          = SEX[rawSexe]             ?? 'inconnu';
    const repasSang     = BLOOD_MEAL[rawBlood]     ?? 'NC';
    const organePreleve = ORGANISM_PART[rawOrgane] ?? null;
    const solutionId    = await resolveSolution(rawPres, solutionCache);

    // ── Parité ──
    // Une valeur non reconnue est signalée plutôt que silencieusement perdue :
    // c'est un critère de dissection, jamais une saisie approximative.
    const parite = PARITE[rawParite] ?? null;
    if (rawParite && !parite) {
      addLog('avertissement', 'PARITE_INVALIDE',
        `Valeur PARITY "${rawParite}" non reconnue — parité laissée vide (attendu : Nullipare/NP ou Pare/P)`);
    }
    // La parité se lit sur les ovaires : elle n'a pas de sens hors femelle.
    if (parite && sexe !== 'F') {
      addLog('avertissement', 'PARITE_HORS_FEMELLE',
        `Parité "${parite}" renseignée sur un spécimen de sexe "${sexe}" — la parité s'observe sur les ovaires`);
    }

    // NUMBER ≤ 0 ou non numérique → 1 : jamais de compte négatif/zéro stocké.
    const rawNombre    = cellValue(row, hMap, ...COL.nombre);
    const parsedNombre = parseInt(rawNombre ?? 1);
    const nombre       = Number.isFinite(parsedNombre) && parsedNombre > 0 ? parsedNombre : 1;
    if (rawNombre != null && rawNombre !== '' && parsedNombre !== nombre) {
      addLog('avertissement', 'NOMBRE_INVALIDE', `Valeur NUMBER "${rawNombre}" invalide (≤ 0 ou non numérique) — ramené à 1`);
    }
    const notes  = toString(cellValue(row, hMap, ...COL.notes));

    // ── 5c. Protocole tube (avertissement, cf. validateMoustiques) ──
    enregistrerTube(registreTubes, {
      box: toString(cellValue(row, hMap, ...COL.container)),
      tube: toString(cellValue(row, hMap, ...COL.position)),
      estBoite: !/^P_/i.test(toString(cellValue(row, hMap, ...COL.container)) ?? ''),
      individus: nombre, rn,
      dims: {
        espece:   [genus, species].filter(Boolean).join(' ') || null,
        piege:    toString(cellValue(row, hMap, ...COL.piege)),
        sexe:     toString(cellValue(row, hMap, ...COL.sexe)),
        sang:     toString(cellValue(row, hMap, ...COL.repasSang)),
        localite: code3w ?? nomLoc,
        date:     dateCol ? dateCol.toISOString().slice(0, 10) : null,
      },
    });

    // ── 6. Container ──
    const boxId = toString(cellValue(row, hMap, ...COL.container));
    let position = toString(cellValue(row, hMap, ...COL.position));
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
      // positionsCache partagé avec le chemin 6b — un container référencé par
      // plusieurs lignes (split ou non) ne relance qu'une seule fois la
      // requête des positions occupées.
      if (!positionsCache.has(containerId)) {
        const occupiedRows = await prisma.moustique.findMany({
          where: { containerId, position: { not: null } },
          select: { position: true, idTerrain: true },
        });
        positionsCache.set(containerId, new Map(occupiedRows.map((r) => [r.position, r.idTerrain])));
      }
      const occupiedMap   = positionsCache.get(containerId);
      const freePositions = freePlaquePositions(occupiedMap);

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
              sexe, stade, parite, trancheHoraire, repasSang, organePreleve, solutionId,
              containerId,
              position:     pos,
              dateCollecte: dateCol,
              notes,
            },
          });
          splitOk++;
          // Marquer la position comme occupée pour les lignes suivantes du même fichier
          occupiedMap.set(pos, splitId);
        } catch (err) {
          logs.push({ ligne: rn, idTerrain: splitId || `ligne_${rn}-${pos}`, niveau: 'erreur',
            code: 'ERREUR_BDD', raison: `Erreur création individu ${pos} : ${err.message}` });
        }
      }

      counts.imported += splitOk;
      importParMission.get(mission.id).imported += splitOk;
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
        if (!positionsCache.has(containerId)) {
          const occupiedRows = await prisma.moustique.findMany({
            where: { containerId, position: { not: null } },
            select: { position: true, idTerrain: true },
          });
          positionsCache.set(containerId, new Map(occupiedRows.map((r) => [r.position, r.idTerrain])));
        }
        const occupiedMap = positionsCache.get(containerId);
        if (occupiedMap.has(position)) {
          addLog('erreur', 'POSITION_OCCUPEE',
            `Position "${position}" déjà occupée dans "${boxId}" par ${occupiedMap.get(position) ?? '(sans idTerrain)'}`);
          continue;
        }
      }
    }

    // ── 7. Unicité idTerrain ──
    // Vérifié contre le pré-chargement (existingIdTerrains) + les idTerrain
    // déjà insérés plus tôt dans CE fichier (Set mis à jour après chaque
    // création réussie, cf. section 8) — plus de requête ici.
    if (idTerrain) {
      if (existingIdTerrains.has(idTerrain)) {
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
          parite,
          trancheHoraire,
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
      importParMission.get(mission.id).imported++;
      // Tient à jour les caches en mémoire pour les lignes suivantes du même
      // fichier (doublon idTerrain / position occupée détectés sans requête).
      if (idTerrain) existingIdTerrains.add(idTerrain);
      if (containerId && position) positionsCache.get(containerId)?.set(position, idTerrain);
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
      if (rowErr.name === 'AppError' && rowErr.statusCode === 403) {
        // Cloisonnement projet (mission rattachée à un projet hors périmètre) :
        // ce n'est pas un incident technique, on le nomme comme tel.
        addLog('erreur', 'ACCES_REFUSE', rowErr.message);
      } else {
        addLog('erreur', 'ERREUR_LIGNE', `Erreur inattendue sur la ligne : ${rowErr.message}`);
      }
    }
  }

  for (const t of tubesHorsProtocole(registreTubes)) {
    logs.push({
      ligne: t.lignes[0], idTerrain: t.tube, niveau: 'avertissement',
      code: 'TUBE_HORS_PROTOCOLE',
      raison: `${t.raison} Lignes : ${compacterLignes(t.lignes)}.`,
    });
  }

  if (lignesSansDate.length) {
    logs.push({
      ligne: lignesSansDate[0], idTerrain: null, niveau: 'avertissement', code: 'DATE_MANQUANTE',
      raison: `DATE_OF_COLLECTION vide sur ${lignesSansDate.length} ligne(s) (${compacterLignes(lignesSansDate)}) — spécimens enregistrés sans date, pièges sans durée d'exposition`,
    });
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

  // ── Journal d'audit ──
  // Une entrée par mission touchée, et non par spécimen : un import de 1000
  // lignes ne doit pas noyer audit_logs sous 1000 entrées. Rattaché à la mission
  // (entityId) parce que c'est la question à laquelle le journal doit répondre :
  // « qui a importé quoi dans cette mission, et quand ». L'import était jusqu'ici
  // la seule opération d'écriture en masse à ne laisser aucune trace.
  for (const [missionId, info] of importParMission) {
    await logAudit({
      req,
      action:   ACTIONS.CREATE,
      entity:   'ImportMoustiques',
      entityId: missionId,
      newValues: {
        fichier:       req.file?.originalname ?? null,
        // Empreinte du contenu : c'est elle qui bloquera un ré-import.
        empreinte,
        ordreMission:  info.ordreMission,
        importes:      info.imported,
        lignesFichier: counts.total,
        ignorees:      counts.skipped,
        dureeSec:      Number(dureeSec),
        creesAuto: {
          projets:   crees.projets.map(p => p.nom),
          missions:  crees.missions.map(m => m.ordreMission),
          localites: crees.localites.length,
        },
      },
    });
  }

  return res.json({
    message: `Import terminé — ${counts.imported} spécimen(s) importé(s), ${counts.skipped} ignoré(s) sur ${counts.total}`,
    total:    counts.total,
    imported: counts.imported,
    skipped:  counts.skipped,
    dureeSec,
    resume,
    colonnes,
    crees,
    logs,
    errors,
  });
};

// Colonnes du modèle Excel téléchargeable.
//
// Doit rester un sous-ensemble de FIELD_COLUMNS (vérifié par test) : le template
// ne proposait ni GPS, ni NUMBER, ni REMARKS, si bien qu'un utilisateur suivant
// scrupuleusement le modèle fourni ne pouvait PAS transmettre de coordonnées —
// et sans GPS l'appariement de localité par proximité ne s'exécute jamais.
//
// `requis` = colonne exigée par checkRequiredHeaders (la colonne doit exister ;
// la cellule peut rester vide sur une ligne donnée, sauf MISSION_ORDER_NUMBER
// qui est le seul champ obligatoire ligne par ligne).
const TEMPLATE_COLUMNS = [
  // — Rattachement —
  { header: 'SERIES',               key: 'series',  width: 22, requis: true,  note: 'Identifiant terrain unique — ex : MPM-2024-0001' },
  { header: 'MISSION_ORDER_NUMBER', key: 'mission', width: 24, requis: true,  note: 'Ordre de mission — obligatoire sur chaque ligne' },
  { header: 'PROJET',               key: 'projet',  width: 20, requis: false, note: 'Nom ou code projet (créé automatiquement par un superviseur)' },
  // — Localisation —
  { header: 'COLLECTION_LOCATION',  key: 'lieu',    width: 34, requis: false, note: 'Lieu, du plus large au plus fin : Région | District | Commune | Fokontany' },
  { header: 'WHAT_3_WORDS',         key: 'w3w',     width: 20, requis: false, note: 'Code localité 3 mots ou code court — ex : ///a.b.c' },
  { header: 'DECIMAL_LATITUDE',     key: 'lat',     width: 16, requis: false, note: 'Latitude décimale (Sud = négatif) — ex : -18.9137' },
  { header: 'DECIMAL_LONGITUDE',    key: 'lon',     width: 16, requis: false, note: 'Longitude décimale — ex : 47.5361' },
  { header: 'ELEVATION',            key: 'alt',     width: 12, requis: false, note: 'Altitude en mètres — ex : 1250' },
  // — Collecte —
  { header: 'DATE_OF_COLLECTION',   key: 'date',    width: 20, requis: false, note: 'Format YYYY-MM-DD — ex : 2024-03-15' },
  { header: 'COLLECTION_METHOD',    key: 'method',  width: 26, requis: false, note: '' /* rempli depuis le référentiel */ },
  { header: 'OUTDOORS_INDOORS',     key: 'intExt',  width: 18, requis: false, note: 'Position du piège : INDOORS (intérieur) | OUTDOORS (extérieur)' },
  { header: 'TIME_OF_COLLECTION',   key: 'heure',   width: 20, requis: false, note: 'Protocoles horodatés (HLC) : heure de FIN du créneau d\'une heure. 19:00 = créneau 18h–19h. Nuit 18h→06h' },
  // — Taxonomie —
  { header: 'SCIENTIFIC_NAME',      key: 'taxo',    width: 28, requis: true,  note: 'Genre Espèce — ex : Anopheles gambiae. "sp." = espèce non déterminée' },
  // GENUS/SPECIES sont PRIORITAIRES sur SCIENTIFIC_NAME (aucun parsing, donc
  // aucune ambiguïté sur les sous-genres et les suffixes). Elles étaient lues
  // mais absentes du modèle : l'utilisateur ne pouvait pas emprunter la voie
  // que l'import lui-même préfère.
  { header: 'GENUS',                key: 'genre',   width: 18, requis: false, note: 'Genre seul. Prioritaire sur SCIENTIFIC_NAME si les deux sont remplis' },
  { header: 'SPECIES',              key: 'espece',  width: 18, requis: false, note: 'Épithète spécifique seule — ex : gambiae. Laisser vide si non déterminée' },
  // — Biologie —
  { header: 'NUMBER',               key: 'nombre',  width: 10, requis: false, note: 'Effectif (défaut 1). Sur une plaque, > 1 répartit automatiquement 1 individu par puits' },
  { header: 'SEX',                  key: 'sex',     width: 12, requis: false, note: 'FEMALE | MALE | UNKNOWN' },
  { header: 'LIFESTAGE',            key: 'stage',   width: 14, requis: false, note: 'ADULT | LARVA | NYMPH | EGG' },
  { header: 'BLOOD_MEAL',           key: 'blood',   width: 14, requis: false, note: 'N (non gorgé) | G (gorgé) | Gr (gravide) | SGr (semi-gravide) | NC' },
  { header: 'PARITY',               key: 'parite',  width: 14, requis: false, note: 'Femelles uniquement (dissection ovarienne) : Nullipare | Pare. NP/P et les échelles fines (paucipare, multipare → Pare) sont acceptés' },
  { header: 'ORGANISM_PART',        key: 'organe',  width: 16, requis: false, note: 'WHOLE_ORGANISM | HEAD | THORAX | ABDOMEN' },
  // — Conservation —
  { header: 'PRESERVATIVE_SOLUTION', key: 'preserv', width: 24, requis: false, note: '95%_ETHANOL | 70%_ETHANOL | RNALATER | DRY | SILICA | LN2' },
  { header: 'BOX_PLATE_ID',         key: 'box',     width: 18, requis: false, note: 'Code container (BX_001 = boîte 81 tubes, P_001 = plaque 96 puits)' },
  { header: 'TUBE_OR_WELL_ID',      key: 'pos',     width: 16, requis: false, note: 'Position dans le container — ex : T001 ou A1. H12 réservé au témoin SOP' },
  // — Divers —
  { header: 'REMARKS',              key: 'notes',   width: 30, requis: false, note: 'Observations libres' },
];

// GET /api/v1/import/template/moustiques
// Génère un fichier Excel prêt à remplir avec les colonnes attendues + exemples + notes.
const getTemplateMoustiques = async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator  = 'SpécimenManager — Institut Pasteur Madagascar';
  workbook.created  = new Date();

  const ws = workbook.addWorksheet('Import Moustiques');

  // Codes de méthode réellement présents dans le référentiel : la note était
  // codée en dur et avait dérivé (elle proposait "GITES", absent de la base, et
  // répétait "HLC"). La dériver garantit qu'on ne documente que ce qui marche.
  // Repli statique si la base est indisponible : le template reste téléchargeable.
  //
  // Attention : un CODE du référentiel n'est pas forcément une VALEUR D'ENTRÉE
  // valide. L'import traduit la valeur du fichier via COLLECTION_METHOD avant de
  // chercher le code ; "AUTRE-METHODE" est un code réel mais aucune clé n'y mène,
  // donc le documenter enverrait l'utilisateur droit dans TYPE_METHODE_INTROUVABLE.
  // On inverse donc la table : pour chaque code présent en base, on retient la
  // clé la plus courte qui y mène. Un code sans clé n'est pas documenté.
  let methodesDispo = [];
  try {
    const types = await prisma.typeMethodeCollecte.findMany({
      where: { actif: true }, select: { code: true }, orderBy: { code: 'asc' },
    });
    methodesDispo = types
      .map(({ code }) => Object.keys(COLLECTION_METHOD)
        .filter(k => COLLECTION_METHOD[k] === code)
        .sort((a, b) => a.length - b.length || a.localeCompare(b))[0])
      .filter(Boolean);
  } catch {
    methodesDispo = [];
  }
  // Repli : la base est indisponible ou aucun code n'est documentable — le
  // template doit rester téléchargeable.
  const methodesTexte = methodesDispo.length
    ? methodesDispo.join(' | ')
    : 'CDC | BG | HLC | DRAGGING';

  const COLS = TEMPLATE_COLUMNS.map(c => ({
    ...c,
    note: c.header === 'COLLECTION_METHOD' ? `Au choix : ${methodesTexte}` : c.note,
  }));

  ws.columns = COLS.map(({ header, key, width }) => ({ header, key, width }));

  // ── En-tête coloré vert IPM ───────────────────────────────────
  const headerRow       = ws.getRow(1);
  headerRow.font        = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill        = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
  headerRow.alignment   = { horizontal: 'center', vertical: 'middle' };
  headerRow.height      = 22;

  // Colonnes obligatoires en vert foncé : la distinction n'était visible nulle
  // part dans le fichier, seulement dans la barre latérale de l'application.
  COLS.forEach((col, i) => {
    if (col.requis) {
      headerRow.getCell(i + 1).fill = {
        type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13704F' },
      };
    }
  });

  // ── Lignes d'exemples ─────────────────────────────────────────
  // Les codes de méthode des exemples sont pris dans le référentiel réel pour
  // qu'ils restent copiables tels quels (les acronymes à tiret "CDC-LT" sont
  // également acceptés — cf. normalizeKey).
  // Exemples : on privilégie les pièges les plus courants s'ils sont disponibles.
  const prefere = ['CDC', 'BG', 'HLC'].filter(m => methodesDispo.includes(m));
  const [m1, m2, m3] = [...prefere, ...methodesDispo, 'CDC', 'CDC', 'CDC'];
  const EXAMPLES = [
    { series: 'MPM-2024-0001', mission: 'OM-2024-001', projet: 'ARBO-MHG',
      lieu: 'Mahajanga | Boeny | Marovoay | Tsararano', w3w: 'LOC-MHG-001',
      lat: -16.1028, lon: 46.6394, alt: 26, date: '2024-03-15', method: m1,
      taxo: 'Anopheles gambiae', genre: 'Anopheles', espece: 'gambiae', intExt: 'OUTDOORS', heure: '19:00', nombre: 1, sex: 'FEMALE', stage: 'ADULT', blood: 'G', parite: 'Pare',
      organe: 'WHOLE_ORGANISM', preserv: '95%_ETHANOL', box: 'BX_001', pos: 'T001', notes: 'Femelle gorgée' },
    { series: 'MPM-2024-0002', mission: 'OM-2024-001', projet: 'ARBO-MHG',
      lieu: 'Mahajanga | Boeny | Marovoay | Tsararano', w3w: 'LOC-MHG-001',
      lat: -16.1028, lon: 46.6394, alt: 26, date: '2024-03-15', method: m2,
      taxo: 'Culex quinquefasciatus', genre: 'Culex', espece: 'quinquefasciatus', intExt: 'INDOORS', heure: '', nombre: 12, sex: 'FEMALE', stage: 'ADULT', blood: 'N', parite: 'Nullipare',
      organe: 'ABDOMEN', preserv: 'RNALATER', box: 'P_001', pos: '', notes: 'Lot réparti sur la plaque' },
    { series: 'MPM-2024-0003', mission: 'OM-2024-002', projet: 'ARBO-MHG',
      lieu: 'Analamanga | Antananarivo | Ambohidratrimo', w3w: 'LOC-ANT-005',
      lat: -18.8103, lon: 47.4528, alt: 1290, date: '2024-03-20', method: m3,
      taxo: 'Aedes sp.', genre: 'Aedes', espece: '', intExt: 'OUTDOORS', heure: '', nombre: 1, sex: 'MALE', stage: 'ADULT', blood: 'NC', parite: '',
      organe: 'WHOLE_ORGANISM', preserv: '70%_ETHANOL', box: '', pos: '', notes: 'Espèce non déterminée sur le terrain' },
  ];

  EXAMPLES.forEach((row, i) => {
    const wsRow = ws.addRow(row);
    wsRow.fill  = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFF0FFF8' : 'FFFFFFFF' },
    };
    wsRow.alignment = { horizontal: 'left' };
  });

  // ── Notes d'aide, en commentaire d'en-tête ────────────────────
  // Elles occupaient auparavant une LIGNE du tableau. L'import ne distingue pas
  // une ligne d'aide d'une ligne de données : le modèle officiel se validait
  // donc lui-même à 4 lignes pour 3 exemples, la ligne d'aide produisant des
  // erreurs absurdes ("Méthode « Au choix : … » introuvable"). En commentaire,
  // l'aide reste visible au survol sans exister pour le parseur.
  COLS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    const aide = col.requis ? `${col.note}\n\n(colonne obligatoire)` : col.note;
    cell.note = {
      texts: [{ font: { size: 10, name: 'Calibri' }, text: aide }],
      margins: { insetmode: 'auto' },
    };
  });

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
  const headerErreur = checkRequiredHeaders(hMap);
  if (headerErreur) return res.status(400).json({ error: headerErreur, colonnes: buildHeaderReport(ws.getRow(1)) });
  const colonnes = buildHeaderReport(ws.getRow(1));

  const logs          = [];
  // Signalé dès l'aperçu : découvrir le blocage seulement après avoir cliqué
  // « Importer » ferait perdre le temps d'analyse du fichier entier.
  const precedent = await importAnterieur(empreinteFichier(req.file.buffer));
  if (precedent) {
    const q = precedent.newValues ?? {};
    const auteur = precedent.user ? `${precedent.user.prenom} ${precedent.user.nom}` : 'un utilisateur';
    logs.push({
      ligne: 0, idTerrain: null, niveau: 'erreur', code: 'FICHIER_DEJA_IMPORTE',
      raison: `Ce fichier a déjà été importé le ${precedent.createdAt.toISOString().slice(0, 10)} par ${auteur}`
            + ` (${q.importes ?? '?'} spécimen(s)) — l'import sera refusé.`,
    });
  }
  const taxoCache     = new Map();
  const methodeCache  = new Map();
  const projetCache   = new Map();
  const seenIds       = new Set();
  const repetitions   = new Map(); // idTerrain -> lignes répétées (hors 1re)
  const premiereLigne = new Map(); // idTerrain -> 1re ligne où il apparaît
  const lignesSansDate = [];
  const registreTubes  = nouveauRegistre();
  const counts        = { total: 0, valid: 0, erreurs: 0, avertissements: 0 };

  // Mêmes règles de cloisonnement qu'à l'import : sans ça l'aperçu annonçait
  // "tout valide" puis l'import refusait chaque ligne pour cause de périmètre.
  const accessibleProjetIds = await getAccessibleProjetIds(req.user?.id, req.user?.role);

  // Même repli que l'import : une ligne sans colonne PROJET hérite du nom lu sur
  // la première ligne de données (cf. projetNomCandidat dans importMoustiques).
  let projetNomCandidat = null;
  ws.eachRow((row, rn) => {
    if (rn > 1 && projetNomCandidat === null) {
      projetNomCandidat = toString(cellValue(row, hMap, ...COL.projet)) ?? 'IMPORT_AUTO';
    }
  });

  const rows = [];
  ws.eachRow((row, rn) => { if (rn > 1) rows.push({ row, rn }); });

  for (const { row, rn } of rows) {
    counts.total++;
    const idTerrain    = toString(cellValue(row, hMap, ...COL.idTerrain));
    const ordreMission = toString(cellValue(row, hMap, ...COL.ordreMission));
    const sciName      = toString(cellValue(row, hMap, ...COL.nomScientifique));
    const { genus, species, conflit } = resolveTaxonInput({
      genus:          toString(cellValue(row, hMap, ...COL.genre)),
      species:        toString(cellValue(row, hMap, ...COL.espece)),
      scientificName: sciName,
    });
    const taxoLabel = sciName || [genus, species].filter(Boolean).join(' ') || '(vide)';
    let rowOk = true;

    const addLog = (niveau, code, raison) => {
      logs.push({ ligne: rn, idTerrain: idTerrain || `ligne_${rn}`, niveau, code, raison });
      if (niveau === 'erreur') { counts.erreurs++; rowOk = false; }
      else if (niveau === 'avertissement') counts.avertissements++;
    };

    // 1. Champs obligatoires
    if (!ordreMission) addLog('erreur', 'MISSION_MANQUANTE', 'MISSION_ORDER_NUMBER manquant');
    if (!genus)        addLog('erreur', 'TAXONOMIE_INTROUVABLE', 'Taxonomie manquante (ni SCIENTIFIC_NAME ni GENUS renseignés)');

    // 1b. Périmètre projet — même verdict que l'import (cf. findOrCreateProjet)
    if (accessibleProjetIds !== null) {
      const { nom: projetNomLigne, code } = projetIdentite(
        toString(cellValue(row, hMap, ...COL.projet)) ?? projetNomCandidat,
      );
      if (!projetCache.has(code)) {
        const projet = await prisma.projet.findUnique({ where: { code }, select: { id: true } })
          ?? await prisma.projet.findFirst({
            where: { nom: { equals: projetNomLigne, mode: 'insensitive' } },
            select: { id: true },
          });
        projetCache.set(code, !projet
          ? `Projet "${projetNomLigne}" inconnu — création réservée aux superviseurs. Demandez sa création, ou corrigez la colonne PROJET.`
          : !accessibleProjetIds.includes(projet.id)
            ? `Projet "${projetNomLigne}" hors de votre périmètre projet`
            : null);
      }
      const refus = projetCache.get(code);
      if (refus) addLog('erreur', 'ACCES_REFUSE', refus);
    }
    if (conflit) {
      addLog('avertissement', 'TAXO_SOURCES_DIVERGENTES',
        `Genre divergent entre colonnes : GENUS="${conflit.genreColonne}" vs SCIENTIFIC_NAME="${conflit.genreNomScientifique}" — la colonne GENUS fait foi`);
    }

    // 2. Taxonomie
    if (genus) {
      const taxoKey = `${genus}_${species}`;
      if (!taxoCache.has(taxoKey)) {
        let t = null;
        if (genus && species) {
          t = await prisma.taxonomieSpecimen.findFirst({
            where: {
              niveau: 'espece',
              nom: { equals: species, mode: 'insensitive' },
              actif: true,
              // cf. importMoustiques — même correctif : le parent direct peut
              // être un sous-genre intermédiaire, pas seulement le genre.
              OR: [
                { parent: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' } } },
                { parent: { niveau: 'sous_genre', parent: { niveau: 'genre', nom: { equals: genus, mode: 'insensitive' } } } },
              ],
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
        addLog('erreur', 'TAXONOMIE_INTROUVABLE', `"${taxoLabel}" introuvable dans le dictionnaire (genre: ${genus ?? '—'}, espèce: ${species ?? '—'})`);
      } else if (taxo.niveau === 'genre') {
        // cf. importMoustiques — même distinction : "sp"/"sp." (déjà retiré de
        // `species`) veut dire non déterminée sur le terrain (normal, info),
        // pas une vraie espèce introuvable (mérite un avertissement).
        if (species) {
          addLog('avertissement', 'TAXO_NIVEAU_GENRE', `"${taxoLabel}" résolu au genre uniquement — espèce "${species}" introuvable`);
        } else {
          addLog('info', 'TAXO_ESPECE_NON_DETERMINEE', `"${taxoLabel}" — espèce non déterminée sur le terrain, rattaché au genre`);
        }
      }
    }

    // 3. Doublon idTerrain
    // Les répétitions INTRA-fichier sont collectées ici et signalées une seule
    // fois par valeur en fin de parcours (cf. plus bas) : un tube répété 209
    // fois produisait 209 messages identiques, illisibles et inexploitables
    // pour corriger le fichier. Le doublon vis-à-vis de la BASE reste par ligne.
    if (idTerrain) {
      if (seenIds.has(idTerrain)) {
        if (!repetitions.has(idTerrain)) repetitions.set(idTerrain, []);
        repetitions.get(idTerrain).push(rn);
        rowOk = false;
        counts.erreurs++;
      } else {
        seenIds.add(idTerrain);
        premiereLigne.set(idTerrain, rn);
        const dupl = await prisma.moustique.findUnique({ where: { idTerrain }, select: { id: true } });
        if (dupl) addLog('erreur', 'DOUBLON', `idTerrain "${idTerrain}" déjà présent en base de données`);
      }
    }

    // 4. Type méthode (référentiel)
    const rawMethod = toString(cellValue(row, hMap, ...COL.methode));
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
    const boxId    = toString(cellValue(row, hMap, ...COL.container));
    const position = toString(cellValue(row, hMap, ...COL.position));
    const rawNombre    = cellValue(row, hMap, ...COL.nombre);
    const parsedNombre = parseInt(rawNombre ?? 1);
    const nombre       = Number.isFinite(parsedNombre) && parsedNombre > 0 ? parsedNombre : 1;
    if (rawNombre != null && rawNombre !== '' && parsedNombre !== nombre) {
      addLog('avertissement', 'NOMBRE_INVALIDE', `Valeur NUMBER "${rawNombre}" invalide (≤ 0 ou non numérique) — sera ramené à 1`);
    }

    // 5a. Date et position du piège — mêmes contrôles qu'à l'import
    const dateLigne = toDate(cellValue(row, hMap, ...COL.dateCollecte));
    if (!dateLigne) lignesSansDate.push(rn);

    // Protocole tube : accumulé ici, analysé après la boucle. Le type de
    // container suit la règle déjà en place à l'import (préfixe P_ = plaque).
    enregistrerTube(registreTubes, {
      box: boxId, tube: position, estBoite: Boolean(boxId) && !/^P_/i.test(boxId),
      individus: nombre, rn,
      dims: {
        espece:   [genus, species].filter(Boolean).join(' ') || null,
        piege:    toString(cellValue(row, hMap, ...COL.piege)),
        sexe:     toString(cellValue(row, hMap, ...COL.sexe)),
        sang:     toString(cellValue(row, hMap, ...COL.repasSang)),
        localite: toString(cellValue(row, hMap, ...COL.code3w))
               ?? toString(cellValue(row, hMap, ...COL.nomLocalite)),
        date:     dateLigne ? dateLigne.toISOString().slice(0, 10) : null,
      },
    });
    const rawIntExt = normalizeKey(cellValue(row, hMap, ...COL.interieurExterieur));
    if (rawIntExt && !INTERIEUR_EXTERIEUR[rawIntExt]) {
      addLog('avertissement', 'POSITION_PIEGE_INVALIDE',
        `Valeur OUTDOORS_INDOORS "${rawIntExt}" non reconnue — position du piège sera laissée vide`);
    }

    // 5b. Parité — mêmes contrôles qu'à l'import (cf. importMoustiques)
    const rawParite = normalizeKey(cellValue(row, hMap, ...COL.parite));
    const parite    = PARITE[rawParite] ?? null;
    const rawHeure  = cellValue(row, hMap, ...COL.trancheHoraire);
    if (rawHeure != null && rawHeure !== '' && !parseTrancheHoraire(rawHeure)) {
      addLog('avertissement', 'TRANCHE_HORAIRE_INVALIDE',
        `Valeur TIME_OF_COLLECTION "${rawHeure instanceof Date ? rawHeure.toISOString().slice(11, 16) : rawHeure}" hors des créneaux d'une nuit (18h→06h) — créneau sera laissé vide`);
    }
    if (rawParite && !parite) {
      addLog('avertissement', 'PARITE_INVALIDE',
        `Valeur PARITY "${rawParite}" non reconnue — parité sera laissée vide (attendu : Nullipare/NP ou Pare/P)`);
    }
    if (parite && (SEX[normalizeKey(cellValue(row, hMap, ...COL.sexe))] ?? 'inconnu') !== 'F') {
      addLog('avertissement', 'PARITE_HORS_FEMELLE',
        `Parité "${parite}" renseignée sur un spécimen non femelle — la parité s'observe sur les ovaires`);
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

  // ── Protocole de conservation en tube ──
  // Un avertissement par tube fautif, pas par ligne : c'est le tube qu'il faut
  // ré-étiqueter. Les lignes concernées sont de toute façon déjà rejetées par
  // l'unicité de l'identifiant terrain — ce message dit POURQUOI.
  for (const t of tubesHorsProtocole(registreTubes)) {
    counts.avertissements++;
    logs.push({
      ligne: t.lignes[0], idTerrain: t.tube, niveau: 'avertissement',
      code: 'TUBE_HORS_PROTOCOLE',
      raison: `${t.raison} Lignes : ${compacterLignes(t.lignes)}.`,
    });
  }

  if (lignesSansDate.length) {
    counts.avertissements++;
    logs.push({
      ligne: lignesSansDate[0], idTerrain: null, niveau: 'avertissement', code: 'DATE_MANQUANTE',
      raison: `DATE_OF_COLLECTION vide sur ${lignesSansDate.length} ligne(s) (${compacterLignes(lignesSansDate)}) — spécimens sans date, pièges sans durée d'exposition`,
    });
  }

  // ── Doublons intra-fichier, groupés par valeur ──
  // Un message par identifiant répété, avec les lignes concernées en plages :
  // c'est ce qui permet de corriger le fichier. Le détail ligne par ligne
  // produisait 209 messages identiques pour un seul tube.
  let lignesDoublonnees = 0;
  for (const [id, lignes] of [...repetitions].sort((a, b) => b[1].length - a[1].length)) {
    lignesDoublonnees += lignes.length;
    logs.push({
      ligne: premiereLigne.get(id) ?? lignes[0],
      idTerrain: id,
      niveau: 'erreur',
      code: 'DOUBLON',
      raison: `"${id}" apparaît sur ${lignes.length + 1} lignes (${compacterLignes([premiereLigne.get(id), ...lignes])}) — l'identifiant doit être unique`,
    });
  }

  const resume = {};
  for (const log of logs) {
    if (log.niveau === 'erreur') resume[log.code] = (resume[log.code] ?? 0) + 1;
  }
  // Le résumé compte des LIGNES en erreur, pas des messages : sans ça un
  // identifiant répété 209 fois n'aurait pesé que 1 dans le total.
  if (lignesDoublonnees) {
    resume.DOUBLON = (resume.DOUBLON ?? 0) - repetitions.size + lignesDoublonnees;
  }

  return res.json({
    total:          counts.total,
    valid:          counts.valid,
    erreurs:        counts.erreurs,
    avertissements: counts.avertissements,
    resume,
    colonnes,
    logs,
  });
};

module.exports = {
  importMoustiques, validateMoustiques, getTemplateMoustiques,
  TEMPLATE_COLUMNS, // exporté pour le test de cohérence avec FIELD_COLUMNS
};
