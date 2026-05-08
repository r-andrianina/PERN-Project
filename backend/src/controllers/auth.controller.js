// backend/src/controllers/auth.controller.js
// Logique métier : inscription, connexion, profil, activation
// Utilise Prisma Client au lieu de node-postgres

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../config/prisma');

// =============================================================
//  REGISTER — Inscription (compte en attente de validation)
// =============================================================

const register = async (req, res) => {
  const { nom, prenom, email, password } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Format email invalide' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        nom:          nom.trim(),
        prenom:       prenom.trim(),
        email:        email.toLowerCase(),
        passwordHash,
        role:         'lecteur',
        actif:        false,
      },
      select: {
        id: true, nom: true, prenom: true,
        email: true, role: true, actif: true, createdAt: true,
      },
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
//  LOGIN — Connexion
// =============================================================

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      return res.status(403).json({
        error: 'Votre compte est en attente de validation par un administrateur.',
      });
    }

    const passwordValide = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValide) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Connexion réussie',
      token,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error('Erreur login :', err.message);
    return res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
};

// =============================================================
//  ME — Profil de l'utilisateur connecté
// =============================================================

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user });

  } catch (err) {
    console.error('Erreur me :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  ACTIVATE — Admin active/désactive + change le rôle
// =============================================================

const activateUser = async (req, res) => {
  const id              = parseInt(req.params.id);
  const { actif, role } = req.body;

  if (id === req.user.id && actif === false) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
  }

  const rolesValides = ['admin', 'chercheur', 'terrain', 'lecteur'];
  const data = {};
  if (typeof actif === 'boolean') data.actif = actif;
  if (role && rolesValides.includes(role)) data.role = role;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie (actif ou role attendu)' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
    });

    return res.json({ message: 'Utilisateur mis à jour avec succès', user });

  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur activateUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  LIST USERS — Admin voit tous les utilisateurs
// =============================================================

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true, createdAt: true },
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
//  CREATE USER — Admin crée un compte directement
//  POST /api/v1/auth/users
// =============================================================

const createUser = async (req, res) => {
  const { nom, prenom, email, password, role, actif } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ error: 'nom, prenom, email et password sont obligatoires' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }
  const rolesValides = ['admin', 'chercheur', 'terrain', 'lecteur'];
  if (role && !rolesValides.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        nom: nom.trim(), prenom: prenom.trim(),
        email: email.toLowerCase(),
        passwordHash,
        role:  role  || 'lecteur',
        actif: actif !== undefined ? Boolean(actif) : true,
      },
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true, createdAt: true },
    });
    return res.status(201).json({ message: 'Utilisateur créé avec succès', user });
  } catch (err) {
    console.error('Erreur createUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  UPDATE USER — Admin modifie nom/prenom/email/role
//  PUT /api/v1/auth/users/:id
// =============================================================

const updateUser = async (req, res) => {
  const id = parseInt(req.params.id);
  const { nom, prenom, email, role } = req.body;

  const rolesValides = ['admin', 'chercheur', 'terrain', 'lecteur'];
  const data = {};
  if (nom)    data.nom    = nom.trim();
  if (prenom) data.prenom = prenom.trim();
  if (email)  data.email  = email.toLowerCase();
  if (role && rolesValides.includes(role)) data.role = role;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie' });
  }

  try {
    if (data.email) {
      const conflict = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } } });
      if (conflict) return res.status(409).json({ error: 'Email déjà utilisé par un autre compte' });
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
    });
    return res.json({ message: 'Utilisateur mis à jour', user });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur updateUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  DELETE USER — Admin supprime (pas soi-même)
//  DELETE /api/v1/auth/users/:id
// =============================================================

const deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  try {
    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    console.error('Erreur deleteUser :', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// =============================================================
//  RESET PASSWORD — Admin définit un nouveau mot de passe
//  PATCH /api/v1/auth/users/:id/reset-password
// =============================================================

const resetPassword = async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }
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

module.exports = { register, login, me, activateUser, listUsers, createUser, updateUser, deleteUser, resetPassword };