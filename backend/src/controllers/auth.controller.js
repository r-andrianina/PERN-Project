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

// Signe un JWT (8 h) à partir d'un enregistrement utilisateur. Factorisé pour
// que login et changePassword produisent exactement le même payload — voir
// enforceAccountActive (auth.middleware) qui s'appuie sur l'iat pour la
// révocation sur changement de mot de passe.
const signToken = (user) =>
  jwt.sign(
    {
      id:                 user.id,
      email:              user.email,
      role:               user.role,
      nom:                user.nom,
      prenom:             user.prenom,
      specimensAutorises: user.specimensAutorises,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

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

  const token = signToken(user);

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

  // Un admin ne peut pas se rétrograder lui-même : évite le verrouillage
  // accidentel (dernier admin qui perd ses droits). Même esprit que les gardes
  // self de activateUser/deleteUser. req.user.role est le rôle rafraîchi (B2).
  if (id === req.user.id && data.role && data.role !== req.user.role) {
    return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' });
  }

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

  const before = await prisma.user.findUnique({ where: { id }, select: { specimensAutorises: true } });
  const user = await prisma.user.update({
    where: { id },
    data:  { specimensAutorises },
    select: USER_SELECT,
  });

  // Invalide les deux caches immédiatement : celui de checkSpecimenAccess (B)
  // ET le cache statut qui alimente req.user.specimensAutorises (carte/dashboard
  // /recherche) — sinon le filtrage resterait périmé jusqu'à 30 s.
  invalidateSpecimenCache(id);
  invalidateUserStatus(id);

  // Notifie l'utilisateur en temps réel via SSE s'il est connecté (D)
  sseManager.sendToUser(id, 'permissions_changed', {
    specimensAutorises: user.specimensAutorises,
    message: 'Vos permissions d\'accès aux spécimens ont été mises à jour.',
  });

  await logAudit({ req, action: ACTIONS.UPDATE, entity: 'User', entityId: id, oldValues: before, newValues: { specimensAutorises: user.specimensAutorises } });

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

  const before = await prisma.user.findUnique({
    where: { id }, select: { nom: true, prenom: true, email: true, role: true },
  });
  if (!before) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const passwordHash = await bcrypt.hash(password, 10);
  // passwordChangedAt coupe les sessions actives de la cible (les JWT émis
  // avant ce reset sont refusés par enforceAccountActive) — sécurité clé
  // quand un compte est réinitialisé parce qu'il est potentiellement compromis.
  await prisma.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date() } });
  invalidateUserStatus(id); // révocation immédiate sans attendre l'expiration du cache statut (30 s)

  // Traçabilité : une réinitialisation de mot de passe par un admin est une
  // action sensible — on l'historise comme les autres opérations sur User
  // (jamais le mot de passe lui-même, seulement un marqueur).
  await logAudit({
    req, action: ACTIONS.UPDATE, entity: 'User', entityId: id,
    oldValues: { nom: before.nom, prenom: before.prenom, email: before.email, role: before.role },
    newValues: { passwordReset: true },
  });

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

  const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsOld) return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l\'ancien' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const changedAt = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: changedAt } });
  invalidateUserStatus(user.id); // coupe les AUTRES sessions du compte (autres navigateurs)

  // On ré-émet un token frais pour la session courante : son iat est postérieur
  // (ou égal à la seconde près) à passwordChangedAt, donc il n'est PAS révoqué —
  // l'utilisateur qui change son mot de passe reste connecté ici, seules ses
  // autres sessions sont coupées. Le frontend remplace le token stocké.
  const token = signToken(user);
  return res.json({ message: 'Mot de passe modifié avec succès', token });
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
