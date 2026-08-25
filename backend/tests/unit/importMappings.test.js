// Tests des tables de correspondance et helpers de parsing de l'import Excel
// (backend/src/utils/importMappings.js). Logique critique — utilisée à chaque
// import, zéro tolérance sur les régressions silencieuses de regex/fuzzy match.
const {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, BLOOD_MEAL,
  PARITE_SOP, toParietéSOP,
  normalizeKey, parseScientificName, buildHeaderMap, cellValue, hasHeader,
} = require('../../src/utils/importMappings');

// ── Mocks minimalistes de l'API ExcelJS utilisée par buildHeaderMap/cellValue ──
function mockHeaderRow(headers) {
  return {
    eachCell(_opts, cb) {
      headers.forEach((h, i) => {
        if (h !== null && h !== undefined) cb({ value: h }, i + 1);
      });
    },
  };
}
function mockRow(valuesByCol) {
  return { getCell: (col) => ({ value: valuesByCol[col] ?? null }) };
}

describe('importMappings/normalizeKey', () => {
  it('met en majuscules et remplace les espaces par des underscores', () => {
    expect(normalizeKey('100%_Ethanol')).toBe('100%_ETHANOL');
    expect(normalizeKey('  human landing catch  ')).toBe('HUMAN_LANDING_CATCH');
  });

  it('gère les espaces multiples', () => {
    expect(normalizeKey('a   b    c')).toBe('A_B_C');
  });

  it('retourne une chaîne vide pour null/undefined', () => {
    expect(normalizeKey(null)).toBe('');
    expect(normalizeKey(undefined)).toBe('');
  });

  it('convertit les nombres en chaîne', () => {
    expect(normalizeKey(123)).toBe('123');
  });
});

describe('importMappings/parseScientificName', () => {
  it('extrait genre + espèce depuis un binôme simple', () => {
    expect(parseScientificName('Anopheles gambiae')).toEqual({ genus: 'Anopheles', species: 'gambiae' });
  });

  it('retourne genus seul si un seul mot', () => {
    expect(parseScientificName('Anopheles')).toEqual({ genus: 'Anopheles', species: null });
  });

  it('retourne null/null pour une entrée vide', () => {
    expect(parseScientificName('')).toEqual({ genus: null, species: null });
    expect(parseScientificName(null)).toEqual({ genus: null, species: null });
  });

  it.each([
    'Anopheles gambiae s.l.',
    'Anopheles gambiae s.l',
    'Anopheles gambiae s.s.',
    'Anopheles gambiae ss',
    'Anopheles gambiae complex',
    'Anopheles gambiae group',
    'Anopheles gambiae gp.',
    'Anopheles gambiae grp.',
    'Anopheles gambiae sensu lato',
    'Anopheles gambiae sensu stricto',
  ])('retire le suffixe taxonomique courant : "%s"', (input) => {
    expect(parseScientificName(input)).toEqual({ genus: 'Anopheles', species: 'gambiae' });
  });

  it.each([
    'Anopheles sp', 'Anopheles sp.', 'Anopheles spp', 'Anopheles spp.', 'Anopheles SP',
  ])('retire "sp"/"sp."/"spp"/"spp." (espèce non déterminée sur le terrain) — genre seul : "%s"', (input) => {
    expect(parseScientificName(input)).toEqual({ genus: 'Anopheles', species: null });
  });

  it('retire "sp." même après une vraie espèce déjà donnée', () => {
    expect(parseScientificName('Anopheles gambiae sp.')).toEqual({ genus: 'Anopheles', species: 'gambiae' });
  });

  it('ne retire PAS un morphotype numéroté/lettré ("sp1", "spA") — ce n\'est pas une espèce non déterminée', () => {
    expect(parseScientificName('Anopheles sp1')).toEqual({ genus: 'Anopheles', species: 'sp1' });
    expect(parseScientificName('Anopheles spA')).toEqual({ genus: 'Anopheles', species: 'spA' });
  });

  it('trim les espaces superflus', () => {
    expect(parseScientificName('  Anopheles   gambiae  ')).toEqual({ genus: 'Anopheles', species: 'gambiae' });
  });
});

describe('importMappings/toParietéSOP', () => {
  it('mappe la parité granulaire vers le binaire SOP (Pare/Nullipare)', () => {
    expect(toParietéSOP('Nulle')).toBe('NP');
    expect(toParietéSOP('Multi')).toBe('P');
  });

  it('retourne une chaîne vide pour une valeur inconnue', () => {
    expect(toParietéSOP('Inconnu')).toBe('');
    expect(toParietéSOP(undefined)).toBe('');
  });

  it('PARITE_SOP est cohérent avec toParietéSOP', () => {
    for (const [key, value] of Object.entries(PARITE_SOP)) {
      expect(toParietéSOP(key)).toBe(value);
    }
  });
});

describe('importMappings/buildHeaderMap', () => {
  it('construit un dictionnaire colonne→index depuis la ligne d\'en-tête', () => {
    const row = mockHeaderRow(['SERIES', 'Mission Order Number', 'What 3 Words']);
    const map = buildHeaderMap(row);
    expect(map.SERIES).toBe(1);
    expect(map.MISSION_ORDER_NUMBER).toBe(2);
    expect(map.WHAT_3_WORDS).toBe(3);
  });

  it('ignore les cellules vides (includeEmpty: false géré par le mock)', () => {
    const row = mockHeaderRow(['A', null, 'C']);
    const map = buildHeaderMap(row);
    expect(Object.keys(map)).toEqual(['A', 'C']);
  });
});

