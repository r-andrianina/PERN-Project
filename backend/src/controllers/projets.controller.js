// backend/src/controllers/projets.controller.js
// Ce contrôleur ne fait que :
//   1. Lire les données HTTP (req.body, req.params, req.query)
//   2. Déléguer au service
//   3. Sérialiser la réponse HTTP

const service = require('../services/projets.service');
const prisma  = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

const AUDIT_FIELDS = { nom: true, code: true, statut: true, porteur: true, dateDebut: true, dateFin: true };

const listProjets = async (req, res) => {
  const projets = await service.list(req.query);
  res.json({ total: projets.length, projets });
};

const getProjet = async (req, res) => {
  const projet = await service.getById(parseInt(req.params.id));
  res.json({ projet });
};

const createProjet = async (req, res) => {
  const projet = await service.create(req.body);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Projet', entityId: projet.id, newValues: { nom: projet.nom, code: projet.code, statut: projet.statut } });
  res.status(201).json({ message: 'Projet créé avec succès', projet });
};

const updateProjet = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.projet.findUnique({ where: { id }, select: AUDIT_FIELDS });
  const projet = await service.update(id, req.body);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Projet', entityId: id, oldValues: before, newValues: { nom: projet.nom, code: projet.code, statut: projet.statut, porteur: projet.porteur, dateDebut: projet.dateDebut, dateFin: projet.dateFin } });
  res.json({ message: 'Projet mis à jour avec succès', projet });
};

const deleteProjet = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.projet.findUnique({ where: { id }, select: AUDIT_FIELDS });
  await service.remove(id);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Projet', entityId: id, oldValues: before });
  res.json({ message: 'Projet supprimé avec succès' });
};

const getProjetStats = async (req, res) => {
  const stats = await service.getStats(parseInt(req.params.id));
  res.json(stats);
};

module.exports = { listProjets, getProjet, createProjet, updateProjet, deleteProjet, getProjetStats };
