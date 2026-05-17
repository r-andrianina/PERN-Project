const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { CAPACITY, allPositions, generateContainerCode, getOccupiedPositions } = require('../utils/container');

const TYPES = ['PLAQUE', 'BOITE'];

const list = async ({ type, missionId, search } = {}) => {
  const where = {};
  if (type)      where.type      = type;
  if (missionId) where.missionId = parseInt(missionId);
  if (search) {
    where.OR = [
      { code:  { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }
  return prisma.container.findMany({
    where,
    include: {
      mission: { select: { id: true, ordreMission: true, projet: { select: { code: true } } } },
      _count:  { select: { moustiques: true, tiques: true, puces: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getById = async (id) => {
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      mission: { select: { id: true, ordreMission: true, dateDebut: true, projet: { select: { code: true, nom: true } } } },
    },
  });
  if (!container) throw AppError.notFound('Container introuvable');

  const occupiedMap = await getOccupiedPositions(id);
  const occupied = Array.from(occupiedMap.entries()).map(([position, items]) => ({ position, items }));

  return {
    container,
    capacity:  CAPACITY[container.type],
    positions: allPositions(container.type),
    occupied,
  };
};

const create = async (data, userId = null) => {
  const { type, missionId, notes } = data;
  if (!TYPES.includes(type)) throw AppError.badRequest('type invalide (PLAQUE ou BOITE)');

  const code = await generateContainerCode(type, missionId);
  return prisma.container.create({
    data: {
      code, type,
      capacity:    CAPACITY[type],
      missionId:   parseInt(missionId),
      notes:       notes || null,
      createdById: userId,
    },
    include: { mission: { select: { id: true, ordreMission: true } } },
  });
};

const update = async (id, data) => {
  return prisma.container.update({
    where: { id }, data: { notes: data.notes ?? null },
  });
};

const remove = async (id) => {
  const c = await prisma.container.findUnique({
    where: { id }, include: { _count: { select: { moustiques: true, tiques: true, puces: true } } },
  });
  if (!c) throw AppError.notFound('Container introuvable');
  const total = c._count.moustiques + c._count.tiques + c._count.puces;
  if (total > 0) throw AppError.conflict(`Impossible — ${total} spécimen(s) dans ce container.`);
  await prisma.container.delete({ where: { id } });
};

module.exports = { list, getById, create, update, remove };
