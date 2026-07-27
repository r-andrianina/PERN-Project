const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateHoteId } = require('../utils/idTerrain');

const INCLUDE_BASE = {
  methode: {
    select: {
      id: true,
      typeMethode: { select: { nom: true } },
      localite:    { select: { nom: true, region: true } },
    },
  },
  taxonomieHote: { include: { parent: { include: { parent: true } } } },
  _count: { select: { tiques: true, puces: true } },
};

const list = async ({ methodeId, taxonomieHoteId, sexe } = {}) => {
  const where = {};
  if (methodeId)       where.methodeId       = parseInt(methodeId);
  if (taxonomieHoteId) where.taxonomieHoteId = parseInt(taxonomieHoteId);
  if (sexe)            where.sexe            = sexe;
  return prisma.hote.findMany({ where, include: INCLUDE_BASE, orderBy: { createdAt: 'desc' } });
};

const getById = async (id) => {
  const hote = await prisma.hote.findUnique({ where: { id }, include: INCLUDE_BASE });
  if (!hote) throw AppError.notFound('Hôte introuvable');
  return hote;
};

const create = async (data) => {
  const { methodeId, taxonomieHoteId, idTerrain, especeLocale, age, sexe, etatSante, vaccination, notes } = data;

  const [methode, taxo] = await Promise.all([
    prisma.methodeCollecte.findUnique({ where: { id: parseInt(methodeId) } }),
    prisma.taxonomieHote.findUnique({ where: { id: parseInt(taxonomieHoteId) } }),
  ]);
  if (!methode) throw AppError.notFound('Méthode introuvable');
  if (!taxo)    throw AppError.notFound('Taxonomie hôte introuvable');
  if (!taxo.actif) throw AppError.badRequest('Cette taxonomie hôte est désactivée');

  return prisma.hote.create({
    data: {
      methodeId:       parseInt(methodeId),
      taxonomieHoteId: parseInt(taxonomieHoteId),
      idTerrain:       idTerrain || await generateHoteId(methodeId),
      especeLocale:    especeLocale || null,
      age:             age          || null,
      sexe:            sexe         || 'inconnu',
      etatSante:       etatSante    || null,
      vaccination:     vaccination  || null,
      notes:           notes        || null,
    },
    include: INCLUDE_BASE,
  });
};

const update = async (id, data) => {
  const { taxonomieHoteId, idTerrain, especeLocale, age, sexe, etatSante, vaccination, notes } = data;
  const patch = {};
  if (taxonomieHoteId !== undefined) patch.taxonomieHoteId = parseInt(taxonomieHoteId);
  if (idTerrain       !== undefined) patch.idTerrain       = idTerrain;
  if (especeLocale    !== undefined) patch.especeLocale    = especeLocale;
  if (age             !== undefined) patch.age             = age;
  if (sexe            !== undefined) patch.sexe            = sexe;
  if (etatSante       !== undefined) patch.etatSante       = etatSante;
  if (vaccination     !== undefined) patch.vaccination     = vaccination;
  if (notes           !== undefined) patch.notes           = notes;
  return prisma.hote.update({ where: { id }, data: patch, include: INCLUDE_BASE });
};

const remove = async (id) => {
  const hote = await prisma.hote.findUnique({
    where: { id }, include: { _count: { select: { tiques: true, puces: true } } },
  });
  if (!hote) throw AppError.notFound('Hôte introuvable');
  const total = hote._count.tiques + hote._count.puces;
  if (total > 0) throw AppError.conflict(`Impossible — ${total} spécimen(s) lié(s) à cet hôte.`);
  await prisma.hote.delete({ where: { id } });
};

module.exports = { list, getById, create, update, remove };
