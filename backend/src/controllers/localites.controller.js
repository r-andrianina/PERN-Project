const service  = require('../services/localites.service');
const AppError = require('../utils/AppError');

const listLocalites = async (req, res) => {
  const localites = await service.list(req.query);
  res.json({ total: localites.length, localites });
};
const getLocalite       = async (req, res) => res.json({ localite: await service.getById(parseInt(req.params.id)) });
const getCarteLocalites = async (req, res) => res.json(await service.getCarte());
const createLocalite    = async (req, res) => res.status(201).json({ message: 'Localité créée avec succès',     localite: await service.create(req.body) });
const updateLocalite    = async (req, res) => res.json({ message: 'Localité mise à jour avec succès',           localite: await service.update(parseInt(req.params.id), req.body) });
const deleteLocalite    = async (req, res) => { await service.remove(parseInt(req.params.id)); res.json({ message: 'Localité supprimée avec succès' }); };

const lookupFokontany = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) throw AppError.badRequest('Coordonnées invalides (lat & lng requis)');
  res.json(await service.lookupFokontany(lat, lng));
};

module.exports = { listLocalites, getLocalite, getCarteLocalites, createLocalite, updateLocalite, deleteLocalite, lookupFokontany };
