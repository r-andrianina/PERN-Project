const service = require('../services/hotes.service');
const prisma  = require('../config/prisma');
const { logAudit, ACTIONS } = require('../utils/audit');

const AUDIT_FIELDS = { especeLocale: true, age: true, sexe: true, etatSante: true, notes: true };

const listHotes = async (req, res) => {
  const hotes = await service.list(req.query);
  res.json({ total: hotes.length, hotes });
};

const getOne = async (req, res) => res.json({ hote: await service.getById(parseInt(req.params.id)) });

const create = async (req, res) => {
  const hote = await service.create(req.body);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Hote', entityId: hote.id, newValues: { especeLocale: hote.especeLocale, sexe: hote.sexe } });
  res.status(201).json({ message: 'Hôte enregistré', hote });
};

const update = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.hote.findUnique({ where: { id }, select: AUDIT_FIELDS });
  const hote   = await service.update(id, req.body);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Hote', entityId: id, oldValues: before, newValues: { especeLocale: hote.especeLocale, sexe: hote.sexe, etatSante: hote.etatSante } });
  res.json({ message: 'Hôte mis à jour', hote });
};

const remove = async (req, res) => {
  const id     = parseInt(req.params.id);
  const before = await prisma.hote.findUnique({ where: { id }, select: AUDIT_FIELDS });
  await service.remove(id);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Hote', entityId: id, oldValues: before });
  res.json({ message: 'Hôte supprimé' });
};

module.exports = { list: listHotes, getOne, create, update, remove };
