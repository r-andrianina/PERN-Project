// backend/src/routes/notifications.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/notifications.controller');
const { verifyToken, verifyTokenSSE } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');

// SSE : token en query param (EventSource ne supporte pas Authorization header)
router.get('/stream', verifyTokenSSE, ctrl.stream);

router.use(verifyToken);
router.get('/',           asyncHandler(ctrl.list));
router.patch('/read-all', asyncHandler(ctrl.markAllRead));
router.patch('/:id/read', asyncHandler(ctrl.markRead));

module.exports = router;
