// backend/src/routes/recherche.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/recherche.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');

router.use(verifyToken);

router.get('/specimens',        asyncHandler(ctrl.search));
router.get('/specimens/export', asyncHandler(ctrl.exportExcel));

module.exports = router;
