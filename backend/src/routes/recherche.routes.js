// backend/src/routes/recherche.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/recherche.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/specimens',        ctrl.search);
router.get('/specimens/export', ctrl.exportExcel);

module.exports = router;
