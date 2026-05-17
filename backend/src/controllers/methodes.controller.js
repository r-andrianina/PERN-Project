const service = require('../services/methodes.service');

const listMethodes = async (req, res) => {
  const methodes = await service.list(req.query);
  res.json({ total: methodes.length, methodes });
};
const getMethode       = async (req, res) => res.json({ methode: await service.getById(parseInt(req.params.id)) });
const createMethode    = async (req, res) => res.status(201).json({ message: 'Méthode de collecte créée avec succès', methode: await service.create(req.body) });
const updateMethode    = async (req, res) => res.json({ message: 'Méthode mise à jour avec succès',                   methode: await service.update(parseInt(req.params.id), req.body) });
const deleteMethode    = async (req, res) => { await service.remove(parseInt(req.params.id)); res.json({ message: 'Méthode supprimée avec succès' }); };
const previewIdTerrain = async (req, res) => res.json(await service.previewId(parseInt(req.params.id)));

module.exports = { listMethodes, getMethode, createMethode, updateMethode, deleteMethode, previewIdTerrain };
