// backend/src/routes/missions.routes.js

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/missions.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

// Lecture — tous les rôles
router.get('/',    ctrl.listMissions);
router.get('/:id', ctrl.getMission);

// Création/modification — Admin + Chercheur
router.post('/',    requireMinRole('chercheur'), ctrl.createMission);
router.put('/:id',  requireMinRole('chercheur'), ctrl.updateMission);

// Suppression — Admin uniquement
router.delete('/:id', requireRole('admin'), ctrl.deleteMission);

module.exports = router;