// backend/src/utils/fileSignature.js
// Vérifie que le CONTENU réel d'un fichier correspond à son extension
// déclarée — une whitelist d'extensions seule ne détecte pas un fichier
// renommé (ex: un exécutable renommé en .jpg passerait le filtre d'extension
// sans problème).

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];

function isValidImageBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
    && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return true; // PNG
  if (buf.length >= 4 && (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) || // TIFF little-endian
    (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)    // TIFF big-endian
  )) return true;
  return false;
}

function isValidRawBuffer(buf, ext) {
  if (ext === '.gz')  return buf.length >= 2 && buf[0] === 0x1F && buf[1] === 0x8B;
  if (ext === '.ab1') return buf.length >= 4 && buf.toString('latin1', 0, 4) === 'ABIF';
  // .fasta/.fa/.fastq/.fq/.seq : formats texte de bioinformatique, sans
  // signature binaire fixe — on vérifie l'absence d'octet nul dans l'entête,
  // un indice fiable de contenu binaire déguisé en fichier texte.
  return !buf.subarray(0, Math.min(buf.length, 512)).includes(0);
}

/**
 * @param {Buffer} buf  les premiers octets du fichier (512 suffisent pour
 *                      toutes les signatures ci-dessus)
 * @param {string} ext  extension en minuscules, avec le point (ex: '.jpg')
 * @returns {boolean}
 */
function matchesSignature(buf, ext) {
  return IMAGE_EXTS.includes(ext) ? isValidImageBuffer(buf) : isValidRawBuffer(buf, ext);
}

module.exports = { matchesSignature, isValidImageBuffer, isValidRawBuffer };
