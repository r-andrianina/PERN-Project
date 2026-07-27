const prisma  = require('../config/prisma');
const service = require('../services/methodes.service');
const { logAudit, ACTIONS } = require('../utils/audit');

// Champs suivis dans l'historique d'audit (inclut le point GPS)
const AUDIT_FIELDS = { typeMethodeId: true, typeHabitatId: true, typeEnvironnementId: true, interieurExterieur: true, latitude: true, longitude: true, altitudeM: true, datePose: true, dateReleve: true, notes: true };

const listMethodes = async (req, res) => {
  const methodes = await service.list(req.query);
  res.json({ total: methodes.length, methodes });
};
const getMethode       = async (req, res) => res.json({ methode: await service.getById(parseInt(req.params.id)) });
const previewIdTerrain = async (req, res) => res.json(await service.previewId(parseInt(req.params.id)));
const previewHoteId    = async (req, res) => res.json(await service.previewHoteId(parseInt(req.params.id)));

const createMethode = async (req, res) => {
  const methode = await service.create(req.body);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'MethodeCollecte', entityId: methode.id, newValues: { typeMethodeId: methode.typeMethodeId, typeHabitatId: methode.typeHabitatId, typeEnvironnementId: methode.typeEnvironnementId, interieurExterieur: methode.interieurExterieur, latitude: methode.latitude, longitude: methode.longitude, altitudeM: methode.altitudeM, datePose: methode.datePose, dateReleve: methode.dateReleve, notes: methode.notes } });
  res.status(201).json({ message: 'Méthode de collecte créée avec succès', methode });
};

const updateMethode = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.methodeCollecte.findUnique({ where: { id }, select: AUDIT_FIELDS });
  const methode = await service.update(id, req.body);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'MethodeCollecte', entityId: id, oldValues: before, newValues: { typeMethodeId: methode.typeMethodeId, typeHabitatId: methode.typeHabitatId, typeEnvironnementId: methode.typeEnvironnementId, interieurExterieur: methode.interieurExterieur, latitude: methode.latitude, longitude: methode.longitude, altitudeM: methode.altitudeM, datePose: methode.datePose, dateReleve: methode.dateReleve, notes: methode.notes } });
  res.json({ message: 'Méthode mise à jour avec succès', methode });
};

const deleteMethode = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.methodeCollecte.findUnique({ where: { id }, select: AUDIT_FIELDS });
  await service.remove(id);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'MethodeCollecte', entityId: id, oldValues: before });
  res.json({ message: 'Méthode supprimée avec succès' });
};

module.exports = { listMethodes, getMethode, createMethode, updateMethode, deleteMethode, previewIdTerrain, previewHoteId };
