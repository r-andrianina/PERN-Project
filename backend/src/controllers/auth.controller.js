// backend/src/controllers/auth.controller.js

const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const prisma     = require('../config/prisma');
const sseManager = require('../utils/sseManager');
const { logAudit, ACTIONS } = require('../utils/audit');
const { invalidateSpecimenCache, invalidateUserStatus } = require('../middlewares/auth.middleware');

const USER_SELECT = {
  id: true, nom: true, prenom: true, email: true,
  role: true, actif: true, createdAt: true,
  specimensAutorises: true,
};

// =============================================================
//  REGISTER
// =============================================================

const register = async (req, res) => {
  // req.body déjà validé + normalisé (trim/lowercase) par validate(schema.register)
  const { nom, prenom, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: { nom, prenom, email, passwordHash, role: 'lecteur', actif: false },
    select: USER_SELECT,
  });
  return res.status(201).json({
    message: 'Inscription réussie — votre compte est en attente de validation par un administrateur.',
    user: newUser,
  });
};

// =============================================================
//  LOGIN
// =============================================================

const login = async (req, res) => {
  // req.body déjà validé (email/password requis, email en minuscules) par Zod
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
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
};

// =============================================================
//  ME
// =============================================================

const me = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: USER_SELECT });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json({ user });
};

// =============================================================
//  LIST USERS
// =============================================================

const listUsers = async (req, res) => {
  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: [{ actif: 'asc' }, { createdAt: 'desc' }],
  });
  return res.json({
    total:      users.length,
    en_attente: users.filter(u => !u.actif),
    actifs:     users.filter(u => u.actif),
  });
};

// =============================================================
//  CREATE USER (Admin)
// =============================================================

const createUser = async (req, res) => {
  // req.body validé + defaults appliqués (role, actif, specimensAutorises) par Zod
  const { nom, prenom, email, password, role, actif, specimensAutorises } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { nom, prenom, email, passwordHash, role, actif, specimensAutorises },
    select: USER_SELECT,
  });
  await logAudit({ req, action: ACTIONS.CREATE, entity: 'User', entityId: user.id, newValues: { nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
  return res.status(201).json({ message: 'Utilisateur créé avec succès', user });
};

// =============================================================
//  UPDATE USER (Admin) — nom/prenom/email/role
// =============================================================

const updateUser = async (req, res) => {
  const id = parseInt(req.params.id);
  // req.body validé par Zod (champs optionnels normalisés, ≥1 champ garanti)
  const { nom, prenom, email, role } = req.body;

  const data = {};
  if (nom    !== undefined) data.nom    = nom;
  if (prenom !== undefined) data.prenom = prenom;
  if (email  !== undefined) data.email  = email;
  if (role   !== undefined) data.role   = role;

  if (data.email) {
    const conflict = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } } });
    if (conflict) return res.status(409).json({ error: 'Email déjà utilisé par un autre compte' });
  }
  const before = await prisma.user.findUnique({ where: { id }, select: { nom: true, prenom: true, email: true, role: true } });
  const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
  if (data.role) {
    invalidateUserStatus(id); // révocation immédiate du rôle en cache (B2)
    sseManager.sendToUser(id, 'account_updated', { role: user.role, message: 'Votre rôle a été mis à jour.' }); // F1
  }
  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'User', entityId: id, oldValues: before, newValues: { nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
  return res.json({ message: 'Utilisateur mis à jour', user });
};

// =============================================================
//  ACTIVATE USER — statut actif + rôle
// =============================================================

const activateUser = async (req, res) => {
  const id = parseInt(req.params.id);
  // req.body validé par Zod (actif ou role garanti). Reste la règle métier ci-dessous.
  const { actif, role } = req.body;

  if (id === req.user.id && actif === false)
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });

  const data = {};
  if (typeof actif === 'boolean') data.actif = actif;
  if (role) data.role = role;

  const before = await prisma.user.findUnique({ where: { id }, select: { actif: true, role: true } });
  const user   = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
  invalidateUserStatus(id); // révocation immédiate (actif/rôle) — B2
  if (data.role) // notifie le changement de rôle en temps réel (F1)
    sseManager.sendToUser(id, 'account_updated', { role: user.role, message: 'Votre rôle a été mis à jour.' });
  const action = typeof actif === 'boolean'
    ? (actif ? ACTIONS.ACTIVATE : ACTIONS.DEACTIVATE)
    : ACTIONS.UPDATE;
  await logAudit({ req, action, entity: 'User', entityId: id, oldValues: before, newValues: { nom: user.nom, prenom: user.prenom, actif: user.actif, role: user.role } });
  return res.json({ message: 'Utilisateur mis à jour avec succès', user });
};

// =============================================================
//  UPDATE SPECIMEN ACCESS
//  PATCH /api/v1/auth/users/:id/specimens
//  Body : { specimensAutorises: ['moustique', 'tique'] }
// =============================================================

const updateSpecimenAccess = async (req, res) => {
  const id = parseInt(req.params.id);
  // specimensAutorises validé par Zod (tableau d'enum de types valides)
  const { specimensAutorises } = req.body;

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
};

// =============================================================
//  DELETE USER
// =============================================================

const deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id)
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  const before = await prisma.user.findUnique({ where: { id }, select: { nom: true, prenom: true, email: true, role: true } });
  if (!before) return res.status(404).json({ error: 'Utilisateur introuvable' });
  await prisma.user.delete({ where: { id } });
  invalidateUserStatus(id);     // coupe l'accès du compte supprimé (B2)
  invalidateSpecimenCache(id);
  await logAudit({ req, action: ACTIONS.DELETE, entity: 'User', entityId: id, oldValues: { nom: before.nom, prenom: before.prenom, email: before.email, role: before.role } });
  return res.json({ message: 'Utilisateur supprimé' });
};

// =============================================================
//  RESET PASSWORD
// =============================================================

const resetPassword = async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body; // longueur ≥8 validée par Zod
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  return res.json({ message: 'Mot de passe réinitialisé' });
};

// =============================================================
//  CHANGE PASSWORD (self-service) — utilisateur déjà authentifié
// =============================================================

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return res.json({ message: 'Mot de passe modifié avec succès' });
};

// =============================================================
//  PRESENCE — utilisateurs ayant une connexion SSE active
// =============================================================

const getPresence = async (req, res) => {
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
  deleteUser, resetPassword, changePassword,
  getPresence, kickUser,
};
