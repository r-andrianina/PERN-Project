// backend/src/controllers/methodes.controller.js
// Méthodes de collecte (instances opérationnelles).
// Tous les champs scientifiques structurants pointent vers des référentiels.

const prisma = require('../config/prisma');

const includeRefs = {
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

// GET /api/v1/methodes
const listMethodes = async (req, res) => {
  try {
    const { localiteId, typeMethodeId, search } = req.query;
    const where = {};
    if (localiteId)    where.localiteId    = parseInt(localiteId);
    if (typeMethodeId) where.typeMethodeId = parseInt(typeMethodeId);
    if (search) {
      where.OR = [
        { typeMethode: { nom: { contains: search, mode: 'insensitive' } } },
        { typeMethode: { code: { contains: search, mode: 'insensitive' } } },
        { notes:       { contains: search, mode: 'insensitive' } },
      ];
    }

    const methodes = await prisma.methodeCollecte.findMany({
      where,
      include: {
        ...includeRefs,
        _count: { select: { moustiques: true, tiques: true, puces: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ total: methodes.length, methodes });
  } catch (err) {
    console.error('Erreur listMethodes :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// GET /api/v1/methodes/:id
const getMethode = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const methode = await prisma.methodeCollecte.findUnique({
      where: { id },
      include: {
        localite: {
          include: {
            mission: {
              select: {
                id: true, ordreMission: true,
                projet: { select: { code: true, nom: true } },
              },
            },
          },
        },
        typeMethode:       true,
        typeHabitat:       true,
        typeEnvironnement: true,
        moustiques: { select: { id: true, nombre: true, sexe: true, taxonomieId: true } },
        tiques:     { select: { id: true, nombre: true, sexe: true, taxonomieId: true } },
        puces:      { select: { id: true, nombre: true, sexe: true, taxonomieId: true } },
        _count:     { select: { moustiques: true, tiques: true, puces: true } },
      },
    });
    if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });
    return res.json({ methode });
  } catch (err) {
    console.error('Erreur getMethode :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// POST /api/v1/methodes
const createMethode = async (req, res) => {
  const {
    localiteId, typeMethodeId, typeHabitatId, typeEnvironnementId,
    latitude, longitude, dateCollecte, heureDebut, heureFin, notes,
  } = req.body;

  if (!localiteId || !typeMethodeId) {
    return res.status(400).json({ error: 'localiteId et typeMethodeId sont obligatoires' });
  }

  try {
    const [localite, typeMethode] = await Promise.all([
      prisma.localite.findUnique({ where: { id: parseInt(localiteId) } }),
      prisma.typeMethodeCollecte.findUnique({ where: { id: parseInt(typeMethodeId) } }),
    ]);
    if (!localite)    return res.status(404).json({ error: 'Localité introuvable' });
    if (!typeMethode) return res.status(404).json({ error: 'Type de méthode introuvable' });
    if (!typeMethode.actif) return res.status(400).json({ error: 'Ce type de méthode est désactivé' });

    const methode = await prisma.methodeCollecte.create({
      data: {
        localiteId:          parseInt(localiteId),
        typeMethodeId:       parseInt(typeMethodeId),
        typeHabitatId:       typeHabitatId       ? parseInt(typeHabitatId)       : null,
        typeEnvironnementId: typeEnvironnementId ? parseInt(typeEnvironnementId) : null,
        latitude:            latitude     ? parseFloat(latitude)  : null,
        longitude:           longitude    ? parseFloat(longitude) : null,
        dateCollecte:        dateCollecte ? new Date(dateCollecte): null,
        heureDebut:          heureDebut   || null,
        heureFin:            heureFin     || null,
        notes:               notes        || null,
      },
      include: includeRefs,
    });

    return res.status(201).json({ message: 'Méthode de collecte créée avec succès', methode });
  } catch (err) {
    console.error('Erreur createMethode :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// PUT /api/v1/methodes/:id
const updateMethode = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    typeMethodeId, typeHabitatId, typeEnvironnementId,
    latitude, longitude, dateCollecte, heureDebut, heureFin, notes,
  } = req.body;

  const data = {};
  if (typeMethodeId       !== undefined) data.typeMethodeId       = typeMethodeId ? parseInt(typeMethodeId) : null;
  if (typeHabitatId       !== undefined) data.typeHabitatId       = typeHabitatId ? parseInt(typeHabitatId) : null;
  if (typeEnvironnementId !== undefined) data.typeEnvironnementId = typeEnvironnementId ? parseInt(typeEnvironnementId) : null;
  if (latitude            !== undefined) data.latitude            = latitude     ? parseFloat(latitude)  : null;
  if (longitude           !== undefined) data.longitude           = longitude    ? parseFloat(longitude) : null;
  if (dateCollecte        !== undefined) data.dateCollecte        = dateCollecte ? new Date(dateCollecte) : null;
  if (heureDebut          !== undefined) data.heureDebut          = heureDebut;
  if (heureFin            !== undefined) data.heureFin            = heureFin;
  if (notes               !== undefined) data.notes               = notes;

  try {
    const methode = await prisma.methodeCollecte.update({
      where: { id }, data,
      include: {
        ...includeRefs,
        _count: { select: { moustiques: true, tiques: true, puces: true } },
      },
    });
    return res.json({ message: 'Méthode mise à jour avec succès', methode });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Méthode introuvable' });
    console.error('Erreur updateMethode :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// DELETE /api/v1/methodes/:id
const deleteMethode = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const methode = await prisma.methodeCollecte.findUnique({
      where: { id },
      include: { _count: { select: { moustiques: true, tiques: true, puces: true } } },
    });
    if (!methode) return res.status(404).json({ error: 'Méthode introuvable' });

    const total = methode._count.moustiques + methode._count.tiques + methode._count.puces;
    if (total > 0) return res.status(409).json({ error: `Impossible — ${total} spécimen(s) liés.` });

    await prisma.methodeCollecte.delete({ where: { id } });
    return res.json({ message: 'Méthode supprimée avec succès' });
  } catch (err) {
    console.error('Erreur deleteMethode :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { listMethodes, getMethode, createMethode, updateMethode, deleteMethode };
