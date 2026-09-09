// backend/src/utils/excelGuards.js
//
// Garde-fous appliqués à TOUT classeur Excel reçu d'un utilisateur, avant que
// la moindre ligne ne soit lue.
//
// Pourquoi ici et pas dans multer : le filtre multer ne voit que le `mimetype`
// annoncé par le navigateur, une valeur entièrement contrôlée par le client.
// Un binaire quelconque envoyé avec le bon en-tête passait donc jusqu'à
// `ExcelJS.load()`, qui levait une erreur brute — remontée en 500 « Erreur
// interne du serveur », sans indication exploitable pour l'utilisateur.
//
// Trois contrôles, du moins cher au plus cher :
//   1. signature ZIP        — un .xlsx est une archive ZIP, ça se vérifie sur 4 octets
//   2. taille décompressée  — protège contre la « zip-bomb » (cf. plus bas)
//   3. chargement ExcelJS   — encapsulé pour produire une erreur 400 lisible

const ExcelJS  = require('exceljs');
const AppError = require('./AppError');

// ── Limites ───────────────────────────────────────────────────────
// Un fichier IPM réel fait ~1 Mo pour 500 lignes. 25 Mo laissent une marge
// confortable (plusieurs dizaines de milliers de lignes) tout en bornant la
// mémoire : ExcelJS charge l'intégralité du classeur en RAM, sans streaming.
const MAX_FICHIER_OCTETS = 25 * 1024 * 1024;

// Une archive .xlsx légitime se décompresse avec un ratio de l'ordre de 10:1 à
// 50:1 (du XML très répétitif). Une « zip-bomb » atteint 1000:1 et au-delà :
// 20 Mo compressés deviennent plusieurs Go décompressés, chargés en mémoire par
// ExcelJS avant qu'aucun de nos contrôles ne s'exécute — le backend est tué par
// l'OOM killer. On plafonne donc le total ANNONCÉ par l'archive elle-même, qu'on
// lit dans son index (central directory) sans rien décompresser.
const MAX_DECOMPRESSE_OCTETS = 400 * 1024 * 1024;

// Plafond de lignes de données traitées. Au-delà, le rapport JSON renvoyé
// deviendrait lui-même ingérable (cf. MAX_LOGS dans import.controller.js) et la
// transaction d'import dépasserait son délai. Un import de cette taille doit
// passer par un découpage en plusieurs fichiers, pas par un timeout opaque.
const MAX_LIGNES = 20000;

// ── 1. Signature ──────────────────────────────────────────────────
// En-tête d'une entrée locale ZIP : "PK\x03\x04".
// "PK\x05\x06" (archive vide) et "PK\x07\x08" (spanned) sont des ZIP valides
// mais ne peuvent pas contenir de classeur : rejetés avec le même message.
function estSignatureXlsx(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0x50 && buffer[1] === 0x4b
    && buffer[2] === 0x03 && buffer[3] === 0x04;
}

// ── 2. Taille décompressée annoncée ───────────────────────────────
// Lit l'index du ZIP (End Of Central Directory + Central Directory) et somme
// les tailles décompressées déclarées. Aucun octet n'est décompressé.
//
// Retourne `null` si l'index est illisible : on ne bloque pas sur une structure
// qu'on ne sait pas interpréter (ZIP64, commentaire exotique…), ExcelJS
// tranchera. Un `null` n'est donc jamais traité comme « archive sûre » ni comme
// « archive dangereuse » — juste comme « indéterminé ».
function tailleDecompresseeAnnoncee(buffer) {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG   = 0x02014b50;
  const EOCD_MIN = 22;

  if (!Buffer.isBuffer(buffer) || buffer.length < EOCD_MIN) return null;

  // L'EOCD est en fin de fichier, suivi d'un commentaire d'au plus 65 535 octets.
  const debutRecherche = Math.max(0, buffer.length - (EOCD_MIN + 0xffff));
  let eocd = -1;
  for (let i = buffer.length - EOCD_MIN; i >= debutRecherche; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) return null;

  const nbEntrees = buffer.readUInt16LE(eocd + 10);
  const offsetCD  = buffer.readUInt32LE(eocd + 16);
  // 0xFFFF / 0xFFFFFFFF = marqueurs ZIP64 : la vraie valeur est ailleurs, on ne
  // sait pas la lire ici → indéterminé.
  if (nbEntrees === 0xffff || offsetCD === 0xffffffff) return null;
  if (offsetCD >= buffer.length) return null;

  let total = 0;
  let p = offsetCD;
  for (let n = 0; n < nbEntrees; n++) {
    if (p + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(p) !== CD_SIG) return null;

    const tailleDecompressee = buffer.readUInt32LE(p + 24);
    if (tailleDecompressee === 0xffffffff) return null;   // ZIP64
    total += tailleDecompressee;

    const lgNom      = buffer.readUInt16LE(p + 28);
    const lgExtra    = buffer.readUInt16LE(p + 30);
    const lgComment  = buffer.readUInt16LE(p + 32);
    p += 46 + lgNom + lgExtra + lgComment;
  }
  return total;
}

