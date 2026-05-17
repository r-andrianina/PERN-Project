const service = require('../services/containers.service');

const listContainers = async (req, res) => {
  const containers = await service.list(req.query);
  res.json({ total: containers.length, containers });
};
const getOne = async (req, res) => res.json(await service.getById(parseInt(req.params.id)));
const create = async (req, res) => res.status(201).json({ message: 'Container créé',       container: await service.create(req.body, req.user?.id) });
const update = async (req, res) => res.json({ message: 'Container mis à jour',             container: await service.update(parseInt(req.params.id), req.body) });
const remove = async (req, res) => { await service.remove(parseInt(req.params.id)); res.json({ message: 'Container supprimé' }); };

module.exports = { list: listContainers, getOne, create, update, remove };
