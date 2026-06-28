const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/dashboard.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.get('/stats',       asyncHandler(ctrl.getStats));
router.get('/admin-stats', requireRole('admin'), asyncHandler(ctrl.getAdminStats));

module.exports = router;
