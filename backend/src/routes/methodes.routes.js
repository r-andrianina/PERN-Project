// backend/src/routes/methodes.routes.js

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/methodes.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',    ctrl.listMethodes);
router.get('/:id', ctrl.getMethode);

// Admin + Chercheur + Terrain peuvent créer/modifier des méthodes
router.post('/',    requireMinRole('terrain'), ctrl.createMethode);
router.put('/:id',  requireMinRole('terrain'), ctrl.updateMethode);

// Suppression — Admin uniquement
router.delete('/:id', requireRole('admin'), ctrl.deleteMethode);

module.exports = router;