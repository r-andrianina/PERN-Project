// backend/src/utils/feuilleGps.js
// Lecture de la feuille « GPS » annexe des classeurs IPM.
//
// Cette feuille liste les pièges posés avec leurs coordonnées. On n'en extrait
// QUE le repère de terrain ("Maison de Nivo", "Président Fokontany") : les
// coordonnées et l'altitude sont déjà portées, à l'identique, par chaque ligne
// de la feuille principale — vérifié sur fichier réel, écart nul sur les 11
// pièges appariables. Les relire ici n'apporterait rien et créerait une seconde
// source de vérité.
//
// Le repère, lui, n'existe nulle part ailleurs, et c'est ce qui permet de
// retrouver physiquement un piège sur le terrain.

const { normalizeCellValue, canonicalHeader, clePiege } = require('./importMappings');

// Libellés possibles de la colonne du repère. Dans les fichiers observés elle
// n'a AUCUN en-tête — d'où le repli sur la dernière colonne sans titre.
const ENTETES_REPERE = new Set(['REPERE', 'REMARQUE', 'REMARQUES', 'OBSERVATION',
  'OBSERVATIONS', 'LANDMARK', 'NOTE', 'NOTES', 'COMMENTAIRE', 'DESCRIPTION']);

// Une feuille GPS se reconnaît à sa colonne d'identifiant de piège, pas à son
// nom : celui-ci varie d'un classeur à l'autre (« ..._GPS_VF »).
const ENTETES_ID = new Set(['ID_PIEGE', 'CATCH_ID', 'ID_TRAP', 'PIEGE', 'TRAP_ID']);

/**
 * Repères de terrain par piège, lus dans la feuille annexe du classeur.
 *
 * @param {object} workbook  classeur ExcelJS déjà chargé
 * @returns {Map<string, string>} clé de piège (cf. clePiege) → repère
 */
function lireReperesPieges(workbook) {
  const reperes = new Map();

  for (const ws of workbook.worksheets.slice(1)) {   // la 1re feuille = les données
    const entetes = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      entetes[col] = String(normalizeCellValue(cell.value) ?? '').trim();
    });

    const colId = entetes.findIndex((h) => h && ENTETES_ID.has(canonicalHeader(h)));
    if (colId < 1) continue;                          // pas une feuille de pièges

    let colRepere = entetes.findIndex((h) => h && ENTETES_REPERE.has(canonicalHeader(h)));
    if (colRepere < 1) {
      // Repli : dernière colonne sans en-tête qui porte du texte.
      for (let c = ws.columnCount; c > colId; c--) {
        if (entetes[c]) continue;
        const aDuTexte = (() => {
          for (let r = 2; r <= ws.rowCount; r++) {
            if (String(normalizeCellValue(ws.getRow(r).getCell(c).value) ?? '').trim()) return true;
          }
          return false;
        })();
        if (aDuTexte) { colRepere = c; break; }
      }
    }
    if (colRepere < 1) continue;                      // aucun repère à extraire

    for (let r = 2; r <= ws.rowCount; r++) {
      const id = String(normalizeCellValue(ws.getRow(r).getCell(colId).value) ?? '').trim();
      const repere = String(normalizeCellValue(ws.getRow(r).getCell(colRepere).value) ?? '').trim();
      if (!id || !repere) continue;
      const cle = clePiege(id);
      // La première feuille rencontrée gagne : on ne réécrit pas un repère déjà
      // trouvé, pour rester déterministe si un classeur a plusieurs annexes.
      if (cle && !reperes.has(cle)) reperes.set(cle, repere.slice(0, 500));
    }
  }

  return reperes;
}

module.exports = { lireReperesPieges };
