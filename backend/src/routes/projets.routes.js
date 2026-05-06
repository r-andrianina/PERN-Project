// backend/src/routes/projets.routes.js
// Routes CRUD projets avec protection par rôle

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/projets.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent un token valide
router.use(verifyToken);

// =============================================================
//  LECTURE — tous les rôles authentifiés
// =============================================================

// GET /api/v1/projets?statut=actif&search=malaria
router.get('/', ctrl.listProjets);

// GET /api/v1/projets/:id
router.get('/:id', ctrl.getProjet);

// =============================================================
//  ÉCRITURE — Admin uniquement
// =============================================================

// POST /api/v1/projets
router.post('/', requireRole('admin'), ctrl.createProjet);

// PUT /api/v1/projets/:id
router.put('/:id', requireRole('admin'), ctrl.updateProjet);

// DELETE /api/v1/projets/:id
router.delete('/:id', requireRole('admin'), ctrl.deleteProjet);

module.exports = router;