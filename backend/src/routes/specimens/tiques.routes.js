// backend/src/routes/specimens/tiques.routes.js

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../../controllers/tiques.controller');
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
router.get('/',       ctrl.listTiques);
router.get('/:id',    ctrl.getTique);

router.post('/',       requireMinRole('terrain'), ctrl.createTique);
router.put('/:id',     requireMinRole('terrain'), ctrl.updateTique);
router.post('/import', requireMinRole('terrain'), upload.single('file'), ctrl.importExcel);
router.delete('/:id',  requireRole('admin'),      ctrl.deleteTique);

module.exports = router;