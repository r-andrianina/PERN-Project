const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/containers.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',    asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.getOne));

router.post('/',    requireMinRole('terrain'),   asyncHandler(ctrl.create));
router.put('/:id',  requireMinRole('chercheur'), asyncHandler(ctrl.update));
router.delete('/:id', requireMinRole('admin'),   asyncHandler(ctrl.remove));

module.exports = router;
