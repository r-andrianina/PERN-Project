const service = require('../services/missions.service');
const prisma  = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

const AUDIT_FIELDS = { ordreMission: true, dateDebut: true, dateFin: true, objet: true };

const listMissions = async (req, res) => {
  const missions = await service.list(req.query, req.user);
  res.json({ total: missions.length, missions });
};

const getMission = async (req, res) => res.json({ mission: await service.getById(parseInt(req.params.id), req.user) });

const createMission = async (req, res) => {
  const mission = await service.create(req.body);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Mission', entityId: mission.id, newValues: { nom: mission.ordreMission } });
  res.status(201).json({ message: 'Mission créée avec succès', mission });
};

const updateMission = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.mission.findUnique({ where: { id }, select: AUDIT_FIELDS });
  const mission = await service.update(id, req.body, req.user);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Mission', entityId: id, oldValues: before, newValues: { nom: mission.ordreMission, dateDebut: mission.dateDebut, dateFin: mission.dateFin } });
  res.json({ message: 'Mission mise à jour avec succès', mission });
};

const deleteMission = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.mission.findUnique({ where: { id }, select: AUDIT_FIELDS });
  await service.remove(id, req.user);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Mission', entityId: id, oldValues: before });
  res.json({ message: 'Mission supprimée avec succès' });
};

module.exports = { listMissions, getMission, createMission, updateMission, deleteMission };