describe('importMappings/hasHeader', () => {
  // Le header map est toujours normalisé (majuscules + espaces → _), donc la
  // présence doit se tester avec la même normalisation — import et validation
  // à sec s'appuient sur ce helper pour rester cohérents.
  const map = buildHeaderMap(mockHeaderRow(['SERIES', 'Mission Order Number', 'Scientific Name']));

  it('trouve une colonne quelle que soit la casse/les espaces demandés', () => {
    expect(hasHeader(map, 'SERIES')).toBe(true);
    expect(hasHeader(map, 'MISSION_ORDER_NUMBER')).toBe(true);
    expect(hasHeader(map, 'Mission Order Number')).toBe(true);
    expect(hasHeader(map, 'scientific name')).toBe(true);
  });

  it('retourne false pour une colonne absente', () => {
    expect(hasHeader(map, 'BOX_PLATE_ID')).toBe(false);
  });
});

describe('importMappings/cellValue', () => {
  const hMap = { SERIES: 1, MISSION_ORDER_NUMBER: 2, PROJET: 3 };

  it('lit la valeur de la première colonne trouvée parmi les alias donnés', () => {
    const row = mockRow({ 1: 'AKZ_1', 2: 'M2026-001' });
    expect(cellValue(row, hMap, 'SERIES')).toBe('AKZ_1');
  });

  it('essaie les alias dans l\'ordre et retourne le premier trouvé', () => {
    const row = mockRow({ 2: 'M2026-001' });
    expect(cellValue(row, hMap, 'ORDRE_MISSION', 'MISSION_ORDER_NUMBER')).toBe('M2026-001');
  });

  it('retourne null si aucune colonne ne correspond', () => {
    const row = mockRow({ 1: 'AKZ_1' });
    expect(cellValue(row, hMap, 'INCONNU')).toBeNull();
  });

  it('retourne null si la cellule est vide (chaîne vide ou null)', () => {
    const row = mockRow({ 3: '' });
    expect(cellValue(row, hMap, 'PROJET')).toBeNull();
  });
});

describe('importMappings/tables de correspondance', () => {
  it('LIFESTAGE normalise les variantes de stade vers A/L/N/E', () => {
    expect(LIFESTAGE.ADULT).toBe('A');
    expect(LIFESTAGE.ADULT_MALE).toBe('A');
    expect(LIFESTAGE.LARVA).toBe('L');
    expect(LIFESTAGE.L4).toBe('L');
    expect(LIFESTAGE.NYMPH).toBe('N');
    expect(LIFESTAGE.PUPA).toBe('N');
    expect(LIFESTAGE.EGG).toBe('E');
  });

  it('SEX normalise vers M/F/inconnu', () => {
    expect(SEX.FEMALE).toBe('F');
    expect(SEX.MALE).toBe('M');
    expect(SEX.UNKNOWN).toBe('inconnu');
    expect(SEX.U).toBe('inconnu');
  });

  it('COLLECTION_METHOD normalise les acronymes SOP Institut Pasteur Madagascar', () => {
    // Route vers les codes historiques ("CDC", "BG", "LC") qui portent déjà
    // des méthodes réelles, pas vers les entrées "canoniques SOP" ajoutées le
    // 2026-08-12 ("CDC-LT", "BG-SENT") qui n'ont jamais été utilisées.
    expect(COLLECTION_METHOD.CDC_LIGHT_TRAP).toBe('CDC');
    expect(COLLECTION_METHOD.BG_SENTINEL).toBe('BG');
    expect(COLLECTION_METHOD.BIOGENTS_TRAP).toBe('BG');
    expect(COLLECTION_METHOD.LC).toBe('LC');
    expect(COLLECTION_METHOD.HLC).toBe('HLC');
    expect(COLLECTION_METHOD.HOTE).toBe('PRISE-HOTE');
    expect(COLLECTION_METHOD['HÔTE']).toBe('PRISE-HOTE');
    expect(COLLECTION_METHOD['ZP/DP']).toBe('ZP-DP');
  });

  it('PRESERVATIVE normalise les variantes d\'éthanol et solutions', () => {
    expect(PRESERVATIVE.ETHANOL_95).toBe('Ethanol 95%');
    expect(PRESERVATIVE['70%_ETHANOL']).toBe('Ethanol 70%');
    expect(PRESERVATIVE.RNALATER).toBe('RNAlater');
    expect(PRESERVATIVE.SILICA_GEL).toBe('Silica gel');
  });

  it('BLOOD_MEAL normalise vers le statut sanguin SOP (N/G/Gr/SGr/NC)', () => {
    expect(BLOOD_MEAL.GORGE).toBe('G');
    expect(BLOOD_MEAL.OUI).toBe('G');
    expect(BLOOD_MEAL.NON).toBe('N');
    expect(BLOOD_MEAL.GRAVIDE).toBe('Gr');
    expect(BLOOD_MEAL.SEMI_GRAVIDE).toBe('SGr');
    expect(BLOOD_MEAL.NOT_COLLECTED).toBe('NC');
  });
});
