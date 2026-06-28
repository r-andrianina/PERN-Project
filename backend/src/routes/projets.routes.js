// backend/src/routes/projets.routes.js

const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/projets.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const schema       = require('../schemas/projets.schema');

router.use(verifyToken);

// ── Projets ────────────────────────────────────────────────────────────────────
router.get('/',          asyncHandler(ctrl.listProjets));     // liste filtrée par membership
router.get('/:id',       asyncHandler(ctrl.getProjet));       // vérifie membership en service
router.get('/:id/stats', asyncHandler(ctrl.getProjetStats));

router.post('/',    requireMinRole('chercheur'), validate(schema.createProjet), asyncHandler(ctrl.createProjet));
router.put('/:id',  requireMinRole('chercheur'), validate(schema.updateProjet), asyncHandler(ctrl.updateProjet));
router.delete('/:id', requireRole('admin'),                                      asyncHandler(ctrl.deleteProjet));

// ── Membres du projet ─────────────────────────────────────────────────────────
router.get('/:id/membres',            requireMinRole('chercheur'),  asyncHandler(ctrl.listMembres));
router.post('/:id/membres',           requireMinRole('superviseur'), asyncHandler(ctrl.addMembre));
router.delete('/:id/membres/:userId', requireMinRole('superviseur'), asyncHandler(ctrl.removeMembre));

module.exports = router;
