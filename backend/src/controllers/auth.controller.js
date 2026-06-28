// backend/src/controllers/auth.controller.js

const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const prisma     = require('../config/prisma');
const sseManager = require('../utils/sseManager');
const { logAudit, ACTIONS } = require('../utils/audit');
const { invalidateSpecimenCache } = require('../middlewares/auth.middleware');

const ROLES_VALIDES     = ['admin', 'superviseur', 'chercheur', 'technicien', 'lecteur'];
const SPECIMENS_VALIDES = ['moustique', 'tique', 'puce'];

const USER_SELECT = {
  id: true, nom: true, prenom: true, email: true,
  role: true, actif: true, createdAt: true,
  specimensAutorises: true,
};

// =============================================================
//  REGISTER
// =============================================================

const register = async (req, res) => {
  const { nom, prenom, email, password } = req.body;

  if (!nom || !prenom || !email || !password)
    return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Format email invalide' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        nom: nom.trim(), prenom: prenom.trim(),
        email: email.toLowerCase(), passwordHash,
        role: 'lecteur', actif: false,
      },
      select: USER_SELECT,
    });
    return res.status(201).json({
      message: 'Inscription réussie — votre compte est en attente de validation par un administrateur.',
      user: newUser,
    });
  } catch (err) {
    console.error('Erreur register :', err.message);
    return res.status(500).json({ error: "Erreur serveur lors de l'inscription" });
  }
};

// =============================================================
//  LOGIN
// =============================================================

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user)      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    if (!user.actif) return res.status(403).json({ error: 'Votre compte est en attente de validation par un administrateur.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const token = jwt.sign(
      {
        id:                 user.id,
        email:              user.email,
        role:               user.role,
        nom:                user.nom,
        prenom:             user.prenom,
        specimensAutorises: user.specimensAutorises,  // embarqué dans le JWT
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id:                 user.id,
        nom:                user.nom,
        prenom:             user.prenom,
        email:              user.email,
        role:               user.role,
        specimensAutorises: user.specimensAutorises,
      },
    });
  } catch (err) {
    console.error('Erreur login :', err.message);
    return res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
};

