// backend/src/controllers/labo.controller.js
// 9 modules : morpho, broyage, dessication, extraction, PCR, qPCR, nested, séquençage, microscopie

const path   = require('path');
const fs     = require('fs');
const prisma = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');
const { UPLOADS_ROOT }      = require('../middlewares/upload.middleware');
const { getAccessibleProjetIds, canBypass, projetScopeWhere, assertProjetAccessible } = require('../utils/access');

const SPECIMEN_MODELS = {
  moustique: 'moustique',
  tique:     'tique',
  puce:      'puce',
  autre:     'autreSpecimen',
};

const includeOperateur = { select: { id: true, nom: true, prenom: true, role: true } };

const includeManip = {
  operateur:  includeOperateur,
  validePar:  { select: { id: true, nom: true, prenom: true } },
  pool:       { include: { membres: true } },
  events: {
    include: { operateur: { select: { id: true, nom: true, prenom: true } } },
    orderBy: { dateHeure: 'desc' },
    take: 30,
  },
  identificationMorpho: true,
  broyagePool:          true,
  dessication:          true,
  extraction:           true,
  pcr:                  { include: { pathogeneCible: true } },
  qpcr:                 { include: { pathogeneCible: true } },
  nestedPcr:            { include: { pathogeneCible: true } },
  sequencage:           true,
  microscopie:          true,
};

// ── Helpers ────────────────────────────────────────────────────

async function specimenExists(specimenType, specimenId) {
  const model = SPECIMEN_MODELS[specimenType];
  if (!model) return false;
  return !!(await prisma[model].findUnique({ where: { id: specimenId }, select: { id: true } }));
}

// Résout le projetId d'un spécimen (référence polymorphe specimenType+specimenId,
// pas une vraie relation Prisma) via sa chaîne methode→localite→mission.
async function getSpecimenProjetId(specimenType, specimenId) {
  const model = SPECIMEN_MODELS[specimenType];
  if (!model) return null;
  const specimen = await prisma[model].findUnique({
    where: { id: specimenId },
    select: { methode: { select: { localite: { select: { mission: { select: { projetId: true } } } } } } },
  });
  return specimen?.methode?.localite?.mission?.projetId ?? null;
}

// projetIds de tous les membres d'un pool (un pool peut en théorie mélanger
// des spécimens de missions/projets différents).
async function getPoolProjetIds(poolId) {
  const pool = await prisma.pool.findUnique({ where: { id: poolId }, select: { membres: true } });
  if (!pool) return [];
  const projetIds = await Promise.all(
    pool.membres.map((m) => getSpecimenProjetId(m.specimenType, m.specimenId))
  );
  return projetIds.filter((p) => p !== null);
}

// Vérifie l'accès à une manipulation (spécimen direct ou pool) pour un
// utilisateur non-bypass — fail-closed pour les pools : TOUS les spécimens
// membres doivent appartenir à des projets accessibles, sinon accès refusé
// (un pool peut en théorie regrouper des spécimens de plusieurs projets ;
// aucune règle métier n'empêche ce mélange aujourd'hui — voir memory).
async function assertManipAccessible({ specimenType, specimenId, poolId }, user) {
  if (!user || canBypass(user.role)) return;
  const ids = await getAccessibleProjetIds(user.id, user.role);
  if (specimenId) {
    const projetId = await getSpecimenProjetId(specimenType, specimenId);
    assertProjetAccessible(projetId, ids);
    return;
  }
  if (poolId) {
    const projetIds = await getPoolProjetIds(poolId);
    for (const projetId of projetIds) assertProjetAccessible(projetId, ids);
  }
}

async function logEvent(manipulationId, typeEvent, req, payload = null) {
  await prisma.manipulationEvent.create({
    data: {
      manipulationId,
      typeEvent,
      operateurId: req.user.id,
      payload:     payload ?? undefined,
      ipAddress:   req.ip ?? null,
    },
  });
}

