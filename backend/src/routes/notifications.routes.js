// backend/src/routes/notifications.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/notifications.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/',          ctrl.list);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
