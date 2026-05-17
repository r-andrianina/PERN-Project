const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/dashboard.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.get('/stats', asyncHandler(ctrl.getStats));

module.exports = router;
