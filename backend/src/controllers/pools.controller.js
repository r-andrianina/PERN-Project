const service = require('../services/pools.service');
const { logAudit, ACTIONS } = require('../utils/audit');

const list = async (req, res) => res.json(await service.list(req.query));

const getOne = async (req, res) => res.json({ pool: await service.getById(parseInt(req.params.id)) });

const create = async (req, res) => {
  const pool = await service.create(req.body, req.user.id);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Pool', entityId: pool.id, newValues: { code: pool.code, nombreIndividus: pool.nombreIndividus } });
  res.status(201).json({ message: 'Pool créé', pool });
};

const remove = async (req, res) => {
  const id = parseInt(req.params.id);
  await service.remove(id);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Pool', entityId: id });
  res.json({ message: 'Pool supprimé' });
};

module.exports = { list, getOne, create, remove };
