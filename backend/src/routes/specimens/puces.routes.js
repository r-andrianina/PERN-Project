// backend/src/routes/specimens/puces.routes.js

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../../controllers/puces.controller');
const { verifyToken, requireRole, requireMinRole } = require('../../middlewares/auth.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(verifyToken);

router.get('/export', ctrl.exportExcel);
router.get('/',       ctrl.listPuces);
router.get('/:id',    ctrl.getPuce);

router.post('/',       requireMinRole('terrain'), ctrl.createPuce);
router.put('/:id',     requireMinRole('terrain'), ctrl.updatePuce);
router.post('/import', requireMinRole('terrain'), upload.single('file'), ctrl.importExcel);
router.delete('/:id',  requireRole('admin'),      ctrl.deletePuce);

module.exports = router;