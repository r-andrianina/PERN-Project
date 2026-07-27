// backend/src/controllers/moustiques.controller.js
// CRUD + Import/Export Excel des moustiques
// Conforme CDC : taxonomie obligatoire (FK), aucune saisie libre genre/espece.

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyId, libelleTaxonomie } = require('../utils/taxonomyResolve');
const { generateIdTerrain, generateMany, isIdTerrainUnique } = require('../utils/idTerrain');
const { validatePlacement, nextAvailablePositions } = require('../utils/container');
const { logAudit, ACTIONS } = require('../utils/audit');
const { toParietéSOP, BLOOD_MEAL, normalizeKey } = require('../utils/importMappings');

const includeBase = {
  methode: {
    select: {
      id: true, numero: true,
      typeMethode: { select: { id: true, code: true, nom: true } },
      localite: {
        select: {
          id: true, nom: true, fokontany: true, region: true, district: true, commune: true,
          mission: {
            select: {
              id: true, ordreMission: true,
              projet: { select: { code: true, nom: true } },
            },
          },
        },
      },
    },
  },
  taxonomie: {
    include: { parent: { include: { parent: true } } },
  },
  solution:  { select: { id: true, nom: true, temperature: true } },
  container: { select: { id: true, code: true, type: true } },
};

// GET /api/v1/moustiques
const listMoustiques = async (req, res) => {
  const { methodeId, missionId, taxonomieId, sexe, search, page, limit } = req.query;
  const pageNum  = Math.max(parseInt(page)  || 1, 1);
  const limitNum = Math.min(parseInt(limit) || 50, 200);

  const where = {};
  if (methodeId)   where.methodeId   = parseInt(methodeId);
  if (taxonomieId) where.taxonomieId = parseInt(taxonomieId);
  if (sexe)        where.sexe        = sexe;
  if (missionId)   where.methode     = { localite: { missionId: parseInt(missionId) } };
  if (search) {
    where.OR = [
      { taxonomie: { nom: { contains: search, mode: 'insensitive' } } },
      { taxonomie: { parent: { nom: { contains: search, mode: 'insensitive' } } } },
      { idTerrain: { contains: search, mode: 'insensitive' } },
      { notes:     { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, moustiques] = await prisma.$transaction([
    prisma.moustique.count({ where }),
    prisma.moustique.findMany({
      where, include: includeBase, orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum, take: limitNum,
    }),
  ]);
  return res.json({ total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum), moustiques });
};

// GET /api/v1/moustiques/:id
const getMoustique = async (req, res) => {
  const id = parseInt(req.params.id);
  const moustique = await prisma.moustique.findUnique({
    where: { id }, include: includeBase,
  });
  if (!moustique) return res.status(404).json({ error: 'Moustique introuvable' });
  return res.json({ moustique });
};

// POST /api/v1/moustiques
// Mode "bulk" : si containerId.type=BOITE, mode='split' et nombre>1, créer N enregistrements (1/tube)
//                aux N prochaines positions libres.
const createMoustique = async (req, res) => {
  const {
    methodeId, taxonomieId, idTerrain, nombre, sexe, stade, parite,
    repasSang, organePreleve, solutionId,
    containerId, position, dateCollecte, notes,
    insertMode, // 'single' (default) | 'split' (1 individu/tube)
  } = req.body;

  if (!methodeId)   return res.status(400).json({ error: 'methodeId obligatoire' });
  if (!taxonomieId) return res.status(400).json({ error: 'taxonomieId obligatoire (référentiel)' });

  const [methode, taxo] = await Promise.all([
    prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } }),
    prisma.taxonomieSpecimen.findUnique({ where: { id: parseInt(taxonomieId) } }),
  ]);
  if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });
  if (!taxo)    return res.status(404).json({ error: 'Taxonomie introuvable' });
  if (!taxo.actif) return res.status(400).json({ error: 'Cette taxonomie est désactivée' });
  if (taxo.type && taxo.type !== 'moustique') return res.status(400).json({ error: 'Taxonomie de type non-moustique' });

  const nbInt = Math.max(parseInt(nombre) || 1, 1);
  const cId   = containerId ? parseInt(containerId) : null;

  // Le container (si fourni) impose des règles :
  //  - PLAQUE : nombre=1 par enregistrement, position obligatoire et unique
  //  - BOITE  : nombre>=1 par tube, plusieurs spécimens peuvent partager un tube
  //             ou mode split → N enregistrements aux N prochaines positions libres
  let container = null;
  if (cId) {
    container = await prisma.container.findUnique({ where: { id: cId } });
    if (!container) return res.status(404).json({ error: 'Container introuvable' });
  }

  // ── MODE SPLIT (boîte ou plaque) — N enregistrements 1 individu/position ──
  if (cId && insertMode === 'split' && nbInt > 1 && (container.type === 'BOITE' || container.type === 'PLAQUE')) {
    const positions = await nextAvailablePositions(cId, nbInt);
    const ids = await generateMany(parseInt(methodeId), nbInt);
    const baseData = {
      methodeId:    parseInt(methodeId),
      taxonomieId:  parseInt(taxonomieId),
      nombre:       1,
      sexe:         sexe   || 'inconnu',
      stade:        stade         || null,
      parite:       parite        || null,
      repasSang,
      organePreleve:organePreleve || null,
      solutionId:   solutionId ? parseInt(solutionId) : null,
      containerId:  cId,
      dateCollecte: dateCollecte ? new Date(dateCollecte) : null,
      notes:        notes || null,
    };
    const data = positions.map((p, i) => ({ ...baseData, position: p, idTerrain: ids[i] }));
    const created = await prisma.moustique.createMany({ data });
    return res.status(201).json({
      message: `${created.count} moustique(s) enregistré(s) (1 individu / ${container.type === 'PLAQUE' ? 'puit' : 'tube'})`,
      count:   created.count,
      positions,
    });
  }

  // ── MODE SINGLE (1 enregistrement) ──
  // Plaque : nombre forcé à 1
  if (cId && container.type === 'PLAQUE' && nbInt > 1) {
    return res.status(400).json({ error: 'Une plaque ne peut contenir qu\'un seul spécimen par puit (nombre forcé à 1)' });
  }

  // Validation de la position
  if (cId) {
    const err = await validatePlacement(cId, position);
    if (err) return res.status(400).json({ error: err });
  }

  // Génération ou validation de l'idTerrain
  let finalIdTerrain = idTerrain ? idTerrain.trim() : null;
  if (finalIdTerrain) {
    const ok = await isIdTerrainUnique(finalIdTerrain);
    if (!ok) return res.status(409).json({ error: `L'ID "${finalIdTerrain}" est déjà utilisé` });
  } else {
    finalIdTerrain = await generateIdTerrain(parseInt(methodeId));
  }

  const moustique = await prisma.moustique.create({
    data: {
      idTerrain:      finalIdTerrain,
      methodeId:      parseInt(methodeId),
      taxonomieId:    parseInt(taxonomieId),
      nombre:         cId && container.type === 'PLAQUE' ? 1 : nbInt,
      sexe:           sexe   || 'inconnu',
      stade:          stade         || null,
      parite:         parite        || null,
      repasSang,
      organePreleve:  organePreleve || null,
      solutionId:     solutionId    ? parseInt(solutionId) : null,
      containerId:    cId,
      position:       position || null,
      dateCollecte:   dateCollecte  ? new Date(dateCollecte) : null,
      notes:          notes         || null,
    },
    include: includeBase,
  });

  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Moustique', entityId: moustique.id,
    newValues: { idTerrain: moustique.idTerrain, taxonomieId: moustique.taxonomieId, nombre: moustique.nombre,
      sexe: moustique.sexe, stade: moustique.stade, parite: moustique.parite, repasSang: moustique.repasSang,
      methodeId: moustique.methodeId, dateCollecte: moustique.dateCollecte } });
  return res.status(201).json({ message: 'Moustique enregistré', moustique });
};

