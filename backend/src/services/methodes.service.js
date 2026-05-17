const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateIdTerrain, getLocaliteByMethode } = require('../utils/idTerrain');

const INCLUDE_REFS = {
  localite: {
    select: {
      id: true, nom: true, region: true,
      mission: { select: { id: true, ordreMission: true } },
    },
  },
  typeMethode:       { select: { id: true, code: true, nom: true } },
  typeHabitat:       { select: { id: true, nom: true } },
  typeEnvironnement: { select: { id: true, nom: true } },
};

const list = async ({ localiteId, typeMethodeId, search } = {}) => {
  const where = {};
  if (localiteId)    where.localiteId    = parseInt(localiteId);
  if (typeMethodeId) where.typeMethodeId = parseInt(typeMethodeId);
  if (search) {
    where.OR = [
      { typeMethode: { nom:  { contains: search, mode: 'insensitive' } } },
      { typeMethode: { code: { contains: search, mode: 'insensitive' } } },
      { notes:       { contains: search, mode: 'insensitive' } },
    ];
  }
  return prisma.methodeCollecte.findMany({
    where,
    include: { ...INCLUDE_REFS, _count: { select: { moustiques: true, tiques: true, puces: true } } },
    orderBy: { createdAt: 'desc' },
  });
};

const getById = async (id) => {
  const methode = await prisma.methodeCollecte.findUnique({
    where: { id },
    include: {
      localite: {
        include: {
          mission: { select: { id: true, ordreMission: true, projet: { select: { code: true, nom: true } } } },
        },
      },
      typeMethode: true, typeHabitat: true, typeEnvironnement: true,
      moustiques: { select: { id: true, nombre: true, sexe: true, taxonomieId: true } },
      tiques:     { select: { id: true, nombre: true, sexe: true, taxonomieId: true } },
      puces:      { select: { id: true, nombre: true, sexe: true, taxonomieId: true } },
      _count:     { select: { moustiques: true, tiques: true, puces: true } },
    },
  });
  if (!methode) throw AppError.notFound('Méthode introuvable');
  return methode;
};

const create = async (data) => {
  const { localiteId, typeMethodeId, typeHabitatId, typeEnvironnementId, latitude, longitude, dateCollecte, heureDebut, heureFin, notes } = data;

  const [localite, typeMethode] = await Promise.all([
    prisma.localite.findUnique({ where: { id: parseInt(localiteId) } }),
    prisma.typeMethodeCollecte.findUnique({ where: { id: parseInt(typeMethodeId) } }),
  ]);
  if (!localite)    throw AppError.notFound('Localité introuvable');
  if (!typeMethode) throw AppError.notFound('Type de méthode introuvable');
  if (!typeMethode.actif) throw AppError.badRequest('Ce type de méthode est désactivé');

  return prisma.methodeCollecte.create({
    data: {
      localiteId:          parseInt(localiteId),
      typeMethodeId:       parseInt(typeMethodeId),
      typeHabitatId:       typeHabitatId       ? parseInt(typeHabitatId)       : null,
      typeEnvironnementId: typeEnvironnementId ? parseInt(typeEnvironnementId) : null,
      latitude:            latitude     ? parseFloat(latitude)  : null,
      longitude:           longitude    ? parseFloat(longitude) : null,
      dateCollecte:        dateCollecte ? new Date(dateCollecte) : null,
      heureDebut:          heureDebut   || null,
      heureFin:            heureFin     || null,
      notes:               notes        || null,
    },
    include: INCLUDE_REFS,
  });
};

const update = async (id, data) => {
  const { typeMethodeId, typeHabitatId, typeEnvironnementId, latitude, longitude, dateCollecte, heureDebut, heureFin, notes } = data;
  const patch = {};
  if (typeMethodeId       !== undefined) patch.typeMethodeId       = typeMethodeId       ? parseInt(typeMethodeId)       : null;
  if (typeHabitatId       !== undefined) patch.typeHabitatId       = typeHabitatId       ? parseInt(typeHabitatId)       : null;
  if (typeEnvironnementId !== undefined) patch.typeEnvironnementId = typeEnvironnementId ? parseInt(typeEnvironnementId) : null;
  if (latitude            !== undefined) patch.latitude            = latitude     ? parseFloat(latitude)  : null;
  if (longitude           !== undefined) patch.longitude           = longitude    ? parseFloat(longitude) : null;
  if (dateCollecte        !== undefined) patch.dateCollecte        = dateCollecte ? new Date(dateCollecte) : null;
  if (heureDebut          !== undefined) patch.heureDebut          = heureDebut;
  if (heureFin            !== undefined) patch.heureFin            = heureFin;
  if (notes               !== undefined) patch.notes               = notes;

  return prisma.methodeCollecte.update({
    where: { id }, data: patch,
    include: { ...INCLUDE_REFS, _count: { select: { moustiques: true, tiques: true, puces: true } } },
  });
};

const remove = async (id) => {
  const methode = await prisma.methodeCollecte.findUnique({
    where: { id }, include: { _count: { select: { moustiques: true, tiques: true, puces: true } } },
  });
  if (!methode) throw AppError.notFound('Méthode introuvable');
  const total = methode._count.moustiques + methode._count.tiques + methode._count.puces;
  if (total > 0) throw AppError.conflict(`Impossible — ${total} spécimen(s) liés à cette méthode.`);
  await prisma.methodeCollecte.delete({ where: { id } });
};

const previewId = async (methodeId) => {
  const localite = await getLocaliteByMethode(methodeId);
  if (!localite) throw AppError.notFound('Méthode introuvable');
  if (!localite.code) {
    return {
      idTerrain: null,
      warning:   "Cette localité n'a pas de code attribué — l'ID terrain ne pourra pas être généré.",
      localite:  { id: localite.id, nom: localite.nom },
    };
  }
  const idTerrain = await generateIdTerrain(methodeId);
  return { idTerrain, localite: { id: localite.id, code: localite.code, nom: localite.nom } };
};

module.exports = { list, getById, create, update, remove, previewId };
