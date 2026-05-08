// backend/src/routes/localites.routes.js

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/localites.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Lecture — tous les rôles
router.get('/carte',             ctrl.getCarteLocalites);
router.get('/lookup-fokontany',  ctrl.lookupFokontany);   // ← avant /:id
router.get('/',                  ctrl.listLocalites);
router.get('/:id',               ctrl.getLocalite);

// Écriture — Admin + Chercheur
router.post('/',    requireMinRole('chercheur'), ctrl.createLocalite);
router.put('/:id',  requireMinRole('chercheur'), ctrl.updateLocalite);

// Suppression — Admin uniquement
router.delete('/:id', requireRole('admin'), ctrl.deleteLocalite);

module.exports = router;