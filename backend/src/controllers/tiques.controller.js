// backend/src/controllers/tiques.controller.js
// CRUD + Import/Export Excel des tiques (avec hôte associé)
// Conforme CDC : taxonomie obligatoire (FK).

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyId, libelleTaxonomie } = require('../utils/taxonomyResolve');
const { generateIdTerrain, generateMany, isIdTerrainUnique } = require('../utils/idTerrain');
const { validatePlacement, nextAvailablePositions } = require('../utils/container');
const { logAudit, ACTIONS } = require('../utils/audit');
const { BLOOD_MEAL, normalizeKey } = require('../utils/importMappings');

const includeBase = {
  methode: {
    select: {
      id: true, numero: true,
      typeMethode: { select: { id: true, code: true, nom: true } },
      localite: {
        select: {
          id: true, nom: true, fokontany: true, region: true, district: true, commune: true,
          mission: { select: { id: true, ordreMission: true, projet: { select: { code: true, nom: true } } } },
        },
      },
    },
  },
  hote:      { include: { taxonomieHote: { select: { nom: true, niveau: true } } } },
  taxonomie: { include: { parent: { include: { parent: true } } } },
  solution:  { select: { id: true, nom: true } },
  container: { select: { id: true, code: true, type: true } },
};

const listTiques = async (req, res) => {
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

  const [total, tiques] = await prisma.$transaction([
    prisma.tique.count({ where }),
    prisma.tique.findMany({
      where, include: includeBase, orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum, take: limitNum,
    }),
  ]);
  return res.json({ total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum), tiques });
};

const getTique = async (req, res) => {
  const id = parseInt(req.params.id);
  const tique = await prisma.tique.findUnique({ where: { id }, include: includeBase });
  if (!tique) return res.status(404).json({ error: 'Tique introuvable' });
  return res.json({ tique });
};

const createTique = async (req, res) => {
  const {
    methodeId, hoteId, taxonomieId, idTerrain, nombre, sexe, stade,
    gorge, partieCorpsHote, solutionId,
    containerId, position, dateCollecte, notes,
    insertMode,
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
  if (taxo.type && taxo.type !== 'tique') return res.status(400).json({ error: 'Taxonomie de type non-tique' });

  const nbInt = Math.max(parseInt(nombre) || 1, 1);
  const cId   = containerId ? parseInt(containerId) : null;

  let container = null;
  if (cId) {
    container = await prisma.container.findUnique({ where: { id: cId } });
    if (!container) return res.status(404).json({ error: 'Container introuvable' });
  }

  // ── MODE SPLIT (boîte uniquement) ──
  if (cId && container.type === 'BOITE' && insertMode === 'split' && nbInt > 1) {
    const positions = await nextAvailablePositions(cId, nbInt);
    const ids = await generateMany(parseInt(methodeId), nbInt);
    const baseData = {
      methodeId:       parseInt(methodeId),
      hoteId:          hoteId ? parseInt(hoteId) : null,
      taxonomieId:     parseInt(taxonomieId),
      nombre:          1,
      sexe:            sexe   || 'inconnu',
      stade:           stade           || null,
      gorge,
      partieCorpsHote: partieCorpsHote || null,
      solutionId:      solutionId      ? parseInt(solutionId) : null,
      containerId:     cId,
      dateCollecte:    dateCollecte    ? new Date(dateCollecte) : null,
      notes:           notes           || null,
    };
    const data = positions.map((p, i) => ({ ...baseData, position: p, idTerrain: ids[i] }));
    const created = await prisma.tique.createMany({ data });
    return res.status(201).json({
      message: `${created.count} tique(s) enregistrée(s) (1 individu / tube)`,
      count:   created.count,
      positions,
    });
  }

  if (cId && container.type === 'PLAQUE' && nbInt > 1) {
    return res.status(400).json({ error: 'Une plaque ne peut contenir qu\'un seul spécimen par puit' });
  }

  if (cId) {
    const err = await validatePlacement(cId, position);
    if (err) return res.status(400).json({ error: err });
  }

  let finalIdTerrain = idTerrain ? idTerrain.trim() : null;
  if (finalIdTerrain) {
    const ok = await isIdTerrainUnique(finalIdTerrain);
    if (!ok) return res.status(409).json({ error: `L'ID "${finalIdTerrain}" est déjà utilisé` });
  } else {
    finalIdTerrain = await generateIdTerrain(parseInt(methodeId));
  }

  const tique = await prisma.tique.create({
    data: {
      idTerrain:       finalIdTerrain,
      methodeId:       parseInt(methodeId),
      hoteId:          hoteId ? parseInt(hoteId) : null,
      taxonomieId:     parseInt(taxonomieId),
      nombre:          cId && container.type === 'PLAQUE' ? 1 : nbInt,
      sexe:            sexe   || 'inconnu',
      stade:           stade           || null,
      gorge,
      partieCorpsHote: partieCorpsHote || null,
      solutionId:      solutionId      ? parseInt(solutionId) : null,
      containerId:     cId,
      position:        position        || null,
      dateCollecte:    dateCollecte    ? new Date(dateCollecte) : null,
      notes:           notes           || null,
    },
    include: includeBase,
  });
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Tique', entityId: tique.id,
    newValues: { idTerrain: tique.idTerrain, taxonomieId: tique.taxonomieId, nombre: tique.nombre,
      sexe: tique.sexe, stade: tique.stade, gorge: tique.gorge, methodeId: tique.methodeId, hoteId: tique.hoteId, dateCollecte: tique.dateCollecte } });
  return res.status(201).json({ message: 'Tique enregistrée', tique });
};

