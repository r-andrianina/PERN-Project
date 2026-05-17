// backend/src/controllers/carte.controller.js
// Agrège les spécimens par méthode de collecte géolocalisée.
// Respecte le RBAC : seuls les types autorisés dans specimensAutorises sont renvoyés.

const prisma = require('../config/prisma');

const taxoLabel = (t) => {
  if (!t) return null;
  return t.parent?.nom ? `${t.parent.nom} ${t.nom}` : t.nom;
};

// GET /api/v1/carte/specimens
const getSpecimens = async (req, res) => {
  const autorises = req.user.role === 'admin'
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

  // Pour chaque méthode, récupérer les spécimens des types autorisés
  const points = await Promise.all(methodes.map(async (m) => {
    const specimens = {};

    if (autorises.includes('moustique') && m._count.moustiques > 0) {
      const items = await prisma.moustique.findMany({
        where:   { methodeId: m.id },
        include: { taxonomie: { include: { parent: true } } },
        take:    3,
        orderBy: { createdAt: 'desc' },
      });
      specimens.moustique = {
        total: m._count.moustiques,
        items: items.map(x => ({
          id:        x.id,
          idTerrain: x.idTerrain,
          taxonomie: taxoLabel(x.taxonomie),
          sexe:      x.sexe,
          stade:     x.stade,
        })),
      };
    }

    if (autorises.includes('tique') && m._count.tiques > 0) {
      const items = await prisma.tique.findMany({
        where:   { methodeId: m.id },
        include: { taxonomie: { include: { parent: true } } },
        take:    3,
        orderBy: { createdAt: 'desc' },
      });
      specimens.tique = {
        total: m._count.tiques,
        items: items.map(x => ({
          id:        x.id,
          idTerrain: x.idTerrain,
          taxonomie: taxoLabel(x.taxonomie),
          sexe:      x.sexe,
          stade:     x.stade,
        })),
      };
    }

    if (autorises.includes('puce') && m._count.puces > 0) {
      const items = await prisma.puce.findMany({
        where:   { methodeId: m.id },
        include: { taxonomie: { include: { parent: true } } },
        take:    3,
        orderBy: { createdAt: 'desc' },
      });
      specimens.puce = {
        total: m._count.puces,
        items: items.map(x => ({
          id:        x.id,
          idTerrain: x.idTerrain,
          taxonomie: taxoLabel(x.taxonomie),
          sexe:      x.sexe,
          stade:     x.stade,
        })),
      };
    }

    // Ignorer si aucun spécimen autorisé sur ce site
    const totalVisible = Object.values(specimens).reduce((s, v) => s + (v?.total || 0), 0);
    if (totalVisible === 0) return null;

    return {
      methodeId:   m.id,
      latitude:    m.latitude,
      longitude:   m.longitude,
      dateCollecte: m.dateCollecte ? m.dateCollecte.toISOString().split('T')[0] : null,
      typeMethode: m.typeMethode,
      localite:    m.localite,
      specimens,
      totalSpecimens: totalVisible,
    };
  }));

  return res.json({ points: points.filter(Boolean) });
};

module.exports = { getSpecimens };
