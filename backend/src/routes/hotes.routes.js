// backend/src/routes/hotes.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/hotes.controller');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post('/',                   requireMinRole('terrain'), ctrl.create);
router.put('/:id',                 requireMinRole('terrain'), ctrl.update);
router.delete('/:id',              requireMinRole('chercheur'), ctrl.remove);

module.exports = router;
