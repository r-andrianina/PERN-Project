// backend/src/controllers/puces.controller.js
// CRUD factorisé via specimenFactory/specimenControllerFactory (voir ces
// fichiers pour le socle partagé avec moustiques/tiques/autres-spécimens) +
// Import/Export Excel, propres à ce type (avec hôte associé).
// Conforme CDC : taxonomie obligatoire (FK).

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyIdCached, libelleTaxonomie } = require('../utils/taxonomyResolve');
const { generateMany } = require('../utils/idTerrain');
const { refsReason } = require('../utils/specimenRefs');
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
  model: 'puce',
  entityLabel: 'Puce',
  labelLower: 'puce',
  refsKey: 'puce',
  includeBase,
  searchClauses: (search) => [
    { taxonomie: { nom: { contains: search, mode: 'insensitive' } } },
    { taxonomie: { parent: { nom: { contains: search, mode: 'insensitive' } } } },
    { idTerrain: { contains: search, mode: 'insensitive' } },
    { notes:     { contains: search, mode: 'insensitive' } },
  ],
  taxonomieRequired: true,
  taxoType: 'puce',
  hasHoteId: true,
  hasTypeSpecimen: false,
  splitContainerTypes: ['BOITE'],
  extraFields: [],
  deleteBlockedMessage: (refs) =>
    `Suppression impossible : cette puce est référencée par ${refsReason(refs)}. Détachez-la du laboratoire / du pool avant de la supprimer.`,
});

const {
  list: listPuces, getOne: getPuce, create: createPuce,
  update: updatePuce, remove: deletePuce,
} = createSpecimenController(service, {
  entityLabel: 'Puce',
  itemsKey: 'puces',
  itemKey: 'puce',
  messages: { created: 'Puce enregistrée', updated: 'Puce mise à jour', deleted: 'Puce supprimée' },
});

// Excel : col1=Genre, col2=Espèce, col3=Nombre, col4=Sexe, col5=Stade,
//         col6=Contenant, col7=PositionPlaque, col8=DateCollecte, col9=Notes
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
    const taxonomieId = await resolveSpecimenTaxonomyIdCached(taxoCache, { type: 'puce', genre, espece });
    if (!taxonomieId) {
      results.errors.push({ ligne: rowNumber, erreur: `Taxonomie "${genre}${espece ? ' '+espece : ''}" introuvable` });
      continue;
    }

    const sexe          = row.getCell(4).value?.toString().trim() || 'inconnu';
    const stade         = row.getCell(5).value?.toString().trim() || null;
    const dateRaw       = row.getCell(6).value;
    const notes         = row.getCell(7).value?.toString().trim() || null;

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
      stade,
      dateCollecte, notes,
    });
  }

  if (dataRows.length > 0) {
    const idsTerrain = await generateMany(parseInt(methodeId), dataRows.length);
    dataRows.forEach((d, i) => { d.idTerrain = idsTerrain[i]; });
    const created = await prisma.puce.createMany({ data: dataRows });
    results.success = created.count;
  }
  if (req.file.path) try { fs.unlinkSync(req.file.path); } catch {}

  return res.status(201).json({
    message: `Import terminé — ${results.success} puce(s)`,
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

  const puces = await prisma.puce.findMany({
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
  const worksheet = workbook.addWorksheet('Puces');
  worksheet.columns = [
    { header: 'ID',             key: 'id',             width: 8  },
    { header: 'ID terrain',     key: 'idTerrain',      width: 14 },
    { header: 'Mission',        key: 'mission',        width: 15 },
    { header: 'Localité',       key: 'localite',       width: 20 },
    { header: 'Région',         key: 'region',         width: 15 },
    { header: 'Latitude',       key: 'latitude',       width: 12 },
    { header: 'Longitude',      key: 'longitude',      width: 12 },
    { header: 'Méthode',        key: 'methode',        width: 20 },
    { header: 'Taxonomie',      key: 'taxonomie',      width: 25 },
    { header: 'Nombre',         key: 'nombre',         width: 8  },
    { header: 'Sexe',           key: 'sexe',           width: 10 },
    { header: 'Stade',          key: 'stade',          width: 10 },
    { header: 'Hôte',           key: 'hote',           width: 20 },
    { header: 'Solution',       key: 'solution',       width: 15 },
    { header: 'Container',      key: 'container',      width: 18 },
    { header: 'Position',       key: 'position',       width: 12 },
    { header: 'Date collecte',  key: 'dateCollecte',   width: 15 },
    { header: 'Notes',          key: 'notes',          width: 30 },
  ];
  worksheet.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF185FA5' } };
  worksheet.getRow(1).alignment = { horizontal: 'center' };

  puces.forEach((p) => {
    worksheet.addRow({
      id:             p.id,
      idTerrain:      p.idTerrain,
      mission:        p.methode.localite.mission.ordreMission,
      localite:       p.methode.localite.nom,
      region:         p.methode.localite.region,
      latitude:       p.methode.localite.latitude,
      longitude:      p.methode.localite.longitude,
      methode:        p.methode.typeMethode?.nom,
      taxonomie:      libelleTaxonomie(p.taxonomie),
      nombre:         p.nombre,
      sexe:           p.sexe,
      stade:          p.stade,
      hote:           p.hote?.taxonomieHote?.nom,
      solution:       p.solution?.nom,
      container:      p.container?.code,
      position:       p.position,
      dateCollecte:   p.dateCollecte ? p.dateCollecte.toISOString().split('T')[0] : null,
      notes:          p.notes,
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=puces.xlsx');
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = { listPuces, getPuce, createPuce, updatePuce, deletePuce, importExcel, exportExcel };
