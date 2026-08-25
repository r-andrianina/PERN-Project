const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/pools.controller');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');
const { validate }  = require('../middlewares/validate');
const schema        = require('../schemas/pools.schema');

router.use(verifyToken);

router.get('/',    asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));

router.post('/', requireMinRole('technicien'), validate(schema.createPool), asyncHandler(ctrl.create));

router.delete('/:id', requireMinRole('admin'), asyncHandler(ctrl.remove));

module.exports = router;
