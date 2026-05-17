const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/methodes.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { validate } = require('../middlewares/validate');
const schema       = require('../schemas/methodes.schema');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',                        asyncHandler(ctrl.listMethodes));
router.get('/:id/preview-id-terrain',  asyncHandler(ctrl.previewIdTerrain));
router.get('/:id',                     asyncHandler(ctrl.getMethode));

router.post('/',    requireMinRole('technicien'), validate(schema.createMethode), asyncHandler(ctrl.createMethode));
router.put('/:id',  requireMinRole('technicien'), validate(schema.updateMethode), asyncHandler(ctrl.updateMethode));

router.delete('/:id', requireRole('admin'), asyncHandler(ctrl.deleteMethode));

module.exports = router;
