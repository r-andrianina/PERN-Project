// backend/src/routes/projets.routes.js

const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/projets.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const schema       = require('../schemas/projets.schema');

router.use(verifyToken);

router.get('/',    asyncHandler(ctrl.listProjets));
router.get('/:id', asyncHandler(ctrl.getProjet));

router.post('/',   requireRole('admin'), validate(schema.createProjet), asyncHandler(ctrl.createProjet));
router.put('/:id', requireRole('admin'), validate(schema.updateProjet), asyncHandler(ctrl.updateProjet));
router.delete('/:id', requireRole('admin'), asyncHandler(ctrl.deleteProjet));

module.exports = router;