// PUT /api/v1/moustiques/:id
const updateMoustique = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    taxonomieId, idTerrain, nombre, sexe, stade, parite,
    repasSang, organePreleve, solutionId,
    containerId, position, dateCollecte, notes,
  } = req.body;

  const data = {};
  if (idTerrain !== undefined) {
    if (idTerrain) {
      const ok = await isIdTerrainUnique(idTerrain.trim(), 'moustique', id);
      if (!ok) return res.status(409).json({ error: `L'ID "${idTerrain}" est déjà utilisé` });
      data.idTerrain = idTerrain.trim();
    } else {
      data.idTerrain = null;
    }
  }
  if (taxonomieId    !== undefined) data.taxonomieId    = parseInt(taxonomieId);
  if (nombre         !== undefined) data.nombre         = parseInt(nombre);
  if (sexe           !== undefined) data.sexe           = sexe;
  if (stade          !== undefined) data.stade          = stade;
  if (parite         !== undefined) data.parite         = parite;
  if (repasSang      !== undefined) data.repasSang      = repasSang;
  if (organePreleve  !== undefined) data.organePreleve  = organePreleve;
  if (solutionId     !== undefined) data.solutionId     = solutionId ? parseInt(solutionId) : null;
  if (containerId    !== undefined) data.containerId    = containerId ? parseInt(containerId) : null;
  if (position       !== undefined) data.position       = position;
  if (dateCollecte   !== undefined) data.dateCollecte   = dateCollecte ? new Date(dateCollecte) : null;
  if (notes          !== undefined) data.notes          = notes;

  const before = await prisma.moustique.findUnique({
    where: { id },
    select: { idTerrain:true, taxonomieId:true, nombre:true, sexe:true, stade:true,
      parite:true, repasSang:true, methodeId:true, solutionId:true, dateCollecte:true, notes:true },
  });
  if (!before) return res.status(404).json({ error: 'Moustique introuvable' });
  const moustique = await prisma.moustique.update({ where: { id }, data, include: includeBase });
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Moustique', entityId: id,
    oldValues: before,
    newValues: { idTerrain: moustique.idTerrain, taxonomieId: moustique.taxonomieId, nombre: moustique.nombre,
      sexe: moustique.sexe, stade: moustique.stade, parite: moustique.parite, repasSang: moustique.repasSang,
      methodeId: moustique.methodeId, solutionId: moustique.solutionId, dateCollecte: moustique.dateCollecte, notes: moustique.notes } });
  return res.json({ message: 'Moustique mis à jour', moustique });
};

