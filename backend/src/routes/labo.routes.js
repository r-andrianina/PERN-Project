const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/labo.controller');
const { verifyToken, requireRole, requireMinRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../middlewares/asyncHandler');
const { validate }  = require('../middlewares/validate');
const schema        = require('../schemas/labo.schema');

// Upload middleware étendu (gel + micro + fichier raw)
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const { UPLOADS_ROOT } = require('../middlewares/upload.middleware');
const { matchesSignature } = require('../utils/fileSignature');

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

  return (req, res, next) => handler(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return next();

    // L'extension whitelistée ci-dessus ne garantit pas le contenu réel —
    // un fichier renommé (ex: exécutable en .jpg) la passerait sans
    // problème. On lit les 512 premiers octets du fichier déjà écrit sur
    // disque et on vérifie sa signature magique (jamais le fichier entier :
    // les uploads séquençage vont jusqu'à 500 Mo).
    const ext = path.extname(req.file.originalname).toLowerCase();
    let head = Buffer.alloc(0);
    try {
      const fd = fs.openSync(req.file.path, 'r');
      const buf = Buffer.alloc(512);
      const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
      fs.closeSync(fd);
      head = buf.subarray(0, bytesRead);
    } catch { /* fichier illisible — laissé passer, une erreur ultérieure le signalera */ }

    if (head.length && !matchesSignature(head, ext)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: `Le contenu du fichier ne correspond pas à l'extension "${ext}"` });
    }
    next();
  });
}

const uploadImage   = makeUpload('images',    ['.jpg', '.jpeg', '.png', '.tif', '.tiff'], 20);
const uploadFichier = makeUpload('sequencage', ['.ab1', '.fastq', '.fq', '.gz', '.fasta', '.fa', '.seq'], 500);

router.use(verifyToken);

// ── CRUD ──────────────────────────────────────────────────────
router.get('/',    asyncHandler(ctrl.listManipulations));
router.get('/:id', asyncHandler(ctrl.getManipulation));

router.post('/',   requireMinRole('technicien'), validate(schema.createManipulation), asyncHandler(ctrl.createManipulation));
router.put('/:id', requireMinRole('technicien'), validate(schema.updateManipulation), asyncHandler(ctrl.updateManipulation));
router.delete('/:id', requireRole('admin'),      asyncHandler(ctrl.deleteManipulation));

// ── Validation ────────────────────────────────────────────────
// /valider n'a pas de corps à valider ; /invalider utilise le schéma
// "validerManipulation" (motifInvalidation) — voir note dans labo.schema.js.
router.post('/:id/valider',   requireMinRole('chercheur'), asyncHandler(ctrl.validerManipulation));
router.post('/:id/invalider', requireMinRole('chercheur'), validate(schema.validerManipulation), asyncHandler(ctrl.invaliderManipulation));

// ── Uploads ───────────────────────────────────────────────────
router.post('/:id/upload/gel',     requireMinRole('technicien'), uploadImage,   (req, res, next) => { req.params.subtype = 'gel';   next(); }, asyncHandler(ctrl.uploadImage));
router.post('/:id/upload/micro',   requireMinRole('technicien'), uploadImage,   (req, res, next) => { req.params.subtype = 'micro'; next(); }, asyncHandler(ctrl.uploadImage));
router.post('/:id/upload/fichier', requireMinRole('technicien'), uploadFichier, asyncHandler(ctrl.uploadFichierRaw));

module.exports = router;
