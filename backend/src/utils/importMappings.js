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
  // NB: on route vers les codes historiques ("CDC", "BG") qui portent déjà
  // des méthodes réelles, pas vers les entrées "canoniques SOP" ajoutées le
  // 2026-08-12 ("CDC-LT", "BG-SENT") — celles-ci n'ont jamais été utilisées.
  // Router vers un code vide aurait fragmenté silencieusement les données
  // (nouvelles méthodes importées séparées des méthodes historiques pour le
  // même piège) au lieu de les rattacher à l'existant.
  CDC_LIGHT_TRAP: 'CDC', CDC_LT: 'CDC', CDC: 'CDC',
  BG_SENTINEL: 'BG', BG_SENTINEL_TRAP: 'BG', BIOGENTS_TRAP: 'BG', BG_SENT: 'BG',
  HUMAN_LANDING_CATCH: 'HLC', HLC: 'HLC', HUMAN_LANDING: 'HLC',
  // Libellés longs présents dans les fichiers IPM réels. Ils tombaient sur la
  // recherche floue par nom — qui trouvait juste, mais au prix d'un
  // avertissement par ligne (154 sur un fichier de 526).
  MUIRHEAD_THOMPSON_WELL: 'PMT', MUIRHEAD_THOMSON_WELL: 'PMT',
  LARVAL_COLLECTION: 'LC',
  DRAGGING: 'DRAGGING', DRAG: 'DRAGGING', FLAGGING: 'DRAGGING',
  CO2_TRAP: 'PIEGE-CO2', CO2: 'PIEGE-CO2',
  RODENT_TRAP: 'PIEGE-RG', SHERMAN: 'PIEGE-RG', BTS: 'PIEGE-RG',
  ON_HOST: 'PRISE-HOTE', HOST_COLLECTION: 'PRISE-HOTE',
  // "Prospection de gîtes larvaires" et "larval collection" désignent la même
  // opération. GITES pointait vers un code absent du référentiel : toute ligne
  // l'employant échouait. Réorienté vers LC, qui existe et porte déjà des
  // données (2026-09-04).
  LARVAL_SURVEY: 'LC', GITES: 'LC',
  // Acronymes Trap_ID du SOP (Institut Pasteur Madagascar)
  LC: 'LC',
  BG: 'BG',
  ZP: 'ZP-DP', DP: 'ZP-DP', 'ZP/DP': 'ZP-DP', ZEBU_PARK: 'ZP-DP', DOG_PERK: 'ZP-DP', DOG_PARK: 'ZP-DP',
  DN: 'DN', DOUBLE_NET: 'DN',
  NC: 'NC', NET_CATCH: 'NC',
  // MHT et PMT désignaient le même piège (puits Muirhead-Thomson) sous deux
  // codes. MHT a été supprimé du référentiel le 2026-09-02 (0 méthode
  // rattachée) ; l'alias est conservé pour que les fichiers terrain écrivant
  // "MHT" continuent de s'importer, en pointant désormais vers PMT.
  MHT: 'PMT', PMT: 'PMT',
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

// Parité (femelles adultes) : a-t-elle déjà pondu ? Échelle binaire côté
// application — 'Nullipare' | 'Pare' (cf. specimens.schema.js).
//
// Les échelles fines du terrain sont volontairement ramenées à `Pare` : une
// femelle paucipare ou multipare a, par définition, déjà pondu. On ne perd donc
// aucune information sur le critère stocké, seulement le détail du nombre de
// cycles — que l'application ne modélise pas.
// 'Multi' est l'ancienne valeur interne (avant le 2026-09-02), acceptée pour
// que les fichiers déjà exportés se réimportent sans retouche.
const PARITE = {
  NULLIPARE: 'Nullipare', NULLIPAROUS: 'Nullipare', NULLIPARA: 'Nullipare',
  NP: 'Nullipare', NULLE: 'Nullipare', NULL: 'Nullipare', '0': 'Nullipare',
  PARE: 'Pare', PAROUS: 'Pare', PARA: 'Pare', P: 'Pare', '1': 'Pare',
  PAUCIPARE: 'Pare', PAUCIPAROUS: 'Pare',
  MULTIPARE: 'Pare', MULTIPAROUS: 'Pare', MULTI: 'Pare',
};

