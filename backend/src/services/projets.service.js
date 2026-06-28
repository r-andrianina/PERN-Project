// src/services/projets.service.js
// Logique métier des projets, extraite du contrôleur.
// Les fonctions ici ne parlent ni HTTP ni res/req — elles lancent des AppError.

const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { getAccessibleProjetIds, canBypass } = require('../utils/access');

const INCLUDE_PROJET = {
  responsable: { select: { id: true, nom: true, prenom: true, email: true } },
  _count:      { select: { missions: true, membres: true } },
};

// ── Liste (filtrée par appartenance pour les non-admins/superviseurs) ──────────

const list = async ({ statut, search } = {}, user) => {
  const where = {};
  if (statut) where.statut = statut;
  if (search) {
    where.OR = [
      { nom:  { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (user) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    if (ids !== null) where.id = { in: ids };
  }

  return prisma.projet.findMany({ where, include: INCLUDE_PROJET, orderBy: { createdAt: 'desc' } });
};

// ── Détail (vérifie l'appartenance pour les non-admins/superviseurs) ──────────

const getById = async (id, user) => {
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

  if (user && !canBypass(user.role)) {
    const isMembre = await prisma.membreProjet.findUnique({
      where: { projetId_userId: { projetId: id, userId: user.id } },
    });
    if (!isMembre) throw AppError.forbidden('Accès refusé — vous n\'êtes pas membre de ce projet');
  }

  return projet;
};

// ── Création (l'auteur est automatiquement ajouté comme membre) ───────────────

const create = async (data, creatorId) => {
  const existing = await prisma.projet.findUnique({ where: { code: data.code } });
  if (existing) throw AppError.conflict(`Le code "${data.code}" est déjà utilisé`);

  const projet = await prisma.projet.create({
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

  // Auto-add the creator as a member (sauf pour admin/superviseur qui bypass)
  if (creatorId) {
    await prisma.membreProjet.create({
      data: { projetId: projet.id, userId: creatorId, addedById: creatorId },
    });
  }

  return projet;
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

const getStats = async (id) => {
  const where = { methode: { localite: { mission: { projetId: id } } } };
  const [moustiques, tiques, puces] = await Promise.all([
    prisma.moustique.count({ where }),
    prisma.tique.count({ where }),
    prisma.puce.count({ where }),
  ]);
  return {
    parType: { moustique: moustiques, tique: tiques, puce: puces },
    total:   moustiques + tiques + puces,
  };
};

// ── Membres ───────────────────────────────────────────────────────────────────

const listMembres = async (projetId) => {
  const projet = await prisma.projet.findUnique({ where: { id: projetId } });
  if (!projet) throw AppError.notFound('Projet introuvable');

  return prisma.membreProjet.findMany({
    where:   { projetId },
    include: { user: { select: { id: true, nom: true, prenom: true, email: true, role: true } } },
    orderBy: { addedAt: 'asc' },
  });
};

const addMembre = async (projetId, userId, addedById) => {
  const [projet, user] = await Promise.all([
    prisma.projet.findUnique({ where: { id: projetId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, actif: true } }),
  ]);
  if (!projet) throw AppError.notFound('Projet introuvable');
  if (!user)   throw AppError.notFound('Utilisateur introuvable');
  if (!user.actif) throw AppError.badRequest('Cet utilisateur est inactif');

  try {
    return await prisma.membreProjet.create({
      data:    { projetId, userId, addedById: addedById ?? null },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true, role: true } } },
    });
  } catch (err) {
    if (err.code === 'P2002') throw AppError.conflict('Cet utilisateur est déjà membre du projet');
    throw err;
  }
};

const removeMembre = async (projetId, userId) => {
  try {
    await prisma.membreProjet.delete({
      where: { projetId_userId: { projetId, userId } },
    });
  } catch (err) {
    if (err.code === 'P2025') throw AppError.notFound('Ce membre n\'existe pas dans ce projet');
    throw err;
  }
};

module.exports = { list, getById, create, update, remove, getStats, listMembres, addMembre, removeMembre };
