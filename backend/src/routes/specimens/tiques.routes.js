const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const ctrl         = require('../../controllers/tiques.controller');
const { verifyToken, requireRole, requireMinRole } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate');
const asyncHandler = require('../../middlewares/asyncHandler');
const schema       = require('../../schemas/specimens.schema');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv'].includes(file.mimetype);
    cb(ok ? null : new Error('Format non accepté'), ok);
  },
});

router.use(verifyToken);

router.get('/export', asyncHandler(ctrl.exportExcel));
router.get('/',       asyncHandler(ctrl.listTiques));
router.get('/:id',    asyncHandler(ctrl.getTique));

router.post('/',   requireMinRole('terrain'), validate(schema.createTique), asyncHandler(ctrl.createTique));
router.put('/:id', requireMinRole('terrain'), validate(schema.updateTique), asyncHandler(ctrl.updateTique));
router.post('/import', requireMinRole('terrain'), upload.single('file'), asyncHandler(ctrl.importExcel));
router.delete('/:id',  requireRole('admin'), asyncHandler(ctrl.deleteTique));

module.exports = router;
