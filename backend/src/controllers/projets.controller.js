// backend/src/controllers/projets.controller.js
// Ce contrôleur ne fait que :
//   1. Lire les données HTTP (req.body, req.params, req.query)
//   2. Déléguer au service
//   3. Sérialiser la réponse HTTP

const service = require('../services/projets.service');

const listProjets = async (req, res) => {
  const projets = await service.list(req.query);
  res.json({ total: projets.length, projets });
};

const getProjet = async (req, res) => {
  const projet = await service.getById(parseInt(req.params.id));
  res.json({ projet });
};

const createProjet = async (req, res) => {
  // req.body est déjà validé/transformé par Zod via le middleware validate()
  const projet = await service.create(req.body);
  res.status(201).json({ message: 'Projet créé avec succès', projet });
};

const updateProjet = async (req, res) => {
  const projet = await service.update(parseInt(req.params.id), req.body);
  res.json({ message: 'Projet mis à jour avec succès', projet });
};

const deleteProjet = async (req, res) => {
  await service.remove(parseInt(req.params.id));
  res.json({ message: 'Projet supprimé avec succès' });
};

module.exports = { listProjets, getProjet, createProjet, updateProjet, deleteProjet };
