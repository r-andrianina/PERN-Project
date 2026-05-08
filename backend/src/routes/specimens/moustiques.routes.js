// backend/src/routes/specimens/moustiques.routes.js

const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const ctrl         = require('../../controllers/moustiques.controller');
const { verifyToken, requireRole, requireMinRole } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate');
const asyncHandler = require('../../middlewares/asyncHandler');
const schema       = require('../../schemas/specimens.schema');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error('Format non accepté — utilisez .xlsx ou .xls'), allowed.includes(file.mimetype));
  },
});

router.use(verifyToken);

router.get('/export',  asyncHandler(ctrl.exportExcel));
router.get('/',        asyncHandler(ctrl.listMoustiques));
router.get('/:id',     asyncHandler(ctrl.getMoustique));

router.post('/',   requireMinRole('terrain'), validate(schema.createMoustique), asyncHandler(ctrl.createMoustique));
router.put('/:id', requireMinRole('terrain'), validate(schema.updateMoustique), asyncHandler(ctrl.updateMoustique));

router.post('/import', requireMinRole('terrain'), upload.single('file'), asyncHandler(ctrl.importExcel));
router.delete('/:id',  requireRole('admin'), asyncHandler(ctrl.deleteMoustique));

module.exports = router;
