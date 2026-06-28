// backend/src/routes/auth.routes.js

const express      = require('express');
const router       = express.Router();
const authCtrl     = require('../controllers/auth.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const schema       = require('../schemas/auth.schema');
const { loginLimiter, publicLimiter } = require('../middlewares/rateLimiter');

// ── Publiques ─────────────────────────────────────────────────
router.post('/register', publicLimiter, validate(schema.register), asyncHandler(authCtrl.register));
router.post('/login',    loginLimiter,  validate(schema.login),    asyncHandler(authCtrl.login));

// ── Authentifiées ─────────────────────────────────────────────
router.get('/me', verifyToken, asyncHandler(authCtrl.me));

// ── Admin ─────────────────────────────────────────────────────
router.get('/users',    verifyToken, requireRole('admin'), asyncHandler(authCtrl.listUsers));
router.post('/users',   verifyToken, requireRole('admin'), validate(schema.createUser),   asyncHandler(authCtrl.createUser));
router.put('/users/:id',verifyToken, requireRole('admin'), validate(schema.updateUser),   asyncHandler(authCtrl.updateUser));
router.delete('/users/:id', verifyToken, requireRole('admin'), asyncHandler(authCtrl.deleteUser));

router.patch('/users/:id/activate',       verifyToken, requireRole('admin'), validate(schema.activateUser),    asyncHandler(authCtrl.activateUser));
router.patch('/users/:id/specimens',      verifyToken, requireRole('admin'), validate(schema.updateSpecimens), asyncHandler(authCtrl.updateSpecimenAccess));
router.patch('/users/:id/reset-password', verifyToken, requireRole('admin'), validate(schema.resetPassword),   asyncHandler(authCtrl.resetPassword));

// Présence & gestion de session
router.get('/users/presence',         verifyToken, requireRole('admin'), asyncHandler(authCtrl.getPresence));
router.delete('/users/:id/session',   verifyToken, requireRole('admin'), asyncHandler(authCtrl.kickUser));

module.exports = router;
