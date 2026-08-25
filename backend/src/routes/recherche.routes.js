// backend/src/routes/recherche.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/recherche.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');
const { searchLimiter, exportLimiter } = require('../middlewares/rateLimiter');

router.use(verifyToken);

router.get('/specimens',        searchLimiter, asyncHandler(ctrl.search));
router.get('/specimens/export', exportLimiter, asyncHandler(ctrl.exportExcel));

module.exports = router;
