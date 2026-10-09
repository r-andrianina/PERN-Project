// backend/src/routes/dictionnaire/personnel.routes.js
// Routes du référentiel standard + import de l'annuaire.

const express      = require('express');
const multer       = require('multer');
const path         = require('path');
const AppError     = require('../../utils/AppError');
const { MAX_FICHIER_OCTETS } = require('../../utils/excelGuards');
const { verifyToken, requireMinRole } = require('../../middlewares/auth.middleware');
const { importLimiter } = require('../../middlewares/rateLimiter');
const asyncHandler = require('../../middlewares/asyncHandler');
const ctrl         = require('../../controllers/personnel.controller');
const { buildSimpleRouter } = require('./_simple.routes');

// Même politique d'upload que /api/v1/import (cf. import.routes.js) : le
// contrôle réel est la signature du contenu, fait dans le contrôleur.
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

const annonceLimite = (req, res, next) => { req.uploadMaxBytes = MAX_FICHIER_OCTETS; next(); };

const router = express.Router();

// Droits : créer ou modifier une fiche demande `chercheur` (fabrique), le rôle
// minimal pour créer une mission — sans quoi « + Ajouter une personne » serait
// refusé depuis le formulaire de mission. L'import en masse, qui peut
// réécrire des dizaines de fiches, est réservé aux superviseurs.
router.post('/import',
  verifyToken, requireMinRole('superviseur'), importLimiter, annonceLimite,
  upload.single('file'), asyncHandler(ctrl.importExcel));

router.use(buildSimpleRouter(ctrl));

module.exports = router;
