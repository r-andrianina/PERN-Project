const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const crypto   = require('crypto');
const {
  getAccessiblePoolIds,
  assertPoolAccessible,
  assertMembresAccessibles,
} = require('../utils/poolAccess');

const list = async ({ search, page, limit } = {}, user) => {
  const pageNum  = Math.max(parseInt(page)  || 1, 1);
  const limitNum = Math.min(parseInt(limit) || 50, 200);
  const where    = search ? { code: { contains: search, mode: 'insensitive' } } : {};

  // null = utilisateur bypass, donc aucun filtre. Une liste VIDE reste un
  // filtre : `id: { in: [] }` ne renvoie rien, ce qui est le comportement
  // voulu pour un chercheur membre d'aucun projet.
  const poolIds = await getAccessiblePoolIds(user);
  if (poolIds !== null) where.id = { in: poolIds };

  const [total, pools] = await prisma.$transaction([
    prisma.pool.count({ where }),
    prisma.pool.findMany({
      where,
      include: { membres: true, _count: { select: { manipulations: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);
  return { total, page: pageNum, pages: Math.ceil(total / limitNum), pools };
};

const getById = async (id, user) => {
  const pool = await prisma.pool.findUnique({
    where: { id },
    include: { membres: true, _count: { select: { manipulations: true } } },
  });
  if (!pool) throw AppError.notFound('Pool introuvable');
  await assertPoolAccessible(id, user);
  return pool;
};

const create = async ({ code, notes, membres }, userId, user) => {
  // Avant toute écriture : les spécimens existent, et ils sont dans le
  // périmètre de l'utilisateur. Sans ce contrôle, un technicien pouvait
  // constituer un pool à partir des spécimens de n'importe quel projet.
  await assertMembresAccessibles(membres, user);

  const poolCode = code || `POOL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return prisma.pool.create({
    data: {
      code:            poolCode,
      nombreIndividus: membres.length,
      notes:           notes ?? null,
      createdById:     userId,
      membres: { create: membres.map((m) => ({ specimenType: m.specimenType, specimenId: m.specimenId })) },
    },
    include: { membres: true },
  });
};

const remove = async (id, user) => {
  const pool = await prisma.pool.findUnique({ where: { id }, select: { id: true, _count: { select: { manipulations: true } } } });
  if (!pool) throw AppError.notFound('Pool introuvable');
  // La route est réservée à admin, qui bypasse — le contrôle ne coûte donc
  // rien aujourd'hui, et protège le jour où cette route s'ouvrira.
  await assertPoolAccessible(id, user);
  if (pool._count.manipulations > 0)
    throw AppError.conflict('Pool utilisé par des manipulations — suppression impossible');
  await prisma.pool.delete({ where: { id } });
};

module.exports = { list, getById, create, remove };
