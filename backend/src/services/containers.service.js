const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { CAPACITY, allPositions, generateContainerCode, getOccupiedPositions } = require('../utils/container');
const { getAccessibleProjetIds, canBypass, projetScopeWhere, assertProjetAccessible } = require('../utils/access');

const TYPES = ['PLAQUE', 'BOITE'];

const list = async ({ type, missionId, search } = {}, user) => {
  const where = {};
  if (type)      where.type      = type;
  if (missionId) where.missionId = parseInt(missionId);
  if (search) {
    where.OR = [
      { code:  { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    Object.assign(where, projetScopeWhere(['mission'], ids));
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

const getById = async (id, user) => {
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      mission: { select: { id: true, ordreMission: true, dateDebut: true, projetId: true, projet: { select: { code: true, nom: true } } } },
    },
  });
  if (!container) throw AppError.notFound('Container introuvable');
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(container.mission.projetId, ids);
  }

  const occupiedMap = await getOccupiedPositions(id);
  const occupied = Array.from(occupiedMap.entries()).map(([position, items]) => ({ position, items }));

  return {
    container,
    capacity:  CAPACITY[container.type],
    positions: allPositions(container.type),
    occupied,
  };
};

const create = async (data, user = null) => {
  const { type, missionId, notes } = data;
  if (!TYPES.includes(type)) throw AppError.badRequest('type invalide (PLAQUE ou BOITE)');

  if (user && !canBypass(user.role)) {
    const mission = await prisma.mission.findUnique({ where: { id: parseInt(missionId) }, select: { projetId: true } });
    if (!mission) throw AppError.notFound('Mission introuvable');
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(mission.projetId, ids);
  }

  const code = await generateContainerCode(type, missionId);
  return prisma.container.create({
    data: {
      code, type,
      capacity:    CAPACITY[type],
      missionId:   parseInt(missionId),
      notes:       notes || null,
      createdById: user?.id ?? null,
    },
    include: { mission: { select: { id: true, ordreMission: true } } },
  });
};

const update = async (id, data, user) => {
  if (user && !canBypass(user.role)) {
    const current = await prisma.container.findUnique({ where: { id }, select: { mission: { select: { projetId: true } } } });
    if (!current) throw AppError.notFound('Container introuvable');
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(current.mission.projetId, ids);
  }
  return prisma.container.update({
    where: { id }, data: { notes: data.notes ?? null },
  });
};

const remove = async (id, user) => {
  const c = await prisma.container.findUnique({
    where: { id },
    include: {
      _count: { select: { moustiques: true, tiques: true, puces: true } },
      mission: { select: { projetId: true } },
    },
  });
  if (!c) throw AppError.notFound('Container introuvable');
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(c.mission.projetId, ids);
  }
  const total = c._count.moustiques + c._count.tiques + c._count.puces;
  if (total > 0) throw AppError.conflict(`Impossible — ${total} spécimen(s) dans ce container.`);
  await prisma.container.delete({ where: { id } });
};

module.exports = { list, getById, create, update, remove };
