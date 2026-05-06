// backend/src/routes/dictionnaire/_simple.routes.js
// Fabrique de routes pour les référentiels plats (CRUD + actif).

const express = require('express');
const { verifyToken, requireMinRole, requireRole } = require('../../middlewares/auth.middleware');

function buildSimpleRouter(ctrl) {
  const router = express.Router();
  router.use(verifyToken);

  router.get('/',     ctrl.list);
  router.get('/:id',  ctrl.getOne);

  router.post('/',                requireMinRole('chercheur'), ctrl.create);
  router.put('/:id',              requireMinRole('chercheur'), ctrl.update);
  router.patch('/:id/activer',    requireMinRole('chercheur'), ctrl.activer);
  router.patch('/:id/desactiver', requireMinRole('chercheur'), ctrl.desactiver);
  router.delete('/:id',           requireRole('admin'),        ctrl.remove);

  return router;
}

module.exports = { buildSimpleRouter };
