// backend/src/controllers/localites.controller.js
// CRUD localités — liées à une mission
// Accès : Admin+Chercheur (écriture), Terrain+Lecteur (lecture)

const prisma = require('../config/prisma');

// =============================================================
//  LIST — Toutes les localités
//  GET /api/v1/localites
// =============================================================

const listLocalites = async (req, res) => {
  try {
    const { missionId, region, search } = req.query;

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

    const localites = await prisma.localite.findMany({
      where,
      include: {
        mission: {
          select: {
            id: true, ordreMission: true, statut: true,
            projet: { select: { id: true, code: true, nom: true } },
          },
        },
        _count: { select: { methodes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ total: localites.length, localites });

  } catch (err) {
    console.error('Erreur listLocalites :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  GET ONE — Détail d'une localité avec ses méthodes
//  GET /api/v1/localites/:id
// =============================================================

const getLocalite = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const localite = await prisma.localite.findUnique({
      where: { id },
      include: {
        mission: {
          include: {
            projet: { select: { id: true, code: true, nom: true } },
          },
        },
        methodes: {
          include: {
            _count: {
              select: { moustiques: true, tiques: true, puces: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!localite) {
      return res.status(404).json({ error: 'Localité introuvable' });
    }

    return res.json({ localite });

  } catch (err) {
    console.error('Erreur getLocalite :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  GET CARTE — Toutes les localités en GeoJSON pour Leaflet
//  GET /api/v1/localites/carte
// =============================================================

const getCarteLocalites = async (req, res) => {
  try {
    const localites = await prisma.localite.findMany({
      where: {
        latitude:  { not: null },
        longitude: { not: null },
      },
      include: {
        mission: {
          select: {
            ordreMission: true,
            projet: { select: { code: true, nom: true } },
          },
        },
        _count: { select: { methodes: true } },
      },
    });

    // Format GeoJSON pour Leaflet
    const geojson = {
      type: 'FeatureCollection',
      features: localites.map(l => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [l.longitude, l.latitude],
        },
        properties: {
          id:           l.id,
          nom:          l.nom,
          toponyme:     l.toponyme,
          region:       l.region,
          district:     l.district,
          commune:      l.commune,
          fokontany:    l.fokontany,
          altitude:     l.altitudeM,
          mission:      l.mission.ordreMission,
          projet:       l.mission.projet.nom,
          nbMethodes:   l._count.methodes,
        },
      })),
    };

    return res.json(geojson);

  } catch (err) {
    console.error('Erreur getCarteLocalites :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  Validation du code localité (préfixe ID terrain)
// =============================================================

const CODE_REGEX = /^[A-Z]{3}$/;

async function validateCode(code, ignoreId = null) {
  if (!code) return null;
  if (!CODE_REGEX.test(code)) return 'Le code doit contenir exactement 3 lettres majuscules (ex: AKZ)';
  const where = { code };
  if (ignoreId) where.NOT = { id: ignoreId };
  const dupe = await prisma.localite.findFirst({ where });
  if (dupe) return `Le code "${code}" est déjà utilisé par une autre localité`;
  return null;
}

// =============================================================
//  CREATE — Créer une localité
//  POST /api/v1/localites
//  Accès : Admin, Chercheur
// =============================================================

const createLocalite = async (req, res) => {
  const {
    missionId, code, nom, toponyme, pays,
    region, district, commune, fokontany,
    latitude, longitude, altitudeM,
  } = req.body;

  if (!missionId || !nom) {
    return res.status(400).json({ error: 'La mission et le nom de la localité sont obligatoires' });
  }

  try {
    // Vérifier que la mission existe
    const mission = await prisma.mission.findUnique({ where: { id: parseInt(missionId) } });
    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }

    // Validation du code (3 lettres majuscules, unique)
    const codeUpper = code ? code.trim().toUpperCase() : null;
    const codeErr = await validateCode(codeUpper);
    if (codeErr) return res.status(400).json({ error: codeErr });

    const localite = await prisma.localite.create({
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
      include: {
        mission: { select: { id: true, ordreMission: true } },
      },
    });

    return res.status(201).json({
      message: 'Localité créée avec succès',
      localite,
    });

  } catch (err) {
    console.error('Erreur createLocalite :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  UPDATE — Modifier une localité
//  PUT /api/v1/localites/:id
// =============================================================

const updateLocalite = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    code, nom, toponyme, pays, region, district,
    commune, fokontany, latitude, longitude, altitudeM,
  } = req.body;

  const data = {};
  if (nom       !== undefined) data.nom       = nom.trim();
  if (toponyme  !== undefined) data.toponyme  = toponyme;
  if (pays      !== undefined) data.pays      = pays;
  if (region    !== undefined) data.region    = region;
  if (district  !== undefined) data.district  = district;
  if (commune   !== undefined) data.commune   = commune;
  if (fokontany !== undefined) data.fokontany = fokontany;
  if (latitude  !== undefined) data.latitude  = latitude  ? parseFloat(latitude)  : null;
  if (longitude !== undefined) data.longitude = longitude ? parseFloat(longitude) : null;
  if (altitudeM !== undefined) data.altitudeM = altitudeM ? parseFloat(altitudeM) : null;

  if (code !== undefined) {
    const codeUpper = code ? code.trim().toUpperCase() : null;
    const codeErr = await validateCode(codeUpper, id);
    if (codeErr) return res.status(400).json({ error: codeErr });
    data.code = codeUpper;
  }

  try {
    const localite = await prisma.localite.update({
      where: { id },
      data,
      include: {
        mission: { select: { id: true, ordreMission: true } },
        _count:  { select: { methodes: true } },
      },
    });

    return res.json({ message: 'Localité mise à jour avec succès', localite });

  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Localité introuvable' });
    }
    console.error('Erreur updateLocalite :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  DELETE — Supprimer une localité
//  DELETE /api/v1/localites/:id
//  Accès : Admin uniquement
// =============================================================

const deleteLocalite = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const localite = await prisma.localite.findUnique({
      where: { id },
      include: { _count: { select: { methodes: true } } },
    });

    if (!localite) {
      return res.status(404).json({ error: 'Localité introuvable' });
    }

    if (localite._count.methodes > 0) {
      return res.status(409).json({
        error: `Impossible de supprimer — cette localité contient ${localite._count.methodes} méthode(s) de collecte.`,
      });
    }

    await prisma.localite.delete({ where: { id } });
    return res.json({ message: 'Localité supprimée avec succès' });

  } catch (err) {
    console.error('Erreur deleteLocalite :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  LOOKUP FOKONTANY — point dans polygone PostGIS
//  GET /api/v1/localites/lookup-fokontany?lat=...&lng=...
// =============================================================

const lookupFokontany = async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Coordonnées invalides (lat & lng requis)' });
  }
  try {
    // ST_Contains avec un point en lng/lat (Postgis attend X=lng, Y=lat)
    const rows = await prisma.$queryRawUnsafe(
      `SELECT fokontany, commune, district, region
       FROM fokontany_geo
       WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
       LIMIT 1;`,
      lng, lat,
    );
    if (!rows.length) {
      // Fallback : nearest centroid (au cas où le point tombe en mer ou hors polygone)
      const fallback = await prisma.$queryRawUnsafe(
        `SELECT fokontany, commune, district, region,
                ST_Distance(geom, ST_SetSRID(ST_Point($1, $2), 4326)) AS dist
         FROM fokontany_geo
         ORDER BY geom <-> ST_SetSRID(ST_Point($1, $2), 4326)
         LIMIT 1;`,
        lng, lat,
      );
      return res.json({
        match: false,
        nearest: fallback[0] || null,
        message: 'Point hors polygone — fokontany le plus proche renvoyé',
      });
    }
    return res.json({ match: true, ...rows[0] });
  } catch (err) {
    console.error('Erreur lookupFokontany :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  listLocalites, getLocalite, getCarteLocalites,
  createLocalite, updateLocalite, deleteLocalite,
  lookupFokontany,
};