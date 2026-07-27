const express      = require('express');
const router       = express.Router();
const ctrl         = require('../../controllers/autresSpecimens.controller');
const { verifyToken, requireRole, requireMinRole, checkSpecimenAccess } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate');
const asyncHandler = require('../../middlewares/asyncHandler');
const schema       = require('../../schemas/autresSpecimens.schema');

router.use(verifyToken);
router.use(checkSpecimenAccess('autre'));

router.get('/',    asyncHandler(ctrl.listAutresSpecimens));
router.get('/:id', asyncHandler(ctrl.getAutreSpecimen));

router.post('/',   requireMinRole('technicien'), validate(schema.createAutreSpecimen), asyncHandler(ctrl.createAutreSpecimen));
router.put('/:id', requireMinRole('technicien'), validate(schema.updateAutreSpecimen), asyncHandler(ctrl.updateAutreSpecimen));
router.delete('/:id', requireRole('admin'),      asyncHandler(ctrl.deleteAutreSpecimen));

module.exports = router;
