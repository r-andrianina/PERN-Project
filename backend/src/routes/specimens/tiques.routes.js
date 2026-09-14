const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const path         = require('path');
const AppError     = require('../../utils/AppError');
const { MAX_FICHIER_OCTETS } = require('../../utils/excelGuards');
const ctrl         = require('../../controllers/tiques.controller');
const { verifyToken, requireRole, requireMinRole, checkSpecimenAccess } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate');
const asyncHandler = require('../../middlewares/asyncHandler');
const schema       = require('../../schemas/specimens.schema');

// Même politique d'upload que /api/v1/import (cf. import.routes.js) : le
// `mimetype` est déclaré par le client, donc non fiable — le contrôle réel est
// la signature du contenu, faite dans le contrôleur (utils/excelGuards.js).
// L'ancien filtre acceptait aussi text/csv alors que le contrôleur ne sait lire
// que du .xlsx : un CSV échouait plus loin, en 500 opaque.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FICHIER_OCTETS, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname ?? '').toLowerCase();
    if (ext !== '.xlsx') {
      return cb(AppError.badRequest(
        `Format non accepté ("${ext || 'sans extension'}") — déposez un fichier .xlsx.`,
      ));
    }
    return cb(null, true);
  },
});

// Annonce la limite à l'error handler, qui peut alors nommer la taille réelle.
const annonceLimite = (req, res, next) => { req.uploadMaxBytes = MAX_FICHIER_OCTETS; next(); };

router.use(verifyToken);
router.use(checkSpecimenAccess('tique'));

router.get('/export', asyncHandler(ctrl.exportExcel));
router.get('/',       asyncHandler(ctrl.listTiques));
router.get('/:id',    asyncHandler(ctrl.getTique));

router.post('/',   requireMinRole('technicien'), validate(schema.createTique), asyncHandler(ctrl.createTique));
router.put('/:id', requireMinRole('technicien'), validate(schema.updateTique), asyncHandler(ctrl.updateTique));
router.post('/import', requireMinRole('technicien'), annonceLimite, upload.single('file'), asyncHandler(ctrl.importExcel));
router.delete('/:id',  requireRole('admin'), asyncHandler(ctrl.deleteTique));

module.exports = router;
