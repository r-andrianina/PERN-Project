const service = require('../services/missions.service');

const listMissions = async (req, res) => {
  const missions = await service.list(req.query);
  res.json({ total: missions.length, missions });
};
const getMission    = async (req, res) => res.json({ mission: await service.getById(parseInt(req.params.id)) });
const createMission = async (req, res) => res.status(201).json({ message: 'Mission créée avec succès',   mission: await service.create(req.body) });
const updateMission = async (req, res) => res.json({ message: 'Mission mise à jour avec succès',         mission: await service.update(parseInt(req.params.id), req.body) });
const deleteMission = async (req, res) => { await service.remove(parseInt(req.params.id)); res.json({ message: 'Mission supprimée avec succès' }); };

module.exports = { listMissions, getMission, createMission, updateMission, deleteMission };
