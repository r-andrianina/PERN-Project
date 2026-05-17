const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');

const INCLUDE_LIST = {
  projet:      { select: { id: true, code: true, nom: true } },
  chefMission: { select: { id: true, nom: true, prenom: true } },
  agents:      { include: { user: { select: { id: true, nom: true, prenom: true, role: true } } } },
  _count:      { select: { localites: true } },
};

const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  projet:    { select: { id: true, code: true, nom: true, statut: true } },
  chefMission: { select: { id: true, nom: true, prenom: true, email: true } },
  localites: {
    include: {
      methodes: { include: { _count: { select: { moustiques: true, tiques: true, puces: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

const list = async ({ statut, projetId, search } = {}) => {
  const where = {};
  if (statut)   where.statut   = statut;
  if (projetId) where.projetId = parseInt(projetId);
  if (search) {
    where.OR = [
      { ordreMission: { contains: search, mode: 'insensitive' } },
      { observations: { contains: search, mode: 'insensitive' } },
    ];
  }
  return prisma.mission.findMany({ where, include: INCLUDE_LIST, orderBy: { dateDebut: 'desc' } });
};

const getById = async (id) => {
  const mission = await prisma.mission.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  if (!mission) throw AppError.notFound('Mission introuvable');
  return mission;
};

const create = async (data) => {
  const { ordreMission, projetId, chefMissionId, dateDebut, dateFin, statut, observations, agentIds } = data;

  if (Array.isArray(agentIds) && agentIds.length > 5)
    throw AppError.badRequest('Maximum 5 agents de terrain par mission');

  const existing = await prisma.mission.findUnique({ where: { ordreMission } });
  if (existing) throw AppError.conflict(`L'ordre de mission "${ordreMission}" existe déjà`);

  const projet = await prisma.projet.findUnique({ where: { id: parseInt(projetId) } });
  if (!projet) throw AppError.notFound('Projet introuvable');

  return prisma.mission.create({
    data: {
      ordreMission:  ordreMission.trim(),
      projetId:      parseInt(projetId),
      chefMissionId: chefMissionId ? parseInt(chefMissionId) : null,
      dateDebut:     new Date(dateDebut),
      dateFin:       dateFin ? new Date(dateFin) : null,
      statut:        statut || 'planifiee',
      observations:  observations || null,
      agents: agentIds?.length ? { create: agentIds.map(uid => ({ userId: parseInt(uid) })) } : undefined,
    },
    include: INCLUDE_LIST,
  });
};

const update = async (id, data) => {
  const { chefMissionId, dateDebut, dateFin, statut, observations, agentIds } = data;

  if (Array.isArray(agentIds) && agentIds.length > 5)
    throw AppError.badRequest('Maximum 5 agents de terrain par mission');

  const patch = {};
  if (chefMissionId !== undefined) patch.chefMissionId = chefMissionId ? parseInt(chefMissionId) : null;
  if (dateDebut)                   patch.dateDebut     = new Date(dateDebut);
  if (dateFin !== undefined)       patch.dateFin       = dateFin ? new Date(dateFin) : null;
  if (statut)                      patch.statut        = statut;
  if (observations !== undefined)  patch.observations  = observations;

  if (agentIds !== undefined) {
    await prisma.missionAgent.deleteMany({ where: { missionId: id } });
    if (agentIds.length > 0) patch.agents = { create: agentIds.map(uid => ({ userId: parseInt(uid) })) };
  }

  return prisma.mission.update({
    where: { id }, data: patch,
    include: { ...INCLUDE_LIST, _count: { select: { localites: true } } },
  });
};

const remove = async (id) => {
  const mission = await prisma.mission.findUnique({
    where: { id }, include: { _count: { select: { localites: true } } },
  });
  if (!mission) throw AppError.notFound('Mission introuvable');
  if (mission._count.localites > 0)
    throw AppError.conflict(`Impossible — cette mission contient ${mission._count.localites} localité(s). Supprimez d'abord les localités.`);
  await prisma.mission.delete({ where: { id } });
};

module.exports = { list, getById, create, update, remove };