const updateTique = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    hoteId, taxonomieId, idTerrain, nombre, sexe, stade,
    gorge, partieCorpsHote, solutionId,
    containerId, position, dateCollecte, notes,
  } = req.body;

  const data = {};
  if (idTerrain !== undefined) {
    if (idTerrain) {
      const ok = await isIdTerrainUnique(idTerrain.trim(), 'tique', id);
      if (!ok) return res.status(409).json({ error: `L'ID "${idTerrain}" est déjà utilisé` });
      data.idTerrain = idTerrain.trim();
    } else {
      data.idTerrain = null;
    }
  }
  if (hoteId          !== undefined) data.hoteId          = hoteId ? parseInt(hoteId) : null;
  if (taxonomieId     !== undefined) data.taxonomieId     = parseInt(taxonomieId);
  if (nombre          !== undefined) data.nombre          = parseInt(nombre);
  if (sexe            !== undefined) data.sexe            = sexe;
  if (stade           !== undefined) data.stade           = stade;
  if (gorge           !== undefined) data.gorge           = gorge;
  if (partieCorpsHote !== undefined) data.partieCorpsHote = partieCorpsHote;
  if (solutionId      !== undefined) data.solutionId      = solutionId ? parseInt(solutionId) : null;
  if (containerId     !== undefined) data.containerId     = containerId ? parseInt(containerId) : null;
  if (position        !== undefined) data.position        = position;
  if (dateCollecte    !== undefined) data.dateCollecte    = dateCollecte ? new Date(dateCollecte) : null;
  if (notes           !== undefined) data.notes           = notes;

  const before = await prisma.tique.findUnique({
    where: { id },
    select: { idTerrain:true, taxonomieId:true, nombre:true, sexe:true, stade:true,
      gorge:true, partieCorpsHote:true, methodeId:true, hoteId:true, solutionId:true, dateCollecte:true, notes:true },
  });
  if (!before) return res.status(404).json({ error: 'Tique introuvable' });
  const tique = await prisma.tique.update({ where: { id }, data, include: includeBase });
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Tique', entityId: id,
    oldValues: before,
    newValues: { idTerrain: tique.idTerrain, taxonomieId: tique.taxonomieId, nombre: tique.nombre,
      sexe: tique.sexe, stade: tique.stade, gorge: tique.gorge, methodeId: tique.methodeId, solutionId: tique.solutionId, dateCollecte: tique.dateCollecte, notes: tique.notes } });
  return res.json({ message: 'Tique mise à jour', tique });
};

const deleteTique = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.tique.findUnique({
    where: { id },
    select: { idTerrain:true, taxonomieId:true, nombre:true, sexe:true, stade:true, gorge:true, methodeId:true, hoteId:true, dateCollecte:true },
  });
  if (!before) return res.status(404).json({ error: 'Tique introuvable' });
  await prisma.tique.delete({ where: { id } });
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Tique', entityId: id, oldValues: before });
  return res.json({ message: 'Tique supprimée' });
};