// Construit les données du module selon le type
function buildModuleData(type, body) {
  const n = (v) => (v != null && v !== '' ? parseFloat(v) : null);
  const i = (v) => (v != null && v !== '' ? parseInt(v)   : null);
  const s = (v) => v || null;
  const b = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : null);

  switch (type) {
    case 'identification_morpho':
      return {
        cleUtilisee:      s(body.cleUtilisee),
        especeIdentifiee: s(body.especeIdentifiee),
        niveauConfiance:  s(body.niveauConfiance),
        stadeConfirme:    s(body.stadeConfirme),
        gorgement:        s(body.gorgement),
        pariteMethode:    s(body.pariteMethode),
        pariteResultat:   s(body.pariteResultat),
        partiesPrelevees: s(body.partiesPrelevees),
        observations:     s(body.observations),
      };

    case 'broyage_pool':
      return {
        methodeBroyage:    s(body.methodeBroyage),
        tamponUtilise:     s(body.tamponUtilise),
        volumeTamponUl:    n(body.volumeTamponUl),
        parametresBroyeur: s(body.parametresBroyeur),
        volumeRecupereUl:  n(body.volumeRecupereUl),
        aspectMacro:       s(body.aspectMacro),
      };

    case 'dessication':
      return {
        methode:              s(body.methode),
        dateMiseConservation: body.dateMiseConservation ? new Date(body.dateMiseConservation) : null,
        temperatureStockage:  s(body.temperatureStockage),
        dureeDessicationH:    n(body.dureeDessicationH),
        quantiteSilicaGelG:   n(body.quantiteSilicaGelG),
        partieCorps:          s(body.partieCorps),
        statutTissu:          s(body.statutTissu),
        emplacementCode:      s(body.emplacementCode),
      };

    case 'extraction':
      return {
        typeAcideNucleique:     s(body.typeAcideNucleique),
        typeKit:                s(body.typeKit),
        methodeExtraction:      s(body.methodeExtraction),
        methodeHomogeneisation: s(body.methodeHomogeneisation),
        quantiteTissuMg:        n(body.quantiteTissuMg),
        numerotLot:             s(body.numerotLot),
        volumeElutionUl:        n(body.volumeElutionUl),
        controlExtraction:      b(body.controlExtraction),
        concentrationAdn:       n(body.concentrationAdn),
        pureteA260A280:         n(body.pureteA260A280),
        pureteA260A230:         n(body.pureteA260A230),
        volumeFinalUl:          n(body.volumeFinalUl),
        idTubeAdn:              s(body.idTubeAdn),
      };

    case 'amplification_pcr':
      return {
        pathogeneCibleId: i(body.pathogeneCibleId),
        geneCible:        s(body.geneCible),
        amorceForward:    s(body.amorceForward),
        amorceReverse:    s(body.amorceReverse),
        enzyme:           s(body.enzyme),
        programmeThermo:  s(body.programmeThermo),
        tailleAttenduePb: i(body.tailleAttenduePb),
        idPlaquePcr:      s(body.idPlaquePcr),
        puitsPcr:         s(body.puitsPcr),
        temoinPositif:    b(body.temoinPositif),
        temoinNegatif:    b(body.temoinNegatif),
        statutBandeGel:   s(body.statutBandeGel),
        tailleBandePb:    i(body.tailleBandePb),
      };

    case 'qpcr':
      return {
        pathogeneCibleId:  i(body.pathogeneCibleId),
        typePcr:           s(body.typePcr),
        geneCible:         s(body.geneCible),
        amorceForward:     s(body.amorceForward),
        amorceReverse:     s(body.amorceReverse),
        sondeTaqman:       s(body.sondeTaqman),
        geneReference:     s(body.geneReference),
        masterMix:         s(body.masterMix),
        volumeReactionUl:  n(body.volumeReactionUl),
        idPlaqueQpcr:      s(body.idPlaqueQpcr),
        puitsQpcr:         s(body.puitsQpcr),
        valeurCt:          n(body.valeurCt),
        ctTemoinPositif:   n(body.ctTemoinPositif),
        ctTemoinNegatif:   n(body.ctTemoinNegatif),
        ctControleInterne: n(body.ctControleInterne),
        efficacitePct:     n(body.efficacitePct),
        interpretation:    s(body.interpretation),
        chargeVirale:      n(body.chargeVirale),
      };

    case 'nested_pcr':
      return {
        pathogeneCibleId: i(body.pathogeneCibleId),
        geneCible:        s(body.geneCible),
        amorceF1:         s(body.amorceF1),
        amorceR1:         s(body.amorceR1),
        tailleAttendue1:  i(body.tailleAttendue1),
        statutBande1:     s(body.statutBande1),
        amorceF2:         s(body.amorceF2),
        amorceR2:         s(body.amorceR2),
        tailleAttendue2:  i(body.tailleAttendue2),
        statutBande2:     s(body.statutBande2),
        resultatFinal:    s(body.resultatFinal),
        tailleBandeObsPb: i(body.tailleBandeObsPb),
        idPlaque:         s(body.idPlaque),
        temoinPositif:    b(body.temoinPositif),
        temoinNegatif:    b(body.temoinNegatif),
      };

    case 'sequencage':
      return {
        methodeSequencage:  s(body.methodeSequencage),
        prestataire:        s(body.prestataire),
        idPlaqueTube:       s(body.idPlaqueTube),
        amorceSequencage:   s(body.amorceSequencage),
        scoreQualite:       n(body.scoreQualite),
        sequenceConsensus:  s(body.sequenceConsensus),
        organismeBlast:     s(body.organismeBlast),
        identiteBlastPct:   n(body.identiteBlastPct),
        couvertureBlastPct: n(body.couvertureBlastPct),
        accessionGenbank:   s(body.accessionGenbank),
        resultatBlast:      s(body.resultatBlast),
      };

    case 'microscopie':
      return {
        typeExamen:         s(body.typeExamen),
        coloration:         s(body.coloration),
        grossissement:      s(body.grossissement),
        resultat:           s(body.resultat),
        stadeObserve:       s(body.stadeObserve),
        densiteParasitaire: s(body.densiteParasitaire),
        observations:       s(body.observations),
      };

    default:
      return null;
  }
}

