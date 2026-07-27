// backend/src/routes/dictionnaire/_simple.routes.js
// Fabrique de routes pour les référentiels plats (CRUD + actif).

const express = require('express');
const { verifyToken, requireMinRole, requireRole } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../middlewares/asyncHandler');

function buildSimpleRouter(ctrl) {
  const router = express.Router();
  router.use(verifyToken);

  router.get('/',     asyncHandler(ctrl.list));
  router.get('/:id',  asyncHandler(ctrl.getOne));

  router.post('/',                requireMinRole('chercheur'), asyncHandler(ctrl.create));
  router.put('/:id',              requireMinRole('chercheur'), asyncHandler(ctrl.update));
  router.patch('/:id/activer',    requireMinRole('chercheur'), asyncHandler(ctrl.activer));
  router.patch('/:id/desactiver', requireMinRole('chercheur'), asyncHandler(ctrl.desactiver));
  router.delete('/:id',           requireRole('admin'),        asyncHandler(ctrl.remove));

  return router;
}

module.exports = { buildSimpleRouter };
