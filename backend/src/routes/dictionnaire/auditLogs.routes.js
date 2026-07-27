// backend/src/routes/dictionnaire/auditLogs.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/auditLogs.controller');
const { verifyToken, requireRole } = require('../../middlewares/auth.middleware');
const asyncHandler = require('../../middlewares/asyncHandler');

router.use(verifyToken, requireRole('admin'));

router.get('/',     asyncHandler(ctrl.list));
router.get('/:id',  asyncHandler(ctrl.getOne));

module.exports = router;
