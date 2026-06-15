const prisma   = require('../config/prisma');
const service  = require('../services/localites.service');
const AppError = require('../utils/AppError');
const { logAudit, ACTIONS } = require('../utils/audit');

// Champs suivis dans l'historique d'audit (inclut le point GPS et l'altitude)
const AUDIT_FIELDS = { nom: true, code: true, region: true, district: true, commune: true, fokontany: true, contactNom: true, contactTelephone: true, contactStatut: true, latitude: true, longitude: true, altitudeM: true };

const listLocalites = async (req, res) => {
  const localites = await service.list(req.query);
  res.json({ total: localites.length, localites });
};
const getLocalite       = async (req, res) => res.json({ localite: await service.getById(parseInt(req.params.id)) });
const getCarteLocalites = async (req, res) => res.json(await service.getCarte());

const createLocalite = async (req, res) => {
  const localite = await service.create(req.body);
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'Localite', entityId: localite.id, newValues: { ...localite, mission: undefined } });
  res.status(201).json({ message: 'Localité créée avec succès', localite });
};

const updateLocalite = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.localite.findUnique({ where: { id }, select: AUDIT_FIELDS });
  const localite = await service.update(id, req.body);
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'Localite', entityId: id, oldValues: before, newValues: { nom: localite.nom, code: localite.code, region: localite.region, district: localite.district, commune: localite.commune, fokontany: localite.fokontany, contactNom: localite.contactNom, contactTelephone: localite.contactTelephone, contactStatut: localite.contactStatut, latitude: localite.latitude, longitude: localite.longitude, altitudeM: localite.altitudeM } });
  res.json({ message: 'Localité mise à jour avec succès', localite });
};

const deleteLocalite = async (req, res) => {
  const id = parseInt(req.params.id);
  const before = await prisma.localite.findUnique({ where: { id }, select: AUDIT_FIELDS });
  await service.remove(id);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'Localite', entityId: id, oldValues: before });
  res.json({ message: 'Localité supprimée avec succès' });
};

const lookupFokontany = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) throw AppError.badRequest('Coordonnées invalides (lat & lng requis)');
  res.json(await service.lookupFokontany(lat, lng));
};

module.exports = { listLocalites, getLocalite, getCarteLocalites, createLocalite, updateLocalite, deleteLocalite, lookupFokontany };
