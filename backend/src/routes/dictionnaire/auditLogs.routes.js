// backend/src/routes/dictionnaire/auditLogs.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/auditLogs.controller');
const { verifyToken, requireRole } = require('../../middlewares/auth.middleware');

router.use(verifyToken, requireRole('admin'));

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);

module.exports = router;
