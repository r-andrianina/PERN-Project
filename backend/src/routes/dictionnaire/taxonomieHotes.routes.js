// backend/src/routes/dictionnaire/taxonomieHotes.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/taxonomieHotes.controller');
const { verifyToken, requireMinRole, requireRole } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../middlewares/asyncHandler');
const { validate } = require('../../middlewares/validate');
const schema = require('../../schemas/taxonomieHotes.schema');

router.use(verifyToken);

router.get('/tree',  asyncHandler(ctrl.tree));
router.get('/',      asyncHandler(ctrl.list));
router.get('/:id',   asyncHandler(ctrl.getOne));

router.post('/',                    requireMinRole('chercheur'), validate(schema.createTaxonomieHote), asyncHandler(ctrl.create));
router.put('/:id',                  requireMinRole('chercheur'), validate(schema.updateTaxonomieHote), asyncHandler(ctrl.update));
router.patch('/:id/activer',        requireMinRole('chercheur'), asyncHandler(ctrl.activer));
router.patch('/:id/desactiver',     requireMinRole('chercheur'), asyncHandler(ctrl.desactiver));
router.delete('/:id',               requireRole('admin'),        asyncHandler(ctrl.remove));

module.exports = router;
