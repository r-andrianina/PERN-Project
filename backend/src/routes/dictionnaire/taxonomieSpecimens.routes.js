// backend/src/routes/dictionnaire/taxonomieSpecimens.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/taxonomieSpecimens.controller');
const { verifyToken, requireMinRole, requireRole } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../middlewares/asyncHandler');

router.use(verifyToken);

router.get('/tree',  asyncHandler(ctrl.tree));
router.get('/',      asyncHandler(ctrl.list));
router.get('/:id',   asyncHandler(ctrl.getOne));

router.post('/',                    requireMinRole('chercheur'), asyncHandler(ctrl.create));
router.put('/:id',                  requireMinRole('chercheur'), asyncHandler(ctrl.update));
router.patch('/:id/activer',        requireMinRole('chercheur'), asyncHandler(ctrl.activer));
router.patch('/:id/desactiver',     requireMinRole('chercheur'), asyncHandler(ctrl.desactiver));
router.delete('/:id',               requireRole('admin'),        asyncHandler(ctrl.remove));

module.exports = router;