// Map type → relation Prisma
const MODULE_RELATION = {
  identification_morpho: 'identificationMorpho',
  broyage_pool:          'broyagePool',
  dessication:           'dessication',
  extraction:            'extraction',
  amplification_pcr:     'pcr',
  qpcr:                  'qpcr',
  nested_pcr:            'nestedPcr',
  sequencage:            'sequencage',
  microscopie:           'microscopie',
};

// ── GET /api/v1/labo ──────────────────────────────────────────

const listManipulations = async (req, res) => {
  const { specimenType, specimenId, poolId, statut, typeManipulation, operateurId, page, limit } = req.query;
  const pageNum  = Math.max(parseInt(page)  || 1, 1);
  const limitNum = Math.min(parseInt(limit) || 50, 200);

  const where = {};
  if (specimenType)     where.specimenType     = specimenType;
  if (specimenId)       where.specimenId       = parseInt(specimenId);
  if (poolId)           where.poolId           = parseInt(poolId);
  if (statut)           where.statut           = statut;
  if (typeManipulation) where.typeManipulation = typeManipulation;
  if (operateurId)      where.operateurId      = parseInt(operateurId);

  if (req.user && !canBypass(req.user.role)) {
    // specimenId n'est pas une vraie relation Prisma (référence polymorphe
    // specimenType+specimenId) — impossible d'exprimer le filtre projet en un
    // seul where imbriqué comme pour les autres ressources. On résout donc
    // d'abord, par type de spécimen, les ids accessibles, puis on limite aux
    // pools dont TOUS les membres sont dans des projets accessibles.
    const ids = await getAccessibleProjetIds(req.user.id, req.user.role);
    const scope = projetScopeWhere(['methode', 'localite', 'mission'], ids);
    const orClauses = [];
    for (const [type, model] of Object.entries(SPECIMEN_MODELS)) {
      const scoped = await prisma[model].findMany({ where: scope, select: { id: true } });
      if (scoped.length) orClauses.push({ specimenType: type, specimenId: { in: scoped.map((s) => s.id) } });
    }
    const pools = await prisma.pool.findMany({ select: { id: true, membres: true } });
    const accessiblePoolIds = [];
    for (const pool of pools) {
      const projetIds = await Promise.all(pool.membres.map((m) => getSpecimenProjetId(m.specimenType, m.specimenId)));
      if (projetIds.length && projetIds.every((p) => p !== null && ids.includes(p))) accessiblePoolIds.push(pool.id);
    }
    if (accessiblePoolIds.length) orClauses.push({ poolId: { in: accessiblePoolIds } });
    // Aucune correspondance possible → liste vide (id: -1) plutôt que "pas de filtre".
    where.AND = [...(where.AND || []), { OR: orClauses.length ? orClauses : [{ id: -1 }] }];
  }

  const [total, manipulations] = await prisma.$transaction([
    prisma.manipulationLabo.count({ where }),
    prisma.manipulationLabo.findMany({
      where,
      include: {
        operateur: includeOperateur,
        validePar: { select: { id: true, nom: true, prenom: true } },
        pool:      { select: { id: true, code: true, nombreIndividus: true } },
        dessication:          { select: { emplacementCode: true, statutTissu: true, temperatureStockage: true } },
        extraction:           { select: { concentrationAdn: true, idTubeAdn: true, typeAcideNucleique: true } },
        pcr:                  { select: { statutBandeGel: true, geneCible: true, pathogeneCible: { select: { nom: true } } } },
        qpcr:                 { select: { valeurCt: true, interpretation: true, pathogeneCible: { select: { nom: true } } } },
        nestedPcr:            { select: { resultatFinal: true, pathogeneCible: { select: { nom: true } } } },
        sequencage:           { select: { organismeBlast: true, identiteBlastPct: true, methodeSequencage: true } },
        microscopie:          { select: { resultat: true, typeExamen: true } },
        identificationMorpho: { select: { especeIdentifiee: true, niveauConfiance: true } },
        broyagePool:          { select: { aspectMacro: true, volumeRecupereUl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);
  return res.json({ total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum), manipulations });
};

// ── GET /api/v1/labo/:id ──────────────────────────────────────

const getManipulation = async (req, res) => {
  const manip = await prisma.manipulationLabo.findUnique({
    where: { id: parseInt(req.params.id) },
    include: includeManip,
  });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });
  await assertManipAccessible(manip, req.user);
  return res.json({ manipulation: manip });
};

// ── POST /api/v1/labo ─────────────────────────────────────────

const createManipulation = async (req, res) => {
  const { specimenType, specimenId, poolId, typeManipulation, protocole, dateDebut, dateFin, notes } = req.body;

  // Validation cible : spécimen OU pool, pas les deux
  if (!specimenId && !poolId)
    return res.status(400).json({ error: 'Précisez un spécimen ou un pool' });
  if (specimenId && poolId)
    return res.status(400).json({ error: 'Choisissez un spécimen ou un pool, pas les deux' });

  if (specimenId) {
    const ok = await specimenExists(specimenType, parseInt(specimenId));
    if (!ok) return res.status(404).json({ error: `Spécimen ${specimenType} #${specimenId} introuvable` });
  }
  if (poolId) {
    const pool = await prisma.pool.findUnique({ where: { id: parseInt(poolId) }, select: { id: true } });
    if (!pool) return res.status(404).json({ error: `Pool #${poolId} introuvable` });
  }
  await assertManipAccessible({ specimenType, specimenId: specimenId ? parseInt(specimenId) : null, poolId: poolId ? parseInt(poolId) : null }, req.user);

  const rel     = MODULE_RELATION[typeManipulation];
  const modData = rel ? buildModuleData(typeManipulation, req.body) : null;

  const manip = await prisma.manipulationLabo.create({
    data: {
      specimenType:    specimenId ? specimenType : null,
      specimenId:      specimenId ? parseInt(specimenId) : null,
      poolId:          poolId    ? parseInt(poolId)    : null,
      typeManipulation,
      protocole:       protocole ?? null,
      operateurId:     req.user.id,
      dateDebut:       dateDebut ? new Date(dateDebut) : new Date(),
      dateFin:         dateFin   ? new Date(dateFin)   : null,
      notes:           notes     ?? null,
      ...(rel && modData ? { [rel]: { create: modData } } : {}),
    },
    include: includeManip,
  });

  await logEvent(manip.id, 'CREATION', req, { specimenType, specimenId, poolId, typeManipulation });
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'ManipulationLabo', entityId: manip.id,
    newValues: { typeManipulation, specimenId, poolId } });
  return res.status(201).json({ message: 'Manipulation créée', manipulation: manip });
};

// ── PUT /api/v1/labo/:id ──────────────────────────────────────

const updateManipulation = async (req, res) => {
  const id    = parseInt(req.params.id);
  const manip = await prisma.manipulationLabo.findUnique({
    where: { id },
    select: { id: true, statut: true, typeManipulation: true, specimenType: true, specimenId: true, poolId: true },
  });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });
  await assertManipAccessible(manip, req.user);
  if (manip.statut === 'valide' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Résultat validé — modification interdite. Contactez un administrateur.' });

  const { protocole, dateDebut, dateFin, notes } = req.body;
  const baseData = {};
  if (protocole !== undefined) baseData.protocole = protocole;
  if (dateDebut !== undefined) baseData.dateDebut = new Date(dateDebut);
  if (dateFin   !== undefined) baseData.dateFin   = dateFin ? new Date(dateFin) : null;
  if (notes     !== undefined) baseData.notes     = notes;

  const rel = MODULE_RELATION[manip.typeManipulation];
  let modData = rel ? buildModuleData(manip.typeManipulation, req.body) : null;
  // B4 — ne conserver que les champs réellement transmis, sinon un PUT partiel
  // (ex. { notes }) remettrait à null toutes les données scientifiques du module.
  if (modData) {
    modData = Object.fromEntries(
      Object.entries(modData).filter(([k]) => req.body[k] !== undefined)
    );
  }
  const hasModData = modData && Object.keys(modData).length > 0;

  const updated = await prisma.manipulationLabo.update({
    where: { id },
    data: {
      ...baseData,
      ...(rel && hasModData ? { [rel]: { upsert: { create: modData, update: modData } } } : {}),
    },
    include: includeManip,
  });

  await logEvent(id, 'MODIFICATION', req);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'ManipulationLabo', entityId: id, newValues: req.body });
  return res.json({ message: 'Manipulation mise à jour', manipulation: updated });
};