// =============================================================
//  ME
// =============================================================

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: USER_SELECT });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user });
  } catch (err) {
    console.error('Erreur me :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  LIST USERS
// =============================================================

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: [{ actif: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json({
      total:      users.length,
      en_attente: users.filter(u => !u.actif),
      actifs:     users.filter(u => u.actif),
    });
  } catch (err) {
    console.error('Erreur listUsers :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  CREATE USER (Admin)
// =============================================================

const createUser = async (req, res) => {
  const { nom, prenom, email, password, role, actif, specimensAutorises } = req.body;

  if (!nom || !prenom || !email || !password)
    return res.status(400).json({ error: 'nom, prenom, email et password sont obligatoires' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  if (role && !ROLES_VALIDES.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        nom: nom.trim(), prenom: prenom.trim(),
        email: email.toLowerCase(), passwordHash,
        role:               role  || 'lecteur',
        actif:              actif !== undefined ? Boolean(actif) : true,
        specimensAutorises: specimensAutorises ?? SPECIMENS_VALIDES,
      },
      select: USER_SELECT,
    });
    await logAudit({ req, action: ACTIONS.CREATE, entity: 'User', entityId: user.id, newValues: { nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
    return res.status(201).json({ message: 'Utilisateur créé avec succès', user });
  } catch (err) {
    console.error('Erreur createUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  UPDATE USER (Admin) — nom/prenom/email/role
// =============================================================

const updateUser = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, prenom, email, role } = req.body;

  if (role && !ROLES_VALIDES.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  const data = {};
  if (nom)    data.nom    = nom.trim();
  if (prenom) data.prenom = prenom.trim();
  if (email)  data.email  = email.toLowerCase();
  if (role)   data.role   = role;

  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: 'Aucune modification fournie' });

  try {
    if (data.email) {
      const conflict = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } } });
      if (conflict) return res.status(409).json({ error: 'Email déjà utilisé par un autre compte' });
    }
    const before = await prisma.user.findUnique({ where: { id }, select: { nom: true, prenom: true, email: true, role: true } });
    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
    await logAudit({ req, action: ACTIONS.UPDATE, entity: 'User', entityId: id, oldValues: before, newValues: { nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
    return res.json({ message: 'Utilisateur mis à jour', user });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur updateUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  ACTIVATE USER — statut actif + rôle
// =============================================================

const activateUser = async (req, res) => {
  const id = parseInt(req.params.id);
  const { actif, role } = req.body;

  if (id === req.user.id && actif === false)
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });

  if (role && !ROLES_VALIDES.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  const data = {};
  if (typeof actif === 'boolean') data.actif = actif;
  if (role) data.role = role;

  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: 'Aucune modification fournie (actif ou role attendu)' });

  try {
    const before = await prisma.user.findUnique({ where: { id }, select: { actif: true, role: true } });
    const user   = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
    const action = typeof actif === 'boolean'
      ? (actif ? ACTIONS.ACTIVATE : ACTIONS.DEACTIVATE)
      : ACTIONS.UPDATE;
    await logAudit({ req, action, entity: 'User', entityId: id, oldValues: before, newValues: { nom: user.nom, prenom: user.prenom, actif: user.actif, role: user.role } });
    return res.json({ message: 'Utilisateur mis à jour avec succès', user });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur activateUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  UPDATE SPECIMEN ACCESS
//  PATCH /api/v1/auth/users/:id/specimens
//  Body : { specimensAutorises: ['moustique', 'tique'] }
// =============================================================

const updateSpecimenAccess = async (req, res) => {
  const id = parseInt(req.params.id);
  const { specimensAutorises } = req.body;

  if (!Array.isArray(specimensAutorises))
    return res.status(400).json({ error: 'specimensAutorises doit être un tableau' });

  const invalides = specimensAutorises.filter(s => !SPECIMENS_VALIDES.includes(s));
  if (invalides.length > 0)
    return res.status(400).json({ error: `Types invalides : ${invalides.join(', ')}` });

  try {
    const user = await prisma.user.update({
      where: { id },
      data:  { specimensAutorises },
      select: USER_SELECT,
    });

    // Invalide le cache de permissions immédiatement (B)
    invalidateSpecimenCache(id);

    // Notifie l'utilisateur en temps réel via SSE s'il est connecté (D)
    sseManager.sendToUser(id, 'permissions_changed', {
      specimensAutorises: user.specimensAutorises,
      message: 'Vos permissions d\'accès aux spécimens ont été mises à jour.',
    });

    return res.json({ message: 'Permissions spécimens mises à jour', user });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur updateSpecimenAccess :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  DELETE USER
// =============================================================

const deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  try {
    const before = await prisma.user.findUnique({ where: { id }, select: { nom: true, prenom: true, email: true, role: true } });
    if (!before) return res.status(404).json({ error: 'Utilisateur introuvable' });
    await prisma.user.delete({ where: { id } });
    await logAudit({ req, action: ACTIONS.DELETE, entity: 'User', entityId: id, oldValues: { nom: before.nom, prenom: before.prenom, email: before.email, role: before.role } });
    return res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur deleteUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  RESET PASSWORD
// =============================================================

const resetPassword = async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    return res.json({ message: 'Mot de passe réinitialisé' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur resetPassword :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  PRESENCE — utilisateurs ayant une connexion SSE active
// =============================================================

const getPresence = async (req, res) => {
  try {
    const onlineIds = sseManager.getOnlineUserIds();

    const users = onlineIds.length > 0
      ? await prisma.user.findMany({
          where:   { id: { in: onlineIds } },
          select:  USER_SELECT,
          orderBy: { prenom: 'asc' },
        })
      : [];

    return res.json({
      count: users.length,
      users: users.map(u => ({ ...u, tabCount: sseManager.getTabCount(u.id) })),
    });
  } catch (err) {
    console.error('Erreur getPresence :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  KICK — ferme les connexions SSE d'un utilisateur
// =============================================================

const kickUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ error: 'Vous ne pouvez pas fermer votre propre session' });

  const disconnected = sseManager.disconnectUser(id);
  // Notifie tous les clients restants que la présence a changé
  sseManager.broadcast(null, 'presence_update', {});

  return res.json({
    disconnected,
    message: disconnected ? 'Session SSE fermée' : 'Utilisateur non connecté',
  });
};

module.exports = {
  register, login, me,
  listUsers, createUser, updateUser,
  activateUser, updateSpecimenAccess,
  deleteUser, resetPassword,
  getPresence, kickUser,
};
