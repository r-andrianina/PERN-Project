const { z } = require('zod');

const intId    = z.coerce.number().int().positive();
const optInt   = z.coerce.number().int().optional().nullable();
const optFloat = z.coerce.number().optional().nullable();
const optStr   = (max = 500) => z.string().max(max).optional().nullable();
const optDate  = z.string().datetime({ offset: true }).optional().nullable();
const optBool  = z.boolean().optional().nullable();

const SPECIMEN_TYPES = ['moustique', 'tique', 'puce', 'autre'];

const TYPE_MANIPULATION = [
  'identification_morpho', 'broyage_pool', 'dessication', 'extraction',
  'amplification_pcr', 'qpcr', 'nested_pcr', 'sequencage', 'microscopie', 'autre',
];

const STATUT_RESULTATS   = ['brut', 'valide', 'invalide'];
const METHODE_EXTRACTION = ['destructive', 'non_destructive'];
const STATUT_BANDE       = ['positif', 'negatif', 'inconclusif'];
const METHODE_SEQUENCAGE = ['sanger', 'ngs_illumina', 'oxford_nanopore'];
const TYPE_BROYAGE       = ['tissuelyser', 'pilon_mortier', 'billes_verre', 'sonication', 'manuel'];
const NIVEAU_CONFIANCE   = ['certain', 'probable', 'douteux'];
const TYPE_AN            = ['adn', 'arn', 'adn_arn'];
const TYPE_EXAMEN        = ['glandes_salivaires', 'frottis_sanguin', 'estomac_moustique', 'ovaires', 'corps_entier'];
const TYPE_PCR_Q         = ['qPCR', 'RT-qPCR'];

// ── Manipulation de base ───────────────────────────────────────

// .passthrough() : POST/PUT envoient aussi les champs du module scientifique
// (PCR, qPCR, extraction...) dans le même corps de requête — buildModuleData()
// (labo.controller.js) les lit directement sur req.body. Sans passthrough,
// validate() (qui remplace req.body par le résultat parsé) les supprimerait
// silencieusement et casserait l'enregistrement des données de module.
const createManipulation = z.object({
  specimenType:     z.enum(SPECIMEN_TYPES).optional(),
  specimenId:       intId.optional(),
  poolId:           intId.optional(),
  typeManipulation: z.enum(TYPE_MANIPULATION),
  protocole:        optStr(200),
  dateDebut:        z.string().datetime({ offset: true }).optional(),
  dateFin:          optDate,
  notes:            optStr(5000),
}).passthrough().refine((d) => d.specimenId || d.poolId, { message: 'Un spécimen ou un pool est requis' });

const updateManipulation = z.object({
  protocole: optStr(200),
  dateDebut: z.string().datetime({ offset: true }).optional(),
  dateFin:   optDate,
  notes:     optStr(5000),
}).passthrough().refine((d) => Object.keys(d).some((k) => d[k] !== undefined), { message: 'Aucune modification fournie' });

// Nommé "validerManipulation" mais son champ (motifInvalidation) est utilisé
// par la route POST /:id/invalider — /:id/valider n'a pas de corps à valider.
const validerManipulation = z.object({
  motifInvalidation: optStr(1000),
});

// ── Module 1 : Identification morphologique ───────────────────

const updateIdentificationMorpho = z.object({
  cleUtilisee:      optStr(200),
  especeIdentifiee: optStr(200),
  niveauConfiance:  z.enum(NIVEAU_CONFIANCE).optional().nullable(),
  stadeConfirme:    optStr(100),
  gorgement:        optStr(100),
  pariteMethode:    optStr(200),
  pariteResultat:   optStr(100),
  partiesPrelevees: optStr(500),
  observations:     optStr(2000),
});

// ── Module 2 : Broyage / Pool ─────────────────────────────────

const updateBroyagePool = z.object({
  methodeBroyage:    z.enum(TYPE_BROYAGE).optional().nullable(),
  tamponUtilise:     optStr(200),
  volumeTamponUl:    optFloat,
  parametresBroyeur: optStr(200),
  volumeRecupereUl:  optFloat,
  aspectMacro:       optStr(200),
});

// ── Module 3 : Dessication ────────────────────────────────────

const updateDessication = z.object({
  methode:              optStr(200),
  temperatureStockage:  optStr(50),
  dureeDessicationH:    optFloat,
  quantiteSilicaGelG:   optFloat,
  dateMiseConservation: z.string().optional().nullable(),
  partieCorps:          optStr(100),
  statutTissu:          optStr(100),
  emplacementCode:      optStr(100),
});

// ── Module 4 : Extraction ADN/ARN ────────────────────────────

