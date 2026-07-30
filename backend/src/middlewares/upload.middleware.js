// Racine des uploads du module Labo.
// NB (B7) : les anciens middlewares multer `uploadGel`/`uploadFichier` exportés
// ici n'étaient utilisés nulle part — `labo.routes.js` définit son propre
// `makeUpload` (sous-dossiers images/ et sequencage/). Seule la constante de
// chemin est réellement consommée (par labo.routes.js et labo.controller.js),
// on ne garde donc qu'elle.

const path = require('path');
const fs   = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'labo');

// S'assure que la racine existe (les sous-dossiers sont créés par makeUpload).
if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

module.exports = { UPLOADS_ROOT };
