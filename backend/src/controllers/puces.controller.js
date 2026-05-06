// backend/src/controllers/puces.controller.js
// CRUD + Import/Export Excel des puces (avec hôte associé)
// Conforme CDC : taxonomie obligatoire (FK).

const prisma  = require('../config/prisma');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const { resolveSpecimenTaxonomyId, libelleTaxonomie } = require('../utils/taxonomyResolve');

const includeBase = {
  methode: {
    select: {
      id: true,
      typeMethode: { select: { id: true, code: true, nom: true } },
      localite: {
        select: {
          id: true, nom: true, region: true,
          mission: { select: { id: true, ordreMission: true, projet: { select: { code: true } } } },
        },
      },
    },
  },
  hote:      { include: { taxonomieHote: { select: { nom: true, niveau: true } } } },
  taxonomie: { include: { parent: { include: { parent: true } } } },
  solution:  { select: { id: true, nom: true } },
};

const listPuces = async (req, res) => {
  try {
    const { methodeId, missionId, taxonomieId, sexe } = req.query;
    const where = {};
    if (methodeId)   where.methodeId   = parseInt(methodeId);
    if (taxonomieId) where.taxonomieId = parseInt(taxonomieId);
    if (sexe)        where.sexe        = sexe;
    if (missionId)   where.methode     = { localite: { missionId: parseInt(missionId) } };

    const puces = await prisma.puce.findMany({
      where, include: includeBase, orderBy: { createdAt: 'desc' },
    });
    return res.json({ total: puces.length, puces });
  } catch (err) {
    console.error('Erreur listPuces :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const getPuce = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const puce = await prisma.puce.findUnique({ where: { id }, include: includeBase });
    if (!puce) return res.status(404).json({ error: 'Puce introuvable' });
    return res.json({ puce });
  } catch (err) {
    console.error('Erreur getPuce :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const createPuce = async (req, res) => {
  const {
    methodeId, hoteId, taxonomieId, nombre, sexe, stade,
    solutionId, contenant, positionPlaque, dateCollecte, notes,
  } = req.body;

  if (!methodeId)   return res.status(400).json({ error: 'methodeId obligatoire' });
  if (!taxonomieId) return res.status(400).json({ error: 'taxonomieId obligatoire (référentiel)' });

  try {
    const [methode, taxo] = await Promise.all([
      prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } }),
      prisma.taxonomieSpecimen.findUnique({ where: { id: parseInt(taxonomieId) } }),
    ]);
    if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });
    if (!taxo)    return res.status(404).json({ error: 'Taxonomie introuvable' });
    if (!taxo.actif) return res.status(400).json({ error: 'Cette taxonomie est désactivée' });
    if (taxo.type && taxo.type !== 'puce') return res.status(400).json({ error: 'Taxonomie de type non-puce' });

    const puce = await prisma.puce.create({
      data: {
        methodeId:      parseInt(methodeId),
        hoteId:         hoteId ? parseInt(hoteId) : null,
        taxonomieId:    parseInt(taxonomieId),
        nombre:         nombre ? parseInt(nombre) : 1,
        sexe:           sexe   || 'inconnu',
        stade:          stade          || null,
        solutionId:     solutionId     ? parseInt(solutionId) : null,
        contenant:      contenant      || null,
        positionPlaque: positionPlaque || null,
        dateCollecte:   dateCollecte   ? new Date(dateCollecte) : null,
        notes:          notes          || null,
      },
      include: includeBase,
    });
    return res.status(201).json({ message: 'Puce enregistrée', puce });
  } catch (err) {
    console.error('Erreur createPuce :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const updatePuce = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    hoteId, taxonomieId, nombre, sexe, stade,
    solutionId, contenant, positionPlaque, dateCollecte, notes,
  } = req.body;

  const data = {};
  if (hoteId         !== undefined) data.hoteId         = hoteId ? parseInt(hoteId) : null;
  if (taxonomieId    !== undefined) data.taxonomieId    = parseInt(taxonomieId);
  if (nombre         !== undefined) data.nombre         = parseInt(nombre);
  if (sexe           !== undefined) data.sexe           = sexe;
  if (stade          !== undefined) data.stade          = stade;
  if (solutionId     !== undefined) data.solutionId     = solutionId ? parseInt(solutionId) : null;
  if (contenant      !== undefined) data.contenant      = contenant;
  if (positionPlaque !== undefined) data.positionPlaque = positionPlaque;
  if (dateCollecte   !== undefined) data.dateCollecte   = dateCollecte ? new Date(dateCollecte) : null;
  if (notes          !== undefined) data.notes          = notes;

  try {
    const puce = await prisma.puce.update({ where: { id }, data, include: includeBase });
    return res.json({ message: 'Puce mise à jour', puce });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Puce introuvable' });
    console.error('Erreur updatePuce :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const deletePuce = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.puce.delete({ where: { id } });
    return res.json({ message: 'Puce supprimée' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Puce introuvable' });
    console.error('Erreur deletePuce :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Excel : col1=Genre, col2=Espèce, col3=Nombre, col4=Sexe, col5=Stade,
//         col6=Contenant, col7=PositionPlaque, col8=DateCollecte, col9=Notes
const importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const { methodeId } = req.body;
  if (!methodeId) return res.status(400).json({ error: 'methodeId obligatoire' });

  try {
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
      const taxonomieId = await resolveSpecimenTaxonomyId({ type: 'puce', genre, espece });
      if (!taxonomieId) {
        results.errors.push({ ligne: rowNumber, erreur: `Taxonomie "${genre}${espece ? ' '+espece : ''}" introuvable` });
        continue;
      }

      const sexe          = row.getCell(4).value?.toString().trim() || 'inconnu';
      const stade         = row.getCell(5).value?.toString().trim() || null;
      const contenant     = row.getCell(6).value?.toString().trim() || null;
      const positionPlaque= row.getCell(7).value?.toString().trim() || null;
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
        stade,
        contenant, positionPlaque, dateCollecte, notes,
      });
    }

    if (dataRows.length > 0) {
      const created = await prisma.puce.createMany({ data: dataRows });
      results.success = created.count;
    }
    if (req.file.path) try { fs.unlinkSync(req.file.path); } catch {}

    return res.status(201).json({
      message: `Import terminé — ${results.success} puce(s)`,
      success: results.success,
      errors:  results.errors,
    });
  } catch (err) {
    console.error('Erreur importExcel puces :', err.message);
    return res.status(500).json({ error: "Erreur lors de l'import Excel" });
  }
};

const exportExcel = async (req, res) => {
  try {
    const { missionId, methodeId } = req.query;
    const where = {};
    if (methodeId) where.methodeId = parseInt(methodeId);
    if (missionId) where.methode   = { localite: { missionId: parseInt(missionId) } };

    const puces = await prisma.puce.findMany({
      where,
      include: {
        methode:   { select: { typeMethode: { select: { nom: true } }, localite: { select: { nom: true, region: true, latitude: true, longitude: true, mission: { select: { ordreMission: true } } } } } },
        hote:      { include: { taxonomieHote: { select: { nom: true } } } },
        taxonomie: { include: { parent: { include: { parent: true } } } },
        solution:  { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Puces');
    worksheet.columns = [
      { header: 'ID',             key: 'id',             width: 8  },
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
      { header: 'Contenant',      key: 'contenant',      width: 15 },
      { header: 'Position plaque',key: 'positionPlaque', width: 15 },
      { header: 'Date collecte',  key: 'dateCollecte',   width: 15 },
      { header: 'Notes',          key: 'notes',          width: 30 },
    ];
    worksheet.getRow(1).font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF185FA5' } };
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    puces.forEach((p) => {
      worksheet.addRow({
        id:             p.id,
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
        contenant:      p.contenant,
        positionPlaque: p.positionPlaque,
        dateCollecte:   p.dateCollecte ? p.dateCollecte.toISOString().split('T')[0] : null,
        notes:          p.notes,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=puces.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erreur exportExcel puces :', err.message);
    return res.status(500).json({ error: "Erreur lors de l'export Excel" });
  }
};

module.exports = { listPuces, getPuce, createPuce, updatePuce, deletePuce, importExcel, exportExcel };
