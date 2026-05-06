// backend/src/controllers/missions.controller.js
// CRUD complet des missions
// Accès : Admin (tout), Chercheur (créer/modifier), Terrain (lecture), Lecteur (lecture)

const prisma = require('../config/prisma');

// =============================================================
//  LIST — Toutes les missions
//  GET /api/v1/missions
// =============================================================

const listMissions = async (req, res) => {
  try {
    const { statut, projetId, search } = req.query;

    const where = {};
    if (statut)   where.statut   = statut;
    if (projetId) where.projetId = parseInt(projetId);
    if (search) {
      where.OR = [
        { ordreMission: { contains: search, mode: 'insensitive' } },
        { observations: { contains: search, mode: 'insensitive' } },
      ];
    }

    const missions = await prisma.mission.findMany({
      where,
      include: {
        projet: {
          select: { id: true, code: true, nom: true },
        },
        chefMission: {
          select: { id: true, nom: true, prenom: true },
        },
        agents: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, role: true } },
          },
        },
        _count: {
          select: { localites: true },
        },
      },
      orderBy: { dateDebut: 'desc' },
    });

    return res.json({ total: missions.length, missions });

  } catch (err) {
    console.error('Erreur listMissions :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  GET ONE — Détail d'une mission avec localités
//  GET /api/v1/missions/:id
// =============================================================

const getMission = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: {
        projet: {
          select: { id: true, code: true, nom: true, statut: true },
        },
        chefMission: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        agents: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, role: true } },
          },
        },
        localites: {
          include: {
            methodes: {
              include: {
                _count: {
                  select: { moustiques: true, tiques: true, puces: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { localites: true } },
      },
    });

    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }

    return res.json({ mission });

  } catch (err) {
    console.error('Erreur getMission :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  CREATE — Créer une mission
//  POST /api/v1/missions
//  Accès : Admin, Chercheur
// =============================================================

const createMission = async (req, res) => {
  const {
    ordreMission, projetId, chefMissionId,
    dateDebut, dateFin, statut, observations,
    agentIds,
  } = req.body;

  if (!ordreMission || !projetId || !dateDebut) {
    return res.status(400).json({
      error: "L'ordre de mission, le projet et la date de début sont obligatoires",
    });
  }

  try {
    // Vérifier unicité ordre de mission
    const existing = await prisma.mission.findUnique({
      where: { ordreMission },
    });
    if (existing) {
      return res.status(409).json({
        error: `L'ordre de mission "${ordreMission}" existe déjà`,
      });
    }

    // Vérifier que le projet existe
    const projet = await prisma.projet.findUnique({ where: { id: parseInt(projetId) } });
    if (!projet) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    // Créer la mission avec les agents si fournis
    const mission = await prisma.mission.create({
      data: {
        ordreMission:  ordreMission.trim(),
        projetId:      parseInt(projetId),
        chefMissionId: chefMissionId ? parseInt(chefMissionId) : null,
        dateDebut:     new Date(dateDebut),
        dateFin:       dateFin ? new Date(dateFin) : null,
        statut:        statut || 'planifiee',
        observations:  observations || null,
        // Ajouter les agents terrain
        agents: agentIds && agentIds.length > 0 ? {
          create: agentIds.map(uid => ({ userId: parseInt(uid) })),
        } : undefined,
      },
      include: {
        projet:      { select: { id: true, code: true, nom: true } },
        chefMission: { select: { id: true, nom: true, prenom: true } },
        agents: {
          include: {
            user: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    return res.status(201).json({
      message: 'Mission créée avec succès',
      mission,
    });

  } catch (err) {
    console.error('Erreur createMission :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  UPDATE — Modifier une mission
//  PUT /api/v1/missions/:id
//  Accès : Admin, Chercheur
// =============================================================

const updateMission = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    chefMissionId, dateDebut, dateFin,
    statut, observations, agentIds,
  } = req.body;

  const data = {};
  if (chefMissionId !== undefined) data.chefMissionId = chefMissionId ? parseInt(chefMissionId) : null;
  if (dateDebut)                   data.dateDebut     = new Date(dateDebut);
  if (dateFin !== undefined)       data.dateFin       = dateFin ? new Date(dateFin) : null;
  if (statut)                      data.statut        = statut;
  if (observations !== undefined)  data.observations  = observations;

  try {
    // Mettre à jour les agents si fournis
    if (agentIds !== undefined) {
      // Supprimer les anciens agents et recréer
      await prisma.missionAgent.deleteMany({ where: { missionId: id } });
      if (agentIds.length > 0) {
        data.agents = {
          create: agentIds.map(uid => ({ userId: parseInt(uid) })),
        };
      }
    }

    const mission = await prisma.mission.update({
      where: { id },
      data,
      include: {
        projet:      { select: { id: true, code: true, nom: true } },
        chefMission: { select: { id: true, nom: true, prenom: true } },
        agents: {
          include: {
            user: { select: { id: true, nom: true, prenom: true } },
          },
        },
        _count: { select: { localites: true } },
      },
    });

    return res.json({ message: 'Mission mise à jour avec succès', mission });

  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Mission introuvable' });
    }
    console.error('Erreur updateMission :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  DELETE — Supprimer une mission
//  DELETE /api/v1/missions/:id
//  Accès : Admin uniquement
// =============================================================

const deleteMission = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: { _count: { select: { localites: true } } },
    });

    if (!mission) {
      return res.status(404).json({ error: 'Mission introuvable' });
    }

    if (mission._count.localites > 0) {
      return res.status(409).json({
        error: `Impossible de supprimer — cette mission contient ${mission._count.localites} localité(s).`,
      });
    }

    await prisma.mission.delete({ where: { id } });
    return res.json({ message: 'Mission supprimée avec succès' });

  } catch (err) {
    console.error('Erreur deleteMission :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { listMissions, getMission, createMission, updateMission, deleteMission };