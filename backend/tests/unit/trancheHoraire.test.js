// Restitution du créneau horaire dans les exports.
// Dérivé du code plutôt que recopié depuis le frontend : ces tests verrouillent
// l'équivalence avec la table de frontend/src/utils/trancheHoraire.js.
const { formatTrancheHoraire, parseTrancheHoraire } = require('../../src/utils/trancheHoraire');

describe('trancheHoraire/formatTrancheHoraire', () => {
  it('reproduit exactement les 12 libellés du frontend', () => {
    const attendu = {
      h18_19: '18h–19h', h19_20: '19h–20h', h20_21: '20h–21h', h21_22: '21h–22h',
      h22_23: '22h–23h', h23_00: '23h–00h', h00_01: '00h–01h', h01_02: '01h–02h',
      h02_03: '02h–03h', h03_04: '03h–04h', h04_05: '04h–05h', h05_06: '05h–06h',
    };
    for (const [code, libelle] of Object.entries(attendu)) {
      expect(formatTrancheHoraire(code)).toBe(libelle);
    }
  });

  it('gère le passage de minuit sans cas particulier', () => {
    expect(formatTrancheHoraire('h23_00')).toBe('23h–00h');
    expect(formatTrancheHoraire('h00_01')).toBe('00h–01h');
  });

  it('rend une chaîne vide pour une valeur absente', () => {
    expect(formatTrancheHoraire(null)).toBe('');
    expect(formatTrancheHoraire(undefined)).toBe('');
    expect(formatTrancheHoraire('')).toBe('');
  });

  it('laisse passer telle quelle une valeur hors motif (jamais de perte muette)', () => {
    expect(formatTrancheHoraire('inconnu')).toBe('inconnu');
    expect(formatTrancheHoraire('h7_8')).toBe('h7_8');
  });
});

// Lecture de la colonne TIME_OF_COLLECTION (2026-09-03).
// L'heure lue désigne la FIN du créneau : vérifié sur les fichiers IPM réels,
// où les 12 heures présentes (19,20,…,23,00,01,…,06) couvrent exactement les
// 12 créneaux d'une nuit 18h→06h une fois lues comme des fins. En lecture
// « début », 06h sortirait de la plage de l'enum.
describe('trancheHoraire/parseTrancheHoraire', () => {
  const excel = (h, m = 0, s = 0) => new Date(Date.UTC(1899, 11, 30, h, m, s));

  it('lit une heure Excel comme fin de créneau', () => {
    expect(parseTrancheHoraire(excel(19))).toBe('h18_19');
    expect(parseTrancheHoraire(excel(0))).toBe('h23_00');
    expect(parseTrancheHoraire(excel(6))).toBe('h05_06');
  });

  it('arrondit le bruit flottant d\'Excel', () => {
    // Excel produit 01:59:59.971 pour 02:00 et 19:00:00.029 pour 19:00
    expect(parseTrancheHoraire(excel(1, 59, 59))).toBe('h01_02');
    expect(parseTrancheHoraire(excel(19, 0, 0))).toBe('h18_19');
    expect(parseTrancheHoraire(excel(4, 59, 59))).toBe('h04_05');
  });

  it('couvre les 12 heures réellement présentes dans les fichiers IPM', () => {
    const heures = [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
    const creneaux = heures.map((h) => parseTrancheHoraire(excel(h)));
    expect(creneaux.filter(Boolean)).toHaveLength(12);
    expect(new Set(creneaux).size).toBe(12); // aucun doublon
  });

  it('accepte une fraction de journée Excel', () => {
    expect(parseTrancheHoraire(19 / 24)).toBe('h18_19');
  });

  it('accepte les écritures textuelles', () => {
    expect(parseTrancheHoraire('19h')).toBe('h18_19');
    expect(parseTrancheHoraire('19:00')).toBe('h18_19');
    expect(parseTrancheHoraire('h18_19')).toBe('h18_19');
    expect(parseTrancheHoraire('18h-19h')).toBe('h18_19'); // intervalle : le 1er nombre est le début
  });

  it('rejette une heure hors de la nuit 18h→06h', () => {
    expect(parseTrancheHoraire(excel(12))).toBeNull();  // -> h11_12, hors enum
    expect(parseTrancheHoraire('h11_12')).toBeNull();
  });

  it('rend null pour une valeur absente ou ininterprétable', () => {
    expect(parseTrancheHoraire(null)).toBeNull();
    expect(parseTrancheHoraire('')).toBeNull();
    expect(parseTrancheHoraire('midi')).toBeNull();
  });

  it('aller-retour parse → format', () => {
    expect(formatTrancheHoraire(parseTrancheHoraire(excel(19)))).toBe('18h–19h');
  });
});
