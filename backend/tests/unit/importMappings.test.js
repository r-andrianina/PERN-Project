// Tests des tables de correspondance et helpers de parsing de l'import Excel
// (backend/src/utils/importMappings.js). Logique critique — utilisée à chaque
// import, zéro tolérance sur les régressions silencieuses de regex/fuzzy match.
const {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, BLOOD_MEAL, PARITE,
  normalizeKey, parseScientificName, parseCatchId, clePiege, buildHeaderMap, cellValue, hasHeader,
  normalizeHeader, canonicalHeader, resolveTaxonInput, buildHeaderReport,
  HEADER_ALIASES, KNOWN_COLUMNS, FIELD_COLUMNS, normalizeCellValue,
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

describe('importMappings/normalizeHeader', () => {
  it('supprime les accents et normalise la ponctuation', () => {
    expect(normalizeHeader('Espèce')).toBe('ESPECE');
    expect(normalizeHeader('Nom scientifique')).toBe('NOM_SCIENTIFIQUE');
    expect(normalizeHeader('scientific-name')).toBe('SCIENTIFIC_NAME');
    expect(normalizeHeader('Altitude (m)')).toBe('ALTITUDE_M');
  });

  it('absorbe BOM, espaces insécables et espaces superflus', () => {
    expect(normalizeHeader('﻿SERIES')).toBe('SERIES');
    expect(normalizeHeader('Nom scientifique')).toBe('NOM_SCIENTIFIQUE');
    expect(normalizeHeader('   Sexe   ')).toBe('SEXE');
  });

  it('retourne une chaîne vide pour null/undefined', () => {
    expect(normalizeHeader(null)).toBe('');
    expect(normalizeHeader(undefined)).toBe('');
  });
});

describe('importMappings/canonicalHeader', () => {
  it('résout les alias FR vers le nom canonique', () => {
    expect(canonicalHeader('Genre')).toBe('GENUS');
    expect(canonicalHeader('Espèce')).toBe('SPECIES');
    expect(canonicalHeader('Nom scientifique')).toBe('SCIENTIFIC_NAME');
    expect(canonicalHeader('Ordre de mission')).toBe('MISSION_ORDER_NUMBER');
    expect(canonicalHeader('Méthode de collecte')).toBe('COLLECTION_METHOD');
  });

  it('laisse passer un nom déjà canonique', () => {
    expect(canonicalHeader('SCIENTIFIC_NAME')).toBe('SCIENTIFIC_NAME');
    expect(canonicalHeader('GENUS')).toBe('GENUS');
  });

  it('renvoie la forme normalisée si aucun alias ne correspond', () => {
    expect(canonicalHeader('Colonne maison')).toBe('COLONNE_MAISON');
  });
});

describe('importMappings/resolveTaxonInput', () => {
  it('utilise SCIENTIFIC_NAME quand GENUS est absent (repli)', () => {
    expect(resolveTaxonInput({ scientificName: 'Anopheles gambiae' }))
      .toEqual({ genus: 'Anopheles', species: 'gambiae', source: 'scientific_name', conflit: null });
  });

  it('privilégie les colonnes GENUS/SPECIES sur SCIENTIFIC_NAME', () => {
    const r = resolveTaxonInput({ genus: 'Anopheles', species: 'gambiae', scientificName: 'Anopheles gambiae' });
    expect(r).toEqual({ genus: 'Anopheles', species: 'gambiae', source: 'columns', conflit: null });
  });

  it('complète l\'espèce depuis SCIENTIFIC_NAME si SPECIES est vide ET le genre concorde', () => {
    const r = resolveTaxonInput({ genus: 'Anopheles', scientificName: 'Anopheles coustani' });
    expect(r.species).toBe('coustani');
    expect(r.source).toBe('columns');
  });

  it('ne complète PAS l\'espèce si les genres divergent, et signale le conflit', () => {
    const r = resolveTaxonInput({ genus: 'Culex', scientificName: 'Anopheles gambiae' });
    expect(r.genus).toBe('Culex');      // la colonne fait foi
    expect(r.species).toBeNull();        // "gambiae" appartient à un autre genre
    expect(r.conflit).toEqual({ genreColonne: 'Culex', genreNomScientifique: 'Anopheles' });
  });

  it('signale le conflit même quand SPECIES est renseignée', () => {
    const r = resolveTaxonInput({ genus: 'Culex', species: 'pipiens', scientificName: 'Anopheles gambiae' });
    expect(r).toMatchObject({ genus: 'Culex', species: 'pipiens', source: 'columns' });
    expect(r.conflit).not.toBeNull();
  });

  it('gère le suffixe "sp" via SCIENTIFIC_NAME — genre seul, sans conflit', () => {
    expect(resolveTaxonInput({ scientificName: 'Culex sp' }))
      .toEqual({ genus: 'Culex', species: null, source: 'scientific_name', conflit: null });
  });

  it('retourne une résolution vide si aucune source n\'est exploitable', () => {
    expect(resolveTaxonInput({}))
      .toEqual({ genus: null, species: null, source: null, conflit: null });
    expect(resolveTaxonInput({ genus: '  ', scientificName: '' }).genus).toBeNull();
  });
});

describe('importMappings/buildHeaderReport', () => {
  it('sépare colonnes reconnues et ignorées, en exposant le nom canonique', () => {
    const report = buildHeaderReport(mockHeaderRow([
      'SERIES', 'Ordre de mission', 'Genre', 'Espèce', 'Colonne maison',
    ]));
    expect(report.reconnues).toEqual([
      { source: 'SERIES',           cible: 'SERIES' },
      { source: 'Ordre de mission', cible: 'MISSION_ORDER_NUMBER' },
      { source: 'Genre',            cible: 'GENUS' },
      { source: 'Espèce',           cible: 'SPECIES' },
    ]);
    expect(report.ignorees).toEqual(['Colonne maison']);
  });

  it('traite un doublon de cible comme ignoré (seule la 1re colonne est lue)', () => {
    const report = buildHeaderReport(mockHeaderRow(['Genre', 'GENUS']));
    expect(report.reconnues).toEqual([{ source: 'Genre', cible: 'GENUS' }]);
    expect(report.ignorees).toEqual(['GENUS']);
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

// ── Cohérence du vocabulaire de colonnes ─────────────────────────────
// Régression du 2026-08-27 : HEADER_ALIASES traduisait vers LATITUDE /
// PRESERVATIVE / WELL_POSITION / NOTES pendant que import.controller.js lisait
// DECIMAL_LATITUDE / PRESERVATIVE_SOLUTION / TUBE_OR_WELL_ID / REMARKS. Les
// colonnes étaient donc annoncées "reconnues" à l'utilisateur puis ignorées :
// perte silencieuse du GPS, de la solution, de la position et des notes.
// Ces tests verrouillent l'invariant des deux côtés.
describe('importMappings/cohérence des noms de colonnes', () => {
  it('tout alias pointe vers une colonne réellement lue par l\'import', () => {
    const morts = Object.entries(HEADER_ALIASES)
      .filter(([, cible]) => !KNOWN_COLUMNS.has(cible))
      .map(([source, cible]) => `${source} -> ${cible}`);
    expect(morts).toEqual([]);
  });

  it('KNOWN_COLUMNS dérive exactement de FIELD_COLUMNS', () => {
    expect([...KNOWN_COLUMNS].sort())
      .toEqual([...new Set(Object.values(FIELD_COLUMNS).flat())].sort());
  });

  it('aucune colonne lue n\'est absente du rapport de mapping', () => {
    for (const noms of Object.values(FIELD_COLUMNS)) {
      for (const nom of noms) {
        expect(KNOWN_COLUMNS.has(canonicalHeader(nom))).toBe(true);
      }
    }
  });

  it('un fichier à en-têtes français résout tous les champs (non-régression)', () => {
    const header = mockHeaderRow([
      'ID_TERRAIN', 'Ordre mission', 'Nom scientifique', 'Méthode',
      'Solution de conservation', 'Position', 'Latitude', 'Longitude',
      'Altitude (m)', 'Remarques',
    ]);
    const hMap = buildHeaderMap(header);
    const row  = mockRow({
      1: 'MPM-1', 2: 'OM-1', 3: 'Anopheles gambiae', 4: 'CDC-LT',
      5: '95%_ETHANOL', 6: 'A1', 7: -18.91, 8: 47.53, 9: 1250, 10: 'note',
    });

    expect(cellValue(row, hMap, ...FIELD_COLUMNS.idTerrain)).toBe('MPM-1');
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.ordreMission)).toBe('OM-1');
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.solution)).toBe('95%_ETHANOL');
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.position)).toBe('A1');
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.latitude)).toBe(-18.91);
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.longitude)).toBe(47.53);
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.altitude)).toBe(1250);
    expect(cellValue(row, hMap, ...FIELD_COLUMNS.notes)).toBe('note');
  });

  it('les colonnes du template IPM sont reconnues, pas signalées ignorées', () => {
    // TUBE_OR_WELL_ID et PRESERVATIVE_SOLUTION sont émises par le template
    // officiel : elles étaient lues mais rapportées comme "ignorées".
    const header = mockHeaderRow([
      'SERIES', 'MISSION_ORDER_NUMBER', 'SCIENTIFIC_NAME',
      'TUBE_OR_WELL_ID', 'PRESERVATIVE_SOLUTION', 'DECIMAL_LATITUDE',
    ]);
    expect(buildHeaderReport(header).ignorees).toEqual([]);
  });
});