const updateExtraction = z.object({
  typeAcideNucleique:     z.enum(TYPE_AN).optional().nullable(),
  typeKit:                optStr(200),
  methodeExtraction:      z.enum(METHODE_EXTRACTION).optional().nullable(),
  methodeHomogeneisation: z.enum(TYPE_BROYAGE).optional().nullable(),
  quantiteTissuMg:        optFloat,
  numerotLot:             optStr(100),
  volumeElutionUl:        optFloat,
  controlExtraction:      optBool,
  concentrationAdn:       optFloat,
  pureteA260A280:         optFloat,
  pureteA260A230:         optFloat,
  volumeFinalUl:          optFloat,
  idTubeAdn:              optStr(100),
});

// ── Module 5 : PCR Standard ───────────────────────────────────

const puitsPcrRegex = /^[A-H](1[0-2]|[1-9])$/;

const updatePcr = z.object({
  pathogeneCibleId: optInt,
  geneCible:        optStr(200),
  amorceForward:    optStr(300),
  amorceReverse:    optStr(300),
  enzyme:           optStr(200),
  programmeThermo:  optStr(500),
  tailleAttenduePb: optInt,
  idPlaquePcr:      optStr(50),
  puitsPcr:         z.string().max(5).regex(puitsPcrRegex).optional().nullable(),
  temoinPositif:    optBool,
  temoinNegatif:    optBool,
  statutBandeGel:   z.enum(STATUT_BANDE).optional().nullable(),
  tailleBandePb:    optInt,
});

// ── Module 6 : qPCR / RT-qPCR ────────────────────────────────

const updateQpcr = z.object({
  pathogeneCibleId:  optInt,
  typePcr:           z.enum(TYPE_PCR_Q).optional().nullable(),
  geneCible:         optStr(200),
  amorceForward:     optStr(300),
  amorceReverse:     optStr(300),
  sondeTaqman:       optStr(300),
  geneReference:     optStr(200),
  masterMix:         optStr(200),
  volumeReactionUl:  optFloat,
  idPlaqueQpcr:      optStr(50),
  puitsQpcr:         z.string().max(5).regex(puitsPcrRegex).optional().nullable(),
  valeurCt:          optFloat,
  ctTemoinPositif:   optFloat,
  ctTemoinNegatif:   optFloat,
  ctControleInterne: optFloat,
  efficacitePct:     optFloat,
  interpretation:    z.enum(STATUT_BANDE).optional().nullable(),
  chargeVirale:      optFloat,
});

// ── Module 7 : Nested PCR ─────────────────────────────────────

const updateNestedPcr = z.object({
  pathogeneCibleId: optInt,
  geneCible:        optStr(200),
  amorceF1:         optStr(300),
  amorceR1:         optStr(300),
  tailleAttendue1:  optInt,
  statutBande1:     z.enum(STATUT_BANDE).optional().nullable(),
  amorceF2:         optStr(300),
  amorceR2:         optStr(300),
  tailleAttendue2:  optInt,
  statutBande2:     z.enum(STATUT_BANDE).optional().nullable(),
  resultatFinal:    z.enum(STATUT_BANDE).optional().nullable(),
  tailleBandeObsPb: optInt,
  idPlaque:         optStr(50),
  temoinPositif:    optBool,
  temoinNegatif:    optBool,
});

// ── Module 8 : Séquençage ─────────────────────────────────────

const updateSequencage = z.object({
  methodeSequencage:  z.enum(METHODE_SEQUENCAGE).optional().nullable(),
  prestataire:        optStr(200),
  idPlaqueTube:       optStr(100),
  amorceSequencage:   optStr(200),
  scoreQualite:       optFloat,
  sequenceConsensus:  z.string().max(100000).optional().nullable(),
  organismeBlast:     optStr(300),
  identiteBlastPct:   optFloat,
  couvertureBlastPct: optFloat,
  accessionGenbank:   optStr(50),
  resultatBlast:      z.string().max(5000).optional().nullable(),
});

// ── Module 9 : Microscopie ────────────────────────────────────

const updateMicroscopie = z.object({
  typeExamen:         z.enum(TYPE_EXAMEN).optional().nullable(),
  coloration:         optStr(200),
  grossissement:      optStr(20),
  resultat:           z.enum(STATUT_BANDE).optional().nullable(),
  stadeObserve:       optStr(300),
  densiteParasitaire: optStr(300),
  observations:       optStr(2000),
});

module.exports = {
  createManipulation, updateManipulation, validerManipulation,
  updateIdentificationMorpho, updateBroyagePool, updateDessication, updateExtraction,
  updatePcr, updateQpcr, updateNestedPcr, updateSequencage, updateMicroscopie,
  SPECIMEN_TYPES, TYPE_MANIPULATION, STATUT_RESULTATS,
  METHODE_EXTRACTION, STATUT_BANDE, METHODE_SEQUENCAGE,
  TYPE_BROYAGE, NIVEAU_CONFIANCE, TYPE_AN, TYPE_EXAMEN,
};