// ── POST /api/v1/labo/:id/valider ────────────────────────────

const validerManipulation = async (req, res) => {
  const id    = parseInt(req.params.id);
  const manip = await prisma.manipulationLabo.findUnique({ where: { id }, select: { id: true, statut: true } });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });
  if (manip.statut === 'valide') return res.status(409).json({ error: 'Déjà validé' });

  const updated = await prisma.manipulationLabo.update({
    where: { id },
    data:  { statut: 'valide', valideParId: req.user.id, valideLe: new Date(), motifInvalidation: null },
    include: includeManip,
  });
  await logEvent(id, 'VALIDATION', req);
  return res.json({ message: 'Manipulation validée', manipulation: updated });
};

// ── POST /api/v1/labo/:id/invalider ──────────────────────────

const invaliderManipulation = async (req, res) => {
  const id    = parseInt(req.params.id);
  const { motifInvalidation } = req.body;
  const manip = await prisma.manipulationLabo.findUnique({ where: { id }, select: { id: true } });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });

  const updated = await prisma.manipulationLabo.update({
    where: { id },
    data:  { statut: 'invalide', motifInvalidation: motifInvalidation ?? null },
    include: includeManip,
  });
  await logEvent(id, 'INVALIDATION', req, { motif: motifInvalidation });
  return res.json({ message: 'Manipulation invalidée', manipulation: updated });
};