// ── Valeurs documentées par le template ──────────────────────────────
// Régression du 2026-08-27 : le template généré par getTemplateMoustiques
// documente "CDC-LT | BG-SENT | HLC | DRAGGING | GITES" comme valeurs de
// COLLECTION_METHOD, mais normalizeKey ne normalisait pas les tirets alors que
// les clés de la table utilisent l'underscore. Les valeurs officiellement
// recommandées étaient donc rejetées en TYPE_METHODE_INTROUVABLE.
describe('importMappings/valeurs documentées par le template', () => {
  it('normalizeKey assimile les tirets aux espaces', () => {
    expect(normalizeKey('CDC-LT')).toBe('CDC_LT');
    expect(normalizeKey('BG-SENT')).toBe('BG_SENT');
    expect(normalizeKey('RNA-later')).toBe('RNA_LATER');
    expect(normalizeKey('semi - gravide')).toBe('SEMI_GRAVIDE');
  });

  it('ne touche pas au "/" dont dépend la clé ZP/DP', () => {
    expect(normalizeKey('ZP/DP')).toBe('ZP/DP');
    expect(COLLECTION_METHOD[normalizeKey('ZP/DP')]).toBe('ZP-DP');
  });

  it('les acronymes SOP à tiret se résolvent', () => {
    expect(COLLECTION_METHOD[normalizeKey('CDC-LT')]).toBe('CDC');
    expect(COLLECTION_METHOD[normalizeKey('BG-SENT')]).toBe('BG');
    expect(PRESERVATIVE[normalizeKey('RNA-later')]).toBe('RNAlater');
  });

  it('toute valeur COLLECTION_METHOD du template est mappée', () => {
    // Liste tenue en phase avec la note du template (COLS[].note pour method).
    const documentees = ['CDC-LT', 'BG-SENT', 'HLC', 'DRAGGING', 'GITES'];
    const nonMappees = documentees.filter((v) => !COLLECTION_METHOD[normalizeKey(v)]);
    expect(nonMappees).toEqual([]);
  });
});

