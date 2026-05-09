// backend/src/utils/importMappings.js
// Tables de correspondance entre les valeurs Excel et les valeurs SpécimenManager

const LIFESTAGE = {
  ADULT: 'Adulte', ADULT_MALE: 'Adulte', ADULT_FEMALE: 'Adulte',
  LARVA: 'Larve', LARVAE: 'Larve', L1: 'Larve', L2: 'Larve', L3: 'Larve', L4: 'Larve',
  NYMPH: 'Nymphe', NYMPHAE: 'Nymphe', PUPA: 'Nymphe', PUPAL: 'Nymphe',
  EGG: 'Oeuf', EGGS: 'Oeuf',
};

const SEX = {
  FEMALE: 'F', MALE: 'M', UNKNOWN: 'inconnu',
  F: 'F', M: 'M', U: 'inconnu',
};

const COLLECTION_METHOD = {
  CDC_LIGHT_TRAP: 'CDC-LT', CDC_LT: 'CDC-LT', CDC: 'CDC-LT',
  BG_SENTINEL: 'BG-SENT', BG_SENTINEL_TRAP: 'BG-SENT',
  HUMAN_LANDING_CATCH: 'HLC', HLC: 'HLC', HUMAN_LANDING: 'HLC',
  DRAGGING: 'DRAGGING', DRAG: 'DRAGGING', FLAGGING: 'DRAGGING',
  CO2_TRAP: 'PIEGE-CO2', CO2: 'PIEGE-CO2',
  RODENT_TRAP: 'PIEGE-RG', SHERMAN: 'PIEGE-RG', BTS: 'PIEGE-RG',
  ON_HOST: 'PRISE-HOTE', HOST_COLLECTION: 'PRISE-HOTE',
  LARVAL_SURVEY: 'GITES',
};

const PRESERVATIVE = {
  '100%_ETHANOL': 'Ethanol 95%', '95%_ETHANOL': 'Ethanol 95%',
  '100_ETHANOL': 'Ethanol 95%', '95_ETHANOL': 'Ethanol 95%',
  ETHANOL_100: 'Ethanol 95%', ETHANOL_95: 'Ethanol 95%',
  '70%_ETHANOL': 'Ethanol 70%', '70_ETHANOL': 'Ethanol 70%',
  ETHANOL_70: 'Ethanol 70%',
  RNALATER: 'RNAlater', RNA_LATER: 'RNAlater', RNALATYER: 'RNAlater',
  LIQUID_NITROGEN: 'Azote liquide', LN2: 'Azote liquide',
  DRY: 'Sec (épingle)', DRY_PIN: 'Sec (épingle)', PINNED: 'Sec (épingle)',
  SILICA: 'Silica gel', SILICA_GEL: 'Silica gel',
};

const ORGANISM_PART = {
  WHOLE_ORGANISM: 'Entier', WHOLE: 'Entier', ENTIRE: 'Entier',
  HEAD: 'Tête',
  THORAX: 'Thorax',
  ABDOMEN: 'Abdomen',
};

const BLOOD_MEAL = {
  Y: true, YES: true, OUI: true, '1': true, TRUE: true,
  N: false, NO: false, NON: false, '0': false, FALSE: false,
};

/**
 * Normalise une valeur pour lookup dans les tables ci-dessus.
 * Ex : "100%_Ethanol" → "100%_ETHANOL"
 */
function normalizeKey(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Extrait genre + espèce depuis un nom scientifique.
 * Ignore les suffixes courants : sl, s.l., s.s., ss, complex, group, gp.
 */
function parseScientificName(name) {
  if (!name) return { genus: null, species: null };
  const clean = String(name)
    .trim()
    .replace(/\s+(sl|s\.l\.|s\.s\.|ss|complex|group|gp\.|grp\.|sensu\s+lato|sensu\s+stricto|sp\.)$/i, '')
    .trim();
  const parts = clean.split(/\s+/);
  return {
    genus:   parts[0] ? parts[0].trim() : null,
    species: parts[1] ? parts[1].trim() : null,
  };
}

/**
 * Construit un dictionnaire colName→colIndex depuis la ligne d'en-tête.
 * Les clés sont normalisées (majuscules, espaces → _).
 */
function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const raw = (cell.value || '').toString().trim();
    const key = raw.toUpperCase().replace(/[\s\t]+/g, '_');
    map[key] = col;
  });
  return map;
}

/**
 * Lit la valeur d'une cellule depuis le header map.
 * @param {object} row    ExcelJS row
 * @param {object} hMap   header map { COL_NAME: colIndex }
 * @param {...string} keys noms de colonnes à essayer dans l'ordre
 * @returns string|number|null
 */
function cellValue(row, hMap, ...keys) {
  for (const k of keys) {
    const col = hMap[k.toUpperCase().replace(/\s+/g, '_')];
    if (col) {
      const cell = row.getCell(col);
      const v = cell?.value;
      if (v !== null && v !== undefined && v !== '') return v;
    }
  }
  return null;
}

module.exports = {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, ORGANISM_PART, BLOOD_MEAL,
  normalizeKey, parseScientificName, buildHeaderMap, cellValue,
};
