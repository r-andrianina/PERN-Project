const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/labo.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');

// Upload middleware étendu (gel + micro + fichier raw)
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const { UPLOADS_ROOT } = require('../middlewares/upload.middleware');

function makeUpload(subfolder, exts, maxMB) {
  const dir = path.join(UPLOADS_ROOT, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, dir),
    filename:    (_r, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID().replace(/-/g, '')}${ext}`);
    },
  });
  const handler = multer({
    storage,
    limits:     { fileSize: maxMB * 1024 * 1024 },
    fileFilter: (_r, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(exts.includes(ext) ? null : new Error(`Extension non autorisée : ${ext}`), exts.includes(ext));
    },
  }).single('file');
  return (req, res, next) => handler(req, res, (err) => err ? res.status(400).json({ error: err.message }) : next());
}

const uploadImage   = makeUpload('images',    ['.jpg', '.jpeg', '.png', '.tif', '.tiff'], 20);
const uploadFichier = makeUpload('sequencage', ['.ab1', '.fastq', '.fq', '.gz', '.fasta', '.fa', '.seq'], 500);

router.use(verifyToken);

// ── CRUD ──────────────────────────────────────────────────────
router.get('/',    asyncHandler(ctrl.listManipulations));
router.get('/:id', asyncHandler(ctrl.getManipulation));

router.post('/',   requireMinRole('technicien'), asyncHandler(ctrl.createManipulation));
router.put('/:id', requireMinRole('technicien'), asyncHandler(ctrl.updateManipulation));
router.delete('/:id', requireRole('admin'),      asyncHandler(ctrl.deleteManipulation));

// ── Validation ────────────────────────────────────────────────
router.post('/:id/valider',   requireMinRole('chercheur'), asyncHandler(ctrl.validerManipulation));
router.post('/:id/invalider', requireMinRole('chercheur'), asyncHandler(ctrl.invaliderManipulation));

// ── Uploads ───────────────────────────────────────────────────
router.post('/:id/upload/gel',     requireMinRole('technicien'), uploadImage,   (req, res, next) => { req.params.subtype = 'gel';   next(); }, asyncHandler(ctrl.uploadImage));
router.post('/:id/upload/micro',   requireMinRole('technicien'), uploadImage,   (req, res, next) => { req.params.subtype = 'micro'; next(); }, asyncHandler(ctrl.uploadImage));
router.post('/:id/upload/fichier', requireMinRole('technicien'), uploadFichier, asyncHandler(ctrl.uploadFichierRaw));

module.exports = router;
