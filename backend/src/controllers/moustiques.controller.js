// backend/src/controllers/moustiques.controller.js
// CRUD factorisé via specimenFactory/specimenControllerFactory (voir ces
// fichiers pour le socle partagé avec tiques/puces/autres-spécimens) +
// Import/Export Excel et suppression en lot, propres à ce type.
// Conforme CDC : taxonomie obligatoire (FK), aucune saisie libre genre/espece.

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyIdCached, libelleTaxonomie } = require('../utils/taxonomyResolve');
const { generateMany } = require('../utils/idTerrain');
const { countSpecimenRefs, refsReason, findReferencedSpecimenIds } = require('../utils/specimenRefs');
const { logAudit, ACTIONS } = require('../utils/audit');
const { toParietéSOP, BLOOD_MEAL, normalizeKey } = require('../utils/importMappings');
const { getAccessibleProjetIds, canBypass, projetScopeWhere, assertProjetAccessible } = require('../utils/access');
const { createSpecimenService }    = require('../services/specimenFactory');
const { createSpecimenController } = require('./specimenControllerFactory');

const includeBase = {
  methode: {
    select: {
      id: true, numero: true,
      typeMethode: { select: { id: true, code: true, nom: true, requiresTrancheHoraire: true } },
      localite: {
        select: {
          id: true, nom: true, fokontany: true, region: true, district: true, commune: true,
          mission: {
            select: {
              id: true, ordreMission: true, projetId: true,
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

const service = createSpecimenService({
  model: 'moustique',
  entityLabel: 'Moustique',
  labelLower: 'moustique',
  refsKey: 'moustique',
  includeBase,
  searchClauses: (search) => [
    { taxonomie: { nom: { contains: search, mode: 'insensitive' } } },
    { taxonomie: { parent: { nom: { contains: search, mode: 'insensitive' } } } },
    { idTerrain: { contains: search, mode: 'insensitive' } },
    { notes:     { contains: search, mode: 'insensitive' } },
  ],
  taxonomieRequired: true,
  taxoType: 'moustique',
  hasHoteId: false,
  hasTypeSpecimen: false,
  splitContainerTypes: ['BOITE', 'PLAQUE'],
  extraFields: ['parite', 'repasSang', 'organePreleve', 'trancheHoraire'],
  deleteBlockedMessage: (refs) =>
    `Suppression impossible : ce moustique est référencé par ${refsReason(refs)}. Détachez-le du laboratoire / du pool avant de le supprimer.`,
});

const {
  list: listMoustiques, getOne: getMoustique, create: createMoustique,
  update: updateMoustique, remove: deleteMoustique,
} = createSpecimenController(service, {
  entityLabel: 'Moustique',
  itemsKey: 'moustiques',
  itemKey: 'moustique',
  messages: { created: 'Moustique enregistré', updated: 'Moustique mis à jour', deleted: 'Moustique supprimé' },
});

// POST /api/v1/moustiques/import   (multipart : file + methodeId)
// Excel : col1=Genre, col2=Espèce, col3=Nombre, col4=Sexe, col5=Stade,
//         col6=Parité, col7=StatutSanguin(N/G/Gr/SGr/NC ou Oui/Non), col8=OrganePrélevé,
//         col9=Contenant, col10=PositionPlaque, col11=DateCollecte, col12=Notes
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

  const results  = { success: 0, errors: [] };
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
    if (!genre) {
      results.errors.push({ ligne: rowNumber, erreur: 'Genre manquant' });
      continue;
    }
    const taxonomieId = await resolveSpecimenTaxonomyIdCached(taxoCache, { type: 'moustique', genre, espece });
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
  if (req.user && !canBypass(req.user.role)) {
    const ids = await getAccessibleProjetIds(req.user.id, req.user.role);
    where.AND = [...(where.AND || []), projetScopeWhere(['methode', 'localite', 'mission'], ids)];
  }

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

  // B6 — n'inclure que les spécimens non référencés en labo/pool ; les autres
  // sont épargnés (résultats scientifiques préservés) plutôt que de bloquer le lot.
  const matching   = await prisma.moustique.findMany({ where, select: { id: true } });
  const referenced = await findReferencedSpecimenIds('moustique', matching.map((r) => r.id));
  const deletable  = matching.map((r) => r.id).filter((i) => !referenced.has(i));

  const { count } = await prisma.moustique.deleteMany({ where: { id: { in: deletable } } });
  const skipped = referenced.size;
  await logAudit({
    req, action: ACTIONS.DELETE, entity: 'Moustique', entityId: null,
    oldValues: { bulkDelete: true, deleted: count, skipped, criteria: JSON.stringify(where) },
  });
  return res.json({
    deleted: count,
    skipped,
    message: `${count} moustique(s) supprimé(s)${skipped ? ` — ${skipped} conservé(s) car référencé(s) en laboratoire ou dans un pool` : ''}`,
  });
};

module.exports = {
  listMoustiques, getMoustique, createMoustique,
  updateMoustique, deleteMoustique, importExcel, exportExcel,
  bulkDeleteMoustiques,
};
