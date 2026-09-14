// backend/src/routes/import.routes.js
const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const path         = require('path');
const ctrl         = require('../controllers/import.controller');
const { verifyToken, requireMinRole, checkSpecimenAccess } = require('../middlewares/auth.middleware');
const { importLimiter } = require('../middlewares/rateLimiter');
const asyncHandler = require('../middlewares/asyncHandler');
const AppError     = require('../utils/AppError');
const { MAX_FICHIER_OCTETS } = require('../utils/excelGuards');

// Types MIME envoyés par les navigateurs pour un .xlsx. La liste reste
// permissive (certains postes Windows annoncent application/octet-stream pour
// un fichier pourtant valide) : ce n'est PAS un contrôle de sécurité, seulement
// un premier tri. Le `mimetype` est déclaré par le client, donc non fiable — le
// vrai contrôle est la signature du contenu, faite dans le contrôleur via
// `chargerClasseurUtilisateur` (cf. utils/excelGuards.js).
const MIMES_TOLERES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'application/zip',
  '', // certains clients n'envoient rien
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FICHIER_OCTETS,
    files:    1,     // un seul fichier par requête
    fields:   10,    // borne les champs texte annexes
  },
  fileFilter: (req, file, cb) => {
    // L'extension est le seul critère réellement vérifiable ici, et elle doit
    // correspondre à ce que le contrôleur sait lire.
    const ext = path.extname(file.originalname ?? '').toLowerCase();
    if (ext !== '.xlsx') {
      return cb(AppError.badRequest(
        `Format non accepté ("${ext || 'sans extension'}") — déposez un fichier .xlsx. `
        + 'Les anciens .xls et les .csv doivent être convertis depuis Excel.',
      ));
    }
    if (!MIMES_TOLERES.has(file.mimetype ?? '')) {
      return cb(AppError.badRequest('Format non accepté — utilisez un classeur Excel .xlsx.'));
    }
    return cb(null, true);
  },
});

// Annonce la limite d'upload à l'error handler, qui peut alors nommer la taille
// réelle dans le message plutôt que de rester vague (cf. errorHandler.js).
const annonceLimite = (req, res, next) => { req.uploadMaxBytes = MAX_FICHIER_OCTETS; next(); };

router.use(verifyToken);

// GET /api/v1/import/template/moustiques — accessible à tous les rôles
router.get('/template/moustiques', asyncHandler(ctrl.getTemplateMoustiques));

router.use(requireMinRole('technicien'));

// Accès par TYPE de spécimen — même garde que /api/v1/moustiques/*, sans quoi
// cette route offrait un second chemin d'import échappant à `specimensAutorises`
// (un technicien sans droit "moustique" pouvait en créer ici). Le cloisonnement
// par PROJET, lui, est appliqué dans le contrôleur : le projet cible n'est connu
// qu'à la lecture du fichier, ligne par ligne.
router.use('/moustiques', checkSpecimenAccess('moustique'));

// POST /api/v1/import/moustiques/validate — validation à sec (aucune écriture)
router.post('/moustiques/validate',
  importLimiter, annonceLimite, upload.single('file'), asyncHandler(ctrl.validateMoustiques));

// POST /api/v1/import/moustiques
router.post('/moustiques',
  importLimiter, annonceLimite, upload.single('file'), asyncHandler(ctrl.importMoustiques));

module.exports = router;
