// src/services/projets.service.js
// Logique métier des projets, extraite du contrôleur.
// Les fonctions ici ne parlent ni HTTP ni res/req — elles lancent des AppError.

const prisma    = require('../config/prisma');
const AppError  = require('../utils/AppError');

const INCLUDE_PROJET = {
  responsable: { select: { id: true, nom: true, prenom: true, email: true } },
  _count:      { select: { missions: true } },
};

const list = async ({ statut, search } = {}) => {
  const where = {};
  if (statut) where.statut = statut;
  if (search) {
    where.OR = [
      { nom:  { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }
  return prisma.projet.findMany({ where, include: INCLUDE_PROJET, orderBy: { createdAt: 'desc' } });
};

const getById = async (id) => {
  const projet = await prisma.projet.findUnique({
    where: { id },
    include: {
      ...INCLUDE_PROJET,
      missions: {
        include: {
          chefMission: { select: { id: true, nom: true, prenom: true } },
          _count:      { select: { localites: true } },
        },
        orderBy: { dateDebut: 'desc' },
      },
    },
  });
  if (!projet) throw AppError.notFound('Projet introuvable');
  return projet;
};

const create = async (data) => {
  const existing = await prisma.projet.findUnique({ where: { code: data.code } });
  if (existing) throw AppError.conflict(`Le code "${data.code}" est déjà utilisé`);

  return prisma.projet.create({
    data: {
      code:          data.code,
      nom:           data.nom,
      description:   data.description  ?? null,
      porteur:       data.porteur       ?? null,
      responsableId: data.responsableId ?? null,
      dateDebut:     data.dateDebut     ? new Date(data.dateDebut) : null,
      dateFin:       data.dateFin       ? new Date(data.dateFin)   : null,
      statut:        data.statut        ?? 'actif',
    },
    include: INCLUDE_PROJET,
  });
};

const update = async (id, data) => {
  const update = {};
  if (data.nom         !== undefined) update.nom           = data.nom;
  if (data.description !== undefined) update.description   = data.description;
  if (data.porteur     !== undefined) update.porteur       = data.porteur;
  if (data.responsableId !== undefined) update.responsableId = data.responsableId;
  if (data.dateDebut   !== undefined) update.dateDebut     = data.dateDebut ? new Date(data.dateDebut) : null;
  if (data.dateFin     !== undefined) update.dateFin       = data.dateFin   ? new Date(data.dateFin)   : null;
  if (data.statut      !== undefined) update.statut        = data.statut;

  return prisma.projet.update({
    where: { id },
    data:  update,
    include: { ...INCLUDE_PROJET },
  });
};

const remove = async (id) => {
  const projet = await prisma.projet.findUnique({
    where: { id },
    include: { _count: { select: { missions: true } } },
  });
  if (!projet) throw AppError.notFound('Projet introuvable');
  if (projet._count.missions > 0) {
    throw AppError.conflict(`Impossible — ce projet contient ${projet._count.missions} mission(s). Supprimez d'abord les missions.`);
  }
  await prisma.projet.delete({ where: { id } });
};

module.exports = { list, getById, create, update, remove };
