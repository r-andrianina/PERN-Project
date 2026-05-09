// backend/src/routes/import.routes.js
const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const ctrl         = require('../controllers/import.controller');
const { verifyToken, requireMinRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ].includes(file.mimetype);
    cb(ok ? null : new Error('Format non accepté — utilisez .xlsx'), ok);
  },
});

router.use(verifyToken);
router.use(requireMinRole('chercheur'));

// POST /api/v1/import/moustiques
router.post('/moustiques', upload.single('file'), asyncHandler(ctrl.importMoustiques));

module.exports = router;
