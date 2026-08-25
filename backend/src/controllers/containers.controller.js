const service = require('../services/containers.service');
const prisma   = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

const AUDIT_FIELDS = { code: true, type: true, capacity: true, notes: true };

const listContainers = async (req, res) => {
  const containers = await service.list(req.query, req.user);
  res.json({ total: containers.length, containers });
};

const getOne = async (req, res) => res.json(await service.getById(parseInt(req.params.id), req.user));

const create = async (req, res) => {
  const container = await service.create(req.body, req.user);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Container', entityId: container.id, newValues: { code: container.code, type: container.type, capacity: container.capacity } });
  res.status(201).json({ message: 'Container créé', container });
};

const update = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.container.findUnique({ where: { id }, select: AUDIT_FIELDS });
  const container = await service.update(id, req.body, req.user);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Container', entityId: id, oldValues: before, newValues: { code: container.code, type: container.type, capacity: container.capacity } });
  res.json({ message: 'Container mis à jour', container });
};

const remove = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.container.findUnique({ where: { id }, select: AUDIT_FIELDS });
  await service.remove(id, req.user);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Container', entityId: id, oldValues: before });
  res.json({ message: 'Container supprimé' });
};

module.exports = { list: listContainers, getOne, create, update, remove };
