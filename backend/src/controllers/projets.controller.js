// backend/src/controllers/projets.controller.js
// CRUD complet des projets
// Accès : Admin (tout), Chercheur (lecture), Terrain (lecture), Lecteur (lecture)

const prisma = require('../config/prisma');

// =============================================================
//  LIST — Tous les projets
//  GET /api/v1/projets
// =============================================================

const listProjets = async (req, res) => {
  try {
    const { statut, search } = req.query;

    const where = {};

    // Filtre par statut (actif, termine, suspendu)
    if (statut) where.statut = statut;

    // Recherche par nom ou code
    if (search) {
      where.OR = [
        { nom:  { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const projets = await prisma.projet.findMany({
      where,
      include: {
        responsable: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        _count: {
          select: { missions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      total: projets.length,
      projets,
    });

  } catch (err) {
    console.error('Erreur listProjets :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  GET ONE — Détail d'un projet avec ses missions
//  GET /api/v1/projets/:id
// =============================================================

const getProjet = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const projet = await prisma.projet.findUnique({
      where: { id },
      include: {
        responsable: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        missions: {
          include: {
            chefMission: {
              select: { id: true, nom: true, prenom: true },
            },
            _count: {
              select: { localites: true },
            },
          },
          orderBy: { dateDebut: 'desc' },
        },
        _count: {
          select: { missions: true },
        },
      },
    });

    if (!projet) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    return res.json({ projet });

  } catch (err) {
    console.error('Erreur getProjet :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  CREATE — Créer un projet
//  POST /api/v1/projets
//  Accès : Admin uniquement
// =============================================================

const createProjet = async (req, res) => {
  const { code, nom, description, porteur, responsableId, dateDebut, dateFin, statut } = req.body;

  // Validation
  if (!code || !nom) {
    return res.status(400).json({ error: 'Le code et le nom du projet sont obligatoires' });
  }

  // Validation format code (lettres, chiffres, tirets uniquement)
  const codeRegex = /^[A-Za-z0-9\-_]+$/;
  if (!codeRegex.test(code)) {
    return res.status(400).json({ error: 'Le code ne doit contenir que des lettres, chiffres et tirets' });
  }

  try {
    // Vérifier unicité du code
    const existing = await prisma.projet.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ error: `Le code "${code}" est déjà utilisé` });
    }

    const projet = await prisma.projet.create({
      data: {
        code:          code.toUpperCase().trim(),
        nom:           nom.trim(),
        description:   description || null,
        porteur:       porteur ? porteur.trim() : null,
        responsableId: responsableId ? parseInt(responsableId) : null,
        dateDebut:     dateDebut ? new Date(dateDebut) : null,
        dateFin:       dateFin   ? new Date(dateFin)   : null,
        statut:        statut    || 'actif',
      },
      include: {
        responsable: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
      },
    });

    return res.status(201).json({
      message: 'Projet créé avec succès',
      projet,
    });

  } catch (err) {
    console.error('Erreur createProjet :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  UPDATE — Modifier un projet
//  PUT /api/v1/projets/:id
//  Accès : Admin uniquement
// =============================================================

const updateProjet = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, description, porteur, responsableId, dateDebut, dateFin, statut } = req.body;

  // Construire les données à mettre à jour (uniquement ce qui est fourni)
  const data = {};
  if (nom)                          data.nom           = nom.trim();
  if (description !== undefined)    data.description   = description;
  if (porteur       !== undefined)  data.porteur       = porteur ? porteur.trim() : null;
  if (responsableId !== undefined)  data.responsableId = responsableId ? parseInt(responsableId) : null;
  if (dateDebut)                    data.dateDebut     = new Date(dateDebut);
  if (dateFin !== undefined)        data.dateFin       = dateFin ? new Date(dateFin) : null;
  if (statut)                       data.statut        = statut;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie' });
  }

  try {
    const projet = await prisma.projet.update({
      where: { id },
      data,
      include: {
        responsable: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        _count: { select: { missions: true } },
      },
    });

    return res.json({
      message: 'Projet mis à jour avec succès',
      projet,
    });

  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Projet introuvable' });
    }
    console.error('Erreur updateProjet :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  DELETE — Supprimer un projet
//  DELETE /api/v1/projets/:id
//  Accès : Admin uniquement
// =============================================================

const deleteProjet = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    // Vérifier s'il a des missions
    const projet = await prisma.projet.findUnique({
      where: { id },
      include: { _count: { select: { missions: true } } },
    });

    if (!projet) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    if (projet._count.missions > 0) {
      return res.status(409).json({
        error: `Impossible de supprimer — ce projet contient ${projet._count.missions} mission(s). Supprimez d'abord les missions.`,
      });
    }

    await prisma.projet.delete({ where: { id } });

    return res.json({ message: 'Projet supprimé avec succès' });

  } catch (err) {
    console.error('Erreur deleteProjet :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { listProjets, getProjet, createProjet, updateProjet, deleteProjet };