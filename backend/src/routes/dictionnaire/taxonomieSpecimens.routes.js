// backend/src/routes/dictionnaire/taxonomieSpecimens.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/taxonomieSpecimens.controller');
const { verifyToken, requireMinRole, requireRole } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../middlewares/asyncHandler');
const { validate } = require('../../middlewares/validate');
const schema = require('../../schemas/taxonomieSpecimens.schema');

router.use(verifyToken);

router.get('/tree',  asyncHandler(ctrl.tree));
router.get('/',      asyncHandler(ctrl.list));
router.get('/:id',   asyncHandler(ctrl.getOne));

router.post('/',                    requireMinRole('chercheur'), validate(schema.createTaxonomieSpecimen), asyncHandler(ctrl.create));
router.put('/:id',                  requireMinRole('chercheur'), validate(schema.updateTaxonomieSpecimen), asyncHandler(ctrl.update));
router.patch('/:id/activer',        requireMinRole('chercheur'), asyncHandler(ctrl.activer));
router.patch('/:id/desactiver',     requireMinRole('chercheur'), asyncHandler(ctrl.desactiver));
router.delete('/:id',               requireRole('admin'),        asyncHandler(ctrl.remove));

module.exports = router;
