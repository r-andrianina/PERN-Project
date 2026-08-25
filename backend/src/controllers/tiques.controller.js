// backend/src/controllers/tiques.controller.js
// CRUD factorisé via specimenFactory/specimenControllerFactory (voir ces
// fichiers pour le socle partagé avec moustiques/puces/autres-spécimens) +
// Import/Export Excel, propres à ce type (avec hôte associé).
// Conforme CDC : taxonomie obligatoire (FK).

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyIdCached, libelleTaxonomie } = require('../utils/taxonomyResolve');
const { generateMany } = require('../utils/idTerrain');
const { refsReason } = require('../utils/specimenRefs');
const { BLOOD_MEAL, normalizeKey } = require('../utils/importMappings');
const { getAccessibleProjetIds, canBypass, projetScopeWhere, assertProjetAccessible } = require('../utils/access');
const { createSpecimenService }    = require('../services/specimenFactory');
const { createSpecimenController } = require('./specimenControllerFactory');

const includeBase = {
  methode: {
    select: {
      id: true, numero: true,
      typeMethode: { select: { id: true, code: true, nom: true } },
      localite: {
        select: {
          id: true, nom: true, fokontany: true, region: true, district: true, commune: true,
          mission: { select: { id: true, ordreMission: true, projetId: true, projet: { select: { code: true, nom: true } } } },
        },
      },
    },
  },
  hote:      { include: { taxonomieHote: { select: { nom: true, niveau: true } } } },
  taxonomie: { include: { parent: { include: { parent: true } } } },
  solution:  { select: { id: true, nom: true } },
  container: { select: { id: true, code: true, type: true } },
};

const service = createSpecimenService({
  model: 'tique',
  entityLabel: 'Tique',
  labelLower: 'tique',
  refsKey: 'tique',
  includeBase,
  searchClauses: (search) => [
    { taxonomie: { nom: { contains: search, mode: 'insensitive' } } },
    { taxonomie: { parent: { nom: { contains: search, mode: 'insensitive' } } } },
    { idTerrain: { contains: search, mode: 'insensitive' } },
    { notes:     { contains: search, mode: 'insensitive' } },
  ],
  taxonomieRequired: true,
  taxoType: 'tique',
  hasHoteId: true,
  hasTypeSpecimen: false,
  splitContainerTypes: ['BOITE'],
  extraFields: ['gorge', 'partieCorpsHote'],
  deleteBlockedMessage: (refs) =>
    `Suppression impossible : cette tique est référencée par ${refsReason(refs)}. Détachez-la du laboratoire / du pool avant de la supprimer.`,
});

const {
  list: listTiques, getOne: getTique, create: createTique,
  update: updateTique, remove: deleteTique,
} = createSpecimenController(service, {
  entityLabel: 'Tique',
  itemsKey: 'tiques',
  itemKey: 'tique',
  messages: { created: 'Tique enregistrée', updated: 'Tique mise à jour', deleted: 'Tique supprimée' },
});

// Excel : col1=Genre, col2=Espèce, col3=Nombre, col4=Sexe, col5=Stade,
//         col6=StatutSanguin(N/G/Gr/SGr/NC ou Oui/Non), col7=PartieCorpsHôte,
//         col8=Contenant, col9=PositionPlaque, col10=DateCollecte, col11=Notes
const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const { methodeId } = req.body;
  if (!methodeId) return res.status(400).json({ error: 'methodeId obligatoire' });

  const methode = await prisma.methodeCollecte.findUnique({
    where: { id: parseInt(methodeId) },
    include: { localite: { select: { mission: { select: { projetId: true } } } } },
  });
  if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });
  if (req.user && !canBypass(req.user.role)) {
    const ids = await getAccessibleProjetIds(req.user.id, req.user.role);
    assertProjetAccessible(methode.localite.mission.projetId, ids);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const worksheet = workbook.worksheets[0];

  const results = { success: 0, errors: [] };
  const dataRows = [];
  const taxoCache = new Map(); // évite de re-résoudre le même (genre, espèce) à chaque ligne

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({ row, rowNumber });
  });

  for (const { row, rowNumber } of rows) {
    const genre  = row.getCell(1).value?.toString().trim() || null;
    const espece = row.getCell(2).value?.toString().trim() || null;
    if (!genre) { results.errors.push({ ligne: rowNumber, erreur: 'Genre manquant' }); continue; }
    const taxonomieId = await resolveSpecimenTaxonomyIdCached(taxoCache, { type: 'tique', genre, espece });
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
  if (req.user && !canBypass(req.user.role)) {
    const ids = await getAccessibleProjetIds(req.user.id, req.user.role);
    where.AND = [...(where.AND || []), projetScopeWhere(['methode', 'localite', 'mission'], ids)];
  }

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
