// backend/src/routes/notifications.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/notifications.controller');
const { verifyToken, verifyTokenSSE } = require('../middlewares/auth.middleware');

// SSE : token en query param (EventSource ne supporte pas Authorization header)
router.get('/stream', verifyTokenSSE, ctrl.stream);

router.use(verifyToken);
router.get('/',           ctrl.list);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