// DELETE /api/v1/moustiques/:id
const deleteMoustique = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.moustique.findUnique({
    where: { id },
    select: { idTerrain:true, taxonomieId:true, nombre:true, sexe:true, stade:true,
      parite:true, repasSang:true, methodeId:true, dateCollecte:true },
  });
  if (!before) return res.status(404).json({ error: 'Moustique introuvable' });
  await prisma.moustique.delete({ where: { id } });
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Moustique', entityId: id, oldValues: before });
  return res.json({ message: 'Moustique supprimé' });
};

// POST /api/v1/moustiques/import   (multipart : file + methodeId)
// Excel : col1=Genre, col2=Espèce, col3=Nombre, col4=Sexe, col5=Stade,
//         col6=Parité, col7=StatutSanguin(N/G/Gr/SGr/NC ou Oui/Non), col8=OrganePrélevé,
//         col9=Contenant, col10=PositionPlaque, col11=DateCollecte, col12=Notes
const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const { methodeId } = req.body;
  if (!methodeId) return res.status(400).json({ error: 'methodeId obligatoire' });

  const methode = await prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } });
  if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const worksheet = workbook.worksheets[0];

  const results  = { success: 0, errors: [] };
  const dataRows = [];

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({ row, rowNumber });
  });

  for (const { row, rowNumber } of rows) {
    const genre  = row.getCell(1).value?.toString().trim() || null;
    const espece = row.getCell(2).value?.toString().trim() || null;
    if (!genre) {
      results.errors.push({ ligne: rowNumber, erreur: 'Genre manquant' });
      continue;
    }
    const taxonomieId = await resolveSpecimenTaxonomyId({ type: 'moustique', genre, espece });
    if (!taxonomieId) {
      results.errors.push({ ligne: rowNumber, erreur: `Taxonomie "${genre}${espece ? ' '+espece : ''}" introuvable dans le référentiel` });
      continue;
    }

    const sexe          = row.getCell(4).value?.toString().trim() || 'inconnu';
    const stade         = row.getCell(5).value?.toString().trim() || null;
    const parite        = row.getCell(6).value?.toString().trim() || null;
    const rawRepasSang  = row.getCell(7).value?.toString().trim() || '';
    const repasSang     = BLOOD_MEAL[normalizeKey(rawRepasSang)] ?? 'NC';
    const organePreleve = row.getCell(8).value?.toString().trim() || null;
    const dateRaw       = row.getCell(9).value;
    const notes         = row.getCell(10).value?.toString().trim() || null;

    let dateCollecte = null;
    if (dateRaw) {
      const parsed = new Date(dateRaw);
      if (!isNaN(parsed.getTime())) dateCollecte = parsed;
    }

    dataRows.push({
      methodeId:   parseInt(methodeId),
      taxonomieId,
      nombre:      parseInt(row.getCell(3).value) || 1,
      sexe:        ['M', 'F', 'inconnu'].includes(sexe) ? sexe : 'inconnu',
      stade, parite, repasSang, organePreleve,
      dateCollecte, notes,
    });
  }

  if (dataRows.length > 0) {
    // Génération en série des idTerrain (un par ligne)
    const idsTerrain = await generateMany(parseInt(methodeId), dataRows.length);
    dataRows.forEach((d, i) => { d.idTerrain = idsTerrain[i]; });
    const created = await prisma.moustique.createMany({ data: dataRows });
    results.success = created.count;
  }
  if (req.file.path) try { fs.unlinkSync(req.file.path); } catch {}

  return res.status(201).json({
    message: `Import terminé — ${results.success} moustique(s)`,
    success: results.success,
    errors:  results.errors,
  });
};

