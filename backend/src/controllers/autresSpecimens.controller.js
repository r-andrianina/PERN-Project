// backend/src/controllers/autresSpecimens.controller.js
// CRUD des Autres Spécimens (Phlébotomes, Culicoïdes, etc.)

const prisma  = require('../config/prisma');
const { generateIdTerrain, generateMany, isIdTerrainUnique } = require('../utils/idTerrain');
const { validatePlacement, nextAvailablePositions } = require('../utils/container');
const { logAudit, ACTIONS } = require('../utils/audit');

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
  typeSpecimen: { select: { id: true, code: true, nom: true } },
  taxonomie:    { include: { parent: { include: { parent: true } } } },
  solution:     { select: { id: true, nom: true, temperature: true } },
  container:    { select: { id: true, code: true, type: true } },
};

// GET /api/v1/autres-specimens
const listAutresSpecimens = async (req, res) => {
  const { methodeId, missionId, typeSpecimenId, sexe, search, page, limit } = req.query;
  const pageNum  = Math.max(parseInt(page)  || 1, 1);
  const limitNum = Math.min(parseInt(limit) || 50, 200);

  const where = {};
  if (methodeId)     where.methodeId     = parseInt(methodeId);
  if (typeSpecimenId) where.typeSpecimenId = parseInt(typeSpecimenId);
  if (sexe)          where.sexe          = sexe;
  if (missionId)     where.methode       = { localite: { missionId: parseInt(missionId) } };
  if (search) {
    where.OR = [
      { typeSpecimen: { nom: { contains: search, mode: 'insensitive' } } },
      { taxonomie:    { nom: { contains: search, mode: 'insensitive' } } },
      { idTerrain:    { contains: search, mode: 'insensitive' } },
      { notes:        { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, specimens] = await prisma.$transaction([
    prisma.autreSpecimen.count({ where }),
    prisma.autreSpecimen.findMany({
      where, include: includeBase, orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum, take: limitNum,
    }),
  ]);
  return res.json({ total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum), specimens });
};

// GET /api/v1/autres-specimens/:id
const getAutreSpecimen = async (req, res) => {
  const id = parseInt(req.params.id);
  const specimen = await prisma.autreSpecimen.findUnique({ where: { id }, include: includeBase });
  if (!specimen) return res.status(404).json({ error: 'Spécimen introuvable' });
  return res.json({ specimen });
};

// POST /api/v1/autres-specimens
const createAutreSpecimen = async (req, res) => {
  const {
    methodeId, typeSpecimenId, taxonomieId, idTerrain,
    nombre, sexe, stade, solutionId, containerId, position,
    dateCollecte, notes, attributs, insertMode,
  } = req.body;

  const methode = await prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } });
  if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });

  const typeSpec = await prisma.typeAutreSpecimen.findUnique({ where: { id: parseInt(typeSpecimenId) } });
  if (!typeSpec) return res.status(404).json({ error: 'Type de spécimen introuvable' });
  if (!typeSpec.actif) return res.status(400).json({ error: 'Ce type de spécimen est désactivé' });

  if (taxonomieId) {
    const taxo = await prisma.taxonomieSpecimen.findUnique({ where: { id: parseInt(taxonomieId) } });
    if (!taxo || !taxo.actif) return res.status(400).json({ error: 'Taxonomie introuvable ou désactivée' });
  }

  const nbInt = Math.max(parseInt(nombre) || 1, 1);
  const cId   = containerId ? parseInt(containerId) : null;
  let container = null;
  if (cId) {
    container = await prisma.container.findUnique({ where: { id: cId } });
    if (!container) return res.status(404).json({ error: 'Container introuvable' });
  }

  // Mode split
  if (cId && insertMode === 'split' && nbInt > 1) {
    const positions = await nextAvailablePositions(cId, nbInt);
    const ids = await generateMany(parseInt(methodeId), nbInt);
    const baseData = {
      methodeId: parseInt(methodeId), typeSpecimenId: parseInt(typeSpecimenId),
      taxonomieId: taxonomieId ? parseInt(taxonomieId) : null,
      nombre: 1, sexe: sexe || 'inconnu', stade: stade || null,
      solutionId: solutionId ? parseInt(solutionId) : null, containerId: cId,
      dateCollecte: dateCollecte ? new Date(dateCollecte) : null,
      notes: notes || null, attributs: attributs || null,
    };
    const data = positions.map((p, i) => ({ ...baseData, position: p, idTerrain: ids[i] }));
    const created = await prisma.autreSpecimen.createMany({ data });
    return res.status(201).json({ message: `${created.count} spécimen(s) enregistré(s)`, count: created.count, positions });
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

  const specimen = await prisma.autreSpecimen.create({
    data: {
      idTerrain: finalIdTerrain,
      methodeId: parseInt(methodeId), typeSpecimenId: parseInt(typeSpecimenId),
      taxonomieId: taxonomieId ? parseInt(taxonomieId) : null,
      nombre: nbInt, sexe: sexe || 'inconnu', stade: stade || null,
      solutionId: solutionId ? parseInt(solutionId) : null,
      containerId: cId, position: position || null,
      dateCollecte: dateCollecte ? new Date(dateCollecte) : null,
      notes: notes || null, attributs: attributs || null,
    },
    include: includeBase,
  });
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'AutreSpecimen', entityId: specimen.id,
    newValues: { idTerrain: specimen.idTerrain, typeSpecimenId, nombre: specimen.nombre, methodeId } });
  return res.status(201).json({ message: 'Spécimen enregistré', specimen });
};