// Position du piège. Valeurs internes alignées sur l'enum de methodes.schema.js
// (['interieur', 'exterieur']) — toute autre valeur laisse le champ vide.
const INTERIEUR_EXTERIEUR = {
  INDOORS: 'interieur', INDOOR: 'interieur', INTERIEUR: 'interieur', INT: 'interieur', IN: 'interieur',
  OUTDOORS: 'exterieur', OUTDOOR: 'exterieur', EXTERIEUR: 'exterieur', EXT: 'exterieur', OUT: 'exterieur',
};

/**
 * Normalise une valeur pour lookup dans les tables ci-dessus.
 * Ex : "100%_Ethanol" → "100%_ETHANOL", "CDC-LT" → "CDC_LT"
 *
 * Les tirets sont assimilés aux espaces : les acronymes SOP s'écrivent avec un
 * tiret sur le terrain ("CDC-LT", "BG-SENT", "RNA-later") alors que les clés des
 * tables ci-dessus utilisent l'underscore. Sans cette équivalence, les valeurs
 * que le template lui-même documente ne se résolvaient pas et les lignes étaient
 * rejetées en TYPE_METHODE_INTROUVABLE.
 * Le "/" est laissé tel quel : c'est un séparateur signifiant, et la clé
 * COLLECTION_METHOD['ZP/DP'] s'appuie dessus.
 */