// GET /api/v1/moustiques/export
const exportExcel = async (req, res) => {
  const { missionId, methodeId } = req.query;
  const where = {};
  if (methodeId) where.methodeId = parseInt(methodeId);
  if (missionId) where.methode   = { localite: { missionId: parseInt(missionId) } };

  const moustiques = await prisma.moustique.findMany({
    where,
    include: {
      methode: {
        select: {
          typeMethode: { select: { nom: true, code: true } },
          localite: {
            select: {
              nom: true, region: true, district: true,
              latitude: true, longitude: true,
              mission: { select: { ordreMission: true } },
            },
          },
        },
      },
      taxonomie: { include: { parent: { include: { parent: true } } } },
      solution:  { select: { nom: true } },
      container: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Moustiques');
  worksheet.columns = [
    { header: 'ID',              key: 'id',             width: 8  },
    { header: 'ID terrain',      key: 'idTerrain',      width: 14 },
    { header: 'Mission',         key: 'mission',        width: 15 },
    { header: 'Localité',        key: 'localite',       width: 20 },
    { header: 'Région',          key: 'region',         width: 15 },
    { header: 'Latitude',        key: 'latitude',       width: 12 },
    { header: 'Longitude',       key: 'longitude',      width: 12 },
    { header: 'Méthode',         key: 'methode',        width: 20 },
    { header: 'Taxonomie',       key: 'taxonomie',      width: 25 },
    { header: 'Nombre',          key: 'nombre',         width: 8  },
    { header: 'Sexe',            key: 'sexe',           width: 10 },
    { header: 'Stade',           key: 'stade',          width: 10 },
    { header: 'Parité',          key: 'parite',         width: 10 },
    { header: 'Parité (SOP)',    key: 'pariteSOP',      width: 12 },
    { header: 'Repas sang',      key: 'repasSang',      width: 12 },
    { header: 'Organe prélevé',  key: 'organePreleve',  width: 15 },
    { header: 'Solution',        key: 'solution',       width: 15 },
    { header: 'Container',       key: 'container',      width: 18 },
    { header: 'Position',        key: 'position',       width: 12 },
    { header: 'Date collecte',   key: 'dateCollecte',   width: 15 },
    { header: 'Notes',           key: 'notes',          width: 30 },
  ];
  worksheet.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
  worksheet.getRow(1).alignment = { horizontal: 'center' };

  moustiques.forEach((m) => {
    worksheet.addRow({
      id:             m.id,
      idTerrain:      m.idTerrain,
      mission:        m.methode.localite.mission.ordreMission,
      localite:       m.methode.localite.nom,
      region:         m.methode.localite.region,
      latitude:       m.methode.localite.latitude,
      longitude:      m.methode.localite.longitude,
      methode:        m.methode.typeMethode?.nom,
      taxonomie:      libelleTaxonomie(m.taxonomie),
      nombre:         m.nombre,
      sexe:           m.sexe,
      stade:          m.stade,
      parite:         m.parite,
      pariteSOP:      toParietéSOP(m.parite),
      repasSang:      m.repasSang,
      organePreleve:  m.organePreleve,
      solution:       m.solution?.nom,
      container:      m.container?.code,
      position:       m.position,
      dateCollecte:   m.dateCollecte ? m.dateCollecte.toISOString().split('T')[0] : null,
      notes:          m.notes,
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=moustiques.xlsx');
  await workbook.xlsx.write(res);
  res.end();
};

// DELETE /api/v1/moustiques/bulk
// Supprime un lot de moustiques soit par IDs explicites, soit par critères de filtre.
const bulkDeleteMoustiques = async (req, res) => {
  const { ids, filters } = req.body;
  if (!ids?.length && !filters) {
    return res.status(400).json({ error: 'ids ou filters est requis' });
  }

  let where = {};

  if (ids?.length) {
    where.id = { in: ids.map(Number).filter((n) => !isNaN(n)) };
  } else {
    const { methodeId, missionId, taxonomieId, sexe, search } = filters;
    if (methodeId)   where.methodeId   = parseInt(methodeId);
    if (taxonomieId) where.taxonomieId = parseInt(taxonomieId);
    if (sexe)        where.sexe        = sexe;
    if (missionId)   where.methode     = { localite: { missionId: parseInt(missionId) } };
    if (search) {
      where.OR = [
        { taxonomie: { nom:    { contains: search, mode: 'insensitive' } } },
        { taxonomie: { parent: { nom: { contains: search, mode: 'insensitive' } } } },
        { idTerrain: { contains: search, mode: 'insensitive' } },
        { notes:     { contains: search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(where).length === 0) {
      return res.status(400).json({ error: 'Au moins un filtre est requis pour éviter une suppression totale accidentelle' });
    }
  }

  const { count } = await prisma.moustique.deleteMany({ where });
  await logAudit({
    req, action: ACTIONS.DELETE, entity: 'Moustique', entityId: null,
    oldValues: { bulkDelete: true, deleted: count, criteria: JSON.stringify(where) },
  });
  return res.json({ deleted: count, message: `${count} moustique(s) supprimé(s)` });
};

module.exports = {
  listMoustiques, getMoustique, createMoustique,
  updateMoustique, deleteMoustique, importExcel, exportExcel,
  bulkDeleteMoustiques,
};