// ── Formes non scalaires des cellules ExcelJS ────────────────────────
// Régression du 2026-08-27 : cell.value n'est pas toujours une primitive.
// Formules, texte enrichi et liens arrivaient en objet et String() produisait
// "[object Object]", stocké tel quel en base. Sur SERIES (unique), la 1re ligne
// passait et toutes les suivantes étaient rejetées en DOUBLON.
describe('importMappings/normalizeCellValue', () => {
  it('laisse passer les primitives et les dates', () => {
    const d = new Date('2024-03-15');
    expect(normalizeCellValue('texte')).toBe('texte');
    expect(normalizeCellValue(42)).toBe(42);
    expect(normalizeCellValue(0)).toBe(0);
    expect(normalizeCellValue(false)).toBe(false);
    expect(normalizeCellValue(d)).toBe(d);
  });

  it('concatène le texte enrichi', () => {
    expect(normalizeCellValue({ richText: [{ text: 'Anopheles ' }, { text: 'gambiae' }] }))
      .toBe('Anopheles gambiae');
  });

  it('utilise le résultat mis en cache d\'une formule', () => {
    expect(normalizeCellValue({ formula: 'CONCATENATE("MPM-","1")', result: 'MPM-1' })).toBe('MPM-1');
    expect(normalizeCellValue({ sharedFormula: 'A1', result: 7 })).toBe(7);
  });

  it('rend null pour une formule non calculée ou une cellule en erreur', () => {
    expect(normalizeCellValue({ formula: 'A1' })).toBeNull();
    expect(normalizeCellValue({ formula: 'A1/0', result: { error: '#DIV/0!' } })).toBeNull();
    expect(normalizeCellValue({ error: '#REF!' })).toBeNull();
  });

  it('extrait le texte d\'un lien hypertexte', () => {
    expect(normalizeCellValue({ text: 'MPM-1', hyperlink: 'http://x' })).toBe('MPM-1');
  });

  it('ne produit jamais "[object Object]"', () => {
    const formes = [
      { richText: [{ text: 'a' }] }, { formula: 'A1', result: 'b' }, { formula: 'A1' },
      { error: '#REF!' }, { text: 'c', hyperlink: 'u' }, {},
    ];
    for (const f of formes) {
      expect(String(normalizeCellValue(f))).not.toBe('[object Object]');
    }
  });

  it('un en-tête en texte enrichi reste reconnu', () => {
    const hMap = buildHeaderMap(mockHeaderRow([
      { richText: [{ text: 'Nom ' }, { text: 'scientifique' }] },
    ]));
    expect(hMap.SCIENTIFIC_NAME).toBe(1);
  });
});

