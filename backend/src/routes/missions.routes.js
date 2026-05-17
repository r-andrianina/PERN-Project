const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/missions.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { validate } = require('../middlewares/validate');
const schema       = require('../schemas/missions.schema');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',    asyncHandler(ctrl.listMissions));
router.get('/:id', asyncHandler(ctrl.getMission));

router.post('/',    requireMinRole('chercheur'), validate(schema.createMission), asyncHandler(ctrl.createMission));
router.put('/:id',  requireMinRole('chercheur'), validate(schema.updateMission), asyncHandler(ctrl.updateMission));

router.delete('/:id', requireRole('admin'), asyncHandler(ctrl.deleteMission));

module.exports = router;
