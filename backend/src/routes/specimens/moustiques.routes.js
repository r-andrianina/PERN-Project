// backend/src/routes/specimens/moustiques.routes.js

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../../controllers/moustiques.controller');
const { verifyToken, requireRole, requireMinRole } = require('../../middlewares/auth.middleware');

// Multer — stockage en mémoire (pas sur disque)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // max 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
      'text/csv',                                                            // .csv
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non accepté — utilisez .xlsx, .xls ou .csv'), false);
    }
  },
});

router.use(verifyToken);

// Lecture
router.get('/export', ctrl.exportExcel);   // ← avant /:id
router.get('/',       ctrl.listMoustiques);
router.get('/:id',    ctrl.getMoustique);

// Saisie manuelle — Admin, Chercheur, Terrain
router.post('/',      requireMinRole('terrain'), ctrl.createMoustique);
router.put('/:id',    requireMinRole('terrain'), ctrl.updateMoustique);

// Import Excel — Admin, Chercheur, Terrain
router.post('/import', requireMinRole('terrain'), upload.single('file'), ctrl.importExcel);

// Suppression — Admin uniquement
router.delete('/:id', requireRole('admin'), ctrl.deleteMoustique);

module.exports = router;