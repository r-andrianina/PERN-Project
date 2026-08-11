// backend/src/controllers/carte.controller.js
// Agrège les spécimens par méthode de collecte géolocalisée.
// Respecte le RBAC : seuls les types autorisés dans specimensAutorises sont renvoyés.

const prisma = require('../config/prisma');
const { BYPASS_ROLES } = require('../config/rbac');

const taxoLabel = (t) => {
  if (!t) return null;
  return t.parent?.nom ? `${t.parent.nom} ${t.nom}` : t.nom;
};

// GET /api/v1/carte/specimens
const getSpecimens = async (req, res) => {
  const autorises = BYPASS_ROLES.includes(req.user.role)
    ? ['moustique', 'tique', 'puce']
    : (req.user.specimensAutorises || []);

  if (autorises.length === 0) return res.json({ points: [] });

  // Récupérer toutes les méthodes géolocalisées
  const methodes = await prisma.methodeCollecte.findMany({
    where: {
      latitude:  { not: null },
      longitude: { not: null },
    },
    include: {
      localite: {
        select: {
          id: true, nom: true, region: true, district: true,
          mission: {
            select: {
              ordreMission: true,
              projet: { select: { code: true, nom: true } },
            },
          },
        },
      },
      typeMethode: { select: { nom: true, code: true } },
      _count:      { select: { moustiques: true, tiques: true, puces: true } },
    },
  });

  const methodeIds = methodes.map(m => m.id);

  // Une requête par type autorisé (batch) — évite le N+1
  const include = { taxonomie: { include: { parent: true } } };
  const mapItem = x => ({
    id:        x.id,
    idTerrain: x.idTerrain,
    taxonomie: taxoLabel(x.taxonomie),
    sexe:      x.sexe,
    stade:     x.stade,
    methodeId: x.methodeId,
  });

  const [rawMoustiques, rawTiques, rawPuces] = await Promise.all([
    autorises.includes('moustique')
      ? prisma.moustique.findMany({ where: { methodeId: { in: methodeIds } }, include, orderBy: { createdAt: 'desc' } })
      : [],
    autorises.includes('tique')
      ? prisma.tique.findMany({ where: { methodeId: { in: methodeIds } }, include, orderBy: { createdAt: 'desc' } })
      : [],
    autorises.includes('puce')
      ? prisma.puce.findMany({ where: { methodeId: { in: methodeIds } }, include, orderBy: { createdAt: 'desc' } })
      : [],
  ]);

  // Grouper par methodeId (Map pour O(1))
  const byMethode = (rows) => rows.reduce((acc, x) => {
    (acc[x.methodeId] = acc[x.methodeId] || []).push(mapItem(x));
    return acc;
  }, {});

  const moustiquesMap = byMethode(rawMoustiques);
  const tiquesMap     = byMethode(rawTiques);
  const pucesMap      = byMethode(rawPuces);

  const points = methodes.map(m => {
    const specimens = {};

    if (autorises.includes('moustique') && m._count.moustiques > 0) {
      specimens.moustique = { total: m._count.moustiques, items: (moustiquesMap[m.id] || []).slice(0, 3) };
    }
    if (autorises.includes('tique') && m._count.tiques > 0) {
      specimens.tique = { total: m._count.tiques, items: (tiquesMap[m.id] || []).slice(0, 3) };
    }
    if (autorises.includes('puce') && m._count.puces > 0) {
      specimens.puce = { total: m._count.puces, items: (pucesMap[m.id] || []).slice(0, 3) };
    }

    const totalVisible = Object.values(specimens).reduce((s, v) => s + (v?.total || 0), 0);
    if (totalVisible === 0) return null;

    return {
      methodeId:      m.id,
      latitude:       m.latitude,
      longitude:      m.longitude,
      dateCollecte:   m.datePose ? m.datePose.toISOString().split('T')[0] : null,
      typeMethode:    m.typeMethode,
      localite:       m.localite,
      specimens,
      totalSpecimens: totalVisible,
    };
  });

  return res.json({ points: points.filter(Boolean) });
};

module.exports = { getSpecimens };