// ── DELETE /api/v1/labo/:id ───────────────────────────────────

const deleteManipulation = async (req, res) => {
  const id = parseInt(req.params.id);
  const manip = await prisma.manipulationLabo.findUnique({
    where: { id },
    select: { id: true, specimenType: true, specimenId: true, poolId: true },
  });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });
  await assertManipAccessible(manip, req.user);

  // Supprimer fichiers images/raw
  const [pcr, seq, nested, micro] = await Promise.all([
    prisma.manipulationPcr.findUnique       ({ where: { manipulationId: id }, select: { imageGelPath: true } }),
    prisma.manipulationSequencage.findUnique({ where: { manipulationId: id }, select: { fichierRawPath: true } }),
    prisma.manipulationNestedPcr.findUnique ({ where: { manipulationId: id }, select: { imageGelPath: true } }),
    prisma.manipulationMicroscopie.findUnique({ where: { manipulationId: id }, select: { imageMicroPath: true } }),
  ]);
  for (const p of [pcr?.imageGelPath, seq?.fichierRawPath, nested?.imageGelPath, micro?.imageMicroPath]) {
    if (p) {
      // Les chemins stockés sont de la forme "labo/<sous-dossier>/<fichier>" et
      // UPLOADS_ROOT se termine déjà par "/labo" : on ne retire QUE le préfixe
      // "labo/" pour conserver le sous-dossier (images/, sequencage/).
      const abs = path.join(UPLOADS_ROOT, p.replace(/^labo\//, ''));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  }

  await prisma.manipulationLabo.delete({ where: { id } });
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'ManipulationLabo', entityId: id });
  return res.json({ message: 'Manipulation supprimée' });
};

// ── Upload image (gel PCR, nested, microscopie) ───────────────

const uploadImage = async (req, res) => {
  const id      = parseInt(req.params.id);
  const subtype = req.params.subtype; // 'gel' | 'micro'
  const file    = req.file;
  if (!file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const manip = await prisma.manipulationLabo.findUnique({
    where: { id },
    select: { id: true, statut: true, typeManipulation: true, specimenType: true, specimenId: true, poolId: true },
  });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });
  await assertManipAccessible(manip, req.user);
  if (manip.statut === 'valide' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Résultat validé — modification interdite' });

  const relativePath = `labo/images/${file.filename}`;

  if (subtype === 'gel') {
    const t = manip.typeManipulation;
    if (t === 'amplification_pcr') {
      await prisma.manipulationPcr.upsert({
        where:  { manipulationId: id },
        create: { manipulationId: id, imageGelPath: relativePath },
        update: { imageGelPath: relativePath },
      });
    } else if (t === 'nested_pcr') {
      await prisma.manipulationNestedPcr.upsert({
        where:  { manipulationId: id },
        create: { manipulationId: id, imageGelPath: relativePath },
        update: { imageGelPath: relativePath },
      });
    } else {
      return res.status(400).json({ error: 'Module non compatible avec un gel' });
    }
  } else if (subtype === 'micro') {
    if (manip.typeManipulation !== 'microscopie')
      return res.status(400).json({ error: 'Module non compatible' });
    await prisma.manipulationMicroscopie.upsert({
      where:  { manipulationId: id },
      create: { manipulationId: id, imageMicroPath: relativePath },
      update: { imageMicroPath: relativePath },
    });
  }

  await logEvent(id, 'UPLOAD_IMAGE', req, { subtype, filename: file.filename, size: file.size });
  return res.json({ message: 'Image uploadée', path: relativePath });
};

// ── Upload fichier raw (.ab1, .fastq) ────────────────────────

const uploadFichierRaw = async (req, res) => {
  const id   = parseInt(req.params.id);
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const manip = await prisma.manipulationLabo.findUnique({
    where: { id },
    select: { id: true, statut: true, typeManipulation: true, specimenType: true, specimenId: true, poolId: true },
  });
  if (!manip) return res.status(404).json({ error: 'Manipulation introuvable' });
  await assertManipAccessible(manip, req.user);
  if (manip.typeManipulation !== 'sequencage')
    return res.status(400).json({ error: 'Upload raw réservé au module Séquençage' });
  if (manip.statut === 'valide' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Résultat validé — modification interdite' });

  const relativePath = `labo/sequencage/${file.filename}`;
  await prisma.manipulationSequencage.upsert({
    where:  { manipulationId: id },
    create: { manipulationId: id, fichierRawPath: relativePath },
    update: { fichierRawPath: relativePath },
  });

  await logEvent(id, 'UPLOAD_FICHIER', req, { filename: file.originalname, size: file.size });
  return res.json({ message: 'Fichier raw uploadé', path: relativePath });
};

module.exports = {
  listManipulations, getManipulation, createManipulation, updateManipulation,
  validerManipulation, invaliderManipulation, deleteManipulation,
  uploadImage, uploadFichierRaw,
};
