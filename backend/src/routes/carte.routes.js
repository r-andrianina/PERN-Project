const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/carte.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/specimens', asyncHandler(ctrl.getSpecimens));

module.exports = router;
