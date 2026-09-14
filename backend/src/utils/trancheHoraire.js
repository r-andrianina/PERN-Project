// backend/src/utils/trancheHoraire.js
// Créneau horaire de capture (protocoles horodatés type HLC).
//
// Miroir de frontend/src/utils/trancheHoraire.js, mais DÉRIVÉ du code plutôt que
// recopié : les 12 libellés suivent tous le même motif (h18_19 → "18h–19h",
// y compris h23_00 → "23h–00h"). Une seconde table codée en dur aurait fini par
// diverger de la première, comme l'ont fait les quatre implémentations du
// libellé taxonomique.
//
// L'enum Prisma TrancheHoraire reste la source de vérité des valeurs possibles.

const MOTIF = /^h(\d{2})_(\d{2})$/;

/** 'h18_19' → '18h–19h'. Renvoie '' pour une valeur absente ou hors motif. */
function formatTrancheHoraire(code) {
  const m = MOTIF.exec(code ?? '');
  return m ? `${m[1]}h–${m[2]}h` : (code ?? '');
}

// Créneaux valides : une nuit 18h→06h, heure par heure (miroir de l'enum Prisma).
const CRENEAUX = new Set(
  [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5].map((h) => cle(h)),
);
function cle(debut) {
  const p = (n) => String(n).padStart(2, '0');
  return `h${p(debut)}_${p((debut + 1) % 24)}`;
}

/**
 * Convertit une valeur de colonne TIME_OF_COLLECTION en créneau.
 *
 * L'heure lue désigne la FIN du créneau, pas son début. Vérifié sur les
 * fichiers IPM : les 12 heures présentes sont 19,20,21,22,23,00,01,…,06, qui
 * couvrent exactement les 12 créneaux d'une nuit 18h→06h une fois lues comme
 * des fins. En lecture « début », 06h sortirait de la plage.
 *
 * Formats acceptés :
 *   - Date         → heure Excel (époque 1899-12-30). Arrondie à l'heure la
 *                    plus proche : Excel produit 01:59:59.971 pour 02:00.
 *   - nombre       → fraction de journée Excel (0,7917 = 19h)
 *   - 'h18_19'     → créneau déjà canonique, repris tel quel
 *   - '18-19', '18h–19h' → intervalle explicite, le premier nombre est le début
 *   - '19', '19h', '19:00' → heure simple, interprétée comme une FIN
 *
 * @returns {string|null} clé d'enum, ou null si non interprétable / hors nuit
 */
function parseTrancheHoraire(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;

  const finVersCle = (heure) => {
    const k = cle((Math.round(heure) + 23) % 24);
    return CRENEAUX.has(k) ? k : null;
  };

  if (valeur instanceof Date) {
    const minutes = valeur.getUTCHours() * 60 + valeur.getUTCMinutes() + valeur.getUTCSeconds() / 60;
    return finVersCle((minutes / 60) % 24);
  }
  if (typeof valeur === 'number') {
    // Fraction de journée ( 0,79 → 19h ) ou heure entière ( 19 )
    return finVersCle(valeur > 0 && valeur < 1 ? valeur * 24 : valeur);
  }

  const texte = String(valeur).trim().toLowerCase();
  const canonique = /^h\d{2}_\d{2}$/.exec(texte);
  if (canonique) return CRENEAUX.has(texte) ? texte : null;

  const nombres = texte.match(/\d{1,2}/g);
  if (!nombres) return null;
  // Un intervalle se reconnaît à son SÉPARATEUR DE PLAGE, pas au nombre de
  // nombres : "19:00" en contient deux (heure et minutes) et reste une heure
  // simple, alors que "18h-19h" est bien un intervalle.
  // \b ne fonctionne pas autour de "à" (hors [A-Za-z0-9_]) : on borne par des espaces.
  const estIntervalle = /[-–—_]|\s(?:à|to)\s/.test(texte);
  if (estIntervalle) {
    // Le premier nombre est le DÉBUT du créneau.
    const k = cle(Number(nombres[0]) % 24);
    return CRENEAUX.has(k) ? k : null;
  }
  return finVersCle(Number(nombres[0]));
}

module.exports = { formatTrancheHoraire, parseTrancheHoraire, CRENEAUX };