function normalizeKey(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * Extrait genre + espèce depuis un nom scientifique.
 * Ignore les suffixes courants : sl, s.l., s.s., ss, complex, group, gp.,
 * ainsi que sp/sp./spp/spp. — convention entomologique standard pour
 * "espèce non déterminée sur le terrain" (le genre est identifié, pas
 * l'espèce) : ce n'est PAS une espèce à chercher dans le dictionnaire.
 * Le point final est optionnel ("sp" seul, sans point, est très courant en
 * saisie terrain). Ne matche jamais un morphotype numéroté comme "sp1"/"spA"
 * (l'ancre de fin de chaîne exige "sp"/"spp" seul, chiffre/lettre exclus).
 */
function parseScientificName(name) {
  if (!name) return { genus: null, species: null };
  const clean = String(name)
    .trim()
    .replace(/\s+(sl|s\.l\.|s\.s\.|ss|complex|group|gp\.|grp\.|sensu\s+lato|sensu\s+stricto|spp?\.?)$/i, '')
    .trim();
  const parts = clean.split(/\s+/);
  return {
    genus:   parts[0] ? parts[0].trim() : null,
    species: parts[1] ? parts[1].trim() : null,
  };
}

/**
 * Décompose un CATCH_ID en { code, numero, position }.
 *
 * Un CATCH_ID identifie un PIÈGE : code du type + numéro quand plusieurs pièges
 * du même type sont posés sur la localité (CDC_1, CDC_2, CDC_3).
 *
 * La position intérieur/extérieur n'a PAS sa place ici — c'est une propriété du
 * piège, portée par la colonne OUTDOORS_INDOORS. Les fichiers réels contiennent
 * pourtant des HLC_EXT_1 / HLC_INT_2 : on les tolère pour ne pas rejeter la
 * ligne, en remontant la position lue afin que l'appelant puisse avertir.
 *
 * Le `code` extrait n'est pas un code de référentiel : il passe par
 * COLLECTION_METHOD comme n'importe quelle valeur de méthode (MHT → PMT).
 *
 * @returns {{ code: string|null, numero: number|null, position: 'interieur'|'exterieur'|null }}
 */
function parseCatchId(brut) {
  const t = brut === null || brut === undefined ? '' : String(brut).trim();
  if (!t) return { code: null, numero: null, position: null };

  let reste = t;
  // Numéro en fin de chaîne : CDC_1, HLC_EXT_3
  let numero = null;
  const mNum = /[_-](\d+)$/.exec(reste);
  if (mNum) { numero = Number(mNum[1]); reste = reste.slice(0, mNum.index); }

  // Position éventuellement incrustée : HLC_EXT, HLC_INT
  let position = null;
  const mPos = /[_-](INT|EXT|INDOORS?|OUTDOORS?)$/i.exec(reste);
  if (mPos) {
    position = /^IN/i.test(mPos[1]) ? 'interieur' : 'exterieur';
    reste = reste.slice(0, mPos.index);
  }

  return { code: reste || null, numero, position };
}

/**
 * Clé d'identité d'un piège, comparable entre feuilles d'un même classeur.
 *
 * La feuille principale et la feuille GPS ne nomment pas les pièges pareil :
 * "HLC_EXT_1" d'un côté, "HLC_1" de l'autre ; "MHT_1" contre le code de
 * référentiel "PMT". On ramène les deux à `CODE/numéro`, en passant par la même
 * table de correspondance que les valeurs de méthode.
 *
 * Le numéro absent vaut 1, comme à la création de la méthode de collecte.
 */
function clePiege(brut) {
  const { code, numero } = parseCatchId(brut);
  if (!code) return null;
  const codeReferentiel = COLLECTION_METHOD[normalizeKey(code)] ?? code.toUpperCase();
  return `${codeReferentiel}/${numero ?? 1}`;
}

/**
 * Normalise un libellé d'en-tête Excel vers une clé canonique comparable.
 * Volontairement tolérant : les fichiers terrain arrivent avec des accents,
 * des tirets, des unités entre parenthèses, des espaces insécables (copier-
 * coller depuis Word) ou un BOM en début de première cellule.
 *   "Nom scientifique"  → NOM_SCIENTIFIQUE
 *   "scientific-name"   → SCIENTIFIC_NAME
 *   "Espèce"            → ESPECE
 *   "Altitude (m)"      → ALTITUDE_M
 */
function normalizeHeader(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/^﻿/, '')            // BOM
    .replace(/ /g, ' ')           // espace insécable
    .normalize('NFD')                  // décompose les accents…
    .replace(/[̀-ͯ]/g, '')   // …et les supprime (é → e)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')       // tout le reste (espaces, -, ., (), /) → _
    .replace(/^_+|_+$/g, '');
}

// Colonnes lues par l'import, groupées par champ logique.
//
// SOURCE UNIQUE DE VÉRITÉ : l'import ne lit QUE via cette table (le contrôleur
// fait `cellValue(row, hMap, ...FIELD_COLUMNS.idTerrain)`), et KNOWN_COLUMNS /
// la validation des alias en dérivent. Sans ça, les trois listes divergent :
// c'est exactement ce qui s'était produit — HEADER_ALIASES traduisait vers
// "LATITUDE"/"PRESERVATIVE"/"NOTES" pendant que le contrôleur lisait
// "DECIMAL_LATITUDE"/"PRESERVATIVE_SOLUTION"/"REMARKS", si bien qu'une colonne
// pouvait être annoncée "reconnue" à l'utilisateur puis silencieusement ignorée.
//
// Le vocabulaire canonique est celui du format IPM (= celui du template généré
// par getTemplateMoustiques) ; les libellés FR et les variantes passent par
// HEADER_ALIASES. Un ordre de plusieurs colonnes = repli : la première non vide
// gagne (cf. cellValue).
const FIELD_COLUMNS = {
  // — Identité / rattachement —
  idTerrain:    ['SERIES', 'COLLECTOR_SAMPLE_ID'],
  ordreMission: ['MISSION_ORDER_NUMBER'],
  projet:       ['PROJET'],
  code3w:       ['WHAT_3_WORDS'],
  // — Géo —
  nomLocalite:  ['COLLECTION_LOCATION'],
  latitude:     ['DECIMAL_LATITUDE'],
  longitude:    ['DECIMAL_LONGITUDE'],
  altitude:     ['ELEVATION'],
  // — Collecte —
  methode:      ['COLLECTION_METHOD'],
  dateCollecte: ['DATE_OF_COLLECTION'],
  // — Taxonomie —
  nomScientifique: ['SCIENTIFIC_NAME'],
  genre:           ['GENUS'],
  espece:          ['SPECIES'],
  // — Biologie —
  sexe:          ['SEX'],
  stade:         ['LIFESTAGE'],
  repasSang:     ['BLOOD_MEAL'],
  parite:        ['PARITY'],
  // Heure de fin du créneau (protocoles horodatés type HLC). Sans elle, douze
  // captures horaires d'une même nuit sont indiscernables et l'import les
  // prenait pour des doublons.
  trancheHoraire: ['TIME_OF_COLLECTION'],
  // Identifiant du piège INDIVIDUEL (CDC_1, HLC_EXT_2…), distinct du type de
  // méthode. Lu pour le contrôle d'homogénéité des tubes ; la numérotation des
  // méthodes de collecte ne s'en sert pas encore.
  piege:          ['CATCH_ID'],
  // Porté par la MÉTHODE de collecte, pas par le spécimen : un piège est posé
  // en intérieur ou en extérieur.
  interieurExterieur: ['OUTDOORS_INDOORS'],
  organePreleve: ['ORGANISM_PART'],
  nombre:        ['NUMBER'],
  // — Conservation / contenant —
  solution:  ['PRESERVATIVE_SOLUTION'],
  container: ['BOX_PLATE_ID'],
  position:  ['TUBE_OR_WELL_ID'],
  // — Divers —
  notes: ['REMARKS', 'OTHER_INFORMATIONS', 'MISC_METADATA'],
};

// Alias d'en-têtes → nom canonique utilisé par le code. Même principe que les
// tables de valeurs ci-dessus (COLLECTION_METHOD, BLOOD_MEAL…), mais pour les
// NOMS DE COLONNES : un fichier en français ou avec une variante de libellé
// doit s'importer sans que l'utilisateur ait à renommer ses colonnes.
// Clés déjà normalisées par normalizeHeader().
//
// INVARIANT : toute valeur ci-dessous doit exister dans FIELD_COLUMNS, sinon
// l'alias est mort (la colonne est reconnue mais jamais lue). Garanti par test.
const HEADER_ALIASES = {
  // — Taxonomie —
  NOM_SCIENTIFIQUE: 'SCIENTIFIC_NAME', NOM_SCIENTIFIQUE_COMPLET: 'SCIENTIFIC_NAME',
  SCIENTIFICNAME: 'SCIENTIFIC_NAME', TAXON: 'SCIENTIFIC_NAME', ESPECE_COMPLETE: 'SCIENTIFIC_NAME',
  GENRE: 'GENUS', GENUS_NAME: 'GENUS',
  ESPECE: 'SPECIES', ESPECES: 'SPECIES', SPECIES_NAME: 'SPECIES', EPITHETE: 'SPECIES',
  // — Identité / rattachement —
  ID_TERRAIN: 'SERIES', IDENTIFIANT_TERRAIN: 'SERIES', SERIE: 'SERIES', N_SERIE: 'SERIES',
  ORDRE_DE_MISSION: 'MISSION_ORDER_NUMBER', ORDRE_MISSION: 'MISSION_ORDER_NUMBER',
  NUMERO_ORDRE_MISSION: 'MISSION_ORDER_NUMBER', MISSION: 'MISSION_ORDER_NUMBER',
  PROJECT: 'PROJET', NOM_PROJET: 'PROJET', CODE_PROJET: 'PROJET',
  W3W: 'WHAT_3_WORDS', WHAT3WORDS: 'WHAT_3_WORDS', CODE_LOCALITE: 'WHAT_3_WORDS',
  // — Collecte —
  METHODE: 'COLLECTION_METHOD', METHODE_DE_COLLECTE: 'COLLECTION_METHOD',
  METHODE_COLLECTE: 'COLLECTION_METHOD', TRAP_ID: 'COLLECTION_METHOD', PIEGE: 'COLLECTION_METHOD',
  DATE_COLLECTE: 'DATE_OF_COLLECTION', DATE_DE_COLLECTE: 'DATE_OF_COLLECTION',
  DATE: 'DATE_OF_COLLECTION',
  // — Biologie —
  SEXE: 'SEX',
  STADE: 'LIFESTAGE', STADE_DE_DEVELOPPEMENT: 'LIFESTAGE', STAGE: 'LIFESTAGE',
  REPAS_SANG: 'BLOOD_MEAL', STATUT_SANGUIN: 'BLOOD_MEAL', GORGEMENT: 'BLOOD_MEAL',
  // PARTURITY : orthographe réellement employée dans les fichiers IPM.
  PARTURITY: 'PARITY', PARITE: 'PARITY', PARITE_OVARIENNE: 'PARITY', STATUT_PARITE: 'PARITY',
  INDOORS_OUTDOORS: 'OUTDOORS_INDOORS', INTERIEUR_EXTERIEUR: 'OUTDOORS_INDOORS',
  ID_PIEGE: 'CATCH_ID', CATCH: 'CATCH_ID', NUMERO_PIEGE: 'CATCH_ID',
  TRANCHE_HORAIRE: 'TIME_OF_COLLECTION', HEURE: 'TIME_OF_COLLECTION',
  HEURE_DE_COLLECTE: 'TIME_OF_COLLECTION', TIME: 'TIME_OF_COLLECTION',
  COLLECTION_TIME: 'TIME_OF_COLLECTION',
  ORGANE_PRELEVE: 'ORGANISM_PART', PARTIE_PRELEVEE: 'ORGANISM_PART',
  NOMBRE: 'NUMBER', QUANTITE: 'NUMBER', EFFECTIF: 'NUMBER',
  // — Conservation —
  PRESERVATIVE: 'PRESERVATIVE_SOLUTION', SOLUTION: 'PRESERVATIVE_SOLUTION',
  SOLUTION_DE_CONSERVATION: 'PRESERVATIVE_SOLUTION', CONSERVATEUR: 'PRESERVATIVE_SOLUTION',
  CONTENANT: 'BOX_PLATE_ID', BOITE: 'BOX_PLATE_ID', PLAQUE: 'BOX_PLATE_ID', CODE_CONTAINER: 'BOX_PLATE_ID',
  WELL_POSITION: 'TUBE_OR_WELL_ID', POSITION: 'TUBE_OR_WELL_ID',
  PUITS: 'TUBE_OR_WELL_ID', POSITION_PLAQUE: 'TUBE_OR_WELL_ID',
  // — Géo —
  LATITUDE: 'DECIMAL_LATITUDE', LATITUDE_Y: 'DECIMAL_LATITUDE', LAT: 'DECIMAL_LATITUDE',
  LONGITUDE: 'DECIMAL_LONGITUDE', LONGITUDE_X: 'DECIMAL_LONGITUDE',
  LON: 'DECIMAL_LONGITUDE', LNG: 'DECIMAL_LONGITUDE',
  ALTITUDE: 'ELEVATION', ALTITUDE_M: 'ELEVATION', ALTITUDE_EN_M: 'ELEVATION',
  LOCALITE: 'COLLECTION_LOCATION', LIEU_DE_COLLECTE: 'COLLECTION_LOCATION',
  // — Divers —
  NOTES: 'REMARKS', REMARQUES: 'REMARKS', REMARQUE: 'REMARKS',
  OBSERVATIONS: 'REMARKS', COMMENTAIRE: 'REMARKS',
};

/** Résout un libellé brut vers son nom de colonne canonique. */
function canonicalHeader(raw) {
  const key = normalizeHeader(raw);
  return HEADER_ALIASES[key] ?? key;
}

/**
 * Détermine le couple (genre, espèce) à partir des sources disponibles dans le
 * fichier : colonnes structurées GENUS/SPECIES, et/ou nom scientifique complet.
 *
 * Règle retenue (arbitrage utilisateur 2026-08-26) : **GENUS/SPECIES prioritaire**
 * — les colonnes structurées ne demandent aucun parsing, donc aucune ambiguïté
 * sur les sous-genres entre parenthèses, les suffixes (sl, sp…) ou les espaces
 * multiples. SCIENTIFIC_NAME sert de repli quand GENUS est vide.
 *
 * Deux nuances :
 *  - si GENUS est rempli mais SPECIES vide, on complète l'espèce depuis
 *    SCIENTIFIC_NAME **à condition que le genre concorde** — sinon on perdrait
 *    l'information d'espèce alors qu'elle est présente dans le fichier ;
 *  - si les deux sources donnent des genres différents, on garde la colonne
 *    GENUS (prioritaire) mais on remonte `conflit` pour que l'appelant émette
 *    un avertissement plutôt que de choisir en silence.
 *
 * @returns {{ genus: string|null, species: string|null, source: 'columns'|'scientific_name'|null, conflit: object|null }}
 */
function resolveTaxonInput({ genus, species, scientificName } = {}) {
  const g = genus         ? String(genus).trim()         : null;
  const s = species       ? String(species).trim()       : null;
  const sci = scientificName ? String(scientificName).trim() : null;
  const parsed = sci ? parseScientificName(sci) : { genus: null, species: null };

  // Repli : pas de colonne GENUS → on s'appuie sur le nom scientifique.
  if (!g) {
    if (!parsed.genus) return { genus: null, species: null, source: null, conflit: null };
    return { genus: parsed.genus, species: parsed.species, source: 'scientific_name', conflit: null };
  }

  const memeGenre = parsed.genus && parsed.genus.toLowerCase() === g.toLowerCase();
  const conflit = parsed.genus && !memeGenre
    ? { genreColonne: g, genreNomScientifique: parsed.genus }
    : null;

  // Espèce : la colonne fait foi ; sinon complétion depuis le nom scientifique
  // uniquement si le genre concorde (sans quoi on mélangerait deux taxons).
  const espece = s || (memeGenre ? parsed.species : null) || null;

  return { genus: g, species: espece, source: 'columns', conflit };
}

/**
 * Construit un dictionnaire colName→colIndex depuis la ligne d'en-tête.
 * Les libellés sont normalisés (accents/ponctuation) puis passés par la table
 * d'alias, de sorte que "Nom scientifique" et "SCIENTIFIC_NAME" mènent à la
 * même clé. La première colonne gagne en cas de doublon (deux libellés
 * différents mappant sur la même cible).
 */
function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    // normalizeCellValue : un libellé d'en-tête partiellement mis en gras arrive
    // en richText, et devenait "[object Object]" — donc colonne non reconnue.
    const key = canonicalHeader(normalizeCellValue(cell.value));
    if (key && map[key] === undefined) map[key] = col;
  });
  return map;
}