// PUT /api/v1/autres-specimens/:id
const updateAutreSpecimen = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    typeSpecimenId, taxonomieId, idTerrain, nombre, sexe, stade,
    solutionId, containerId, position, dateCollecte, notes, attributs,
  } = req.body;

  const data = {};
  if (idTerrain !== undefined) {
    if (idTerrain) {
      const ok = await isIdTerrainUnique(idTerrain.trim(), 'autreSpecimen', id);
      if (!ok) return res.status(409).json({ error: `L'ID "${idTerrain}" est déjà utilisé` });
      data.idTerrain = idTerrain.trim();
    } else {
      data.idTerrain = null;
    }
  }
  if (typeSpecimenId !== undefined) data.typeSpecimenId = parseInt(typeSpecimenId);
  if (taxonomieId    !== undefined) data.taxonomieId    = taxonomieId ? parseInt(taxonomieId) : null;
  if (nombre         !== undefined) data.nombre         = parseInt(nombre);
  if (sexe           !== undefined) data.sexe           = sexe;
  if (stade          !== undefined) data.stade          = stade;
  if (solutionId     !== undefined) data.solutionId     = solutionId ? parseInt(solutionId) : null;
  if (containerId    !== undefined) data.containerId    = containerId ? parseInt(containerId) : null;
  if (position       !== undefined) data.position       = position;
  if (dateCollecte   !== undefined) data.dateCollecte   = dateCollecte ? new Date(dateCollecte) : null;
  if (notes          !== undefined) data.notes          = notes;
  if (attributs      !== undefined) data.attributs      = attributs;

  const before = await prisma.autreSpecimen.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: 'Spécimen introuvable' });

  const specimen = await prisma.autreSpecimen.update({ where: { id }, data, include: includeBase });
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'AutreSpecimen', entityId: id, oldValues: before, newValues: data });
  return res.json({ message: 'Spécimen mis à jour', specimen });
};

// DELETE /api/v1/autres-specimens/:id
const deleteAutreSpecimen = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.autreSpecimen.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: 'Spécimen introuvable' });
  await prisma.autreSpecimen.delete({ where: { id } });
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'AutreSpecimen', entityId: id, oldValues: before });
  return res.json({ message: 'Spécimen supprimé' });
};

module.exports = { listAutresSpecimens, getAutreSpecimen, createAutreSpecimen, updateAutreSpecimen, deleteAutreSpecimen };
