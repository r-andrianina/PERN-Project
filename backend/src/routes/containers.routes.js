// backend/src/routes/containers.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/containers.controller');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post('/',                 requireMinRole('terrain'),   ctrl.create);
router.put('/:id',               requireMinRole('chercheur'), ctrl.update);
router.delete('/:id',            requireMinRole('admin'),     ctrl.remove);

module.exports = router;