/**
 * Réduit une valeur de cellule ExcelJS à une primitive exploitable.
 *
 * `cell.value` n'est PAS toujours un scalaire : ExcelJS renvoie un objet pour
 * les formules, le texte enrichi, les liens et les cellules en erreur. Sans
 * cette réduction, `String(v)` produisait la chaîne littérale "[object Object]",
 * stockée telle quelle en base — le cas le plus courant étant le texte enrichi,
 * qu'il suffit d'obtenir en mettant un mot en gras dans la cellule. Pire, sur
 * SERIES (unique), la première ligne passait et toutes les suivantes étaient
 * rejetées comme doublons.
 *
 *   { richText: [{text}, …] }        → concaténation des fragments
 *   { formula|sharedFormula, result} → le résultat mis en cache par Excel
 *   { text, hyperlink }              → le texte affiché
 *   { error: '#REF!' }               → null (pas de valeur exploitable)
 *
 * Une formule sans résultat en cache (fichier produit par une librairie qui ne
 * calcule pas) donne null : la valeur n'existe simplement nulle part dans le
 * fichier.
 */
function normalizeCellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;              // Date est un objet : à préserver
  if (typeof v !== 'object') return v;

  if (Array.isArray(v.richText)) {
    const texte = v.richText.map((f) => f?.text ?? '').join('');
    return texte === '' ? null : texte;
  }
  if ('result' in v) return normalizeCellValue(v.result);   // formule calculée
  if ('formula' in v || 'sharedFormula' in v) return null;  // formule non calculée
  if ('error' in v) return null;                            // #REF!, #N/A…
  if ('text' in v) return normalizeCellValue(v.text);       // lien hypertexte
  return null;
}

