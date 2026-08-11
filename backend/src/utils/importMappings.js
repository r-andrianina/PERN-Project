// backend/src/utils/importMappings.js
// Tables de correspondance entre les valeurs Excel et les valeurs SpécimenManager

const LIFESTAGE = {
  ADULT: 'A', ADULT_MALE: 'A', ADULT_FEMALE: 'A', A: 'A',
  LARVA: 'L', LARVAE: 'L', L1: 'L', L2: 'L', L3: 'L', L4: 'L', L: 'L',
  NYMPH: 'N', NYMPHAE: 'N', PUPA: 'N', PUPAL: 'N', N: 'N',
  EGG: 'E', EGGS: 'E', E: 'E',
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
  // Acronymes Trap_ID du SOP (Institut Pasteur Madagascar)
  LC: 'GITES',
  BG: 'BG-SENT',
  ZP: 'ZP-DP', DP: 'ZP-DP', 'ZP/DP': 'ZP-DP', ZEBU_PARK: 'ZP-DP', DOG_PERK: 'ZP-DP', DOG_PARK: 'ZP-DP',
  DN: 'DN', DOUBLE_NET: 'DN',
  NC: 'NC', NET_CATCH: 'NC',
  MHT: 'MHT',
  OVITRAP: 'OVITRAP',
  HOTE: 'PRISE-HOTE', 'HÔTE': 'PRISE-HOTE',
  ET: 'ET',
  PYR: 'PYR',
  OTHER: 'AUTRE-METHODE', AUTRE: 'AUTRE-METHODE',
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

// Statut sanguin SOP : N (Non gorgé) / G (Gorgé) / Gr (Gravide) / SGr (Semi-gravide) / NC (Not collected)
const BLOOD_MEAL = {
  G: 'G', GORGE: 'G', 'GORGÉ': 'G', Y: 'G', YES: 'G', OUI: 'G', '1': 'G', TRUE: 'G',
  N: 'N', NON_GORGE: 'N', 'NON_GORGÉ': 'N', NO: 'N', NON: 'N', '0': 'N', FALSE: 'N',
  GR: 'Gr', GRAVIDE: 'Gr',
  SGR: 'SGr', SEMI_GRAVIDE: 'SGr',
  NC: 'NC', NOT_COLLECTED: 'NC', NON_COLLECTE: 'NC',
};

// Mapping export SOP : parité interne (granulaire) -> binaire Pare/Nullipare
const PARITE_SOP = { Nulle: 'NP', Paucie: 'P', Multi: 'P' };
function toParietéSOP(parite) { return PARITE_SOP[parite] ?? ''; }

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

/**
 * Vrai si la colonne `name` est présente dans le header map, en appliquant la
 * même normalisation que cellValue/buildHeaderMap (majuscules + espaces → _).
 * Centralise le test de présence d'en-tête pour que l'import et la validation
 * à sec utilisent exactement la même règle.
 */
function hasHeader(hMap, name) {
  return Boolean(hMap[name.toUpperCase().replace(/\s+/g, '_')]);
}

module.exports = {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, ORGANISM_PART, BLOOD_MEAL,
  PARITE_SOP, toParietéSOP,
  normalizeKey, parseScientificName, buildHeaderMap, cellValue, hasHeader,
};
