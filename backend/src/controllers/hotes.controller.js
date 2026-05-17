const service = require('../services/hotes.service');

const listHotes = async (req, res) => {
  const hotes = await service.list(req.query);
  res.json({ total: hotes.length, hotes });
};
const getOne   = async (req, res) => res.json({ hote: await service.getById(parseInt(req.params.id)) });
const create   = async (req, res) => res.status(201).json({ message: 'Hôte enregistré',      hote: await service.create(req.body) });
const update   = async (req, res) => res.json({ message: 'Hôte mis à jour',                  hote: await service.update(parseInt(req.params.id), req.body) });
const remove   = async (req, res) => { await service.remove(parseInt(req.params.id)); res.json({ message: 'Hôte supprimé' }); };

module.exports = { list: listHotes, getOne, create, update, remove };
