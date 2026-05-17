const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');

const CODE_REGEX = /^[A-Z]{3}$/;

const validateCode = async (code, ignoreId = null) => {
  if (!code) return;
  if (!CODE_REGEX.test(code))
    throw AppError.badRequest('Le code doit contenir exactement 3 lettres majuscules (ex: AKZ)');
  const where = { code };
  if (ignoreId) where.NOT = { id: ignoreId };
  const dupe = await prisma.localite.findFirst({ where });
  if (dupe) throw AppError.conflict(`Le code "${code}" est déjà utilisé par une autre localité`);
};

const INCLUDE_LIST = {
  mission: {
    select: {
      id: true, ordreMission: true, statut: true,
      projet: { select: { id: true, code: true, nom: true } },
    },
  },
  _count: { select: { methodes: true } },
};

const INCLUDE_DETAIL = {
  mission: { include: { projet: { select: { id: true, code: true, nom: true } } } },
  methodes: {
    include: { _count: { select: { moustiques: true, tiques: true, puces: true } } },
    orderBy: { createdAt: 'asc' },
  },
};

const list = async ({ missionId, region, search } = {}) => {
  const where = {};
  if (missionId) where.missionId = parseInt(missionId);
  if (region)    where.region    = { contains: region, mode: 'insensitive' };
  if (search) {
    where.OR = [
      { nom:      { contains: search, mode: 'insensitive' } },
      { toponyme: { contains: search, mode: 'insensitive' } },
      { district: { contains: search, mode: 'insensitive' } },
      { commune:  { contains: search, mode: 'insensitive' } },
    ];
  }
  return prisma.localite.findMany({ where, include: INCLUDE_LIST, orderBy: { createdAt: 'desc' } });
};

const getById = async (id) => {
  const localite = await prisma.localite.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  if (!localite) throw AppError.notFound('Localité introuvable');
  return localite;
};

const getCarte = async () => {
  const localites = await prisma.localite.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    include: {
      mission: { select: { ordreMission: true, projet: { select: { code: true, nom: true } } } },
      _count:  { select: { methodes: true } },
    },
  });
  return {
    type: 'FeatureCollection',
    features: localites.map(l => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] },
      properties: {
        id: l.id, nom: l.nom, toponyme: l.toponyme,
        region: l.region, district: l.district, commune: l.commune,
        fokontany: l.fokontany, altitude: l.altitudeM,
        mission: l.mission.ordreMission, projet: l.mission.projet.nom,
        nbMethodes: l._count.methodes,
      },
    })),
  };
};

const create = async (data) => {
  const { missionId, code, nom, toponyme, pays, region, district, commune, fokontany, latitude, longitude, altitudeM } = data;

  const mission = await prisma.mission.findUnique({ where: { id: parseInt(missionId) } });
  if (!mission) throw AppError.notFound('Mission introuvable');

  const codeUpper = code ? code.trim().toUpperCase() : null;
  await validateCode(codeUpper);

  return prisma.localite.create({
    data: {
      missionId:  parseInt(missionId),
      code:       codeUpper,
      nom:        nom.trim(),
      toponyme:   toponyme   || null,
      pays:       pays       || 'Madagascar',
      region:     region     || null,
      district:   district   || null,
      commune:    commune    || null,
      fokontany:  fokontany  || null,
      latitude:   latitude   ? parseFloat(latitude)  : null,
      longitude:  longitude  ? parseFloat(longitude) : null,
      altitudeM:  altitudeM  ? parseFloat(altitudeM) : null,
    },
    include: { mission: { select: { id: true, ordreMission: true } } },
  });
};

const update = async (id, data) => {
  const { code, nom, toponyme, pays, region, district, commune, fokontany, latitude, longitude, altitudeM } = data;
  const patch = {};
  if (nom       !== undefined) patch.nom       = nom.trim();
  if (toponyme  !== undefined) patch.toponyme  = toponyme;
  if (pays      !== undefined) patch.pays      = pays;
  if (region    !== undefined) patch.region    = region;
  if (district  !== undefined) patch.district  = district;
  if (commune   !== undefined) patch.commune   = commune;
  if (fokontany !== undefined) patch.fokontany = fokontany;
  if (latitude  !== undefined) patch.latitude  = latitude  ? parseFloat(latitude)  : null;
  if (longitude !== undefined) patch.longitude = longitude ? parseFloat(longitude) : null;
  if (altitudeM !== undefined) patch.altitudeM = altitudeM ? parseFloat(altitudeM) : null;

  if (code !== undefined) {
    const codeUpper = code ? code.trim().toUpperCase() : null;
    await validateCode(codeUpper, id);
    patch.code = codeUpper;
  }

  return prisma.localite.update({
    where: { id }, data: patch,
    include: { mission: { select: { id: true, ordreMission: true } }, _count: { select: { methodes: true } } },
  });
};

const remove = async (id) => {
  const localite = await prisma.localite.findUnique({
    where: { id }, include: { _count: { select: { methodes: true } } },
  });
  if (!localite) throw AppError.notFound('Localité introuvable');
  if (localite._count.methodes > 0)
    throw AppError.conflict(`Impossible — cette localité contient ${localite._count.methodes} méthode(s) de collecte.`);
  await prisma.localite.delete({ where: { id } });
};

const lookupFokontany = async (lat, lng) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT fokontany, commune, district, region
     FROM fokontany_geo
     WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
     LIMIT 1;`,
    lng, lat,
  );
  if (!rows.length) {
    const fallback = await prisma.$queryRawUnsafe(
      `SELECT fokontany, commune, district, region,
              ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) AS dist
       FROM fokontany_geo
       ORDER BY geom <-> ST_SetSRID(ST_Point($1, $2), 4326)
       LIMIT 1;`,
      lng, lat,
    );
    return { match: false, nearest: fallback[0] || null, message: 'Point hors polygone — fokontany le plus proche renvoyé' };
  }
  return { match: true, ...rows[0] };
};

module.exports = { list, getById, getCarte, create, update, remove, lookupFokontany };