// ── 3. Chargement ─────────────────────────────────────────────────
/**
 * Vérifie puis charge un classeur Excel reçu d'un utilisateur.
 *
 * @param {Buffer} buffer  contenu brut du fichier déposé
 * @param {object} [opts]
 * @param {number} [opts.maxOctets]        plafond de taille du fichier
 * @param {number} [opts.maxDecompresse]   plafond de taille décompressée annoncée
 * @returns {Promise<ExcelJS.Workbook>}
 * @throws {AppError} 400 — toujours une erreur métier lisible, jamais une 500
 */
async function chargerClasseurUtilisateur(buffer, opts = {}) {
  const maxOctets      = opts.maxOctets      ?? MAX_FICHIER_OCTETS;
  const maxDecompresse = opts.maxDecompresse ?? MAX_DECOMPRESSE_OCTETS;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw AppError.badRequest('Fichier vide — aucun contenu à importer.');
  }
  if (buffer.length > maxOctets) {
    throw AppError.badRequest(
      `Fichier trop volumineux (${(buffer.length / 1024 / 1024).toFixed(1)} Mo) — `
      + `la limite est de ${Math.round(maxOctets / 1024 / 1024)} Mo. Découpez le fichier en plusieurs classeurs.`,
    );
  }
  if (!estSignatureXlsx(buffer)) {
    throw AppError.badRequest(
      "Ce fichier n'est pas un classeur .xlsx. Son contenu ne correspond pas au format annoncé — "
      + 'ré-enregistrez-le depuis Excel au format « Classeur Excel (.xlsx) ».',
    );
  }

  const decompresse = tailleDecompresseeAnnoncee(buffer);
  if (decompresse !== null && decompresse > maxDecompresse) {
    throw AppError.badRequest(
      `Archive rejetée : le fichier annonce ${(decompresse / 1024 / 1024).toFixed(0)} Mo une fois décompressé, `
      + `au-delà de la limite de ${Math.round(maxDecompresse / 1024 / 1024)} Mo.`,
    );
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    // On ne relaie PAS err.message : il expose la structure interne du parseur
    // sans rien apprendre d'utile à l'utilisateur.
    console.error('[import] Classeur illisible :', err?.message ?? err);
    throw AppError.badRequest(
      'Fichier Excel illisible ou corrompu. Ouvrez-le dans Excel, puis ré-enregistrez-le au format .xlsx.',
    );
  }
  return wb;
}

/**
 * Première feuille du classeur, avec un message clair si elle est absente ou
 * ne contient aucune ligne de données.
 * @returns {ExcelJS.Worksheet}
 */
function premiereFeuille(wb) {
  const ws = wb.worksheets?.[0];
  if (!ws) throw AppError.badRequest('Classeur vide — aucune feuille de calcul trouvée.');
  // rowCount inclut l'en-tête : 0 ou 1 = aucune donnée.
  if (ws.rowCount <= 1) {
    throw AppError.badRequest("La première feuille ne contient aucune ligne de données sous l'en-tête.");
  }
  return ws;
}

/**
 * Refuse un classeur dont le volume dépasse ce que l'import sait traiter dans
 * une transaction unique.
 */
function assertVolumeTraitable(ws, maxLignes = MAX_LIGNES) {
  const lignes = Math.max(0, ws.rowCount - 1);
  if (lignes > maxLignes) {
    throw AppError.badRequest(
      `Fichier trop volumineux : ${lignes} lignes de données pour un maximum de ${maxLignes}. `
      + 'Découpez-le en plusieurs fichiers (par mission ou par localité).',
    );
  }
  return lignes;
}

module.exports = {
  chargerClasseurUtilisateur,
  premiereFeuille,
  assertVolumeTraitable,
  estSignatureXlsx,
  tailleDecompresseeAnnoncee,
  MAX_FICHIER_OCTETS,
  MAX_DECOMPRESSE_OCTETS,
  MAX_LIGNES,
};
