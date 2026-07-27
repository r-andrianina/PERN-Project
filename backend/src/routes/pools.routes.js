const express      = require('express');
const router       = express.Router();
const prisma       = require('../config/prisma');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');
const crypto       = require('crypto');

router.use(verifyToken);

// GET /api/v1/pools?search=&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
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
  return res.json({ total, page: pageNum, pages: Math.ceil(total / limitNum), pools });
}));

// GET /api/v1/pools/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const pool = await prisma.pool.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { membres: true, _count: { select: { manipulations: true } } },
  });
  if (!pool) return res.status(404).json({ error: 'Pool introuvable' });
  return res.json({ pool });
}));

// POST /api/v1/pools
router.post('/', requireMinRole('technicien'), asyncHandler(async (req, res) => {
  const { code, membres, notes } = req.body;

  if (!Array.isArray(membres) || membres.length === 0)
    return res.status(400).json({ error: 'Au moins un spécimen requis' });

  const poolCode = code?.trim() || `POOL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const pool = await prisma.pool.create({
    data: {
      code:            poolCode,
      nombreIndividus: membres.length,
      notes:           notes ?? null,
      createdById:     req.user.id,
      membres: {
        create: membres.map((m) => ({
          specimenType: m.specimenType,
          specimenId:   parseInt(m.specimenId),
        })),
      },
    },
    include: { membres: true },
  });
  return res.status(201).json({ message: 'Pool créé', pool });
}));

// DELETE /api/v1/pools/:id (admin seulement)
router.delete('/:id', requireMinRole('admin'), asyncHandler(async (req, res) => {
  const id   = parseInt(req.params.id);
  const pool = await prisma.pool.findUnique({ where: { id }, select: { id: true, _count: { select: { manipulations: true } } } });
  if (!pool) return res.status(404).json({ error: 'Pool introuvable' });
  if (pool._count.manipulations > 0)
    return res.status(409).json({ error: 'Pool utilisé par des manipulations — suppression impossible' });
  await prisma.pool.delete({ where: { id } });
  return res.json({ message: 'Pool supprimé' });
}));

module.exports = router;
