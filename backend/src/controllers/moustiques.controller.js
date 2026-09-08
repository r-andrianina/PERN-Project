// backend/src/controllers/moustiques.controller.js
// CRUD factorisé via specimenFactory/specimenControllerFactory (voir ces
// fichiers pour le socle partagé avec tiques/puces/autres-spécimens) +
// Import/Export Excel et suppression en lot, propres à ce type.
// Conforme CDC : taxonomie obligatoire (FK), aucune saisie libre genre/espece.

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyIdCached, decomposeTaxon } = require('../utils/taxonomyResolve');
const { chargerEquipes } = require('../utils/missionEquipe');
const { formatTrancheHoraire } = require('../utils/trancheHoraire');
const { generateMany } = require('../utils/idTerrain');
const { countSpecimenRefs, refsReason, findReferencedSpecimenIds } = require('../utils/specimenRefs');
const { logAudit, ACTIONS } = require('../utils/audit');
const { BLOOD_MEAL, normalizeKey } = require('../utils/importMappings');
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
          // `numero` : nécessaire au code d'instance (BG_1), aligné sur l'export
          // de recherche. Sans lui, la colonne "Méthode" affichait le nom du
          // type et non l'instance de piège.
          numero: true,
          // cf. specimenSearch.js : coordonnées du piège, source primaire des
          // colonnes GPS ; celles de la localité ne servent que de repli.
          latitude: true,
          longitude: true,
          typeMethode: { select: { nom: true, code: true } },
          localite: {
            select: {
              nom: true, region: true, district: true, commune: true, fokontany: true,
              latitude: true, longitude: true,
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
      taxonomie:    { include: { parent: { include: { parent: { include: { parent: true } } } } } },
      solution:  { select: { nom: true } },
      container: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Moustiques');
  // Colonnes alignées sur l'export de recherche (recherche.controller.js) :
  // même ordre, mêmes en-têtes, mêmes conventions. Deux exports des mêmes
  // données avec des schémas différents forçaient l'utilisateur à retraiter
  // selon la provenance du fichier.
  // Différences assumées : pas de colonne "Type" (export mono-type) ni "Hôte"
  // (les moustiques ne sont pas rattachés à un hôte) ; "Organe prélevé" en plus,
  // spécifique aux moustiques.
  worksheet.columns = [
    { header: 'ID',              key: 'id',             width: 8  },
    { header: 'ID terrain',      key: 'idTerrain',      width: 14 },
    { header: 'Genre',           key: 'genre',          width: 20 },
    { header: 'Espèce',          key: 'espece',         width: 20 },
    { header: 'Nombre',          key: 'nombre',         width: 8  },
    { header: 'Sexe',            key: 'sexe',           width: 10 },
    { header: 'Stade',           key: 'stade',          width: 10 },
    { header: 'Parité',          key: 'parite',         width: 10 },
    { header: 'Statut sanguin',  key: 'statutSanguin',  width: 14 },
    { header: 'Organe prélevé',  key: 'organePreleve',  width: 15 },
    { header: 'Date collecte',   key: 'dateCollecte',   width: 15 },
    { header: 'Tranche horaire', key: 'trancheHoraire', width: 14 },
    { header: 'Projet',          key: 'projet',         width: 22 },
    { header: 'Mission',         key: 'mission',        width: 15 },
    { header: 'Chef de mission', key: 'chefMission',    width: 22 },
    { header: 'Agents',          key: 'agents',         width: 30 },
    { header: 'Localité',        key: 'localite',       width: 20 },
    { header: 'Région',          key: 'region',         width: 15 },
    { header: 'District',        key: 'district',       width: 15 },
    { header: 'Commune',         key: 'commune',        width: 15 },
    { header: 'Fokontany',       key: 'fokontany',      width: 18 },
    { header: 'Latitude',        key: 'latitude',       width: 12 },
    { header: 'Longitude',       key: 'longitude',      width: 12 },
    { header: 'Méthode',         key: 'methode',        width: 14 },
    { header: 'Type de méthode', key: 'typeMethode',    width: 22 },
    { header: 'Solution',        key: 'solution',       width: 15 },
    { header: 'Container',       key: 'container',      width: 18 },
    { header: 'Position',        key: 'position',       width: 12 },
    { header: 'Notes',           key: 'notes',          width: 30 },
  ];
  worksheet.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
  worksheet.getRow(1).alignment = { horizontal: 'center' };

  const equipes = await chargerEquipes(moustiques.map((m) => m.methode?.localite?.mission?.id));

  moustiques.forEach((m) => {
    const { genre, espece } = decomposeTaxon(m.taxonomie);
    const equipe = equipes.get(m.methode?.localite?.mission?.id) ?? {};
    worksheet.addRow({
      id:             m.id,
      idTerrain:      m.idTerrain,
      genre:          genre  ?? '',
      espece:         espece ?? '',
      nombre:         m.nombre,
      sexe:           m.sexe,
      stade:          m.stade,
      parite:         m.parite,
      statutSanguin:  m.repasSang,
      organePreleve:  m.organePreleve,
      dateCollecte:   m.dateCollecte ? m.dateCollecte.toISOString().split('T')[0] : null,
      trancheHoraire: formatTrancheHoraire(m.trancheHoraire),
      projet:         m.methode.localite.mission.projet?.nom
        ?? m.methode.localite.mission.projet?.code ?? '',
      mission:        m.methode.localite.mission.ordreMission,
      chefMission:    equipe.chef   ?? '',
      agents:         equipe.agents ?? '',
      localite:       m.methode.localite.nom,
      region:         m.methode.localite.region,
      district:       m.methode.localite.district,
      commune:        m.methode.localite.commune,
      fokontany:      m.methode.localite.fokontany,
      // cf. recherche.controller.js : piège d'abord, localité en repli.
      latitude:       m.methode.latitude  ?? m.methode.localite.latitude,
      longitude:      m.methode.longitude ?? m.methode.localite.longitude,
      methode:        m.methode.typeMethode?.code && m.methode.numero != null
        ? `${m.methode.typeMethode.code}_${m.methode.numero}`
        : (m.methode.typeMethode?.code ?? ''),
      typeMethode:    m.methode.typeMethode?.nom ?? '',
      solution:       m.solution?.nom,
      container:      m.container?.code,
      position:       m.position,
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
