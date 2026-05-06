// backend/src/routes/dictionnaire/taxonomieSpecimens.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/taxonomieSpecimens.controller');
const { verifyToken, requireMinRole, requireRole } = require('../../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/tree',  ctrl.tree);
router.get('/',      ctrl.list);
router.get('/:id',   ctrl.getOne);

router.post('/',                    requireMinRole('chercheur'), ctrl.create);
router.put('/:id',                  requireMinRole('chercheur'), ctrl.update);
router.patch('/:id/activer',        requireMinRole('chercheur'), ctrl.activer);
router.patch('/:id/desactiver',     requireMinRole('chercheur'), ctrl.desactiver);
router.delete('/:id',               requireRole('admin'),        ctrl.remove);

module.exports = router;
