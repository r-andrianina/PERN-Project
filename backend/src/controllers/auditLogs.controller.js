// backend/src/controllers/auditLogs.controller.js
// Lecture des logs d'audit (admin uniquement)

const prisma = require('../config/prisma');

const list = async (req, res) => {
  try {
    const {
      entity, entityId, action, userId,
      dateFrom, dateTo, limit = 100, offset = 0,
    } = req.query;

    const where = {};
    if (entity)   where.entity   = entity;
    if (entityId) where.entityId = parseInt(entityId);
    if (action)   where.action   = action;
    if (userId)   where.userId   = parseInt(userId);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, prenom: true, nom: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit) || 100, 500),
        skip: parseInt(offset) || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({ total, count: items.length, items });
  } catch (err) {
    console.error('Erreur list auditLogs :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const getOne = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const item = await prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, prenom: true, nom: true, email: true, role: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Entrée d\'audit introuvable' });
    return res.json({ item });
  } catch (err) {
    console.error('Erreur getOne auditLogs :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { list, getOne };
