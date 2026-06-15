const { z } = require('zod');

const sexeEnum   = z.enum(['M', 'F', 'inconnu']).default('inconnu');
// Statut sanguin SOP : N (Non gorgé) / G (Gorgé) / Gr (Gravide) / SGr (Semi-gravide) / NC (Not collected)
const STATUT_SANGUIN = ['N', 'G', 'Gr', 'SGr', 'NC'];
const stadeStr   = z.string().max(50).optional().nullable();
const intId      = z.coerce.number().int().positive();
const optIntId   = intId.optional().nullable();
const dateStr    = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const idTerrain  = z.string().max(50).optional().nullable();
const insertMode = z.enum(['single', 'split']).default('single');

// Variantes sans .default() pour les schémas update* : sous Zod v4,
// .partial() sur un champ .default() réinjecte la valeur par défaut pour
// les clés absentes, ce qui écrase silencieusement les valeurs existantes.
const sexeEnumOpt = z.enum(['M', 'F', 'inconnu']).optional();
const nombreOpt   = z.coerce.number().int().positive().optional();

// ── Moustique ─────────────────────────────────────────────────
const createMoustique = z.object({
  methodeId:      intId,
  taxonomieId:    intId,
  idTerrain,
  nombre:         z.coerce.number().int().positive().default(1),
  sexe:           sexeEnum,
  stade:          stadeStr,
  parite:         z.enum(['Nulle', 'Paucie', 'Multi']).optional().nullable(),
  repasSang:      z.enum(STATUT_SANGUIN).default('N'),
  organePreleve:  z.string().max(100).optional().nullable(),
  solutionId:     optIntId,
  containerId:    optIntId,
  position:       z.string().max(10).optional().nullable(),
  insertMode,
  dateCollecte:   dateStr,
  notes:          z.string().max(5000).optional().nullable(),
});

const updateMoustique = createMoustique
  .omit({ methodeId: true, insertMode: true })
  .partial()
  .extend({ sexe: sexeEnumOpt, nombre: nombreOpt, repasSang: z.enum(STATUT_SANGUIN).optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

// ── Tique ─────────────────────────────────────────────────────
const createTique = z.object({
  methodeId:       intId,
  hoteId:          optIntId,
  taxonomieId:     intId,
  idTerrain,
  nombre:          z.coerce.number().int().positive().default(1),
  sexe:            sexeEnum,
  stade:           stadeStr,
  gorge:           z.enum(STATUT_SANGUIN).default('N'),
  partieCorpsHote: z.string().max(100).optional().nullable(),
  solutionId:      optIntId,
  containerId:     optIntId,
  position:        z.string().max(10).optional().nullable(),
  insertMode,
  dateCollecte:    dateStr,
  notes:           z.string().max(5000).optional().nullable(),
});

const updateTique = createTique
  .omit({ methodeId: true, insertMode: true })
  .partial()
  .extend({ sexe: sexeEnumOpt, nombre: nombreOpt, gorge: z.enum(STATUT_SANGUIN).optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

// ── Puce ──────────────────────────────────────────────────────
const createPuce = z.object({
  methodeId:    intId,
  hoteId:       optIntId,
  taxonomieId:  intId,
  idTerrain,
  nombre:       z.coerce.number().int().positive().default(1),
  sexe:         sexeEnum,
  stade:        stadeStr,
  solutionId:   optIntId,
  containerId:  optIntId,
  position:     z.string().max(10).optional().nullable(),
  insertMode,
  dateCollecte: dateStr,
  notes:        z.string().max(5000).optional().nullable(),
});

const updatePuce = createPuce
  .omit({ methodeId: true, insertMode: true })
  .partial()
  .extend({ sexe: sexeEnumOpt, nombre: nombreOpt })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = {
  createMoustique, updateMoustique, createTique, updateTique, createPuce, updatePuce,
  STATUT_SANGUIN,
};
