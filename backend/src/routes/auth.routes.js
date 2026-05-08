// backend/src/routes/auth.routes.js
// Routes d'authentification et gestion des utilisateurs

const express    = require('express');
const router     = express.Router();
const authCtrl   = require('../controllers/auth.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

// =============================================================
//  ROUTES PUBLIQUES (sans token)
// =============================================================

// POST /api/v1/auth/register — Inscription (compte en attente)
router.post('/register', authCtrl.register);

// POST /api/v1/auth/login — Connexion → retourne un JWT
router.post('/login', authCtrl.login);

// =============================================================
//  ROUTES PROTÉGÉES (token JWT requis)
// =============================================================

// GET /api/v1/auth/me — Profil de l'utilisateur connecté
router.get('/me', verifyToken, authCtrl.me);

// =============================================================
//  ROUTES ADMIN UNIQUEMENT
// =============================================================

// GET /api/v1/auth/users — Liste tous les utilisateurs
router.get(
  '/users',
  verifyToken,
  requireRole('admin'),
  authCtrl.listUsers
);

// PATCH /api/v1/auth/users/:id/activate — Activer/désactiver + changer rôle
router.patch('/users/:id/activate',      verifyToken, requireRole('admin'), authCtrl.activateUser);

// POST   /api/v1/auth/users        — Admin crée un compte
router.post('/users',                    verifyToken, requireRole('admin'), authCtrl.createUser);

// PUT    /api/v1/auth/users/:id    — Admin modifie nom/prenom/email/role
router.put('/users/:id',                 verifyToken, requireRole('admin'), authCtrl.updateUser);

// DELETE /api/v1/auth/users/:id    — Admin supprime un compte
router.delete('/users/:id',              verifyToken, requireRole('admin'), authCtrl.deleteUser);

// PATCH  /api/v1/auth/users/:id/reset-password — Admin réinitialise le mdp
router.patch('/users/:id/reset-password', verifyToken, requireRole('admin'), authCtrl.resetPassword);

module.exports = router;