// ── Parité (branchée à l'import le 2026-09-02) ───────────────────────
// Échelle binaire côté application : 'Nullipare' | 'Pare'. Les échelles fines
// du terrain sont ramenées à 'Pare' — une femelle paucipare ou multipare a par
// définition déjà pondu, seul le nombre de cycles est perdu (non modélisé).
describe('importMappings/PARITE', () => {
  it('accepte les termes complets, FR et EN', () => {
    for (const v of ['Nullipare', 'nullipare', 'NULLIPAROUS']) {
      expect(PARITE[normalizeKey(v)]).toBe('Nullipare');
    }
    for (const v of ['Pare', 'parous', 'PARA']) {
      expect(PARITE[normalizeKey(v)]).toBe('Pare');
    }
  });

  it('accepte les codes courts du SOP', () => {
    expect(PARITE[normalizeKey('NP')]).toBe('Nullipare');
    expect(PARITE[normalizeKey('P')]).toBe('Pare');
    expect(PARITE[normalizeKey('0')]).toBe('Nullipare');
    expect(PARITE[normalizeKey('1')]).toBe('Pare');
  });

  it('ramène les échelles fines à Pare', () => {
    for (const v of ['paucipare', 'PAUCIPAROUS', 'multipare', 'MULTIPAROUS']) {
      expect(PARITE[normalizeKey(v)]).toBe('Pare');
    }
  });

  it('accepte l\'ancienne valeur interne "Multi" (fichiers déjà exportés)', () => {
    expect(PARITE[normalizeKey('Multi')]).toBe('Pare');
  });

  it('ne produit que les deux valeurs du schéma Zod', () => {
    expect([...new Set(Object.values(PARITE))].sort()).toEqual(['Nullipare', 'Pare']);
  });

  it('une valeur inconnue reste non mappée (signalée, jamais devinée)', () => {
    expect(PARITE[normalizeKey('peut-être')]).toBeUndefined();
    expect(PARITE[normalizeKey('')]).toBeUndefined();
  });

  it('PARITY est une colonne lue et reconnue par le rapport de mapping', () => {
    expect(FIELD_COLUMNS.parite).toEqual(['PARITY']);
    expect(KNOWN_COLUMNS.has('PARITY')).toBe(true);
    expect(canonicalHeader('Parité')).toBe('PARITY');
  });
});

