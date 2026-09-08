// backend/src/routes/import.routes.js
const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const ctrl         = require('../controllers/import.controller');
const { verifyToken, requireMinRole, checkSpecimenAccess } = require('../middlewares/auth.middleware');
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
router.post('/moustiques/validate', upload.single('file'), asyncHandler(ctrl.validateMoustiques));

// POST /api/v1/import/moustiques
router.post('/moustiques', upload.single('file'), asyncHandler(ctrl.importMoustiques));

module.exports = router;