/**
 * Lit la valeur d'une cellule depuis le header map.
 * @param {object} row    ExcelJS row
 * @param {object} hMap   header map { COL_NAME: colIndex }
 * @param {...string} keys noms de colonnes à essayer dans l'ordre
 * @returns string|number|Date|null
 */
function cellValue(row, hMap, ...keys) {
  for (const k of keys) {
    const col = hMap[canonicalHeader(k)];
    if (col) {
      const v = normalizeCellValue(row.getCell(col)?.value);
      if (v !== null && v !== undefined && v !== '') return v;
    }
  }
  return null;
}

/**
 * Vrai si la colonne `name` est présente dans le header map, en appliquant la
 * même normalisation + résolution d'alias que cellValue/buildHeaderMap.
 * Centralise le test de présence d'en-tête pour que l'import et la validation
 * à sec utilisent exactement la même règle.
 */
function hasHeader(hMap, name) {
  return Boolean(hMap[canonicalHeader(name)]);
}

// Colonnes que l'import sait exploiter — sert uniquement à distinguer, dans le
// rapport de mapping, une colonne comprise d'une colonne ignorée.
// DÉRIVÉ de FIELD_COLUMNS : le rapport ne peut donc plus annoncer "reconnue"
// une colonne que le contrôleur ne lit pas, ni l'inverse.
const KNOWN_COLUMNS = new Set(Object.values(FIELD_COLUMNS).flat());