// ── CATCH_ID : identité du piège (2026-09-04) ────────────────────────
// CATCH_ID = code du type + numéro quand plusieurs pièges du même type sont
// posés sur une localité (CDC_1, CDC_2, CDC_3). La position intérieur/extérieur
// appartient à OUTDOORS_INDOORS, pas à CATCH_ID — mais les fichiers réels
// contiennent des HLC_EXT_1 : on les tolère en le signalant.
describe('importMappings/parseCatchId', () => {
  it('extrait code et numéro', () => {
    expect(parseCatchId('CDC_1')).toEqual({ code: 'CDC', numero: 1, position: null });
    expect(parseCatchId('CDC_3')).toEqual({ code: 'CDC', numero: 3, position: null });
  });

  it('un piège sans numéro n\'en invente pas', () => {
    expect(parseCatchId('ZP')).toEqual({ code: 'ZP', numero: null, position: null });
    expect(parseCatchId('LC')).toEqual({ code: 'LC', numero: null, position: null });
  });

  it('tolère une position incrustée et la remonte', () => {
    expect(parseCatchId('HLC_EXT_1')).toEqual({ code: 'HLC', numero: 1, position: 'exterieur' });
    expect(parseCatchId('HLC_INT_2')).toEqual({ code: 'HLC', numero: 2, position: 'interieur' });
  });

  it('sépare HLC_1 intérieur de HLC_1 extérieur par la position, pas le numéro', () => {
    const ext = parseCatchId('HLC_EXT_1');
    const int = parseCatchId('HLC_INT_1');
    expect(ext.numero).toBe(int.numero);          // même numéro
    expect(ext.position).not.toBe(int.position);  // pièges distincts
  });

  it('le code extrait n\'est pas un code de référentiel — il passe par COLLECTION_METHOD', () => {
    expect(parseCatchId('MHT_1').code).toBe('MHT');
    expect(COLLECTION_METHOD[normalizeKey('MHT')]).toBe('PMT');
  });

  it('valeur absente', () => {
    expect(parseCatchId(null)).toEqual({ code: null, numero: null, position: null });
    expect(parseCatchId('')).toEqual({ code: null, numero: null, position: null });
  });

  it('couvre les 12 CATCH_ID du fichier IPM de référence', () => {
    const reels = ['CDC_1','CDC_2','CDC_3','HLC_EXT_1','HLC_EXT_2','HLC_EXT_3',
                   'HLC_INT_1','HLC_INT_2','HLC_INT_3','LC','MHT_1','ZP'];
    const identites = reels.map((c) => {
      const p = parseCatchId(c);
      return [COLLECTION_METHOD[normalizeKey(p.code)], p.numero ?? 1, p.position].join('_');
    });
    expect(new Set(identites).size).toBe(12); // 12 pièges physiques distincts
  });
});

// ── clePiege : jointure entre feuilles d'un même classeur ────────────
// La feuille principale et la feuille GPS ne nomment pas les pièges pareil :
// HLC_EXT_1 / HLC_1, MHT_1 / le code référentiel PMT.
describe('importMappings/clePiege', () => {
  it('rapproche les deux nomenclatures du même piège', () => {
    expect(clePiege('HLC_EXT_1')).toBe(clePiege('HLC_1'));
    expect(clePiege('HLC_INT_1')).toBe(clePiege('HLC_1'));
    expect(clePiege('MHT_1')).toBe(clePiege('PMT_1'));
  });

  it('passe par la table des méthodes pour le code', () => {
    expect(clePiege('MHT_1')).toBe('PMT/1');
    expect(clePiege('ZP_1')).toBe('ZP-DP/1');
  });

  it('un numéro absent vaut 1, comme à la création de la méthode', () => {
    expect(clePiege('ZP')).toBe('ZP-DP/1');
    expect(clePiege('LC')).toBe('LC/1');
  });

  it('ne confond pas deux pièges du même type', () => {
    expect(clePiege('CDC_1')).not.toBe(clePiege('CDC_2'));
  });

  it('valeur absente', () => {
    expect(clePiege(null)).toBeNull();
    expect(clePiege('')).toBeNull();
  });
});
