const prisma   = require('../config/prisma');
const AppError = require('../utils/AppError');
const { getAccessibleProjetIds, canBypass, projetScopeWhere, assertProjetAccessible } = require('../utils/access');

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
      id: true, ordreMission: true,
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
  contacts: { orderBy: { id: 'asc' } },
};

// Remplace intégralement les contacts d'une localité par le tableau fourni
// (upsert des contacts avec id, création des nouveaux, suppression des absents).
const syncContacts = async (tx, localiteId, contacts) => {
  const existing = await tx.localiteContact.findMany({ where: { localiteId }, select: { id: true } });
  const keptIds = contacts.filter(c => c.id).map(c => c.id);
  const toDelete = existing.map(c => c.id).filter(id => !keptIds.includes(id));

  if (toDelete.length) {
    await tx.localiteContact.deleteMany({ where: { id: { in: toDelete } } });
  }
  for (const c of contacts) {
    const contactData = {
      nom:       c.nom.trim(),
      telephone: c.telephone || null,
      statut:    c.statut    || null,
    };
    if (c.id) {
      await tx.localiteContact.update({ where: { id: c.id }, data: contactData });
    } else {
      await tx.localiteContact.create({ data: { ...contactData, localiteId } });
    }
  }
};

const list = async ({ missionId, region, search } = {}, user) => {
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
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    Object.assign(where, projetScopeWhere(['mission'], ids));
  }
  return prisma.localite.findMany({ where, include: INCLUDE_LIST, orderBy: { createdAt: 'desc' } });
};

const getById = async (id, user) => {
  const localite = await prisma.localite.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  if (!localite) throw AppError.notFound('Localité introuvable');
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(localite.mission.projetId, ids);
  }
  return localite;
};

const getCarte = async (user) => {
  const where = { latitude: { not: null }, longitude: { not: null } };
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    Object.assign(where, projetScopeWhere(['mission'], ids));
  }
  const localites = await prisma.localite.findMany({
    where,
    include: {
      mission:  { select: { ordreMission: true, projet: { select: { code: true, nom: true } } } },
      contacts: { orderBy: { id: 'asc' } },
      _count:   { select: { methodes: true } },
    },
  });
  return {
    type: 'FeatureCollection',
    features: localites.map(l => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] },
      properties: {
        id: l.id, code: l.code, nom: l.nom,
        region: l.region, district: l.district, commune: l.commune,
        fokontany: l.fokontany,
        latitude: l.latitude, longitude: l.longitude, altitudeM: l.altitudeM,
        contacts: l.contacts.map(c => ({ nom: c.nom, telephone: c.telephone, statut: c.statut })),
        mission: l.mission.ordreMission, projet: l.mission.projet.nom,
        nbMethodes: l._count.methodes,
      },
    })),
  };
};

const create = async (data) => {
  const { missionId, code, nom, pays, region, district, commune, fokontany, contacts, latitude, longitude, altitudeM } = data;

  const mission = await prisma.mission.findUnique({ where: { id: parseInt(missionId) } });
  if (!mission) throw AppError.notFound('Mission introuvable');

  const codeUpper = code ? code.trim().toUpperCase() : null;
  await validateCode(codeUpper);

  const nomTrimmed = nom.trim();

  return prisma.$transaction(async (tx) => {
    const localite = await tx.localite.create({
      data: {
        missionId:  parseInt(missionId),
        code:       codeUpper,
        nom:        nomTrimmed,
        // Champ visuel unique côté formulaire — les 2 colonnes restent en base, mirroirées.
        toponyme:   nomTrimmed,
        pays:       pays       || 'Madagascar',
        region:     region     || null,
        district:   district   || null,
        commune:    commune    || null,
        fokontany:  fokontany  || null,
        latitude:   latitude   ? parseFloat(latitude)  : null,
        longitude:  longitude  ? parseFloat(longitude) : null,
        altitudeM:  altitudeM  ? parseFloat(altitudeM) : null,
      },
    });
    if (Array.isArray(contacts) && contacts.length) {
      await syncContacts(tx, localite.id, contacts);
    }
    return tx.localite.findUnique({
      where: { id: localite.id },
      include: { mission: { select: { id: true, ordreMission: true } }, contacts: { orderBy: { id: 'asc' } } },
    });
  });
};

const update = async (id, data, user) => {
  if (user && !canBypass(user.role)) {
    const current = await prisma.localite.findUnique({ where: { id }, select: { missionId: true, mission: { select: { projetId: true } } } });
    if (!current) throw AppError.notFound('Localité introuvable');
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(current.mission.projetId, ids);
  }
  const { code, nom, pays, region, district, commune, fokontany, contacts, latitude, longitude, altitudeM } = data;
  const patch = {};
  if (nom !== undefined) {
    const nomTrimmed = nom.trim();
    patch.nom      = nomTrimmed;
    patch.toponyme = nomTrimmed; // mirroir — cf. create()
  }
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

  return prisma.$transaction(async (tx) => {
    if (Array.isArray(contacts)) {
      await syncContacts(tx, id, contacts);
    }
    return tx.localite.update({
      where: { id }, data: patch,
      include: {
        mission: { select: { id: true, ordreMission: true } },
        _count:  { select: { methodes: true } },
        contacts: { orderBy: { id: 'asc' } },
      },
    });
  });
};

const remove = async (id, user) => {
  const localite = await prisma.localite.findUnique({
    where: { id }, include: { _count: { select: { methodes: true } }, mission: { select: { projetId: true } } },
  });
  if (!localite) throw AppError.notFound('Localité introuvable');
  if (user && !canBypass(user.role)) {
    const ids = await getAccessibleProjetIds(user.id, user.role);
    assertProjetAccessible(localite.mission.projetId, ids);
  }
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
