const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'labo');

const ALLOWED = {
  gel:    { exts: ['.jpg', '.jpeg', '.png', '.tif', '.tiff'], maxMB: 20 },
  fichier: { exts: ['.ab1', '.fastq', '.fq', '.gz', '.fasta', '.fa', '.seq'], maxMB: 500 },
};

function makeStorage(subfolder) {
  const dir = path.join(UPLOADS_ROOT, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const uuid = crypto.randomUUID().replace(/-/g, '');
      cb(null, `${uuid}${ext}`);
    },
  });
}

function fileFilter(type) {
  return (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const ok   = ALLOWED[type].exts.includes(ext);
    cb(ok ? null : new Error(`Extension non autorisée : ${ext}`), ok);
  };
}

const uploadGel = multer({
  storage:  makeStorage('pcr'),
  limits:   { fileSize: ALLOWED.gel.maxMB * 1024 * 1024 },
  fileFilter: fileFilter('gel'),
}).single('imageGel');

const uploadFichier = multer({
  storage:  makeStorage('sequencage'),
  limits:   { fileSize: ALLOWED.fichier.maxMB * 1024 * 1024 },
  fileFilter: fileFilter('fichier'),
}).single('fichierRaw');

function wrapUpload(handler) {
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}

module.exports = {
  uploadGel:     wrapUpload(uploadGel),
  uploadFichier: wrapUpload(uploadFichier),
  UPLOADS_ROOT,
};