/**
 * Décrit ce que l'import a compris de la ligne d'en-tête, pour affichage en
 * tête du rapport. Permet à l'utilisateur de voir immédiatement si sa colonne
 * a été reconnue (et sous quel nom canonique) au lieu de le déduire après coup
 * d'une avalanche d'avertissements ligne par ligne.
 *
 * @returns {{ reconnues: Array<{source: string, cible: string}>, ignorees: string[] }}
 */
function buildHeaderReport(headerRow) {
  const reconnues = [];
  const ignorees  = [];
  const vues      = new Set();

  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const source = (normalizeCellValue(cell.value) ?? '').toString().trim();
    if (!source) return;
    const cible = canonicalHeader(source);
    if (!cible) return;

    if (!KNOWN_COLUMNS.has(cible)) { ignorees.push(source); return; }
    // Doublon : deux libellés mappent sur la même cible — seul le premier est lu
    // (cf. buildHeaderMap), le second est donc effectivement ignoré.
    if (vues.has(cible)) { ignorees.push(source); return; }
    vues.add(cible);
    reconnues.push({ source, cible });
  });

  return { reconnues, ignorees };
}

module.exports = {
  LIFESTAGE, SEX, COLLECTION_METHOD, PRESERVATIVE, ORGANISM_PART, BLOOD_MEAL, PARITE, INTERIEUR_EXTERIEUR,
  HEADER_ALIASES, KNOWN_COLUMNS, FIELD_COLUMNS,
  normalizeHeader, canonicalHeader, resolveTaxonInput, buildHeaderReport,
  normalizeKey, parseScientificName, parseCatchId, clePiege, buildHeaderMap, cellValue, hasHeader,
  normalizeCellValue,
};
