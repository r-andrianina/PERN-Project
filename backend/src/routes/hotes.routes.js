const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/hotes.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { validate } = require('../middlewares/validate');
const schema       = require('../schemas/hotes.schema');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',    asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));

router.post('/',    requireMinRole('technicien'),   validate(schema.createHote), asyncHandler(ctrl.create));
router.put('/:id',  requireMinRole('technicien'),   validate(schema.updateHote), asyncHandler(ctrl.update));
router.delete('/:id', requireMinRole('chercheur'), asyncHandler(ctrl.remove));

module.exports = router;
