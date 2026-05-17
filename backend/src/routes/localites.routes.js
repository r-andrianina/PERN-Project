const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/localites.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { validate } = require('../middlewares/validate');
const schema       = require('../schemas/localites.schema');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/carte',            asyncHandler(ctrl.getCarteLocalites));
router.get('/lookup-fokontany', asyncHandler(ctrl.lookupFokontany));
router.get('/',                 asyncHandler(ctrl.listLocalites));
router.get('/:id',              asyncHandler(ctrl.getLocalite));

router.post('/',    requireMinRole('chercheur'), validate(schema.createLocalite), asyncHandler(ctrl.createLocalite));
router.put('/:id',  requireMinRole('chercheur'), validate(schema.updateLocalite), asyncHandler(ctrl.updateLocalite));

router.delete('/:id', requireRole('admin'), asyncHandler(ctrl.deleteLocalite));

module.exports = router;
