const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const crypto   = require('crypto');

const list = async ({ search, page, limit } = {}) => {
  const pageNum  = Math.max(parseInt(page)  || 1, 1);
  const limitNum = Math.min(parseInt(limit) || 50, 200);
  const where    = search ? { code: { contains: search, mode: 'insensitive' } } : {};

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

const getById = async (id) => {
  const pool = await prisma.pool.findUnique({
    where: { id },
    include: { membres: true, _count: { select: { manipulations: true } } },
  });
  if (!pool) throw AppError.notFound('Pool introuvable');
  return pool;
};

const create = async ({ code, notes, membres }, userId) => {
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

const remove = async (id) => {
  const pool = await prisma.pool.findUnique({ where: { id }, select: { id: true, _count: { select: { manipulations: true } } } });
  if (!pool) throw AppError.notFound('Pool introuvable');
  if (pool._count.manipulations > 0)
    throw AppError.conflict('Pool utilisé par des manipulations — suppression impossible');
  await prisma.pool.delete({ where: { id } });
};

module.exports = { list, getById, create, remove };
