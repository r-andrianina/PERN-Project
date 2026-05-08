// backend/src/controllers/containers.controller.js
// CRUD + génération automatique du code + visualisation des positions occupées.

const prisma = require('../config/prisma');
const {
  CAPACITY, allPositions, generateContainerCode, getOccupiedPositions,
} = require('../utils/container');

const TYPES = ['PLAQUE', 'BOITE'];

// GET /api/v1/containers
const list = async (req, res) => {
  try {
    const { type, missionId, search } = req.query;
    const where = {};
    if (type)      where.type      = type;
    if (missionId) where.missionId = parseInt(missionId);
    if (search) {
      where.OR = [
        { code:  { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const containers = await prisma.container.findMany({
      where,
      include: {
        mission: { select: { id: true, ordreMission: true, projet: { select: { code: true } } } },
        _count:  { select: { moustiques: true, tiques: true, puces: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ total: containers.length, containers });
  } catch (err) {
    console.error('Erreur list containers :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// GET /api/v1/containers/:id (avec positions occupées détaillées)
const getOne = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const container = await prisma.container.findUnique({
      where: { id },
      include: {
        mission: { select: { id: true, ordreMission: true, dateDebut: true, projet: { select: { code: true, nom: true } } } },
      },
    });
    if (!container) return res.status(404).json({ error: 'Container introuvable' });

    const occupiedMap = await getOccupiedPositions(id);
    const occupied = Array.from(occupiedMap.entries()).map(([position, items]) => ({
      position, items,
    }));

    return res.json({
      container,
      capacity:  CAPACITY[container.type],
      positions: allPositions(container.type),
      occupied,
    });
  } catch (err) {
    console.error('Erreur getOne container :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// POST /api/v1/containers
const create = async (req, res) => {
  const { type, missionId, notes } = req.body;
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'type invalide (PLAQUE ou BOITE)' });
  if (!missionId)            return res.status(400).json({ error: 'missionId obligatoire' });

  try {
    const code = await generateContainerCode(type, missionId);
    const container = await prisma.container.create({
      data: {
        code, type,
        capacity:    CAPACITY[type],
        missionId:   parseInt(missionId),
        notes:       notes || null,
        createdById: req.user?.id ?? null,
      },
      include: {
        mission: { select: { id: true, ordreMission: true } },
      },
    });
    return res.status(201).json({ message: 'Container créé', container });
  } catch (err) {
    console.error('Erreur create container :', err.message);
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
};

// PUT /api/v1/containers/:id (notes uniquement, code/type/mission immuables)
const update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { notes } = req.body;
  try {
    const container = await prisma.container.update({
      where: { id }, data: { notes: notes ?? null },
    });
    return res.json({ message: 'Container mis à jour', container });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Container introuvable' });
    console.error('Erreur update container :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// DELETE /api/v1/containers/:id (refus si non vide)
const remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const c = await prisma.container.findUnique({
      where: { id },
      include: { _count: { select: { moustiques: true, tiques: true, puces: true } } },
    });
    if (!c) return res.status(404).json({ error: 'Container introuvable' });
    const total = c._count.moustiques + c._count.tiques + c._count.puces;
    if (total > 0) return res.status(409).json({ error: `Impossible — ${total} spécimen(s) dans ce container.` });
    await prisma.container.delete({ where: { id } });
    return res.json({ message: 'Container supprimé' });
  } catch (err) {
    console.error('Erreur delete container :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { list, getOne, create, update, remove };