// Excel : col1=Genre, col2=Espèce, col3=Nombre, col4=Sexe, col5=Stade,
//         col6=StatutSanguin(N/G/Gr/SGr/NC ou Oui/Non), col7=PartieCorpsHôte,
//         col8=Contenant, col9=PositionPlaque, col10=DateCollecte, col11=Notes
const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const { methodeId } = req.body;
  if (!methodeId) return res.status(400).json({ error: 'methodeId obligatoire' });

  const methode = await prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } });
  if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const worksheet = workbook.worksheets[0];

  const results = { success: 0, errors: [] };
  const dataRows = [];

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({ row, rowNumber });
  });

  for (const { row, rowNumber } of rows) {
    const genre  = row.getCell(1).value?.toString().trim() || null;
    const espece = row.getCell(2).value?.toString().trim() || null;
    if (!genre) { results.errors.push({ ligne: rowNumber, erreur: 'Genre manquant' }); continue; }
    const taxonomieId = await resolveSpecimenTaxonomyId({ type: 'tique', genre, espece });
    if (!taxonomieId) {
      results.errors.push({ ligne: rowNumber, erreur: `Taxonomie "${genre}${espece ? ' '+espece : ''}" introuvable` });
      continue;
    }

    const sexe          = row.getCell(4).value?.toString().trim() || 'inconnu';
    const stade         = row.getCell(5).value?.toString().trim() || null;
    const rawGorge      = row.getCell(6).value?.toString().trim() || '';
    const gorge         = BLOOD_MEAL[normalizeKey(rawGorge)] ?? 'NC';
    const partieCorpsHote = row.getCell(7).value?.toString().trim() || null;
    const dateRaw       = row.getCell(8).value;
    const notes         = row.getCell(9).value?.toString().trim() || null;

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
      stade, gorge, partieCorpsHote,
      dateCollecte, notes,
    });
  }

  if (dataRows.length > 0) {
    const idsTerrain = await generateMany(parseInt(methodeId), dataRows.length);
    dataRows.forEach((d, i) => { d.idTerrain = idsTerrain[i]; });
    const created = await prisma.tique.createMany({ data: dataRows });
    results.success = created.count;
  }
  if (req.file.path) try { fs.unlinkSync(req.file.path); } catch {}

  return res.status(201).json({
    message: `Import terminé — ${results.success} tique(s)`,
    success: results.success,
    errors:  results.errors,
  });
};

const exportExcel = async (req, res) => {
  const { missionId, methodeId } = req.query;
  const where = {};
  if (methodeId) where.methodeId = parseInt(methodeId);
  if (missionId) where.methode   = { localite: { missionId: parseInt(missionId) } };

  const tiques = await prisma.tique.findMany({
    where,
    include: {
      methode:   { select: { typeMethode: { select: { nom: true } }, localite: { select: { nom: true, region: true, latitude: true, longitude: true, mission: { select: { ordreMission: true } } } } } },
      hote:      { include: { taxonomieHote: { select: { nom: true } } } },
      taxonomie: { include: { parent: { include: { parent: true } } } },
      solution:  { select: { nom: true } },
      container: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tiques');
  worksheet.columns = [
    { header: 'ID',                key: 'id',              width: 8  },
    { header: 'ID terrain',        key: 'idTerrain',       width: 14 },
    { header: 'Mission',           key: 'mission',         width: 15 },
    { header: 'Localité',          key: 'localite',        width: 20 },
    { header: 'Région',            key: 'region',          width: 15 },
    { header: 'Latitude',          key: 'latitude',        width: 12 },
    { header: 'Longitude',         key: 'longitude',       width: 12 },
    { header: 'Méthode',           key: 'methode',         width: 20 },
    { header: 'Taxonomie',         key: 'taxonomie',       width: 25 },
    { header: 'Nombre',            key: 'nombre',          width: 8  },
    { header: 'Sexe',              key: 'sexe',            width: 10 },
    { header: 'Stade',             key: 'stade',           width: 10 },
    { header: 'Gorgée',            key: 'gorge',           width: 10 },
    { header: 'Partie corps hôte', key: 'partieCorpsHote', width: 18 },
    { header: 'Hôte',              key: 'hote',            width: 20 },
    { header: 'Solution',          key: 'solution',        width: 15 },
    { header: 'Container',         key: 'container',       width: 18 },
    { header: 'Position',          key: 'position',        width: 12 },
    { header: 'Date collecte',     key: 'dateCollecte',    width: 15 },
    { header: 'Notes',             key: 'notes',           width: 30 },
  ];
  worksheet.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF854F0B' } };
  worksheet.getRow(1).alignment = { horizontal: 'center' };

  tiques.forEach((t) => {
    worksheet.addRow({
      id:              t.id,
      idTerrain:       t.idTerrain,
      mission:         t.methode.localite.mission.ordreMission,
      localite:        t.methode.localite.nom,
      region:          t.methode.localite.region,
      latitude:        t.methode.localite.latitude,
      longitude:       t.methode.localite.longitude,
      methode:         t.methode.typeMethode?.nom,
      taxonomie:       libelleTaxonomie(t.taxonomie),
      nombre:          t.nombre,
      sexe:            t.sexe,
      stade:           t.stade,
      gorge:           t.gorge,
      partieCorpsHote: t.partieCorpsHote,
      hote:            t.hote?.taxonomieHote?.nom,
      solution:        t.solution?.nom,
      container:       t.container?.code,
      position:        t.position,
      dateCollecte:    t.dateCollecte ? t.dateCollecte.toISOString().split('T')[0] : null,
      notes:           t.notes,
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=tiques.xlsx');
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = { listTiques, getTique, createTique, updateTique, deleteTique, importExcel, exportExcel };
